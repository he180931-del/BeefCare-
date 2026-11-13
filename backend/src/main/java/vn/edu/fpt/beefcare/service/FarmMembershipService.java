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

    @Transactional(readOnly = true)
    public List<MemberView> listMembers(Long farmId) {
        AppUser caller = access.currentActiveUser();
        FarmMembership callerMembership = memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farmId, caller.getId(), ACTIVE)
            .orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        boolean owner = "OWNER".equalsIgnoreCase(callerMembership.getRole());
        if (owner) access.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        else access.require(farmId, FarmAction.VIEW_CATALOGUES);
        return memberships.findByFarmIdOrderById(farmId).stream()
            .filter(membership -> owner || ACTIVE.equalsIgnoreCase(membership.getStatus()))
            .map(this::memberView)
            .toList();
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

    @Transactional
    public InvitationView resend(Long farmId, Long invitationId, Integer expectedVersion) {
        FarmContext owner = requireOwner(farmId, true);
        FarmInvitation invitation = ownInvitation(farmId, invitationId);
        requirePending(invitation);
        VersionGuard.requireExpected(invitation.getVersion(), expectedVersion);
        Instant now = clock.now();
        mail.cancelActionLink("INVITATION", invitation.getId());
        invitation.setTokenNonce(linkSigner.newNonce());
        String raw = linkSigner.bearer("FARM_INVITATION", invitation.getId(), invitation.getTokenNonce());
        invitation.setTokenHash(linkSigner.hash(raw)); // invalidates every previously sent link
        invitation.setLastSentAt(now);
        invitation.setExpiresAt(now.plusSeconds(invitation.getValidityDays() * 86_400L));
        audit.log(owner, "INVITE_RESEND", "FarmInvitation", invitation.getId(),
            java.util.Map.of("role", invitation.getProposedRole(), "validityDays", invitation.getValidityDays()));
        mail.queueActionLink(invitation.getInvitedEmail(), "FARM_INVITATION", "INVITATION", invitation.getId(), null, owner.farm().getName(), invitation.getProposedRole());
        invitations.flush();
        return invitationView(invitation);
    }

    @Transactional
    public InvitationView cancel(Long farmId, Long invitationId, Integer expectedVersion) {
        FarmContext owner = requireOwner(farmId, false);
        FarmInvitation invitation = ownInvitation(farmId, invitationId);
        requirePending(invitation);
        VersionGuard.requireExpected(invitation.getVersion(), expectedVersion);
        invitation.setStatus("CANCELLED");
        invitation.setCancelledAt(clock.now());
        invitation.setTokenHash(null);
        mail.cancelActionLink("INVITATION", invitation.getId());
        audit.log(owner, "INVITE_CANCEL", "FarmInvitation", invitation.getId(), java.util.Map.of("status", "CANCELLED"));
        invitations.flush();
        return invitationView(invitation);
    }

    @Transactional(readOnly = true)
    public InvitationAcceptance preview(String rawToken) {
        FarmInvitation invitation = findValidInviteForCaller(rawToken);
        if (!ACTIVE.equalsIgnoreCase(invitation.getFarm().getServiceStatus())) throw DomainException.forbidden("MSG-FE03-04");
        return new InvitationAcceptance(invitation.getFarm().getName(), invitation.getInvitedEmail(), invitation.getProposedRole(), invitation.getCreatedAt(), invitation.getExpiresAt());
    }

    @Transactional
    public MemberView accept(String rawToken) {
        FarmInvitation invitation = findInviteForCaller(rawToken, true, true);
        Farm farm = farms.lockById(invitation.getFarm().getId()).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if (!ACTIVE.equalsIgnoreCase(farm.getServiceStatus())) throw DomainException.forbidden("MSG-FE03-04");
        AppUser caller = access.currentActiveUser();
        Optional<FarmMembership> prior = memberships.findFirstByFarmIdAndUserId(farm.getId(), caller.getId());
        if (prior.isPresent()) {
            FarmMembership existing = prior.get();
            boolean accepted = "ACCEPTED".equalsIgnoreCase(invitation.getStatus());
            if (accepted && ACTIVE.equalsIgnoreCase(existing.getStatus())) return memberView(existing);
            // UC-FE03-04 E1: a used link is no longer valid. MSG-FE03-21 and the membership id are for the Owner's invite popup only (D25).
            if (accepted) throw invitationInvalid("ACCEPTED");
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        if (!PENDING.equalsIgnoreCase(invitation.getStatus()) || !invitation.getExpiresAt().isAfter(clock.now())) {
            throw invitationInvalid(invitationStatus(invitation));
        }
        FarmMembership membership = new FarmMembership();
        membership.setFarm(farm);
        membership.setUser(caller);
        membership.setRole(parseInviteRole(invitation.getProposedRole()).name());
        membership.setStatus(ACTIVE);
        membership.setEffectiveDate(clock.today());
        membership.setChangeReason("Invitation accepted");
        membership = memberships.saveAndFlush(membership);
        invitation.setStatus("ACCEPTED");
        invitation.setAcceptedAt(clock.now());
        mail.cancelActionLink("INVITATION", invitation.getId());
        audit.log(farm, caller, "MEMBER_ACCEPT", "FarmMembership", membership.getId(), java.util.Map.of("role", membership.getRole()));
        memberships.flush();
        invitations.flush();
        AppUser owner = memberships.findByFarmIdOrderById(farm.getId()).stream()
            .filter(value -> "OWNER".equalsIgnoreCase(value.getRole()) && ACTIVE.equalsIgnoreCase(value.getStatus()))
            .map(FarmMembership::getUser).findFirst().orElse(null);
        if (owner != null) mail.sendEmail(owner.getEmail(), "Farm invitation accepted", caller.getFullName() + " joined " + farm.getName() + " as Farm " + membership.getRole().toLowerCase(Locale.ROOT) + ".", false, false);
        return memberView(membership);
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
        return memberView(membership);
    }

    private FarmContext requireOwner(Long farmId, boolean requireActiveFarm) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        if (requireActiveFarm && !ACTIVE.equalsIgnoreCase(context.farm().getServiceStatus())) {
            throw DomainException.forbidden("MSG-FE03-04");
        }
        return context;
    }

    private FarmInvitation ownInvitation(Long farmId, Long invitationId) {
        return invitations.findById(invitationId).filter(invitation -> farmId.equals(invitation.getFarm().getId()))
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private void requirePending(FarmInvitation invitation) {
        expireIfNecessary(invitation);
        if (!PENDING.equalsIgnoreCase(invitation.getStatus())) throw DomainException.conflict("MSG-FE03-08", "status", invitation.getStatus());
    }

    private void expireIfNecessary(FarmInvitation invitation) {
        if (PENDING.equalsIgnoreCase(invitation.getStatus()) && invitation.getExpiresAt() != null && !invitation.getExpiresAt().isAfter(clock.now())) {
            invitation.setStatus("EXPIRED");
            invitation.setTokenHash(null);
            // Release the partial unique PENDING key before inserting a replacement invitation.
            invitations.flush();
            mail.cancelActionLink("INVITATION", invitation.getId());
            audit.log(invitation.getFarm(), access.currentActiveUser(), "INVITE_EXPIRED", "FarmInvitation", invitation.getId(), java.util.Map.of("status", "EXPIRED"));
        }
    }

    /** JOB-02: every 15 minutes; acceptance and resend also check the expiry in real time. */
    @Scheduled(cron = "${beefcare.jobs.invitation-expiry-cron:0 */15 * * * *}")
    @Transactional
    public void expirePendingInvitations() {
        List<FarmInvitation> expired = invitations.lockPendingExpiredBefore(clock.now());
        for (FarmInvitation invitation : expired) {
            invitation.setStatus("EXPIRED");
            invitation.setTokenHash(null);
            audit.log(invitation.getFarm(), null, "INVITE_EXPIRED", "FarmInvitation", invitation.getId(), java.util.Map.of("status", "EXPIRED"));
        }
        if (!expired.isEmpty()) LOG.info("Expired {} farm invitations", expired.size());
    }

    private FarmInvitation findValidInviteForCaller(String rawToken) {
        return findInviteForCaller(rawToken, false, false);
    }

    private FarmInvitation findInviteForCaller(String rawToken, boolean allowAccepted, boolean lock) {
        if (rawToken == null || rawToken.isBlank()) throw invitationInvalid("INVALID");
        String tokenHash = linkSigner.hash(rawToken);
        FarmInvitation invitation = (lock ? invitations.lockByTokenHash(tokenHash) : invitations.findOneByTokenHash(tokenHash)).orElseThrow(() -> invitationInvalid("INVALID"));
        AppUser caller = access.currentActiveUser();
        if (!invitation.getInvitedEmail().equalsIgnoreCase(caller.getEmail())) throw DomainException.forbidden(MessageCodes.FE03_09);
        if (!linkSigner.matchesHash(linkSigner.bearer("FARM_INVITATION", invitation.getId(), invitation.getTokenNonce()), invitation.getTokenHash())) throw invitationInvalid("INVALID");
        boolean acceptedReplay = allowAccepted && "ACCEPTED".equalsIgnoreCase(invitation.getStatus());
        if (!acceptedReplay && (!PENDING.equalsIgnoreCase(invitation.getStatus()) || !invitation.getExpiresAt().isAfter(clock.now()))) throw invitationInvalid(invitationStatus(invitation));
        return invitation;
    }

    private MemberView memberView(FarmMembership membership) {
        AppUser user = membership.getUser();
        return new MemberView(membership.getId(), user.getId(), user.getFullName(), user.getEmail(), membership.getRole(), membership.getStatus(), membership.getEffectiveDate(), membership.getChangeReason(), membership.getVersion());
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
}
