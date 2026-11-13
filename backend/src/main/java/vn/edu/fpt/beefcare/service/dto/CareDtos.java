package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Transport objects for the Manager-only care commands. */
public final class CareDtos {
    private CareDtos() {}

    /**
     * FE-10 A3: open a case ({@code existingCaseId} null) or add an observation to an OPEN / CHRONIC case of the same
     * cattle ({@code existingCaseId} + {@code expectedVersion}). {@code vaccinationId}: the vaccination the case is opened
     * for (post-vaccination reaction, GBR-47). {@code observerId}: an ACTIVE member; defaults to the recorder.
     */
    public record OpenHealthCase(Long cattleId, Long existingCaseId, Integer expectedVersion, Instant observedAt, Long observerId, BigDecimal temperatureC,
                                 String signs, String diagnosis, Boolean suspectedContagious, String severity, Long vaccinationId) {}
    /** FE-10 A4: one follow-up of an OPEN / CHRONIC case; {@code progress} IMPROVED / UNCHANGED / WORSENED (required). */
    public record FollowUp(Integer expectedVersion, Instant observedAt, BigDecimal temperatureC, String progress, String description, Long observerId) {}
    /**
     * FE-10 A5 (popup Cập nhật / Đóng ca). {@code action}: KEEP (only the follow-up), TO_CHRONIC (OPEN → CHRONIC),
     * TO_OPEN (CHRONIC → OPEN), CLOSE (outcome RECOVERED / DIED / MISSING, {@code closedAt} not before the latest
     * record, {@code confirmedById} an ACTIVE member, default the actor). {@code latestProgress} is stored as one
     * follow-up ({@code progress} optional, default UNCHANGED): required for KEEP, optional otherwise (Q1).
     * {@code suspectedDiagnosis} / {@code suspectedContagious} update the case when present.
     */
    public record CaseStatus(Integer expectedVersion, String action, String latestProgress, String progress, String suspectedDiagnosis,
                             Boolean suspectedContagious, String outcome, Instant closedAt, Long confirmedById) {}
    /**
     * FE-10 A6: {@code medicineId} an ACTIVE medicine of the farm (name snapshotted), {@code route} one of
     * INTRAMUSCULAR / SUBCUTANEOUS / INTRAVENOUS / ORAL / TOPICAL / OTHER, {@code courseDays} 1–30 (default 1),
     * {@code withdrawalDays} 0–365 (default: the medicine's), {@code performerId} an ACTIVE member or
     * {@code performerName} ≤ 100, {@code veterinaryAdvice} ≤ 500, {@code expectedVersion} of the case.
     */
    public record TreatmentCommand(Integer expectedVersion, Long medicineId, Instant administeredAt, String dose, String route,
                                   Integer courseDays, Integer withdrawalDays, Long performerId, String performerName, String veterinaryAdvice) {}
    /** A6 result: the treatment's withdrawal end, the cattle's overall withdrawal end (treatments + on-farm vaccinations, GBR-46) and the derived health state. */
    public record TreatmentResult(Long id, Long caseId, Integer caseVersion, String caseStatus, LocalDate withdrawalEndDate,
                                  LocalDate cattleWithdrawalEndDate, String healthState, Integer courseDays, String medicineName, boolean returnedToOpen) {}
    public record VoidRecord(Integer expectedVersion, String reason) {}
    /** A8: fields of a follow-up (or the opening observation) to correct; null = unchanged. */
    public record CorrectObservation(Integer expectedVersion, String reason, Instant observedAt, BigDecimal temperatureC,
                                     String signs, String progress, Long observerId) {}
    /** A7: fields of a treatment to correct; null = unchanged. Same rules as {@link TreatmentCommand}. */
    public record CorrectTreatment(Integer expectedVersion, String reason, Long medicineId, Instant administeredAt,
                                   String dose, String route, Integer courseDays, Integer withdrawalDays,
                                   Long performerId, String performerName, String veterinaryAdvice) {}
    /** A7 / A8 result: the cattle's withdrawal end before and after the change (MSG-FE10-12 when they differ) and the health state. */
    public record RecordStatus(Long id, String status, Integer version, String healthState, Long caseId, String caseStatus,
                               LocalDate withdrawalBefore, LocalDate withdrawalAfter) {}
    public record CreateVaccinationSchedule(String name, Long vaccineId, LocalDate firstDueDate, Integer doseCount,
                                            Integer intervalDays, Integer boosterIntervalMonths, List<Long> cattleIds,
                                            List<Long> penIds, List<String> herdGroups, List<String> lifeStages, List<Long> excludedCattleIds) {
        public CreateVaccinationSchedule(String name, Long vaccineId, LocalDate firstDueDate, Integer doseCount,
                                         Integer intervalDays, Integer boosterIntervalMonths, List<Long> cattleIds) {
            this(name, vaccineId, firstDueDate, doseCount, intervalDays, boosterIntervalMonths, cattleIds, List.of(), List.of(), List.of(), List.of());
        }
    }
    public record VaccinationScheduleResult(Long id, String name, String status, Integer version, int targetCount, int plannedDoseCount) {}
    /** A3 / A4 target chosen on SCR-32: pens, herd groups and life stages (AND), plus cattle added / removed one by one (GBR-41). */
    public record ScheduleTarget(List<Long> penIds, List<String> herdGroups, List<String> lifeStages, List<Long> cattleIds, List<Long> excludedCattleIds) {}
    /**
     * A4. Null fields keep the current value. {@code doseCount}: 1-10, only doses not yet given change (R-09-05);
     * {@code removeBooster}: true drops the booster and cancels its open doses; {@code target}: the new target, resolved
     * like A3 - added cattle get PLANNED doses, removed cattle lose their open doses, DONE doses never change (TC-09-09).
     */
    public record EditVaccinationSchedule(Integer expectedVersion, String name, Long vaccineId, LocalDate firstDueDate,
                                          Integer intervalDays, Integer boosterIntervalMonths, Integer doseCount, Boolean removeBooster,
                                          ScheduleTarget target) {
        public EditVaccinationSchedule(Integer expectedVersion, String name, Long vaccineId, LocalDate firstDueDate,
                                       Integer intervalDays, Integer boosterIntervalMonths) {
            this(expectedVersion, name, vaccineId, firstDueDate, intervalDays, boosterIntervalMonths, null, null, null);
        }
    }
    /** The stored target with display codes, so SCR-32 shows the same selection when the schedule is edited (GAP-FE09-01). */
    public record ScheduleTargetView(List<Long> penIds, List<String> penCodes, List<String> herdGroups, List<String> lifeStages,
                                     List<Long> cattleIds, List<String> cattleCodes, List<Long> excludedCattleIds, List<String> excludedCattleCodes) {}
    public record ScheduledDoseView(Long id, Long cattleId, String cattleCode, Integer doseNo, LocalDate dueDate,
                                    LocalDate newExpectedDate, String status, String deferralReason, Integer version) {}
    public record VaccinationScheduleView(Long id, String name, String targetGroup, Long vaccineId, String vaccineName,
                                          LocalDate firstDueDate, Integer doseCount, Integer intervalDays, Integer boosterIntervalMonths,
                                          String status, Integer version, List<ScheduledDoseView> doses, String stopReason,
                                          ScheduleTargetView target) {}
    /** A5: stopping a schedule needs a reason (R-09-06, ≤ 500 characters, Q1). */
    public record StopVaccinationSchedule(String reason) {}
    public record DeferDose(Integer expectedVersion, String reason, LocalDate newExpectedDate, String note) {}
    public record DoseResult(Long id, String status, Integer version, String reason, LocalDate newExpectedDate) {}
    public record VaccinationAnimal(Long cattleId, Long scheduledDoseId, Integer expectedDoseVersion, String decision,
                                    String deferralReason, LocalDate newExpectedDate) {}
    public record RecordVaccinations(Long vaccineId, String source, LocalDate vaccinationDate, Instant administeredAt, String batchNo, String dose,
                                     String route, Integer withdrawalDays, String vaccinator, List<VaccinationAnimal> animals) {}
    /**
     * A6. {@code skipped} (R-09-10, TC-09-17): animals left out of the batch - the dose was already given (MSG-FE09-09) or
     * the animal left the herd meanwhile (MSG-COM-13); the other animals are still recorded.
     */
    public record VaccinationBatchResult(int vaccinatedCount, int deferredCount, List<Long> vaccinationIds, List<SkippedAnimal> skipped) {
        public VaccinationBatchResult(int vaccinatedCount, int deferredCount, List<Long> vaccinationIds) {
            this(vaccinatedCount, deferredCount, vaccinationIds, List.of());
        }
    }
    /** One animal skipped in a batch: its code, the message code and, for MSG-FE09-09, the dose number. */
    public record SkippedAnimal(Long cattleId, String cattleCode, String messageCode, Integer doseNo) {}
    /**
     * A10. {@code withdrawalDays}: new withdrawal period (0-365) of an ON_FARM record; null keeps the current one
     * (GAP-FE09-04, TC-09-27). A HISTORICAL record has no withdrawal (R-09-08).
     */
    public record CorrectVaccination(Integer expectedVersion, Long vaccineId, LocalDate vaccinationDate, Instant administeredAt,
                                     String batchNo, String dose, String route, String vaccinator, String reason, Integer withdrawalDays) {
        public CorrectVaccination(Integer expectedVersion, Long vaccineId, LocalDate vaccinationDate, Instant administeredAt,
                                  String batchNo, String dose, String route, String vaccinator, String reason) {
            this(expectedVersion, vaccineId, vaccinationDate, administeredAt, batchNo, dose, route, vaccinator, reason, null);
        }
    }
    /** A10 / A11: the record and the withdrawal end of its cattle, recalculated after the change (R-09-13, R-09-14). */
    public record VaccinationResult(Long id, String status, Integer version, LocalDate withdrawalEndDate, Boolean corrected,
                                    Integer withdrawalDays, LocalDate cattleWithdrawalEndDate) {}
    /**
     * A10. {@code baseVersion}: the version number the form was loaded with; when another version was saved meanwhile
     * the save answers MSG-COM-05 (R-18-15, TC-18-26). Null skips the check (older callers).
     */
    public record ParameterVersionCommand(Map<String, Object> parameters, Integer gestationLengthDays, LocalDate effectiveFrom, String sourceNote, Integer baseVersion) {
        public ParameterVersionCommand(Map<String, Object> parameters, Integer gestationLengthDays, LocalDate effectiveFrom, String sourceNote) {
            this(parameters, gestationLengthDays, effectiveFrom, sourceNote, null);
        }
    }
    /** A9 / A10: a saved version with its source note, author and whether it starts later (scheduled, R-18-11). */
    public record ParameterVersionResult(Long id, Integer versionNo, Integer gestationLengthDays, LocalDate effectiveFrom, Map<String, Object> parameters,
                                         String sourceNote, String savedBy, java.time.Instant createdAt, boolean scheduled) {}
    public record VaccineCommand(Integer expectedVersion, String code, String name, String diseasePrevented, String manufacturer,
                                 String dose, String route, Integer withdrawalDays, Integer boosterInterval, Boolean available) {}
    public record MedicineCommand(Integer expectedVersion, String code, String name, String description, String dose, String route,
                                  Integer withdrawalDays, Boolean available) {}
    /**
     * Vaccine or medicine (A3, A5). {@code scheduleCount} / {@code recordCount}: vaccination schedules and vaccinations
     * (or treatments) that use it; {@code referencedCount} = their sum (MSG-FE18-03; 0 = may be deleted).
     * {@code completeFromLabel}: a vaccine without reference dose or route (R-18-07).
     */
    public record CatalogueItem(Long id, String code, String name, String description, String diseasePrevented,
                               String manufacturer, String dose, String route, Integer withdrawalDays,
                               Integer boosterInterval, Boolean available, Integer version,
                               long scheduleCount, long recordCount, long referencedCount, boolean completeFromLabel) {}
    /**
     * A3 / A4 / A5 result. {@code observationId}: the observation written by this command (null for a pure status
     * change). {@code pendingExitVoucherId}: the PENDING loss voucher created when the case was closed as DIED /
     * MISSING (R-10-07). {@code cattleWithdrawalEndDate}: the cattle's current withdrawal end (GBR-46).
     */
    public record HealthCaseResult(Long id, String caseCode, String status, Integer version, Long cattleId, String cattleCode,
                                   Long observationId, String healthState, LocalDate cattleWithdrawalEndDate, String outcome,
                                   LocalDate chronicSince, Instant closedAt, Long pendingExitVoucherId) {}
    /** A1 row (SCR-36). {@code openedAt}: the opening observation; {@code dayN}: days since opening (day 1 = opening day) for OPEN cases. */
    public record HealthCaseRow(Long id,String caseCode,Long cattleId,String cattleCode,String breed,String sex,Long penId,String penCode,
                                String penName,String diagnosis,String signs,Boolean suspectedContagious,String severity,
                                LocalDate openedDate,Instant openedAt,Integer dayN,String status,LocalDate chronicSince,String outcome,
                                LocalDate closedDate,Long treatmentCount,Integer version) {}
    /** A1 page: {@code counts} per tab (open, chronic, closed, all) with the same search / severity / pen / period filters. */
    public record HealthCasePage(List<HealthCaseRow> items,long total,int page,int size,Map<String,Long> counts) {}
    /**
     * A2 timeline row of one case: OPENING (the observation that opened the case), FOLLOW_UP or TREATMENT, with
     * every stored field so the correction popup can show current values (UC-FE10-05).
     */
    public record HealthTimelineRow(Long id,Long caseId,String type,Instant occurredAt,String recordedBy,String observer,Long observerId,
                                    String status,Boolean corrected,Integer version,BigDecimal temperatureC,String progress,String description,
                                    Long linkedVaccinationId,Long medicineId,String medicineName,String dose,String route,Integer courseDays,
                                    Integer withdrawalDays,LocalDate withdrawalEndDate,String performer,String veterinaryAdvice) {}
    /** A2 open case (OPEN / CHRONIC) with its own timeline; {@code latestEntryAt}: the latest VALID record (lower bound for closing). */
    public record HealthCaseView(Long id,String caseCode,String status,String severity,String diagnosis,Boolean suspectedContagious,
                                 String openingSigns,LocalDate openedDate,Instant openedAt,Integer dayN,LocalDate chronicSince,
                                 Long treatmentCount,Long linkedVaccinationId,Instant latestEntryAt,List<HealthTimelineRow> timeline,Integer version) {}
    /** A2 previous (CLOSED) case: code, opening signs, outcome and the month it was closed ({@code month} yyyy-MM). */
    public record PreviousHealthCase(Long id,String caseCode,String openingSigns,String diagnosis,String severity,LocalDate openedDate,
                                     String outcome,LocalDate closedDate,String month,String confirmedBy) {}
    /** A2: the PENDING loss voucher (DIED / MISSING) proposed from one of the cattle's cases and awaiting the Owner (GBR-26). */
    public record PendingHealthExit(Long voucherId,String code,String lossKind,LocalDate exitDate,Long caseId,String caseCode) {}
    public record HealthProfile(Long cattleId,String cattleCode,String healthState,LocalDate withdrawalEndDate,Boolean suspectedContagious,
                                PendingHealthExit pendingExit,List<HealthCaseView> openCases,List<PreviousHealthCase> previousCases) {}
    /**
     * A8 / A9 history row. {@code route}, {@code withdrawalDays} and {@code revisions} (GAP-FE09-03): the stored route,
     * the withdrawal period of an ON_FARM record and its correction / void history, oldest first (BR-D15, R-09-14).
     */
    public record VaccinationHistoryRow(Long id,Instant administeredAt,LocalDate vaccinationDate,Long cattleId,String cattleCode,
                                        Long penId,String penCode,String penName,Long vaccineId,String vaccineName,String dose,
                                        String batchNo,String source,String vaccinator,LocalDate withdrawalEndDate,
                                        Long reactionCaseId,String reactionCaseCode,String status,Boolean corrected,Integer version,
                                        String route,Integer withdrawalDays,List<VaccinationRevision> revisions) {}
    /** One immutable correction / void of a vaccination record: who, when, why and the values before / after (BR-D15). */
    public record VaccinationRevision(Long id,Instant changedAt,String changedBy,String action,String reason,
                                      Map<String,Object> before,Map<String,Object> after) {}
}
