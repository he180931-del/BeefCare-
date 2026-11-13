package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.*;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

/** Owner-controlled invitation lifecycle and fixed farm-role membership changes (GBR-06, GBR-14, GBR-16–18). */
@Service
public class FarmMembershipService {

    private static final Logger LOG = LoggerFactory.getLogger(FarmMembershipService.class);

    private static final String ACTIVE = "ACTIVE";
    private static final String PENDING = "PENDING";
    private static final String ACCEPTED = "ACCEPTED";
    private final FarmAccessService access;
    private final FarmRepository farms;
    private final FarmInvitationRepository invitations;
    private final FarmMembershipRepository memberships;
    private final AppUserRepository users;
    private final AuditService audit;
    private final MailService mail;
    private final FarmClock clock;
    private final ActionLinkSigner linkSigner;

    public FarmMembershipService(
        FarmAccessService access,
        FarmRepository farms,
        FarmInvitationRepository invitations,
        FarmMembershipRepository memberships,
        AppUserRepository users,
        AuditService audit,
        MailService mail,
        FarmClock clock,
        ActionLinkSigner linkSigner
    ) {
        this.access = access;
        this.farms = farms;
        this.invitations = invitations;
        this.memberships = memberships;
        this.users = users;
        this.audit = audit;
        this.mail = mail;
        this.clock = clock;
        this.linkSigner = linkSigner;
    }

    /**
     * A1 / SCR-13 (UC-FE03-05, D29). The Owner reads every membership in any service status (GBR-14 read exception that
     * supports deactivation); a Manager reads the ACTIVE memberships of an ACTIVE farm; a Technician is refused (Table III-2).
     */
    @Transactional(readOnly = true)
    public MemberList listMembers(Long farmId) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_MEMBERS);
        boolean owner = context.role() == FarmRole.OWNER;
        Farm farm = context.farm();
        boolean farmActive = ACTIVE.equalsIgnoreCase(farm.getServiceStatus());
        java.text.Collator collator = java.text.Collator.getInstance(Locale.forLanguageTag("vi"));
        collator.setStrength(java.text.Collator.SECONDARY); // letter case ignored, Vietnamese accents kept
        List<FarmMembership> rows = memberships.findWithUserByFarmId(farmId).stream()
            .filter(membership -> owner || ACTIVE.equalsIgnoreCase(membership.getStatus()))
            .sorted(java.util.Comparator.<FarmMembership, String>comparing(FarmMembershipService::sortName, collator)
                .thenComparing(membership -> membership.getUser().getEmail(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(FarmMembership::getId))
            .toList();
        long managers = rows.stream().filter(m -> ACTIVE.equalsIgnoreCase(m.getStatus()) && "MANAGER".equalsIgnoreCase(m.getRole())).count();
        long technicians = rows.stream().filter(m -> ACTIVE.equalsIgnoreCase(m.getStatus()) && "TECHNICIAN".equalsIgnoreCase(m.getRole())).count();
        Long inactive = owner ? rows.stream().filter(m -> !ACTIVE.equalsIgnoreCase(m.getStatus())).count() : null;
        List<MemberView> items = rows.stream().map(membership -> memberView(membership, owner, farmActive)).toList();
        return new MemberList(farm.getName(), farm.getTimeZone(), farm.getServiceStatus(), new MemberCounts(rows.size(), managers, technicians, inactive), items);
    }

    private static String sortName(FarmMembership membership) {
        String name = membership.getUser().getFullName();
        return name == null || name.isBlank() ? membership.getUser().getEmail() : name.trim();
    }

    /** The Owner's commands on a row now (GBR-18, D29); a Manager gets none and the Owner row has none. */
    private static List<String> memberActions(FarmMembership membership, boolean ownerCaller, boolean farmActive) {
        if (!ownerCaller || "OWNER".equalsIgnoreCase(membership.getRole())) return List.of();
        if (ACTIVE.equalsIgnoreCase(membership.getStatus())) return farmActive ? List.of("CHANGE_ROLE", "DEACTIVATE") : List.of("DEACTIVATE");
        return farmActive ? List.of("REACTIVATE") : List.of();
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public InvitationPage listInvitations(Long farmId, String status, int page, int size, String sort, String dir, Long invitationId) {
        access.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        String filter = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        if (filter != null && !List.of("PENDING", "ACCEPTED", "CANCELLED", "EXPIRED").contains(filter)) {
            throw DomainException.invalid("status");
        }
        if (page < 0 || page > Integer.MAX_VALUE / 100) throw DomainException.invalid("page");
        if (size < 1 || size > 100) throw DomainException.invalid("size");
        if (!"lastSentAt".equals(sort)) throw DomainException.invalid("sort");
        if (dir == null || !List.of("asc", "desc").contains(dir.toLowerCase(Locale.ROOT))) throw DomainException.invalid("dir");
        if (invitationId != null && invitationId < 1) throw DomainException.invalid("invitationId");
        java.time.Instant asOf = clock.now();
        var order = org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.fromString(dir), "lastSentAt")
            .and(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "id"));
        var found = invitations.searchInvitations(farmId, filter, invitationId, asOf, org.springframework.data.domain.PageRequest.of(page, size, order));
        var counts = new java.util.LinkedHashMap<String, Long>();
        var totals = invitations.countInvitationStatuses(farmId, asOf);
        counts.put("PENDING", totals.getPending()); counts.put("ACCEPTED", totals.getAccepted());
        counts.put("EXPIRED", totals.getExpired()); counts.put("CANCELLED", totals.getCancelled());
        var emails = found.stream().map(row -> row.getInvitedEmail().toLowerCase(Locale.ROOT)).toList();
        java.util.Set<String> existing = emails.isEmpty() ? java.util.Set.of() : users.findExistingInvitationEmails(emails);
        var items = found.stream().map(row -> invitationView(row, invitationStatus(row, asOf), existing.contains(row.getInvitedEmail().toLowerCase(Locale.ROOT)))).toList();
        return new InvitationPage(items, found.getTotalElements(), page, size, counts, asOf);
    }

    @Transactional
    public InvitationView invite(Long farmId, InviteRequest request) {
        FarmContext owner = requireOwner(farmId, true);
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if (!ACTIVE.equalsIgnoreCase(farm.getServiceStatus())) throw DomainException.forbidden("MSG-FE03-04");
        String email = normalizeEmail(request.email());
        int validityDays = request.validityDays() == null ? 7 : request.validityDays();
        if (!List.of(3, 7, 14).contains(validityDays)) throw DomainException.invalid("validityDays");
        FarmRole role = parseInviteRole(request.role());
        if (role != FarmRole.MANAGER && role != FarmRole.TECHNICIAN) throw DomainException.invalid("role");

        Optional<AppUser> account = users.findOneByEmailIgnoreCase(email);
        if (account.isPresent()) {
            Optional<FarmMembership> existing = memberships.findFirstByFarmIdAndUserId(farmId, account.get().getId());
            if (existing.filter(membership -> ACTIVE.equalsIgnoreCase(membership.getStatus())).isPresent()) {
                throw DomainException.conflict("MSG-FE03-02", "email", email);
            }
            if (existing.isPresent()) {
                throw DomainException.conflict(MessageCodes.FE03_21, "membershipId", existing.get().getId(), "email", email);
            }
        }
        Optional<FarmInvitation> existingInvite = invitations.findFirstByFarmIdAndInvitedEmailIgnoreCaseAndStatusIgnoreCase(farmId, email, PENDING);
        if (existingInvite.isPresent()) {
            expireIfNecessary(existingInvite.get());
            if (PENDING.equalsIgnoreCase(existingInvite.get().getStatus())) {
                throw DomainException.conflict(MessageCodes.FE03_03, "invitationId", existingInvite.get().getId(), "email", email);
            }
        }

        Instant now = clock.now();
        FarmInvitation invitation = new FarmInvitation();
        invitation.setFarm(farm);
        invitation.setInvitedBy(owner.user());
        invitation.setInvitedEmail(email);
        invitation.setProposedRole(role.name());
        invitation.setProposedPermissions(null); // role permissions are fixed system policy, never per-member grants
        invitation.setStatus(PENDING);
        invitation.setCreatedAt(now);
        invitation.setLastSentAt(now);
        invitation.setValidityDays(validityDays);
        invitation.setExpiresAt(now.plusSeconds(validityDays * 86_400L));
        invitation.setTokenNonce(linkSigner.newNonce());
        invitation.setTokenHash(linkSigner.hash(linkSigner.newNonce())); // replaced atomically after the sequence id is assigned
        invitation = invitations.saveAndFlush(invitation);
        String rawToken = linkSigner.bearer("FARM_INVITATION", invitation.getId(), invitation.getTokenNonce());
        invitation.setTokenHash(linkSigner.hash(rawToken));
        invitation = invitations.saveAndFlush(invitation);
        audit.log(owner, "MEMBER_INVITE", "FarmInvitation", invitation.getId(),
            java.util.Map.of("role", role.name(), "validityDays", validityDays));
        mail.queueActionLink(invitation.getInvitedEmail(), "FARM_INVITATION", "INVITATION", invitation.getId(), null, farm.getName(), role.name());
        return invitationView(invitation, invitationStatus(invitation), account.isPresent());
    }

    /** UC-FE03-03 / GBR-16: same invitation, email, role and validity; the period restarts and only the newest link works (D27). */
    @Transactional
    public InvitationView resend(Long farmId, Long invitationId, Integer expectedVersion) {
        FarmContext owner = requireOwner(farmId, true);
        FarmInvitation invitation = lockPendingInvitation(farmId, invitationId, expectedVersion);
        Instant now = clock.now();
        var before = java.util.Map.of("lastSentAt", invitation.getLastSentAt().toString(), "expiresAt", invitation.getExpiresAt().toString());
        mail.cancelActionLink("INVITATION", invitation.getId());
        invitation.setTokenNonce(linkSigner.newNonce());
        String raw = linkSigner.bearer("FARM_INVITATION", invitation.getId(), invitation.getTokenNonce());
        invitation.setTokenHash(linkSigner.hash(raw)); // invalidates every previously sent link
        invitation.setLastSentAt(now);
        invitation.setExpiresAt(now.plusSeconds(invitation.getValidityDays() * 86_400L));
        audit.log(owner, "INVITE_RESEND", "FarmInvitation", invitation.getId(), java.util.Map.of(
            "role", invitation.getProposedRole(), "validityDays", invitation.getValidityDays(), "before", before,
            "after", java.util.Map.of("lastSentAt", invitation.getLastSentAt().toString(), "expiresAt", invitation.getExpiresAt().toString())));
        mail.queueActionLink(invitation.getInvitedEmail(), "FARM_INVITATION", "INVITATION", invitation.getId(), null, owner.farm().getName(), invitation.getProposedRole());
        invitations.flush();
        return invitationView(invitation);
    }

    /** UC-FE03-03 / GBR-14: allowed in every service status so the Owner can withdraw access. */
    @Transactional
    public InvitationView cancel(Long farmId, Long invitationId, Integer expectedVersion) {
        FarmContext owner = requireOwner(farmId, false);
        FarmInvitation invitation = lockPendingInvitation(farmId, invitationId, expectedVersion);
        invitation.setStatus("CANCELLED");
        invitation.setCancelledAt(clock.now());
        // D28: the hash stays until JOB-08 so the link can still say CANCELLED; the status check means it grants nothing.
        mail.cancelActionLink("INVITATION", invitation.getId());
        audit.log(owner, "INVITE_CANCEL", "FarmInvitation", invitation.getId(),
            java.util.Map.of("role", invitation.getProposedRole(), "statusBefore", PENDING, "statusAfter", "CANCELLED"));
        invitations.flush();
        return invitationView(invitation);
    }

    /**
     * A7 / SCR-15. Only the signed-in invited email learns anything (E2 first). PENDING and unexpired: reviewable while the
     * farm is ACTIVE (E3). ACCEPTED: the caller's own ACTIVE membership is shown again (AF2, D28); otherwise the link is used (E1).
     */
    @Transactional(readOnly = true)
    public InvitationAcceptance preview(String rawToken) {
        FarmInvitation invitation = findInviteForCaller(rawToken, true, false);
        Farm farm = invitation.getFarm();
        if (ACCEPTED.equalsIgnoreCase(invitation.getStatus())) {
            return acceptance(invitation, ACCEPTED, activeMembershipOfCaller(invitation).getId());
        }
        if (!ACTIVE.equalsIgnoreCase(farm.getServiceStatus())) throw DomainException.forbidden(MessageCodes.FE03_04);
        return acceptance(invitation, PENDING, null);
    }

    /** A8 / UC-FE03-04 steps 6-8. The token is the intent (D28): repeating the acceptance returns the same membership (GBR-17). */
    @Transactional
    public AcceptedInvitation accept(String rawToken) {
        FarmInvitation invitation = findInviteForCaller(rawToken, true, true);
        Farm farm = farms.lockById(invitation.getFarm().getId()).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        // MSG-FE03-21 and the membership id are for the Owner's invite popup only (D25); a used link is MSG-FE03-08 (E1).
        if (ACCEPTED.equalsIgnoreCase(invitation.getStatus())) return accepted(activeMembershipOfCaller(invitation));
        if (!ACTIVE.equalsIgnoreCase(farm.getServiceStatus())) throw DomainException.forbidden(MessageCodes.FE03_04);
        AppUser caller = access.currentActiveUser();
        if (memberships.findFirstByFarmIdAndUserId(farm.getId(), caller.getId()).isPresent()) throw DomainException.conflict(MessageCodes.COM_05);
        if (!PENDING.equalsIgnoreCase(invitation.getStatus()) || !invitation.getExpiresAt().isAfter(clock.now())) {
            throw invitationInvalid(invitation);
        }
        FarmMembership created = new FarmMembership();
        created.setFarm(farm);
        created.setUser(caller);
        created.setRole(parseInviteRole(invitation.getProposedRole()).name());
        created.setStatus(ACTIVE);
        created.setEffectiveDate(clock.today());
        created.setJoinedAt(clock.now());
        created.setChangeReason("Invitation accepted");
        FarmMembership membership = memberships.saveAndFlush(created);
        invitation.setStatus(ACCEPTED);
        invitation.setAcceptedAt(clock.now());
        mail.cancelActionLink("INVITATION", invitation.getId());
        audit.log(farm, caller, "MEMBER_ACCEPT", "FarmMembership", membership.getId(), java.util.Map.of("role", membership.getRole()));
        // Step 8 / GBR-64 (D28): the Owner e-mail intent commits with the acceptance; JOB-07 resolves the Owner again and retries.
        memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farm.getId(), "OWNER", ACTIVE)
            .ifPresent(owner -> mail.queueMemberJoined(owner.getUser(), membership));
        memberships.flush();
        invitations.flush();
        return accepted(membership);
    }

    /** AF2 / GBR-17: an ACCEPTED link stays usable only by the person whose membership it created, while that membership is ACTIVE. */
    private FarmMembership activeMembershipOfCaller(FarmInvitation invitation) {
        AppUser caller = access.currentActiveUser();
        return memberships.findFirstByFarmIdAndUserId(invitation.getFarm().getId(), caller.getId())
            .filter(membership -> ACTIVE.equalsIgnoreCase(membership.getStatus()))
            .orElseThrow(() -> invitationInvalid(invitation));
    }

    private InvitationAcceptance acceptance(FarmInvitation invitation, String status, Long membershipId) {
        Farm farm = invitation.getFarm();
        String invitedBy = invitation.getInvitedBy() == null ? null : invitation.getInvitedBy().getFullName();
        return new InvitationAcceptance(status, farm.getId(), farm.getName(), farm.getTimeZone(), invitation.getInvitedEmail(),
            invitation.getProposedRole(), invitedBy, invitation.getLastSentAt(), invitation.getExpiresAt(), membershipId);
    }

    private static AcceptedInvitation accepted(FarmMembership membership) {
        return new AcceptedInvitation(membership.getId(), membership.getFarm().getId(), membership.getFarm().getName(), membership.getRole(), membership.getStatus());
    }

    @Transactional
    public MemberView changeMember(Long farmId, Long membershipId, MemberChange request) {
        FarmContext owner = requireOwner(farmId, false);
        FarmMembership membership = memberships.findById(membershipId).filter(value -> farmId.equals(value.getFarm().getId()))
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if ("OWNER".equalsIgnoreCase(membership.getRole())) throw DomainException.forbidden(MessageCodes.COM_01);
        VersionGuard.requireExpected(membership.getVersion(), request.expectedVersion());
        LocalDate effectiveDate = request.effectiveDate();
        if (effectiveDate.isAfter(clock.today())) throw DomainException.badRequest(MessageCodes.COM_07, "field", "effectiveDate");
        String reason = request.reason().trim();
        if (reason.isEmpty()) throw DomainException.required("reason");
        String action = request.action().trim().toUpperCase(Locale.ROOT);
        boolean farmActive = ACTIVE.equalsIgnoreCase(owner.farm().getServiceStatus());
        if (("CHANGE_ROLE".equals(action) || "REACTIVATE".equals(action)) && !farmActive) throw DomainException.forbidden("MSG-FE03-04");

        switch (action) {
            case "CHANGE_ROLE" -> {
                FarmRole role = parseInviteRole(request.role());
                if (role == null || role == FarmRole.OWNER) throw DomainException.invalid("role");
                if (role.name().equalsIgnoreCase(membership.getRole())) throw DomainException.conflict(MessageCodes.FE03_20, "target", membership.getUser().getEmail(), "value", "role");
                membership.setRole(role.name());
            }
            case "DEACTIVATE" -> {
                if (!ACTIVE.equalsIgnoreCase(membership.getStatus())) throw DomainException.conflict(MessageCodes.FE03_20, "target", membership.getUser().getEmail(), "value", "status");
                membership.setStatus("INACTIVE");
            }
            case "REACTIVATE" -> {
                if (ACTIVE.equalsIgnoreCase(membership.getStatus())) throw DomainException.conflict(MessageCodes.FE03_20, "target", membership.getUser().getEmail(), "value", "status");
                membership.setStatus(ACTIVE);
            }
            default -> throw DomainException.invalid("action");
        }
        membership.setEffectiveDate(effectiveDate);
        membership.setChangeReason(reason);
        audit.log(owner, "MEMBER_" + action, "FarmMembership", membership.getId(),
            java.util.Map.of("role", membership.getRole(), "status", membership.getStatus(), "effectiveDate", effectiveDate.toString()));
        memberships.flush();
        return memberView(membership, true, farmActive);
    }

    private FarmContext requireOwner(Long farmId, boolean requireActiveFarm) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        if (requireActiveFarm && !ACTIVE.equalsIgnoreCase(context.farm().getServiceStatus())) {
            throw DomainException.forbidden("MSG-FE03-04");
        }
        return context;
    }

    /**
     * UC-FE03-03 step 4: the row lock makes a concurrent command wait and then see the committed status. Status is checked
     * before the version (E2 before E4) and with the read clock, so an expired PENDING row reports EXPIRED without writing.
     */
    private FarmInvitation lockPendingInvitation(Long farmId, Long invitationId, Integer expectedVersion) {
        FarmInvitation invitation = invitations.lockByIdAndFarmId(invitationId, farmId)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        String status = invitationStatus(invitation).toUpperCase(Locale.ROOT);
        if (!PENDING.equals(status)) throw DomainException.conflict(MessageCodes.FE03_08, "status", status);
        VersionGuard.requireExpected(invitation.getVersion(), expectedVersion);
        return invitation;
    }

    private void expireIfNecessary(FarmInvitation invitation) {
        if (PENDING.equalsIgnoreCase(invitation.getStatus()) && invitation.getExpiresAt() != null && !invitation.getExpiresAt().isAfter(clock.now())) {
            invitation.setStatus("EXPIRED"); // D28: the link hash stays until JOB-08 so SCR-15 can still say EXPIRED
            // Release the partial unique PENDING key before inserting a replacement invitation.
            invitations.flush();
            mail.cancelActionLink("INVITATION", invitation.getId());
            audit.log(invitation.getFarm(), access.currentActiveUser(), "INVITE_EXPIRED", "FarmInvitation", invitation.getId(), java.util.Map.of("status", "EXPIRED"));
        }
    }

    /**
     * JOB-02: every 15 minutes; acceptance and resend also check the expiry in real time. The link hash is kept (D28): the
     * status alone makes the link grant nothing, and JOB-08 removes the hash 7 days after expiry.
     */
    @Scheduled(cron = "${beefcare.jobs.invitation-expiry-cron:0 */15 * * * *}")
    @Transactional
    public void expirePendingInvitations() {
        List<FarmInvitation> expired = invitations.lockPendingExpiredBefore(clock.now());
        for (FarmInvitation invitation : expired) {
            invitation.setStatus("EXPIRED");
            audit.log(invitation.getFarm(), null, "INVITE_EXPIRED", "FarmInvitation", invitation.getId(), java.util.Map.of("status", "EXPIRED"));
        }
        if (!expired.isEmpty()) LOG.info("Expired {} farm invitations", expired.size());
    }

    /** E2 before anything else: a link opened by another account reveals neither the farm nor the invitation's status. */
    private FarmInvitation findInviteForCaller(String rawToken, boolean allowAccepted, boolean lock) {
        if (rawToken == null || rawToken.isBlank()) throw invitationInvalid("INVALID");
        String tokenHash = linkSigner.hash(rawToken);
        FarmInvitation invitation = (lock ? invitations.lockByTokenHash(tokenHash) : invitations.findOneByTokenHash(tokenHash)).orElseThrow(() -> invitationInvalid("INVALID"));
        AppUser caller = access.currentActiveUser();
        if (!invitation.getInvitedEmail().equalsIgnoreCase(caller.getEmail())) throw DomainException.forbidden(MessageCodes.FE03_09);
        if (!linkSigner.matchesHash(linkSigner.bearer("FARM_INVITATION", invitation.getId(), invitation.getTokenNonce()), invitation.getTokenHash())) throw invitationInvalid("INVALID");
        boolean acceptedReplay = allowAccepted && ACCEPTED.equalsIgnoreCase(invitation.getStatus());
        if (!acceptedReplay && (!PENDING.equalsIgnoreCase(invitation.getStatus()) || !invitation.getExpiresAt().isAfter(clock.now()))) throw invitationInvalid(invitation);
        return invitation;
    }

    private static MemberView memberView(FarmMembership membership, boolean ownerCaller, boolean farmActive) {
        AppUser user = membership.getUser();
        return new MemberView(membership.getId(), user.getId(), user.getFullName(), user.getEmail(), membership.getRole(), membership.getStatus(),
            membership.getJoinedAt(), membership.getVersion(), memberActions(membership, ownerCaller, farmActive));
    }

    private InvitationView invitationView(FarmInvitation invitation) {
        return invitationView(invitation, invitationStatus(invitation));
    }

    private InvitationView invitationView(FarmInvitation invitation, String status) {
        return invitationView(invitation, status, users.existsByEmailIgnoreCase(invitation.getInvitedEmail()));
    }

    private InvitationView invitationView(FarmInvitation invitation, String status, boolean hasAccount) {
        return new InvitationView(invitation.getId(), invitation.getInvitedEmail(), invitation.getProposedRole(), status, invitation.getCreatedAt(), invitation.getLastSentAt(), invitation.getExpiresAt(), invitation.getValidityDays(), invitation.getVersion(), hasAccount);
    }

    private String invitationStatus(FarmInvitation invitation) {
        return invitationStatus(invitation, clock.now());
    }

    private String invitationStatus(FarmInvitation invitation, java.time.Instant asOf) {
        return PENDING.equalsIgnoreCase(invitation.getStatus()) && invitation.getExpiresAt() != null && !invitation.getExpiresAt().isAfter(asOf)
            ? "EXPIRED"
            : invitation.getStatus();
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) throw DomainException.required("email");
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 254 || !normalized.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw DomainException.invalid("email");
        return normalized;
    }

    private FarmRole parseInviteRole(String role) {
        if (role == null) return null;
        try { return FarmRole.valueOf(role.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException error) { return null; }
    }

    /** MSG-FE03-08: the invitation is expired, cancelled, already used or the link is invalid ({@code status} is INVALID when unknown). */
    private static DomainException invitationInvalid(String status) {
        return DomainException.badRequest(MessageCodes.FE03_08, "status", status);
    }

    /** SCR-15 "Invitation no longer valid": MSG-FE03-08 with the status and expiry, for the invited email only (D28). */
    private DomainException invitationInvalid(FarmInvitation invitation) {
        return DomainException.badRequest(MessageCodes.FE03_08, "status", invitationStatus(invitation).toUpperCase(Locale.ROOT),
            "expiresAt", invitation.getExpiresAt().toString());
    }
}
