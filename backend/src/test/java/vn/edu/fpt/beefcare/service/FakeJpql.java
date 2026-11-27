package vn.edu.fpt.beefcare.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * Test double for the JPQL queries of an {@link EntityManager} mock: each query is routed by a fragment of its text to
 * a function that computes the rows from the bound parameters, so a unit test can keep its records in memory without a
 * database. An unrouted query fails the test, which keeps the stubs honest when the service changes.
 */
final class FakeJpql {

    private record Route(String fragment, BiFunction<String, Map<String, Object>, List<?>> rows) {}

    private final List<Route> routes = new ArrayList<>();
    private final List<String> executed = new ArrayList<>();
    private final List<Map<String, Object>> bound = new ArrayList<>();

    @SuppressWarnings({ "unchecked", "rawtypes" })
    FakeJpql(EntityManager em) {
        when(em.createQuery(anyString(), any(Class.class))).thenAnswer(inv -> query(inv.getArgument(0)));
        when(em.createQuery(anyString())).thenAnswer(inv -> query(inv.getArgument(0)));
        when(em.createNativeQuery(anyString())).thenAnswer(inv -> query(inv.getArgument(0)));
        when(em.createNativeQuery(anyString(), any(Class.class))).thenAnswer(inv -> query(inv.getArgument(0)));
    }

    /** Routes every query whose text contains {@code fragment}; the first matching route wins. */
    FakeJpql on(String fragment, Function<Map<String, Object>, List<?>> rows) {
        routes.add(new Route(fragment, (jpql, params) -> rows.apply(params)));
        return this;
    }

    /** Like {@link #on(String, Function)}, for a route whose rows also depend on the query text (e.g. max / min variants). */
    FakeJpql onText(String fragment, BiFunction<String, Map<String, Object>, List<?>> rows) {
        routes.add(new Route(fragment, rows));
        return this;
    }

    /** Texts of the queries the service ran, in order. */
    List<String> executed() {
        return executed;
    }

    /** Parameters bound to the last executed query whose text contains {@code fragment}. */
    Map<String, Object> lastParams(String fragment) {
        for (int i = executed.size() - 1; i >= 0; i--) {
            if (executed.get(i).contains(fragment)) {
                return bound.get(i);
            }
        }
        throw new AssertionError("No query containing: " + fragment);
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    private TypedQuery<?> query(String jpql) {
        Route route = routes.stream().filter(r -> jpql.contains(r.fragment())).findFirst()
            .orElseThrow(() -> new AssertionError("Unexpected query: " + jpql));
        executed.add(jpql);
        Map<String, Object> params = new HashMap<>();
        bound.add(params);
        int[] max = { Integer.MAX_VALUE };
        TypedQuery q = mock(TypedQuery.class, RETURNS_SELF);
        when(q.setParameter(anyString(), any())).thenAnswer(inv -> {
            params.put(inv.getArgument(0), inv.getArgument(1));
            return q;
        });
        when(q.setMaxResults(anyInt())).thenAnswer(inv -> {
            max[0] = inv.getArgument(0);
            return q;
        });
        when(q.getResultList()).thenAnswer(inv -> limit(route.rows().apply(jpql, params), max[0]));
        when(q.getResultStream()).thenAnswer(inv -> limit(route.rows().apply(jpql, params), max[0]).stream());
        when(q.getSingleResult()).thenAnswer(inv -> {
            List<?> rows = route.rows().apply(jpql, params);
            if (rows.isEmpty()) {
                throw new NoResultException(jpql);
            }
            return rows.get(0);
        });
        when(q.executeUpdate()).thenAnswer(inv -> route.rows().apply(jpql, params).size());
        return q;
    }

    private static List<?> limit(List<?> rows, int max) {
        return rows.size() <= max ? rows : rows.subList(0, max);
    }
}
