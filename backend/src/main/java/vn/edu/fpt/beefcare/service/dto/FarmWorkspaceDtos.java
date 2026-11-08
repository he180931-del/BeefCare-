package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

public final class FarmWorkspaceDtos {
    private FarmWorkspaceDtos() {}
    /** SCR-10 / SCR-11 contact phone: "0" or "+84" followed by 9 digits; an empty value means "not provided". */
    public static final String CONTACT_PHONE = "((?:0|\\+84)[0-9]{9})?";
    /** SCR-10 expected herd size: optional, one of the four ranges; an empty value means "not provided". */
    public static final String EXPECTED_HERD_SIZE = "(UNDER_50|50_149|150_300|OVER_300)?";
    /** SCR-10. {@code province} must also be one of {@code VietnamProvinces.NAMES} (checked by the service). */
    public record Registration(
        @NotBlank @Size(min=2,max=150) String name,
        @NotBlank @Size(max=150) String province,
        @NotBlank @Size(max=150) String commune,
        @Size(max=255) String detailedAddress,
        @Size(max=100) String contactPerson,
        @Pattern(regexp=CONTACT_PHONE) String contactPhone,
        @Size(max=255) String registrationCertificateInfo,
        @Pattern(regexp=EXPECTED_HERD_SIZE) String expectedHerdSize,
        Set<@NotBlank String> mainBreedCodes
    ) {}
    public record Update(
        @NotBlank @Size(min=2,max=150) String name,
        @NotBlank @Size(max=150) String province,
        @NotBlank @Size(max=150) String commune,
        @Size(max=255) String detailedAddress,
        @Size(max=100) String contactPerson,
        @Pattern(regexp=CONTACT_PHONE) String contactPhone,
        @Size(max=255) String registrationCertificateInfo,
        @Size(max=40) String timeZone,
        LocalTime morningShiftStart,
        @Size(max=1000) String operatingNotes,
        Set<Long> mainBreedIds,
        @NotNull Integer expectedVersion
    ) {}
    public record Summary(Long id,String name,String role,String serviceStatus,Integer version) {}
    public record Details(Long id,String name,String province,String commune,String detailedAddress,
        String contactPerson,String contactPhone,String registrationCertificateInfo,String expectedHerdSize,
        String timeZone,LocalTime morningShiftStart,String operatingNotes,String serviceStatus,
        Set<Long> mainBreedIds,Integer version) {}
    public record Lookup(Long id,String code,String name,boolean available,String type) {}
    public record Catalogues(List<Lookup> breeds,List<Lookup> productionPurposes,List<Lookup> vaccines,List<Lookup> feedItems) {}
}
