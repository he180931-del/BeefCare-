package vn.edu.fpt.beefcare.service.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class FarmDashboardDtos {
    private FarmDashboardDtos() {}
    public record DashboardRequest(LocalDate from, LocalDate to, Long penId, String herdGroup, String lifeStage) {}
    public record DashboardView(String farmName, long activeCattle, String serviceStatus, Instant generatedAt,
        Map<String,Object> indicators, List<Map<String,Object>> attention) {}
    @Schema(name = "FarmManagementReportRequest")
    public record ReportRequest(String reportType, LocalDate from, LocalDate to, List<Long> penIds,
        List<Long> breedIds, List<String> herdGroups, List<String> lifeStages) {}
    public record ReportTotalRow(String label, Map<String, Object> cells) {}
    public record ReportChartBar(String label, BigDecimal value, long numerator, long denominator) {}
    public record ReportChart(String title, String sub, List<ReportChartBar> bars) {}
    public record ReportSection(String key, String title, String rowHeading, List<Map<String, Object>> rows, ReportTotalRow totalRow) {}
    public record ReportMetricChartBar(String label, BigDecimal value, Long sampleSize, Long numerator, Long denominator) {}
    public record ReportMetricChart(String title, String sub, String unit, List<ReportMetricChartBar> bars) {}
    public record ReportView(String reportType, LocalDate from, LocalDate to, Instant generatedAt,
        Map<String,Object> summary, List<Map<String,Object>> rows, ReportTotalRow totalRow,
        ReportChart chart, List<String> unavailableData, List<ReportSection> sections, List<ReportMetricChart> charts) {}
}
