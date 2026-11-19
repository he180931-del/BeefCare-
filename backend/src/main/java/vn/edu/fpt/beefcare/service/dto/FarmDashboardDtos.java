package vn.edu.fpt.beefcare.service.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class FarmDashboardDtos {
    private FarmDashboardDtos() {}
    public record DashboardRequest(LocalDate from, LocalDate to, Long penId, String herdGroup, String lifeStage) {}
    public record DashboardView(String farmName, long activeCattle, String serviceStatus, Instant generatedAt,
        Map<String,Object> indicators, List<Map<String,Object>> attention) {}
    public record ReportRequest(String reportType, LocalDate from, LocalDate to, List<Long> penIds,
        List<Long> breedIds, List<String> herdGroups, List<String> lifeStages) {}
    public record ReportView(String reportType, LocalDate from, LocalDate to, Instant generatedAt,
        Map<String,Object> summary, List<Map<String,Object>> rows, List<String> unavailableData) {}
}
