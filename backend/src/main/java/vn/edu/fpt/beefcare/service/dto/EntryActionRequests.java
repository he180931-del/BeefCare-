package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;

/** Request bodies of the entry voucher commands. */
public final class EntryActionRequests {

    private EntryActionRequests() {}

    /** Post: optional optimistic version of the draft the form was loaded with; printQr is echoed back for the client. */
    public record PostRequest(Integer expectedVersion, Boolean printQr) {}

    public record VoidRequest(@NotBlank @Size(max = 500) String reason, Integer expectedVersion) {}

    public record DiedBeforeRegistrationRequest(@NotBlank @Size(max = 500) String reason) {}

    /**
     * Correction of one herd entry (popup "Correct / Void Herd Entry"). Only the fields that differ from the current
     * values are saved. entryDate of a PURCHASE voucher applies to all its cattle; seller / certificate / plate are the
     * "source information" of the voucher.
     */
    public record CorrectEntryRequest(
        @NotBlank @Size(max = 500) String reason,
        Integer expectedVersion,
        Integer voucherVersion,
        @NotNull @Valid Changes changes
    ) {}

    public record Changes(
        LocalDate entryDate,
        Long sellerId,
        @Size(max = 50) String quarantineCertNo,
        @Size(max = 20) String vehiclePlate,
        @DecimalMin("1") @DecimalMax("1500") BigDecimal entryWeightKg,
        WeightBasis weightBasis,
        @PositiveOrZero Long unitPrice,
        Long breedId,
        Sex sex,
        LocalDate birthDate,
        BirthDateAccuracy birthDateAccuracy,
        Integer ageMonths,
        @Valid EntryLineRequest.VaccinationDeclaration vaccination,
        @Valid EntryLineRequest.DiseaseDeclaration disease,
        @Valid EntryLineRequest.ReproductionDeclaration reproduction
    ) {}
}
