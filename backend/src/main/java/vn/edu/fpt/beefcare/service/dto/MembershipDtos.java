package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;

/** Request and response shapes for farm membership. Secrets (invite tokens) are never returned. */
public final class MembershipDtos {
    private MembershipDtos() {}

    public record InviteRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "MANAGER|TECHNICIAN") String role,
        Integer validityDays
    ) {}

    public record InvitationView(Long id, String email, String role, String status, Instant createdAt, Instant lastSentAt, Instant expiresAt, Integer validityDays, Integer version) {}

    public record InvitationAction(@NotNull Integer expectedVersion) {}

    public record MemberView(Long id, Long userId, String fullName, String email, String role, String status, LocalDate effectiveDate, String reason, Integer version) {}

    public record MemberChange(
        @NotBlank @Pattern(regexp = "CHANGE_ROLE|DEACTIVATE|REACTIVATE") String action,
        @Pattern(regexp = "MANAGER|TECHNICIAN") String role,
        @NotNull LocalDate effectiveDate,
        @NotBlank @Size(max = 500) String reason,
        @NotNull Integer expectedVersion
    ) {}

    public record InvitationAcceptance(String farmName, String email, String role, Instant invitedAt, Instant expiresAt) {}
    public record AcceptInvitation(@NotBlank String token) {}
}
