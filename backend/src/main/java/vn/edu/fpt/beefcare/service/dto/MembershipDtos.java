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

    /**
     * A1 row (UC-FE03-05, D29). {@code joinedAt} is the instant the membership was created (shown as mm/yyyy in the farm
     * time zone). {@code actions} are the Owner's commands available now: CHANGE_ROLE and REACTIVATE need an ACTIVE farm,
     * DEACTIVATE is always available on an ACTIVE member; empty on the Owner row and for a Manager. The reason and effective
     * date of the last change are not part of SCR-13 and are not returned.
     */
    public record MemberView(Long id, Long userId, String fullName, String email, String role, String status, Instant joinedAt, Integer version,
        java.util.List<String> actions) {}

    /**
     * SCR-13 tabs (D29): {@code all} counts every row returned (the Owner and inactive members included for the Owner),
     * {@code managers} / {@code technicians} only ACTIVE members of that role, {@code inactive} the INACTIVE members and
     * only for the Owner (omitted for a Manager, who has no Inactive tab).
     */
    public record MemberCounts(long all, long managers, long technicians,
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) Long inactive) {}

    /**
     * A1 (D29): the whole member list of the farm, ordered by name (Vietnamese, case-insensitive; email when there is no
     * name; then id). The farm name, time zone and stored service status let SCR-13 render without the Owner-only farm API.
     */
    public record MemberList(String farmName, String timeZone, String serviceStatus, MemberCounts counts, java.util.List<MemberView> items) {}

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
