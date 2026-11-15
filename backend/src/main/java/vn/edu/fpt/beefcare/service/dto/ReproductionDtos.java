package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Request/response shapes of FE-11 (A1–A6) and FE-12 (A1–A8); field names follow the specs §7. */
public final class ReproductionDtos {
    private ReproductionDtos() {}

    // ------------------------------------------------------------------ commands (FE-11 A3/A4, FE-12 A2–A4)

    /** FE-11 A3. {@code observerId} is a farm member (default: the recorder); {@code observerName} an external person. */
    public record EstrusCommand(Integer expectedCattleVersion, Instant observedAt, Long observerId, String observerName,
                                List<String> signs, String description, String dataSource, Boolean confirmDuplicate) {}

    /** FE-11 A4. EXTERNAL needs {@code sireBreedId} or {@code sireBreed}; INTERNAL needs {@code sireCattleId}. */
    public record BreedingCommand(Integer expectedCattleVersion, Instant bredAt, String dataSource, String method, String sireSource,
                                  Long sireCattleId, Long sireBreedId, String sireBreed, String semenCode, String semenSupplier,
                                  Long performerId, String performerName, Long linkedEstrusId, String note, Boolean confirmDuplicate) {}

    /** FE-12 A2. */
    public record PregnancyCheckCommand(Integer expectedCattleVersion, Long linkedBreedingId, Instant checkedAt, String dataSource,
                                        String result, String method, Integer estimatedMonths, Long examinerId, String examinerName,
                                        String note) {}

    public record Window(Instant from, Instant to) {}
    public record EligibilityWarning(String code, List<String> conditions) {}
    public record EpisodeInfo(Long episodeId, Integer version, Integer parity, LocalDate expectedDate, String basis, String notice) {}

    /** Result of A3 / A4 / FE-12 A2 and of their correction / void. Absent fields are omitted. */
    public record EventResult(Long eventId, String type, String status, Integer version, Integer cattleVersion, String result,
                              Window window, LocalDate tentativeCalvingDate, String parameterMissing,
                              EligibilityWarning eligibilityWarning, EpisodeInfo episode, String reproStatus) {}

    /** FE-12 A3. */
    public record PregnancyUpdateCommand(Integer expectedEpisodeVersion, String type, Instant occurredAt, String dataSource,
                                         String details, Long healthCaseId) {}
    public record PregnancyUpdateResult(Long updateId, Long episodeId, String type, String status, Integer version,
                                        String episodeStatus, Integer episodeVersion, String reproStatus) {}

    /** FE-12 A4 calf block. {@code registration}: DRAFT (default) | REGISTER_NOW; ignored for STILLBORN. */
    public record CalfCommand(String outcome, String sex, BigDecimal birthWeightKg, String weightBasis, String tagCode,
                              Long penId, Long breedId, String registration, Long purposeId) {}

    /** FE-12 A4. {@code episodeId} defaults to the OPEN pregnancy unless {@code noTrackedPregnancy}. */
    public record CalvingCommand(Long damId, Integer expectedCattleVersion, Long episodeId, Integer expectedEpisodeVersion,
                                 Boolean noTrackedPregnancy, Instant birthAt, String dataSource, Long attendantId,
                                 String attendantName, String course, String damCondition, Boolean retainedPlacenta,
                                 List<CalfCommand> calves) {}

    public record CalfResult(Long calfId, Integer calfNo, String outcome, String registration, Long cattleId, String cattleCode,
                             String voucherCode, String tagCode, String status, Integer version) {}
    public record CalvingResult(Long calvingId, String status, Integer version, Long episodeId, List<CalfResult> calves,
                                String damStatus) {}

    // ------------------------------------------------------------------ corrections (FE-11 A5/A6, FE-12 A5–A8)

    /** Only the fields sent change. {@code unlinkEvent=true} removes the linked estrus / breeding ("Không có"). */
    public record CorrectEvent(Integer expectedVersion, String reason, Instant occurredAt, String dataSource,
                               List<String> signs, String description, Long observerId, String observerName,
                               String method, String sireSource, Long sireCattleId, Long sireBreedId, String sireBreed,
                               String semenCode, String semenSupplier, Long performerId, String performerName,
                               Long linkedEventId, Boolean unlinkEvent, String note,
                               String result, Integer estimatedMonths, Long examinerId, String examinerName) {}
    public record CorrectPregnancyUpdate(Integer expectedVersion, String reason, String type, Instant occurredAt,
                                         String dataSource, String details, Long healthCaseId, Boolean unlinkHealthCase) {}
    public record CorrectCalving(Integer expectedVersion, String reason, Instant birthAt, String dataSource, Long attendantId,
                                 String attendantName, String course, String damCondition, Boolean retainedPlacenta) {}
    public record CorrectCalf(Integer expectedVersion, String reason, String outcome, String sex, BigDecimal birthWeightKg,
                              String weightBasis, Boolean clearWeight, String tagCode, Long penId, Long breedId, Long purposeId) {}
    public record VoidRecord(Integer expectedVersion, String reason) {}

    /** MSG-FE11-07 params.dependents item. */
    public record Dependent(String type, Long id, Instant at) {}

    // ------------------------------------------------------------------ FE-11 A1 worklist

    public record Ref(Long id, String code, String name) {}
    public record Person(Long id, String name) {}
    public record Eligibility(Boolean met, List<String> failed) {}
    public record LatestEvent(String type, Instant at, LocalDate date, Long daysAgo) {}
    public record Due(LocalDate date, Instant windowFrom, Instant windowTo) {}
    public record WorklistItem(Long cattleId, String code, String earTag, Ref breed, Ref pen, String status, Instant statusSince,
                               Eligibility eligibility, LatestEvent latestEvent, String nextAction, Due due,
                               LocalDate expectedCalvingDate, String expectedBasis, Integer version) {}
    public record Tiles(int inEstrus, int inWindow, int checkDue, int calving30, int postCalvingReady, int notEligible) {}
    public record Counts(int awaitingBreeding, int inEstrus, int bred, int pregnant, int dueSoon, int postCalving, int all) {}
    public record Worklist(Tiles tiles, Counts counts, List<WorklistItem> items) {}

    // ------------------------------------------------------------------ FE-11 A2 / FE-12 A1 profile

    public record Criterion(String name, String required, String value, boolean met) {}
    public record EligibilityDetail(Boolean met, List<Criterion> criteria) {}
    public record EstrusWindow(Instant estrusAt, Instant from, Instant to, boolean configured) {}
    public record Indicators(Integer ageAtFirstCalvingMonths, Long lastIntervalDays, Long daysSinceCalving, Long daysOpen,
                             int conceptions, int services, boolean overdue) {}
    public record LatestWeight(BigDecimal kg, LocalDate date) {}
    public record LastCalving(Long calvingId, Instant at) {}
    public record LatestBreeding(Long eventId, Instant at, String method, String sireSource, Ref sire, Ref sireBreed,
                                 String sireBreedText, String semenCode, String semenSupplier, Person performer,
                                 LocalDate tentativeCalvingDate, int checksSince, LocalDate checkFrom) {}
    public record CurrentPregnancy(Long episodeId, Integer version, Integer parity, Long linkedBreedingId, Instant linkedBreedingAt,
                                   Long confirmingCheckId, Instant confirmedAt, LocalDate expectedDate, String basis,
                                   Long daysPregnant, boolean dueSoon) {}
    public record TimelineRow(String kind, Long id, Instant at, Instant recordedAt, String recordedBy, String source, String status,
                              boolean corrected, Integer version, String voidReason,
                              List<String> signs, String description, Person observer,
                              String method, String sireSource, Ref sire, Ref sireBreed, String sireBreedText, String semenCode,
                              String semenSupplier, Person performer, Long linkedEventId, LocalDate tentativeCalvingDate,
                              String result, Integer estimatedMonths, Person examiner, Long episodeId,
                              String updateType, Long healthCaseId, String healthCaseCode, Long calvingId) {}
    public record CalfRow(Long calfId, Integer calfNo, String outcome, String sex, BigDecimal birthWeightKg, String weightBasis,
                          String tagCode, Ref pen, Ref breed, Ref purpose, String registration, Long cattleId, String cattleCode,
                          String status, Integer version, boolean corrected) {}
    public record CalvingRow(Long calvingId, Instant at, String status, boolean corrected, Integer version, String source,
                             Person attendant, String course, String damCondition, Boolean retainedPlacenta, Long episodeId,
                             List<CalfRow> calves) {}
    public record Profile(Long cattleId, String code, String earTag, String sex, String lifeStage, String purposeType,
                          String herdStatus, Ref breed, Ref pen, Integer version, boolean applicable, String notApplicableReason,
                          String status, Instant statusSince, int servicesInCycle, int parity, LastCalving lastCalving,
                          LatestWeight latestWeight, Integer declaredPregnancyMonths, Indicators indicators,
                          boolean canManage, List<String> allowedActions, List<String> otherActions,
                          EligibilityDetail eligibility, EstrusWindow window, LatestBreeding latestBreeding,
                          CurrentPregnancy currentPregnancy, List<TimelineRow> timeline, List<CalvingRow> calvings) {}
}
