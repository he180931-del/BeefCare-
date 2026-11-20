package vn.edu.fpt.beefcare.service;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;

/**
 * Purges only explicitly owned local fixture rows, following the actual database foreign keys.
 * Nullable references from other cattle are detached; the other cattle themselves are never followed.
 * This helper is reachable only from the local runtime fixture lifecycle, in its transaction.
 */
final class LocalRuntimeCattleCleanup {
    private record Edge(String child, String parent, String column, boolean nullable) {}
    private record Table(boolean hasId, Set<String> columns, Set<String> required) {}
    private record Schema(String name, Map<String, Table> tables, List<Edge> edges) {}
    private final DataSource dataSource;
    private final NamedParameterJdbcTemplate jdbc;
    private Schema cachedSchema;

    LocalRuntimeCattleCleanup(DataSource dataSource) {
        this.dataSource = dataSource;
        this.jdbc = new NamedParameterJdbcTemplate(dataSource);
    }

    /** Resolve the fixed schema once during startup so shutdown does not scan metadata again. */
    void prepare() { schema(); }

    void deleteCattle(List<Long> cattleIds) {
        if (cattleIds.isEmpty()) return;
        Schema schema = schema();
        jdbc.queryForList("select id from " + table(schema, "cattle") + " where id in (:ids) order by id for update",
            Map.of("ids", cattleIds), Long.class);
        Map<String, Set<Long>> rows = new LinkedHashMap<>();
        rows.put("cattle", new LinkedHashSet<>(cattleIds));
        Map<String, List<Long>> sharedVouchers = new LinkedHashMap<>();
        for (String line : List.of("herd_entry", "herd_exit")) {
            List<Long> candidates = jdbc.queryForList("select distinct voucher_id from " + table(schema, line)
                + " where cattle_id in (:ids)", Map.of("ids", cattleIds), Long.class);
            List<Long> exclusive = new ArrayList<>();
            List<Long> shared = new ArrayList<>();
            for (Long id : candidates) {
                Long others = jdbc.queryForObject("select count(*) from " + table(schema, line)
                    + " where voucher_id=:voucher and (cattle_id is null or cattle_id not in (:ids))",
                    Map.of("voucher", id, "ids", cattleIds), Long.class);
                if (others != null && others == 0) exclusive.add(id); else shared.add(id);
            }
            if (!exclusive.isEmpty()) rows.put(line + "_voucher", new LinkedHashSet<>(exclusive));
            sharedVouchers.put(line, shared);
        }
        collect(schema, rows);
        detachReferences(schema, rows);
        for (Edge edge : schema.edges()) {
            Set<Long> parent = rows.get(edge.parent());
            if (parent == null || parent.isEmpty() || weakReference(edge)) continue;
            Table child = schema.tables().get(edge.child());
            if (!child.hasId()) {
                jdbc.update("delete from " + table(schema, edge.child()) + " where " + quote(edge.column()) + " in (:ids)", Map.of("ids", parent));
            }
        }
        Set<String> pending = new LinkedHashSet<>(rows.keySet());
        Set<Edge> broken = new HashSet<>();
        while (!pending.isEmpty()) {
            String leaf = pending.stream().filter(parent -> schema.edges().stream().noneMatch(edge ->
                !broken.contains(edge) && !weakReference(edge) && edge.parent().equals(parent)
                    && pending.contains(edge.child()))).findFirst().orElse(null);
            if (leaf == null) {
                // Keep acyclic references intact: posted entries and payments have conditional CHECK constraints.
                Edge cycle = schema.edges().stream().filter(edge -> edge.nullable() && !weakReference(edge)
                    && !broken.contains(edge) && pending.contains(edge.child()) && pending.contains(edge.parent())
                    && reaches(schema, pending, broken, edge.parent(), edge.child(), new HashSet<>())).findFirst()
                    .orElseThrow(() -> new IllegalStateException("Cannot safely order local fixture cleanup: " + pending));
                jdbc.update("update " + table(schema, cycle.child()) + " set " + quote(cycle.column())
                    + "=null where id in (:children) and " + quote(cycle.column()) + " in (:parents)",
                    Map.of("children", rows.get(cycle.child()), "parents", rows.get(cycle.parent())));
                broken.add(cycle);
                continue;
            }
            jdbc.update("delete from " + table(schema, leaf) + " where id in (:ids)", Map.of("ids", rows.get(leaf)));
            pending.remove(leaf);
        }
        for (var vouchers : sharedVouchers.entrySet()) {
            if (vouchers.getValue().isEmpty()) continue;
            String line = vouchers.getKey();
            jdbc.update("update " + table(schema, line + "_voucher") + " v set cattle_amount=(select coalesce(sum(l.line_amount),0) from "
                + table(schema, line) + " l where l.voucher_id=v.id and l.status not in ('VOIDED','REMOVED','DISMISSED')),"
                + " version=version+1,updated_at=current_timestamp where v.id in (:ids)", Map.of("ids", vouchers.getValue()));
        }
    }

    private boolean reaches(Schema schema, Set<String> pending, Set<Edge> broken, String current, String target, Set<String> visited) {
        if (current.equals(target)) return true;
        if (!visited.add(current)) return false;
        for (Edge edge : schema.edges()) {
            if (edge.child().equals(current) && pending.contains(edge.parent()) && !weakReference(edge) && !broken.contains(edge)
                && reaches(schema, pending, broken, edge.parent(), target, visited)) return true;
        }
        return false;
    }

    private void collect(Schema schema, Map<String, Set<Long>> rows) {
        boolean changed;
        do {
            changed = false;
            for (Edge edge : schema.edges()) {
                Set<Long> parent = rows.get(edge.parent());
                if (parent == null || parent.isEmpty() || weakReference(edge) || !schema.tables().get(edge.child()).hasId()) continue;
                List<Long> children = jdbc.queryForList("select id from " + table(schema, edge.child())
                    + " where " + quote(edge.column()) + " in (:ids)", Map.of("ids", parent), Long.class);
                if (!children.isEmpty()) changed |= rows.computeIfAbsent(edge.child(), unused -> new LinkedHashSet<>()).addAll(children);
            }
            for (var source : new LinkedHashMap<>(rows).entrySet()) {
                List<String> types = sourceTypes(source.getKey());
                changed |= scalarRows(schema, rows, "audit_log", "target_type", "target_id", types, source.getValue(), false);
                changed |= scalarRows(schema, rows, "record_revision", "source_type", "source_id", types, source.getValue(), false);
                changed |= scalarRows(schema, rows, "outbox_event", "aggregate_type", "aggregate_id", types, source.getValue(), true);
            }
        } while (changed);
    }

    private boolean scalarRows(Schema schema, Map<String, Set<Long>> rows, String target, String type, String id,
        List<String> sourceTypes, Set<Long> sourceIds, boolean textId) {
        Table definition = schema.tables().get(target);
        if (definition == null || !definition.columns().containsAll(List.of(type, id))) return false;
        List<?> ids = textId ? sourceIds.stream().map(String::valueOf).toList() : new ArrayList<>(sourceIds);
        List<Long> matches = jdbc.queryForList("select id from " + table(schema, target) + " where " + quote(type)
            + " in (:types) and " + quote(id) + " in (:ids)", Map.of("types", sourceTypes, "ids", ids), Long.class);
        return !matches.isEmpty() && rows.computeIfAbsent(target, unused -> new LinkedHashSet<>()).addAll(matches);
    }

    private List<String> sourceTypes(String table) {
        StringBuilder name = new StringBuilder();
        for (String word : table.split("_")) name.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        return "growth".equals(table) ? List.of(name.toString(), "GROWTH_ASSESSMENT") : List.of(name.toString());
    }

    private void detachReferences(Schema schema, Map<String, Set<Long>> rows) {
        for (Edge edge : schema.edges()) {
            Set<Long> parent = rows.get(edge.parent());
            if (!weakReference(edge) || parent == null || parent.isEmpty()) continue;
            if (!edge.nullable()) throw new IllegalStateException("Cannot detach a required local fixture reference: " + edge);
            Table child = schema.tables().get(edge.child());
            String version = child.columns().contains("version") ? ",version=version+1" : "";
            String updated = child.columns().contains("updated_at") ? ",updated_at=current_timestamp" : "";
            jdbc.update("update " + table(schema, edge.child()) + " set " + quote(edge.column()) + "=null" + version + updated
                + " where " + quote(edge.column()) + " in (:ids)", Map.of("ids", parent));
        }
    }

    private boolean weakReference(Edge edge) {
        return "cattle".equals(edge.child()) || "cattle".equals(edge.parent()) && (
            "reproduction_event".equals(edge.child()) && "sire_id".equals(edge.column())
            || "calf_outcome".equals(edge.child()) && Set.of("assigned_dam_id", "assigned_sire_id", "registered_cattle_id").contains(edge.column()))
            || "calf_outcome".equals(edge.parent()) && "herd_entry".equals(edge.child()) && "calf_outcome_id".equals(edge.column())
            || "health_case".equals(edge.parent()) && "herd_exit_voucher".equals(edge.child()) && "source_health_case_id".equals(edge.column());
    }

    private Schema schema() {
        if (cachedSchema != null) return cachedSchema;
        Connection connection = DataSourceUtils.getConnection(dataSource);
        try {
            DatabaseMetaData metadata = connection.getMetaData();
            String name = connection.getSchema();
            if ("PostgreSQL".equals(metadata.getDatabaseProductName())) {
                cachedSchema = postgresSchema(connection, name);
                return cachedSchema;
            }
            Map<String, Table> tables = new LinkedHashMap<>();
            List<Edge> edges = new ArrayList<>();
            Deque<String> pending = new ArrayDeque<>(List.of("cattle", "herd_entry_voucher", "herd_exit_voucher", "audit_log", "record_revision", "outbox_event"));
            Set<String> visited = new HashSet<>();
            while (!pending.isEmpty()) {
                String parent = pending.removeFirst();
                if (!visited.add(parent)) continue;
                if (!tables.containsKey(parent)) tables.put(parent, describe(connection, metadata, name, parent));
                try (var keys = metadata.getExportedKeys(connection.getCatalog(), name, parent)) {
                    while (keys.next()) {
                        if (!"id".equals(keys.getString("PKCOLUMN_NAME"))) continue;
                        if (!name.equals(keys.getString("FKTABLE_SCHEM"))) {
                            throw new IllegalStateException("A local fixture has cross-schema references; refusing cleanup");
                        }
                        String child = keys.getString("FKTABLE_NAME");
                        if (!tables.containsKey(child)) tables.put(child, describe(connection, metadata, name, child));
                        String column = keys.getString("FKCOLUMN_NAME");
                        edges.add(new Edge(child, parent, column, !tables.get(child).required().contains(column)));
                        pending.addLast(child);
                    }
                }
            }
            cachedSchema = new Schema(name, tables, List.copyOf(new LinkedHashSet<>(edges)));
            return cachedSchema;
        } catch (SQLException failure) {
            throw new IllegalStateException("Could not read local fixture foreign keys", failure);
        } finally {
            DataSourceUtils.releaseConnection(connection, dataSource);
        }
    }

    /** PostgreSQL's JDBC metadata makes a round trip per table; read its catalog in two queries instead. */
    private Schema postgresSchema(Connection connection, String name) throws SQLException {
        Map<String, Set<String>> columns = new LinkedHashMap<>();
        Map<String, Set<String>> required = new LinkedHashMap<>();
        try (var query = connection.prepareStatement("""
            select t.relname, a.attname, a.attnotnull
            from pg_catalog.pg_class t
            join pg_catalog.pg_namespace n on n.oid=t.relnamespace
            join pg_catalog.pg_attribute a on a.attrelid=t.oid
            where n.nspname=? and t.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
            """)) {
            query.setString(1, name);
            try (var fields = query.executeQuery()) {
                while (fields.next()) {
                    String table = fields.getString(1);
                    String column = fields.getString(2);
                    columns.computeIfAbsent(table, unused -> new HashSet<>()).add(column);
                    Set<String> mandatory = required.computeIfAbsent(table, unused -> new HashSet<>());
                    if (fields.getBoolean(3)) mandatory.add(column);
                }
            }
        }
        Map<String, Table> tables = new LinkedHashMap<>();
        columns.forEach((table, fields) -> tables.put(table, new Table(fields.contains("id"), fields, required.get(table))));
        List<Edge> edges = new ArrayList<>();
        try (var query = connection.prepareStatement("""
            select child.relname, parent.relname, ca.attname, ca.attnotnull, cn.nspname
            from pg_catalog.pg_constraint fk
            join pg_catalog.pg_class parent on parent.oid=fk.confrelid
            join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace
            join pg_catalog.pg_class child on child.oid=fk.conrelid
            join pg_catalog.pg_namespace cn on cn.oid=child.relnamespace
            cross join lateral unnest(fk.conkey, fk.confkey) as cols(child_no, parent_no)
            join pg_catalog.pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=cols.parent_no
            join pg_catalog.pg_attribute ca on ca.attrelid=child.oid and ca.attnum=cols.child_no
            where fk.contype='f' and pn.nspname=? and pa.attname='id'
            """)) {
            query.setString(1, name);
            try (var keys = query.executeQuery()) {
                while (keys.next()) {
                    if (!name.equals(keys.getString(5))) {
                        throw new IllegalStateException("A local fixture has cross-schema references; refusing cleanup");
                    }
                    edges.add(new Edge(keys.getString(1), keys.getString(2), keys.getString(3), !keys.getBoolean(4)));
                }
            }
        }
        return new Schema(name, tables, List.copyOf(new LinkedHashSet<>(edges)));
    }

    private Table describe(Connection connection, DatabaseMetaData metadata, String schema, String table) throws SQLException {
        Set<String> columns = new HashSet<>();
        Set<String> required = new HashSet<>();
        try (var fields = metadata.getColumns(connection.getCatalog(), schema, table, "%")) {
            while (fields.next()) {
                String column = fields.getString("COLUMN_NAME"); columns.add(column);
                if (fields.getInt("NULLABLE") == DatabaseMetaData.columnNoNulls) required.add(column);
            }
        }
        return new Table(columns.contains("id"), columns, required);
    }

    private String table(Schema schema, String table) { return quote(schema.name()) + "." + quote(table); }
    private String quote(String name) { return "\"" + name.replace("\"", "\"\"") + "\""; }
}
