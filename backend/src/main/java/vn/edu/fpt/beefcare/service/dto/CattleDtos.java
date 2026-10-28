package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import vn.edu.fpt.beefcare.domain.enumeration.*;

public final class CattleDtos {
    private CattleDtos() {}
    public record ProfileUpdate(@Size(max=30) String earTagNumber,@Size(max=50) String name,@Size(max=255) String colourMarkings,
        @Size(max=1000) String notes,Long productionPurposeId,LifeStage lifeStage,@NotNull LocalDate effectiveDate,
        @NotBlank @Size(max=500) String reason,@NotNull Integer expectedVersion,boolean acknowledgedReproductionChange) {}
    public record TagRequest(ReplacementReason reason,@Size(max=50) @Pattern(regexp="[A-Za-z0-9_-]+") String tagCode,
        @Size(max=255) String note,@NotNull Integer cattleVersion) {}
    public record Entry(String source,LocalDate entryDate,java.math.BigDecimal weightKg,String weightBasis,Long id,Long voucherId,String voucherCode,String seller) {}
    public record Profile(Long id,String displayCode,String earTagNumber,String name,Sex sex,LocalDate birthDate,BirthDateAccuracy birthDateAccuracy,
        Long breedId,String breedName,Long purposeId,String purposeName,PurposeType purposeType,LifeStage lifeStage,HerdStatus herdStatus,
        ExitType exitType,LocalDate exitDate,String herdGroup,Integer version,String photoUrl,Long penId,String penCode,String penName,LocalDate penSince,
        boolean exitPending,java.math.BigDecimal latestWeightKg,String weightBasis,java.math.BigDecimal latestBcs,java.math.BigDecimal adg90,
        String healthState,LocalDate withdrawalEndDate,boolean withdrawalActive,Boolean suspectedContagious,String reproductiveStatus,
        LocalDate expectedCalvingDate,String expectedBasis,Boolean breedingEligible,List<String> failedBreedingConditions,
        String colourMarkings,String notes,Long damId,Long sireId,String externalSireCode,Boolean canUpdate,Boolean canChangePurpose,
        Entry entry,LocalDate quarantineUntil) {}
    public record Page(List<Profile> items,long total,int page,int size,Map<String,Long> counts) {}
    public record Tag(Long id,String tagCode,String status,String displayCode,String scanUrl,java.time.Instant issuedAt,
        java.time.Instant endedAt,String reason,Integer version) {}
    public record Resolved(Long farmId,Long cattleId,boolean switchFarmRequired,boolean replacedTag,Profile cattle,String messageCode) {}
}
