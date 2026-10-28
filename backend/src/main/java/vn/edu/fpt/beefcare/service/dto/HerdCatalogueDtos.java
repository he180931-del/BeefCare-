package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;

public final class HerdCatalogueDtos {
    private HerdCatalogueDtos() {}
    public record BreedWrite(@NotBlank @Pattern(regexp="[A-Z0-9-]{2,20}") String code,@NotBlank @Size(max=100) String name,
        @Size(max=50) String group,@Size(max=500) String description,@NotNull Boolean available,Integer expectedVersion) {}
    public record PurposeWrite(@NotBlank @Pattern(regexp="[A-Z0-9-]{2,20}") String code,@NotBlank @Size(max=100) String name,
        @NotNull PurposeType purposeType,@Size(max=500) String description,@NotNull Boolean available,Integer expectedVersion) {}
    public record BreedView(Long id,String code,String name,String group,String description,boolean available,long activeCattle,
        boolean referenced,Integer version,List<String> messages) {}
    public record ReceivingPen(Long id,String code,String name) {}
    public record PurposeView(Long id,String code,String name,PurposeType purposeType,String description,boolean available,
        long activeCattle,boolean referenced,List<ReceivingPen> receivingPens,Integer version,List<String> messages) {}
}
