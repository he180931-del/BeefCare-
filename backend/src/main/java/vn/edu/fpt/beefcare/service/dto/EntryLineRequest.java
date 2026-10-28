package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;

/**
 * One cattle line of an entry voucher ("Voucher Cattle Line" popup). Stored as the line's draft data while the
 * voucher is a DRAFT. A day birth date, a month (first day of the month) or an age in months may be given.
 * For FARM_BORN vouchers only calfOutcomeId, penId, purposeId, earTagNumber, name, photoUrl, colourMarkings and
 * warningReason are used; parentage, breed, sex, birth date and weight come from the calving (GBR-31).
 */
public record EntryLineRequest(
    @Size(max = 30) String earTagNumber,
    @Size(max = 50) String name,
    @Size(max = 500) String photoUrl,
    @Size(max = 255) String colourMarkings,
    Long breedId,
    Sex sex,
    LocalDate birthDate,
    BirthDateAccuracy birthDateAccuracy,
    @Min(1) @Max(240) Integer ageMonths,
    LifeStage lifeStage,
    Long purposeId,
    @DecimalMin("1") @DecimalMax("1500") BigDecimal entryWeightKg,
    WeightBasis weightBasis,
    Long penId,
    @PositiveOrZero Long unitPrice,
    LocalDate quarantineUntil,
    @Size(max = 500) String warningReason,
    @Valid VaccinationDeclaration vaccination,
    @Valid DiseaseDeclaration disease,
    @Valid ReproductionDeclaration reproduction,
    Long calfOutcomeId
) {
    public static EntryLineRequest blank() {
        return new EntryLineRequest(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    public record VaccinationDeclaration(DeclarationStatus status, @Size(max = 255) String informationSource, @Valid List<VaccinationItem> items) {}

    /** A vaccine from the catalogue (vaccineId) or free text (vaccineName); the date is a day or the first day of a month. */
    public record VaccinationItem(Long vaccineId, @Size(max = 255) String vaccineName, LocalDate date, @Size(max = 255) String informationSource) {}

    public record DiseaseDeclaration(DeclarationStatus status, @Size(max = 1000) String description) {}

    public record ReproductionDeclaration(
        DeclarationStatus status,
        @Min(0) @Max(15) Integer earlierCalvings,
        YesNoUnknown pregnantAtEntry,
        @Min(1) @Max(9) Integer estMonthsPregnant,
        @Size(max = 1000) String description
    ) {}
}
