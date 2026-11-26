package vn.edu.fpt.beefcare.web.rest;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.ExportSnapshot;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.ReportLine;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.ReportSummary;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.ScopeTotals;

/**
 * UC-FE21-09: builds the cash report XLSX from an immutable snapshot.
 * Layout mirrors the FE preview ({@code buildWorkbookPreview}): Tổng hợp, Theo trại, Thu, Chi.
 */
final class PlatformFinanceWorkbook {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    private static final String RECEIPT = "SUBSCRIPTION_RECEIPT";
    private static final String INCOME = "INCOME";

    private static final Map<String, String> CATEGORY = Map.ofEntries(
        Map.entry("SUBSCRIPTION", "Gói đăng ký"),
        Map.entry("IMPLEMENTATION_SUPPORT", "Phí hỗ trợ triển khai"),
        Map.entry("USER_TRAINING", "Phí hướng dẫn sử dụng"),
        Map.entry("COST_REIMBURSEMENT", "Hoàn lại chi phí"),
        Map.entry("OTHER_INCOME", "Thu khác"),
        Map.entry("SERVER_STORAGE", "Máy chủ và lưu trữ"),
        Map.entry("DOMAIN_SOFTWARE", "Tên miền và phần mềm"),
        Map.entry("EMAIL_NOTIFICATIONS", "Email và thông báo"),
        Map.entry("OTHER_EXPENSE", "Chi khác")
    );
    private static final Map<String, String> SOURCE = Map.of(
        "ALL", "Biên nhận + thủ công", "BOTH", "Biên nhận + thủ công",
        "RECEIPTS_ONLY", "Chỉ biên nhận gói", "RECEIPTS", "Chỉ biên nhận gói",
        "MANUAL_ONLY", "Chỉ khoản thủ công", "MANUAL", "Chỉ khoản thủ công"
    );
    private static final Map<String, String> STATUS = Map.of("PAID", "Đã thanh toán", "POSTED", "Đã ghi sổ", "VOID", "Đã hủy bỏ");

    /** Cell styles, index into {@code cellXfs} of styles.xml. */
    private enum Style { TEXT, TITLE, HEAD, MONEY, TOTAL_TEXT, TOTAL_MONEY }
    private record Cell(Object value, Style style) {}
    private record Sheet(String name, int[] widths, List<List<Cell>> rows) {}

    private PlatformFinanceWorkbook() {}

    static byte[] build(ExportSnapshot snapshot) throws IOException {
        List<Sheet> sheets = List.of(summary(snapshot), farms(snapshot.summary()), flow(snapshot.lines(), INCOME, "Thu"), flow(snapshot.lines(), "EXPENSE", "Chi"));
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            StringBuilder overrides = new StringBuilder();
            StringBuilder sheetList = new StringBuilder();
            StringBuilder rels = new StringBuilder();
            for (int i = 1; i <= sheets.size(); i++) {
                overrides.append("<Override PartName=\"/xl/worksheets/sheet").append(i).append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
                sheetList.append("<sheet name=\"").append(escape(sheets.get(i - 1).name())).append("\" sheetId=\"").append(i).append("\" r:id=\"rId").append(i).append("\"/>");
                rels.append("<Relationship Id=\"rId").append(i).append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet").append(i).append(".xml\"/>");
            }
            int stylesId = sheets.size() + 1;
            rels.append("<Relationship Id=\"rId").append(stylesId).append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
            entry(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" + overrides + "</Types>");
            entry(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            entry(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>" + sheetList + "</sheets></workbook>");
            entry(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" + rels + "</Relationships>");
            entry(zip, "xl/styles.xml", STYLES);
            for (int i = 0; i < sheets.size(); i++) entry(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(sheets.get(i)));
        }
        return bytes.toByteArray();
    }

    // ---- Sheet 1: Tổng hợp -------------------------------------------------------------------

    private static Sheet summary(ExportSnapshot snapshot) {
        ReportSummary s = snapshot.summary();
        List<ReportLine> lines = Objects.requireNonNullElse(snapshot.lines(), List.of());
        List<ReportLine> ins = lines.stream().filter(PlatformFinanceWorkbook::isIncome).toList();
        List<ReportLine> outs = lines.stream().filter(l -> !isIncome(l)).toList();
        BigDecimal totalIncome = nz(s.totalIncome());
        BigDecimal totalExpense = nz(s.totalExpense());

        List<List<Cell>> rows = new ArrayList<>();
        rows.add(List.of(new Cell("Báo cáo dòng tiền nền tảng BeefCare", Style.TITLE)));
        rows.add(text("Kỳ báo cáo", DMY.format(snapshot.dateFrom()) + " – " + DMY.format(snapshot.dateTo())));
        rows.add(text("Trang trại / Nguồn", farmLabel(snapshot) + " · " + SOURCE.getOrDefault(snapshot.criteria().sourceFilter(), String.valueOf(snapshot.criteria().sourceFilter()))));
        rows.add(text("Bản chốt", "SNAP-" + snapshot.id() + " · " + STAMP.format(snapshot.asOf().atZone(BUSINESS_ZONE))));
        rows.add(text("Đơn vị", "VND · giờ Việt Nam"));
        rows.add(List.of());

        rows.add(head("Kết quả chính", "Số tiền"));
        rows.add(total("Tổng thu", totalIncome));
        rows.add(money("  Thu từ gói đăng ký", nz(s.subscriptionReceipts())));
        rows.add(money("  Thu khác", nz(s.otherIncome())));
        rows.add(total("Tổng chi", totalExpense));
        rows.add(total("Dòng tiền ròng", nz(s.netCashFlow())));
        rows.add(text("Tỷ lệ chi / thu", percent(totalExpense, totalIncome)));
        rows.add(List.of());

        rows.add(head("Theo tháng", "Thu", "Chi", "Ròng", "Ròng lũy kế"));
        BigDecimal running = BigDecimal.ZERO;
        for (YearMonth m = YearMonth.from(snapshot.dateFrom()); !m.isAfter(YearMonth.from(snapshot.dateTo())); m = m.plusMonths(1)) {
            YearMonth month = m;
            BigDecimal in = sum(ins.stream().filter(l -> YearMonth.from(l.cashDate()).equals(month)).toList());
            BigDecimal out = sum(outs.stream().filter(l -> YearMonth.from(l.cashDate()).equals(month)).toList());
            running = running.add(in).subtract(out);
            rows.add(List.of(new Cell("Tháng " + String.format("%02d/%d", month.getMonthValue(), month.getYear()), Style.TEXT),
                new Cell(in, Style.MONEY), new Cell(out, Style.MONEY), new Cell(in.subtract(out), Style.MONEY), new Cell(running, Style.MONEY)));
        }
        rows.add(List.of());

        rows.add(head("Theo danh mục", "Số tiền", "Tỷ trọng"));
        rows.add(total("Thu", totalIncome));
        for (Map.Entry<String, BigDecimal> e : ranked(ins, l -> category(l.category()))) rows.add(share("  " + e.getKey(), e.getValue(), totalIncome));
        rows.add(total("Chi", totalExpense));
        for (Map.Entry<String, BigDecimal> e : ranked(outs, l -> category(l.category()))) rows.add(share("  " + e.getKey(), e.getValue(), totalExpense));
        rows.add(List.of());

        rows.add(head("Điểm nổi bật", "Giá trị"));
        rows.add(text("Số giao dịch thu", String.valueOf(ins.size())));
        rows.add(text("Số giao dịch chi", String.valueOf(outs.size())));
        rows.add(text("Trại thu nhiều nhất", top(ranked(ins, PlatformFinanceWorkbook::farmOf))));
        rows.add(text("Danh mục chi lớn nhất", top(ranked(outs, l -> category(l.category())))));
        return new Sheet("Tổng hợp", new int[] { 28, 34, 16, 16, 16 }, rows);
    }

    // ---- Sheet 2: Theo trại ------------------------------------------------------------------

    private static Sheet farms(ReportSummary s) {
        List<List<Cell>> rows = new ArrayList<>();
        rows.add(head("Trại", "Thu từ gói đăng ký", "Thu khác", "Tổng thu", "Chi", "Ròng"));
        for (ScopeTotals x : Objects.requireNonNullElse(s.scopes(), List.<ScopeTotals>of())) {
            BigDecimal sub = nz(x.subscriptionReceipts()), other = nz(x.otherIncome()), expense = nz(x.expense());
            boolean total = "PLATFORM".equals(x.scope());
            Style text = total ? Style.TOTAL_TEXT : Style.TEXT, money = total ? Style.TOTAL_MONEY : Style.MONEY;
            rows.add(List.of(new Cell(Objects.requireNonNullElse(x.farmName(), ""), text), new Cell(sub, money), new Cell(other, money),
                new Cell(sub.add(other), money), new Cell(expense, money), new Cell(sub.add(other).subtract(expense), money)));
        }
        return new Sheet("Theo trại", new int[] { 32, 20, 16, 16, 16, 16 }, rows);
    }

    // ---- Sheet 3/4: Thu, Chi -----------------------------------------------------------------

    private static Sheet flow(List<ReportLine> all, String direction, String name) {
        List<ReportLine> lines = Objects.requireNonNullElse(all, List.<ReportLine>of()).stream()
            .filter(l -> INCOME.equals(direction) == isIncome(l))
            .sorted(Comparator.comparing(ReportLine::cashDate).thenComparing(ReportLine::code, Comparator.nullsLast(String::compareTo)))
            .toList();
        List<List<Cell>> rows = new ArrayList<>();
        rows.add(head("Ngày", "Mã", "Loại nguồn", "Danh mục", "Trại", "Số tiền (VND)", "Trạng thái", "Nguồn", "Phiên bản nguồn"));
        for (ReportLine l : lines) {
            rows.add(List.of(
                new Cell(DMY.format(l.cashDate()), Style.TEXT),
                new Cell(nzs(l.code()), Style.TEXT),
                new Cell(RECEIPT.equals(l.sourceType()) ? "Biên nhận gói" : "Khoản thu chi", Style.TEXT),
                new Cell(category(l.category()), Style.TEXT),
                new Cell(farmOf(l), Style.TEXT),
                new Cell(nz(l.amount()), Style.MONEY),
                new Cell(STATUS.getOrDefault(l.status(), nzs(l.status())), Style.TEXT),
                new Cell(nzs(l.sourceReference()), Style.TEXT),
                new Cell(l.sourceVersion() == null ? "" : "v" + l.sourceVersion(), Style.TEXT)));
        }
        List<Cell> total = new ArrayList<>(List.of(new Cell("Tổng (" + lines.size() + " giao dịch)", Style.TOTAL_TEXT)));
        for (int i = 0; i < 4; i++) total.add(new Cell("", Style.TOTAL_TEXT));
        total.add(new Cell(sum(lines), Style.TOTAL_MONEY));
        rows.add(total);
        return new Sheet(name, new int[] { 12, 16, 16, 24, 28, 16, 16, 22, 14 }, rows);
    }

    // ---- helpers -----------------------------------------------------------------------------

    private static boolean isIncome(ReportLine l) { return INCOME.equals(l.direction()) || "IN".equals(l.direction()); }
    private static String farmOf(ReportLine l) { return "GENERAL".equals(l.scope()) ? "Chung nền tảng" : nzs(l.farmName()); }
    private static String category(String code) { return code == null ? "" : CATEGORY.getOrDefault(code, code); }
    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private static String nzs(String v) { return v == null ? "" : v; }
    private static BigDecimal sum(List<ReportLine> lines) { return lines.stream().map(l -> nz(l.amount())).reduce(BigDecimal.ZERO, BigDecimal::add); }

    private static String farmLabel(ExportSnapshot snapshot) {
        Long farmId = snapshot.criteria().farmId();
        if (farmId == null) return "Tất cả trại";
        return Objects.requireNonNullElse(snapshot.summary().scopes(), List.<ScopeTotals>of()).stream()
            .filter(x -> farmId.equals(x.farmId()) && x.farmName() != null).map(ScopeTotals::farmName).findFirst().orElse("Trại #" + farmId);
    }

    private static List<Map.Entry<String, BigDecimal>> ranked(List<ReportLine> lines, Function<ReportLine, String> key) {
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        for (ReportLine l : lines) totals.merge(key.apply(l), nz(l.amount()), BigDecimal::add);
        return totals.entrySet().stream().sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()).toList();
    }

    private static String top(List<Map.Entry<String, BigDecimal>> ranked) {
        if (ranked.isEmpty()) return "—";
        Map.Entry<String, BigDecimal> first = ranked.get(0);
        return first.getKey() + " · " + String.format("%,d", first.getValue().longValue()).replace(',', '.') + " đ";
    }

    private static String percent(BigDecimal part, BigDecimal whole) {
        if (whole.signum() <= 0) return "—";
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 0, RoundingMode.HALF_UP) + "%";
    }

    private static List<Cell> text(String label, String value) { return List.of(new Cell(label, Style.TEXT), new Cell(value, Style.TEXT)); }
    private static List<Cell> money(String label, BigDecimal value) { return List.of(new Cell(label, Style.TEXT), new Cell(value, Style.MONEY)); }
    private static List<Cell> total(String label, BigDecimal value) { return List.of(new Cell(label, Style.TOTAL_TEXT), new Cell(value, Style.TOTAL_MONEY)); }
    private static List<Cell> share(String label, BigDecimal value, BigDecimal whole) {
        return List.of(new Cell(label, Style.TEXT), new Cell(value, Style.MONEY), new Cell(percent(value, whole), Style.TEXT));
    }
    private static List<Cell> head(String... labels) {
        List<Cell> cells = new ArrayList<>();
        for (String label : labels) cells.add(new Cell(label, Style.HEAD));
        return cells;
    }

    private static String sheetXml(Sheet sheet) {
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><cols>");
        for (int c = 0; c < sheet.widths().length; c++) xml.append("<col min=\"").append(c + 1).append("\" max=\"").append(c + 1).append("\" width=\"").append(sheet.widths()[c]).append("\" customWidth=\"1\"/>");
        xml.append("</cols><sheetData>");
        for (int r = 0; r < sheet.rows().size(); r++) {
            List<Cell> row = sheet.rows().get(r);
            xml.append("<row r=\"").append(r + 1).append("\">");
            for (int c = 0; c < row.size(); c++) {
                Cell cell = row.get(c);
                String ref = column(c + 1) + (r + 1);
                int s = cell.style().ordinal();
                if (cell.value() instanceof BigDecimal number) {
                    xml.append("<c r=\"").append(ref).append("\" s=\"").append(s).append("\"><v>").append(number.stripTrailingZeros().toPlainString()).append("</v></c>");
                } else {
                    xml.append("<c r=\"").append(ref).append("\" s=\"").append(s).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                        .append(escape(String.valueOf(cell.value()))).append("</t></is></c>");
                }
            }
            xml.append("</row>");
        }
        return xml.append("</sheetData></worksheet>").toString();
    }

    /** cellXfs order must match {@link Style}: TEXT, TITLE, HEAD, MONEY, TOTAL_TEXT, TOTAL_MONEY. */
    private static final String STYLES = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
        + "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">"
        + "<numFmts count=\"1\"><numFmt numFmtId=\"164\" formatCode=\"#,##0;[Red]-#,##0\"/></numFmts>"
        + "<fonts count=\"3\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"14\"/><name val=\"Calibri\"/></font></fonts>"
        + "<fills count=\"4\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>"
        + "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFDCEBE1\"/><bgColor indexed=\"64\"/></patternFill></fill>"
        + "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFF1F6F2\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>"
        + "<borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border>"
        + "<border><left style=\"thin\"><color rgb=\"FFC8D1CB\"/></left><right style=\"thin\"><color rgb=\"FFC8D1CB\"/></right><top style=\"thin\"><color rgb=\"FFC8D1CB\"/></top><bottom style=\"thin\"><color rgb=\"FFC8D1CB\"/></bottom><diagonal/></border></borders>"
        + "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>"
        + "<cellXfs count=\"6\">"
        + "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>"
        + "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>"
        + "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"/>"
        + "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>"
        + "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"3\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>"
        + "<xf numFmtId=\"164\" fontId=\"1\" fillId=\"3\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\" applyFont=\"1\" applyFill=\"1\"/>"
        + "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";

    private static String column(int index) {
        StringBuilder value = new StringBuilder();
        while (index > 0) { int rem = (index - 1) % 26; value.insert(0, (char) ('A' + rem)); index = (index - 1) / 26; }
        return value.toString();
    }

    private static String escape(String s) {
        StringBuilder out = new StringBuilder();
        s.codePoints().filter(cp -> cp == 0x9 || cp == 0xA || cp == 0xD || cp >= 0x20 && cp <= 0xD7FF || cp >= 0xE000 && cp <= 0xFFFD || cp >= 0x10000 && cp <= 0x10FFFF)
            .forEach(cp -> {
                switch (cp) {
                    case '&' -> out.append("&amp;");
                    case '<' -> out.append("&lt;");
                    case '>' -> out.append("&gt;");
                    case '"' -> out.append("&quot;");
                    case '\'' -> out.append("&apos;");
                    default -> out.appendCodePoint(cp);
                }
            });
        return out.toString();
    }

    private static void entry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
