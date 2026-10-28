package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Transport objects for the Manager-only care commands. */
public final class CareDtos {
    private CareDtos() {}

    public record OpenHealthCase(Long cattleId, Long existingCaseId, Integer expectedVersion, Instant observedAt, Long observerId, BigDecimal temperatureC,
                                 String signs, String diagnosis, Boolean suspectedContagious, String severity) {}
    public record FollowUp(Integer expectedVersion, Instant observedAt, BigDecimal temperatureC, String progress, String description) {}
    public record CaseStatus(Integer expectedVersion, String action, String outcome, LocalDate closingDate, String reason) {}
    public record CorrectClosure(Integer expectedVersion, String outcome, LocalDate closingDate, String reason) {}
    public record TreatmentCommand(Long medicineId, Instant treatmentTime, String treatmentDetail, String dose, String route,
                                   Integer courseDays, Integer withdrawalDays, String performer, String veterinaryAdvice) {}
    public record TreatmentResult(Long id, Long caseId, Integer caseVersion, String caseStatus, LocalDate withdrawalEndDate,
                                  Integer courseDays, String medicineName) {}
    public record VoidRecord(Integer expectedVersion, String reason) {}
    public record CorrectObservation(Integer expectedVersion, String reason, Instant observedAt, BigDecimal temperatureC,
                                     String signs, String progress) {}
    public record CorrectTreatment(Integer expectedVersion, String reason, Long medicineId, Instant treatmentTime,
                                   String treatmentDetail, String dose, String route, Integer courseDays,
                                   Integer withdrawalDays, String performer, String veterinaryAdvice) {}
    public record RecordStatus(Long id, String status, Integer version, String healthState) {}
    public record CreateVaccinationSchedule(String name, Long vaccineId, LocalDate firstDueDate, Integer doseCount,
                                            Integer intervalDays, Integer boosterIntervalMonths, List<Long> cattleIds,
                                            List<Long> penIds, List<String> herdGroups, List<String> lifeStages, List<Long> excludedCattleIds) {
        public CreateVaccinationSchedule(String name, Long vaccineId, LocalDate firstDueDate, Integer doseCount,
                                         Integer intervalDays, Integer boosterIntervalMonths, List<Long> cattleIds) {
            this(name, vaccineId, firstDueDate, doseCount, intervalDays, boosterIntervalMonths, cattleIds, List.of(), List.of(), List.of(), List.of());
        }
    }
    public record VaccinationScheduleResult(Long id, String name, String status, Integer version, int targetCount, int plannedDoseCount) {}
    public record EditVaccinationSchedule(Integer expectedVersion, String name, Long vaccineId, LocalDate firstDueDate,
                                          Integer intervalDays, Integer boosterIntervalMonths) {}
    public record ScheduledDoseView(Long id, Long cattleId, String cattleCode, Integer doseNo, LocalDate dueDate,
                                    LocalDate newExpectedDate, String status, String deferralReason, Integer version) {}
    public record VaccinationScheduleView(Long id, String name, String targetGroup, Long vaccineId, String vaccineName,
                                          LocalDate firstDueDate, Integer doseCount, Integer intervalDays, Integer boosterIntervalMonths,
                                          String status, Integer version, List<ScheduledDoseView> doses) {}
    public record DeferDose(Integer expectedVersion, String reason, LocalDate newExpectedDate, String note) {}
    public record DoseResult(Long id, String status, Integer version, String reason, LocalDate newExpectedDate) {}
    public record VaccinationAnimal(Long cattleId, Long scheduledDoseId, Integer expectedDoseVersion, String decision,
                                    String deferralReason, LocalDate newExpectedDate) {}
    public record RecordVaccinations(Long vaccineId, String source, LocalDate vaccinationDate, Instant administeredAt, String batchNo, String dose,
                                     String route, Integer withdrawalDays, String vaccinator, List<VaccinationAnimal> animals) {}
    public record VaccinationBatchResult(int vaccinatedCount, int deferredCount, List<Long> vaccinationIds) {}
    public record CorrectVaccination(Integer expectedVersion, Long vaccineId, LocalDate vaccinationDate, Instant administeredAt,
                                     String batchNo, String dose, String route, String vaccinator, String reason) {}
    public record VaccinationResult(Long id, String status, Integer version, LocalDate withdrawalEndDate, Boolean corrected) {}
    public record ParameterVersionCommand(Map<String, Object> parameters, Integer gestationLengthDays, LocalDate effectiveFrom, String sourceNote) {}
    public record ParameterVersionResult(Long id, Integer versionNo, Integer gestationLengthDays, LocalDate effectiveFrom, Map<String, Object> parameters) {}
    public record VaccineCommand(Integer expectedVersion, String code, String name, String diseasePrevented, String manufacturer,
                                 String dose, String route, Integer withdrawalDays, Integer boosterInterval, Boolean available) {}
    public record MedicineCommand(Integer expectedVersion, String code, String name, String description, String dose, String route,
                                  Integer withdrawalDays, Boolean available) {}
    public record CatalogueItem(Long id, String code, String name, String description, String diseasePrevented,
                               String manufacturer, String dose, String route, Integer withdrawalDays,
                               Integer boosterInterval, Boolean available, Integer version) {}
    public record HealthCaseResult(Long id, String caseCode, String status, Integer version, Long cattleId,
                                   Long observationId, String healthState) {}
    public record HealthCaseRow(Long id,String caseCode,Long cattleId,String cattleCode,String breed,String sex,Long penId,String penCode,
                                String penName,String diagnosis,String signs,Boolean suspectedContagious,String severity,
                                LocalDate openedDate,String status,LocalDate chronicSince,String outcome,Long treatmentCount,Integer version) {}
    public record HealthTimelineRow(Long id,String type,Instant occurredAt,String details,String recordedBy,String status,
                                    Boolean corrected,Long linkedVaccinationId,Integer version) {}
    public record HealthCaseCard(Long id,String caseCode,String status,String severity,String diagnosis,String openingSigns,
                                 LocalDate openedDate,LocalDate chronicSince,String outcome,Long treatmentCount,Integer version) {}
    public record HealthProfile(Long cattleId,String healthState,LocalDate withdrawalEndDate,Boolean suspectedContagious,
                                List<HealthCaseCard> activeCases,List<HealthCaseCard> previousCases,List<HealthTimelineRow> timeline) {}
    public record VaccinationHistoryRow(Long id,Instant administeredAt,LocalDate vaccinationDate,Long cattleId,String cattleCode,
                                        Long penId,String penCode,String penName,Long vaccineId,String vaccineName,String dose,
                                        String batchNo,String source,String vaccinator,LocalDate withdrawalEndDate,
                                        Long reactionCaseId,String reactionCaseCode,String status,Boolean corrected,Integer version) {}
}
