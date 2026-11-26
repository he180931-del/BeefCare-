package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.*;

/** UC-FE21-09: the exported file follows the 4-sheet layout shown in the FE preview. */
class PlatformFinanceWorkbookTest {

    private static final ReportCriteria CRITERIA = new ReportCriteria(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 26), null, "ALL");

    private static ExportSnapshot snapshot(List<ReportLine> lines, ReportSummary summary) {
        return new ExportSnapshot(12L, CRITERIA.dateFrom(), CRITERIA.dateTo(), Instant.parse("2026-11-26T06:46:00Z"), CRITERIA, summary, lines);
    }

    private static ExportSnapshot sample() {
        ReportLine receipt = new ReportLine("SUBSCRIPTION_RECEIPT", "RC-26-0001", "FARM", 5L, "Trại B", "INCOME", "SUBSCRIPTION",
            "Gói 1 năm", new BigDecimal("1000000"), LocalDate.of(2026, 10, 3), "PAID", "SEPAY:9", 2L);
        ReportLine other = new ReportLine("MANUAL_FINANCE", "FR-0002", "FARM", 6L, "Trại A", "INCOME", "OTHER_INCOME",
            "Thu khác", new BigDecimal("200000"), LocalDate.of(2026, 11, 2), "POSTED", "REF<1>&2", 7L);
        ReportLine expense = new ReportLine("MANUAL_FINANCE", "FR-0003", "GENERAL", null, "Chung nền tảng", "EXPENSE", "SERVER_STORAGE",
            null, new BigDecimal("300000"), LocalDate.of(2026, 11, 10), "POSTED", null, 1L);
        List<ScopeTotals> scopes = List.of(
            new ScopeTotals("FARM", 5L, "Trại B", new BigDecimal("1000000"), BigDecimal.ZERO, BigDecimal.ZERO),
            new ScopeTotals("FARM", 6L, "Trại A", BigDecimal.ZERO, new BigDecimal("200000"), BigDecimal.ZERO),
            new ScopeTotals("GENERAL", null, "Chung nền tảng", BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("300000")),
            new ScopeTotals("PLATFORM", null, "Toàn nền tảng", new BigDecimal("1000000"), new BigDecimal("200000"), new BigDecimal("300000")));
        ReportSummary summary = new ReportSummary(new BigDecimal("1000000"), new BigDecimal("200000"), new BigDecimal("1200000"),
            new BigDecimal("300000"), new BigDecimal("900000"), scopes, List.of(), "Dòng tiền, không phải lợi nhuận theo luật định.");
        return snapshot(List.of(receipt, other, expense), summary);
    }

    @Test
    void workbookHasFourVietnameseSheetsInPreviewOrder() throws Exception {
        Map<String, String> entries = unzip(PlatformFinanceWorkbook.build(sample()));

        assertThat(entries.get("xl/workbook.xml"))
            .containsSubsequence("name=\"Tổng hợp\"", "name=\"Theo trại\"", "name=\"Thu\"", "name=\"Chi\"");
        assertThat(entries).containsKeys("xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet4.xml");
    }

    @Test
    void summarySheetHasInfoKeyResultsMonthsCategoriesAndHighlights() throws Exception {
        String summary = unzip(PlatformFinanceWorkbook.build(sample())).get("xl/worksheets/sheet1.xml");

        assertThat(summary).containsSubsequence(
            "Báo cáo dòng tiền nền tảng BeefCare",
            "Kỳ báo cáo", "01/10/2026 – 26/11/2026",
            "Trang trại / Nguồn", "Tất cả trại · Biên nhận + thủ công",
            "Bản chốt", "SNAP-12 · 13:46 26/11/2026",
            "Kết quả chính", "Tổng thu", ">1200000<", "Thu từ gói đăng ký", "Thu khác", "Tổng chi", ">300000<", "Dòng tiền ròng", ">900000<",
            "Tỷ lệ chi / thu", "25%",
            "Theo tháng", "Tháng 10/2026", "Tháng 11/2026",
            "Theo danh mục", "Gói đăng ký", "Máy chủ và lưu trữ",
            "Điểm nổi bật", "Số giao dịch thu", "Trại thu nhiều nhất", "Trại B", "Danh mục chi lớn nhất");
        assertThat(summary).doesNotContain("Ghi chú", "Theo trại");
        // Tháng 11: thu 200.000, chi 300.000, ròng −100.000, lũy kế 900.000
        assertThat(summary).containsSubsequence("Tháng 11/2026", ">200000<", ">300000<", ">-100000<", ">900000<");
    }

    @Test
    void farmSheetListsEachScopeWithTotalRow() throws Exception {
        String farms = unzip(PlatformFinanceWorkbook.build(sample())).get("xl/worksheets/sheet2.xml");

        assertThat(farms).containsSubsequence("Trại", "Thu từ gói đăng ký", "Thu khác", "Tổng thu", "Chi", "Ròng",
            "Trại B", "Trại A", "Chung nền tảng", "Toàn nền tảng", ">1200000<", ">300000<", ">900000<");
    }

    @Test
    void incomeAndExpenseSheetsSplitLinesAndTranslateCodes() throws Exception {
        Map<String, String> entries = unzip(PlatformFinanceWorkbook.build(sample()));
        String income = entries.get("xl/worksheets/sheet3.xml");
        String expense = entries.get("xl/worksheets/sheet4.xml");

        assertThat(income).containsSubsequence("Ngày", "Mã", "Loại nguồn", "Danh mục", "Trại", "Số tiền (VND)", "Trạng thái", "Nguồn", "Phiên bản nguồn",
            "03/10/2026", "RC-26-0001", "Biên nhận gói", "Gói đăng ký", "Trại B", ">1000000<", "Đã thanh toán", "SEPAY:9", "v2",
            "FR-0002", "Khoản thu chi", "Thu khác", "Đã ghi sổ", "Tổng (2 giao dịch)", ">1200000<");
        assertThat(income).doesNotContain("FR-0003");
        assertThat(expense).containsSubsequence("FR-0003", "Máy chủ và lưu trữ", "Chung nền tảng", ">300000<", "Tổng (1 giao dịch)");
        assertThat(expense).doesNotContain("RC-26-0001");
    }

    @Test
    void emptySnapshotStillHasHeadersAndZeroTotals() throws Exception {
        ScopeTotals total = new ScopeTotals("PLATFORM", null, "Toàn nền tảng", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        ReportSummary empty = new ReportSummary(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
            List.of(total), List.of(), "");
        Map<String, String> entries = unzip(PlatformFinanceWorkbook.build(snapshot(List.of(), empty)));

        assertThat(entries.get("xl/worksheets/sheet1.xml")).contains("Tổng thu", "Tỷ lệ chi / thu", "—");
        assertThat(entries.get("xl/worksheets/sheet3.xml")).contains("Số tiền (VND)", "Tổng (0 giao dịch)");
        assertThat(entries.get("xl/worksheets/sheet4.xml")).contains("Tổng (0 giao dịch)");
    }

    @Test
    void textIsEscapedAndNumbersStayNumeric() throws Exception {
        String income = unzip(PlatformFinanceWorkbook.build(sample())).get("xl/worksheets/sheet3.xml");

        assertThat(income).contains("REF&lt;1&gt;&amp;2").doesNotContain("REF<1>");
        assertThat(income).contains("<v>1000000</v>");
    }

    private static Map<String, String> unzip(byte[] bytes) throws Exception {
        Map<String, String> entries = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
        }
        return entries;
    }
}
