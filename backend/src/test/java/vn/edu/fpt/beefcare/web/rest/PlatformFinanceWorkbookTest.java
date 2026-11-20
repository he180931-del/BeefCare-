package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Method;
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

class PlatformFinanceWorkbookTest {
    @Test
    void workbookKeepsTwoSheetsUnicodeAndSourceVersionFromTheSnapshot() throws Exception {
        ReportCriteria criteria = new ReportCriteria(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2), null, "ALL");
        ScopeTotals total = new ScopeTotals("PLATFORM", null, "Toàn nền tảng", BigDecimal.ZERO, new BigDecimal("1000"), BigDecimal.ZERO);
        ReportSummary summary = new ReportSummary(BigDecimal.ZERO, new BigDecimal("1000"), new BigDecimal("1000"), BigDecimal.ZERO,
            new BigDecimal("1000"), List.of(total), List.of(), "Dòng tiền, không phải lợi nhuận theo luật định.");
        ReportLine line = new ReportLine("MANUAL_FINANCE", "FR-0001", "GENERAL", null, "Chung nền tảng", "INCOME", "OTHER_INCOME",
            "Thu khác tiếng Việt", new BigDecimal("1000"), LocalDate.of(2026, 11, 1), "POSTED", "SEPAY:1", 7L);
        ExportSnapshot snapshot = new ExportSnapshot(1L, criteria.dateFrom(), criteria.dateTo(), Instant.parse("2026-11-02T03:00:00Z"), criteria, summary, List.of(line));

        Method workbook = PlatformFinanceResource.class.getDeclaredMethod("workbook", ExportSnapshot.class);
        workbook.setAccessible(true);
        byte[] bytes = (byte[]) workbook.invoke(null, snapshot);
        Map<String, String> entries = unzip(bytes);

        assertThat(entries.get("xl/workbook.xml")).contains("Summary", "Details");
        assertThat(entries.get("xl/worksheets/sheet2.xml")).contains("Thu khác tiếng Việt", "Phiên bản nguồn", ">7<");
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
