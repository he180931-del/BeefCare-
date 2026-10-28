package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;

/** Create / update of a trading partner (seller, buyer, feed supplier; GBR-97). */
public record TradingPartnerRequest(
    @NotBlank @Size(max = 150) String name,
    Boolean seller,
    Boolean buyer,
    Boolean supplier,
    @Size(max = 50) String phone,
    @Size(max = 255) String area,
    @Size(max = 500) String note,
    Integer expectedVersion
) {
    public record StatusRequest(ActiveStatus status, Integer expectedVersion) {}
}
