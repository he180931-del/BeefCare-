package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Void a recorded payment; the reason is mandatory (GBR-91). {@code version} is the payment's version, optional. */
public record VoidPaymentRequest(@NotBlank @Size(max = 500) String reason, Integer version) {}
