package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Request/response shapes for manager reproduction commands. */
public final class ReproductionDtos {
    private ReproductionDtos() {}

    public record EventCommand(Long cattleId, Integer expectedCattleVersion, Instant occurredAt, String source, String method,
                               String result, List<String> signs, String description, String performedBy, String examiner,
                               Long linkedEventId, Long sireId, String sireSource, String externalSireName, Long sireBreedId,
                               String semenBatch, String supplier, Integer estimatedMonthsPregnant, String observer) {}
    public record EventResult(Long id, String type, String status, Integer version, LocalDate tentativeExpectedCalvingDate,
                              Long pregnancyEpisodeId, Integer cattleVersion) {}
    public record PregnancyUpdateCommand(Integer expectedEpisodeVersion, Instant occurredAt, String source, String type,
                                         String details, Long healthCaseId) {}
    public record PregnancyUpdateResult(Long id, Long episodeId, String type, String episodeStatus, Integer episodeVersion) {}
    public record CalfCommand(Integer calfNo, String outcome, String sex, BigDecimal birthWeight, String weightUnit,
                              String weightBasis, String tagCode, Long proposedPenId, Long breedId, Long purposeId,
                              Boolean registerNow) {}
    public record CalvingCommand(Long cattleId, Integer expectedCattleVersion, Long episodeId, Integer expectedEpisodeVersion,
                                 Instant birthTime, String source, String course, String damCondition, Boolean retainedPlacenta,
                                 String attendant, List<CalfCommand> calves) {}
    public record CalvingResult(Long id, String status, Integer version, Long episodeId, List<Long> calfOutcomeIds,
                                List<Long> registeredCattleIds, List<String> warnings) {}
    public record CorrectEvent(Integer expectedVersion, String reason, Instant occurredAt, String method, String result,
                               String description, String performedBy, String examiner, String observer) {}
    public record CorrectPregnancyUpdate(Integer expectedVersion, String reason, Instant occurredAt, String details) {}
    public record CorrectCalving(Integer expectedVersion, String reason, Instant birthTime, String source, String course,
                                 String damCondition, Boolean retainedPlacenta, String attendant) {}
    public record CorrectCalf(Integer expectedVersion, String reason, String outcome, String sex, BigDecimal birthWeight,
                              String weightUnit, String weightBasis, String tagCode, Long proposedPenId, Long breedId,
                              Long purposeId, Boolean registerNow) {}
    public record CalfOutcomeResult(Long id, String outcome, String sex, BigDecimal birthWeight, String registrationState,
                                    String status, Integer version, Long registeredCattleId) {}
    public record ReproductionAnimal(Long cattleId, String cattleCode, String status, LocalDate expectedCalvingDate,
                                     String expectedBasis, Boolean breedingEligible, List<String> failedBreedingConditions) {}
    public record ReproductionHistory(Long cattleId, List<EventHistory> events, List<PregnancyHistory> pregnancies,
                                      List<CalvingHistory> calvings) {}
    public record EventHistory(Long id, String type, Instant occurredAt, Instant recordedAt, Long recordedById,
                               String result, String method, String observer, String performedBy, String examiner,
                               String status, Boolean corrected, Integer version) {}
    public record PregnancyHistory(Long id, String status, Integer parity, LocalDate expectedCalvingDate, String expectedBasis,
                                   List<PregnancyUpdateHistory> updates) {}
    public record PregnancyUpdateHistory(Long id, String type, Instant occurredAt, Instant recordedAt, String status,
                                         Boolean corrected, Integer version) {}
    public record CalvingHistory(Long id, Instant birthTime, String status, Boolean corrected, Integer version,
                                 List<CalfOutcomeResult> calves) {}
    public record VoidRecord(Integer expectedVersion, String reason) {}
}
