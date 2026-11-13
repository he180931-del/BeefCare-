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

    public record InvitationView(Long id, String email, String role, String status, Instant createdAt, Instant lastSentAt, Instant expiresAt, Integer validityDays, Integer version, boolean hasAccount) {}

    public record InvitationPage(java.util.List<InvitationView> items, long total, int page, int size,
        java.util.Map<String, Long> counts, Instant asOf) {}

    public record InvitationAction(@NotNull Integer expectedVersion) {}

    public record MemberView(Long id, Long userId, String fullName, String email, String role, String status, LocalDate effectiveDate, String reason, Integer version) {}

    public record MemberChange(
        @NotBlank @Pattern(regexp = "CHANGE_ROLE|DEACTIVATE|REACTIVATE") String action,
        @Pattern(regexp = "MANAGER|TECHNICIAN") String role,
        @NotNull LocalDate effectiveDate,
        @NotBlank @Size(max = 500) String reason,
        @NotNull Integer expectedVersion
    ) {}

    /**
     * A7 (UC-FE03-04 step 4, AF2, D28): returned only to the signed-in invited email. PENDING can be accepted; ACCEPTED is the
     * caller's own ACTIVE membership ({@code membershipId}). sentAt is the last send; times are instants shown in timeZone.
     */
    public record InvitationAcceptance(String status, Long farmId, String farmName, String timeZone, String email, String role,
        String invitedBy, Instant sentAt, Instant expiresAt, Long membershipId) {}

    /** A8 (D28): the link token identifies the intent; repeating the acceptance returns the same membership (GBR-17). */
    public record AcceptedInvitation(Long membershipId, Long farmId, String farmName, String role, String status) {}
    public record AcceptInvitation(@NotBlank String token) {}
}
