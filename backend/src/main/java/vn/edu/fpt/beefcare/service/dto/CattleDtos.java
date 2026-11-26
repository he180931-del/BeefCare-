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
    /** Thông tin nhập đàn; declarations là khai báo lịch sử trước nhập (SCR-19 #11, D82), null với bò không có khai báo. */
    public record Entry(String source,LocalDate entryDate,java.math.BigDecimal weightKg,String weightBasis,Long id,Long voucherId,String voucherCode,String seller,
        List<Declaration> declarations) {}
    /**
     * Một nhóm khai báo trước nhập (GBR-30): category VACCINATION / DISEASE / REPRODUCTION, status KNOWN / NONE / UNKNOWN.
     * Chi tiết chỉ có khi status KNOWN; pregnantAtEntry YES / NO / UNKNOWN.
     */
    public record Declaration(String category,String status,List<DeclaredVaccine> vaccines,String description,String informationSource,
        Integer earlierCalvings,String pregnantAtEntry,Integer estMonthsPregnant) {}
    /** Mũi tiêm đã khai: tên (danh mục hoặc gõ tự do) và ngày tiêm, null khi không rõ ngày. */
    public record DeclaredVaccine(String name,LocalDate date) {}
    public record Profile(Long id,String displayCode,String earTagNumber,String name,Sex sex,LocalDate birthDate,BirthDateAccuracy birthDateAccuracy,
        Long breedId,String breedName,Long purposeId,String purposeName,PurposeType purposeType,LifeStage lifeStage,HerdStatus herdStatus,
        ExitType exitType,LocalDate exitDate,String herdGroup,Integer version,String photoUrl,Long penId,String penCode,String penName,LocalDate penSince,
        boolean exitPending,java.math.BigDecimal latestWeightKg,String weightBasis,LocalDate latestWeightDate,java.math.BigDecimal latestBcs,java.math.BigDecimal adg90,
        String healthState,LocalDate withdrawalEndDate,boolean withdrawalActive,Boolean suspectedContagious,Integer vaccinationOverdue,String reproductiveStatus,
        LocalDate expectedCalvingDate,String expectedBasis,Boolean breedingEligible,List<String> failedBreedingConditions,
        String colourMarkings,String notes,Long damId,Long sireId,String externalSireCode,Boolean canUpdate,Boolean canChangePurpose,
        Entry entry,LocalDate quarantineUntil,String damCode,String sireCode) {}
    public record Page(List<Profile> items,long total,int page,int size,Map<String,Long> counts) {}
    /** A QR tag of a cattle (A5): who issued it and the note are shown in the SCR-21 tag history. */
    public record Tag(Long id,String tagCode,String status,String displayCode,String scanUrl,java.time.Instant issuedAt,
        java.time.Instant endedAt,String reason,Integer version,String issuedByName,String note) {}
    /** Scan / manual lookup result (A7). A REPLACED tag also gives the current tag and when the scanned tag was replaced (MSG-FE05-05). */
    public record Resolved(Long farmId,Long cattleId,boolean switchFarmRequired,boolean replacedTag,Profile cattle,String messageCode,
        String currentTagCode,java.time.Instant replacedAt) {}
}
