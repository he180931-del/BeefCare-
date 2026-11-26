package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.domain.AnnouncementMemberSelector;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementMemberSelectorRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.repository.FarmAnnouncementRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.*;

/** FE-07 draft, publication, correction history and recipient delivery snapshot commands. */
@Service
public class FarmAnnouncementService {
    private static final String ACTIVE = "ACTIVE";
    private static final String FE07_INVALID_RECIPIENT = "MSG-FE07-02";
    private static final String FE07_NO_RECIPIENT = "MSG-FE07-05";

    private final FarmAccessService access;
    private final FarmClock clock;
    private final EntityManager entityManager;
    private final FarmMembershipRepository memberships;
    private final FarmAnnouncementRepository announcements;
    private final AnnouncementVersionRepository versions;
    private final AnnouncementRecipientRepository recipients;
    private final AnnouncementMemberSelectorRepository memberSelectors;
    private final OutboxService outbox;

    public FarmAnnouncementService(
        FarmAccessService access,
        FarmClock clock,
        EntityManager entityManager,
        FarmMembershipRepository memberships,
        FarmAnnouncementRepository announcements,
        AnnouncementVersionRepository versions,
        AnnouncementRecipientRepository recipients,
        AnnouncementMemberSelectorRepository memberSelectors,
        OutboxService outbox
    ) {
        this.access = access;
        this.clock = clock;
        this.entityManager = entityManager;
        this.memberships = memberships;
        this.announcements = announcements;
        this.versions = versions;
        this.recipients = recipients;
        this.memberSelectors = memberSelectors;
        this.outbox = outbox;
    }

    /** Active, farm-scoped memberships that the current author is allowed to address (GBR-60). */
    @Transactional(readOnly = true)
    public List<MemberOption> listEligibleRecipients(Long farmId) {
        FarmContext context = access.require(farmId, FarmAction.MANAGE_ANNOUNCEMENTS);
        FarmMembership author = membership(farmId, context.user().getId());
        Set<String> allowedRoles = allowedRecipientRoles(context.role());
        return memberships.findByFarm_IdAndStatusIgnoreCase(farmId, ACTIVE).stream()
            .filter(candidate -> !candidate.getId().equals(author.getId()))
            .filter(candidate -> ACTIVE.equalsIgnoreCase(candidate.getStatus()))
            .filter(candidate -> !hasActivePlatformRole(candidate))
            .filter(candidate -> {
                FarmRole role = FarmAccessService.parseRole(candidate.getRole());
                return role != null && allowedRoles.contains(role.name());
            })
            .sorted(Comparator.comparing(FarmMembership::getId))
            .map(this::memberOption)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<AnnouncementView> list(Long farmId) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_ANNOUNCEMENTS);
        FarmMembership member = membership(farmId, context.user().getId());
        Map<Long, AnnouncementView> result = new LinkedHashMap<>();

        for (FarmAnnouncement announcement : announcements.findByFarm_IdOrderByIdDesc(farmId)) {
            if (announcement.getAuthor().getId().equals(member.getId())) {
                result.put(announcement.getId(), view(announcement, true, member));
            }
        }
        for (AnnouncementRecipient delivery : recipients.findByMembership_IdOrderByDeliveredTimeDesc(member.getId())) {
            FarmAnnouncement announcement = delivery.getVersion().getAnnouncement();
            if (announcement.getFarm().getId().equals(farmId)) {
                result.putIfAbsent(announcement.getId(), view(announcement, false, member));
            }
        }

        return result.values().stream()
            .sorted(
                Comparator.comparing(
                    AnnouncementView::publishedTime,
                    Comparator.nullsLast(Comparator.reverseOrder())
                ).thenComparing(AnnouncementView::id, Comparator.reverseOrder())
            )
            .toList();
    }

    @Transactional(readOnly = true)
    public AnnouncementView get(Long farmId, Long id) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_ANNOUNCEMENTS);
        FarmMembership member = membership(farmId, context.user().getId());
        FarmAnnouncement announcement = load(farmId, id);
        boolean author = announcement.getAuthor().getId().equals(member.getId());
        if (
            !author &&
            ("DRAFT".equals(announcement.getState()) || !recipients.existsByVersion_Announcement_IdAndMembership_Id(id, member.getId()))
        ) {
            throw DomainException.notFound(MessageCodes.COM_08);
        }
        return view(announcement, author, member);
    }

    @Transactional(readOnly = true)
    public PublishPreview previewPublish(Long farmId, Long id) {
        FarmContext context = access.require(farmId, FarmAction.MANAGE_ANNOUNCEMENTS);
        FarmMembership author = membership(farmId, context.user().getId());
        FarmAnnouncement announcement = load(farmId, id);
        requireAuthor(announcement, author);
        requireDraft(announcement);
        List<String> audience = validateRecipients(context.role(), splitRoles(announcement.getRecipientRoles()));
        List<FarmMembership> named = validateNamedRecipients(farmId, author, context.role(), selectedMemberIds(announcement));
        requireAudience(audience, named);
        List<FarmMembership> currentMembers = memberships.findByFarm_IdAndStatusIgnoreCase(context.farmId(), ACTIVE);
        List<FarmMembership> eligible = eligibleRecipients(author, audience, named, currentMembers);
        return new PublishPreview(
            view(announcement, true, author),
            eligible.stream().map(this::memberOption).toList()
        );
    }

    @Transactional
    public AnnouncementView createDraft(Long farmId, DraftRequest request) {
        FarmContext context = access.require(farmId, FarmAction.MANAGE_ANNOUNCEMENTS);
        List<String> roleNames = validateRecipients(context.role(), request.recipientRoles());
        FarmMembership author = membership(farmId, context.user().getId());
        List<FarmMembership> named = validateNamedRecipients(farmId, author, context.role(), request.recipientMemberIds());
        requireAudience(roleNames, named);

        FarmAnnouncement announcement = new FarmAnnouncement();
        announcement.setFarm(context.farm());
        announcement.setAuthor(author);
        announcement.setState("DRAFT");
        announcement.setDraftTitle(request.title().trim());
        announcement.setDraftBody(request.body().trim());
        announcement.setRecipientRoles(String.join(",", roleNames));
        announcement = announcements.saveAndFlush(announcement);
        saveMemberSelectors(announcement, named);
        return view(announcement, true, author);
    }

    @Transactional
    public AnnouncementView updateDraft(Long farmId, Long id, DraftRequest request) {
        FarmContext context = access.require(farmId, FarmAction.MANAGE_ANNOUNCEMENTS);
        FarmMembership author = membership(farmId, context.user().getId());
        FarmAnnouncement announcement = load(farmId, id);
        requireAuthor(announcement, author);
        requireDraft(announcement);
        VersionGuard.requireExpected(announcement.getVersion(), request.expectedVersion());

        List<String> roleNames = validateRecipients(context.role(), request.recipientRoles());
        List<Long> previousMemberIds = selectedMemberIds(announcement);
        // A null field is an older role-only client; preserve any newer named selection. [] explicitly clears it.
        List<Long> memberIds = request.recipientMemberIds() == null ? previousMemberIds : request.recipientMemberIds();
        List<FarmMembership> named = validateNamedRecipients(farmId, author, context.role(), memberIds);
        requireAudience(roleNames, named);

        String roleSelection = String.join(",", roleNames);
        List<Long> namedIds = named.stream().map(FarmMembership::getId).toList();
        if (!Objects.equals(announcement.getRecipientRoles(), roleSelection) || !previousMemberIds.equals(namedIds)) {
            int audienceRevision = announcement.getDraftAudienceRevision() == null ? 0 : announcement.getDraftAudienceRevision();
            announcement.setDraftAudienceRevision(audienceRevision + 1);
        }

        announcement.setDraftTitle(request.title().trim());
        announcement.setDraftBody(request.body().trim());
        announcement.setRecipientRoles(roleSelection);
        announcements.saveAndFlush(announcement);
        saveMemberSelectors(announcement, named);
        return view(announcement, true, author);
    }

    @Transactional
    public AnnouncementView publish(Long farmId, Long id, PublishRequest request) {
        FarmContext context = access.require(farmId, FarmAction.MANAGE_ANNOUNCEMENTS);
        FarmMembership author = membership(farmId, context.user().getId());
        FarmAnnouncement announcement = load(farmId, id);
        requireAuthor(announcement, author);
        VersionGuard.requireExpected(announcement.getVersion(), request.expectedVersion());
        requireDraft(announcement);

        publishVersion(context, announcement, author, null);
        announcement.setState("PUBLISHED");
        announcements.saveAndFlush(announcement);
        return view(announcement, true, author);
    }

    @Transactional
    public AnnouncementView correctPublished(Long farmId, Long id, CorrectionRequest request) {
        FarmContext context = access.require(farmId, FarmAction.MANAGE_ANNOUNCEMENTS);
        FarmMembership author = membership(farmId, context.user().getId());
        FarmAnnouncement announcement = load(farmId, id);
        requireAuthor(announcement, author);
        VersionGuard.requireExpected(announcement.getVersion(), request.expectedVersion());
        if (!"PUBLISHED".equals(announcement.getState())) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }

        announcement.setDraftTitle(request.title().trim());
        announcement.setDraftBody(request.body().trim());
        announcements.saveAndFlush(announcement);
        publishVersion(context, announcement, author, request.reason().trim());
        return view(announcement, true, author);
    }

    @Transactional
    public ReadResult markRead(Long farmId, Long recipientId) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_ANNOUNCEMENTS);
        FarmMembership member = membership(farmId, context.user().getId());
        AnnouncementRecipient item = recipients
            .findByIdAndMembership_Id(recipientId, member.getId())
            .filter(delivery -> delivery.getVersion().getAnnouncement().getFarm().getId().equals(farmId))
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if (item.getReadTime() == null) {
            item.setReadTime(clock.now());
        }
        AnnouncementRecipient saved = recipients.save(item);
        return new ReadResult(saved.getId(), saved.getReadTime());
    }

    private AnnouncementVersion publishVersion(FarmContext context, FarmAnnouncement announcement, FarmMembership author, String correctionReason) {
        if (announcement.getDraftTitle() == null || announcement.getDraftTitle().isBlank() || announcement.getDraftBody() == null || announcement.getDraftBody().isBlank()) {
            throw DomainException.required("content");
        }

        List<FarmMembership> targets;
        if (correctionReason != null) {
            AnnouncementVersion original = versions
                .findByAnnouncement_IdOrderByVersionNoDesc(announcement.getId())
                .stream()
                .min(Comparator.comparing(AnnouncementVersion::getVersionNo))
                .orElseThrow(() -> DomainException.conflict(MessageCodes.COM_05));
            List<Long> originalRecipientIds = recipients.findByVersion_Id(original.getId()).stream()
                .map(delivery -> delivery.getMembership().getId())
                .distinct()
                .sorted()
                .toList();
            List<Long> lockIds = new ArrayList<>(originalRecipientIds);
            lockIds.add(author.getId());
            List<FarmMembership> locked = lockAndRefresh(memberships.lockByIdsAndFarmIdOrderById(
                context.farmId(), lockIds.stream().distinct().sorted().toList()
            ));
            FarmMembership currentAuthor = requireCurrentAuthor(locked, author, context);
            Set<Long> originalIdSet = new HashSet<>(originalRecipientIds);
            targets = locked.stream()
                .filter(member -> originalIdSet.contains(member.getId()))
                .filter(member -> !member.getId().equals(currentAuthor.getId()))
                .filter(member -> ACTIVE.equalsIgnoreCase(member.getStatus()))
                .filter(member -> !hasActivePlatformRole(member))
                .toList();
        } else {
            List<String> audience = validateRecipients(context.role(), splitRoles(announcement.getRecipientRoles()));
            List<Long> selectedMemberIds = selectedMemberIds(announcement);
            List<Long> lockIds = new ArrayList<>(selectedMemberIds);
            lockIds.add(author.getId());
            List<String> lockRoles = audience.isEmpty() ? List.of("__NO_MATCHING_ROLE__") : audience;
            List<FarmMembership> locked = lockAndRefresh(memberships.lockAnnouncementCandidatesByFarmIdAndRolesOrIds(
                context.farmId(), lockRoles, lockIds.stream().distinct().sorted().toList()
            ));
            FarmMembership currentAuthor = requireCurrentAuthor(locked, author, context);
            List<FarmMembership> named = validateNamedRecipients(
                context.farmId(), currentAuthor, context.role(), selectedMemberIds, locked
            );
            requireAudience(audience, named);
            targets = eligibleRecipients(currentAuthor, audience, named, locked);
        }
        if (targets.isEmpty() && correctionReason == null) {
            throw DomainException.unprocessable(FE07_NO_RECIPIENT, "field", "recipientRoles");
        }

        int nextVersion = versions.findByAnnouncement_IdOrderByVersionNoDesc(announcement.getId()).stream()
            .mapToInt(AnnouncementVersion::getVersionNo)
            .max()
            .orElse(0) + 1;
        Instant now = clock.now();
        AnnouncementVersion version = new AnnouncementVersion();
        version.setAnnouncement(announcement);
        version.setVersionNo(nextVersion);
        version.setTitle(announcement.getDraftTitle());
        version.setBody(announcement.getDraftBody());
        version.setPublishedTime(now);
        version.setCorrectionReason(correctionReason);
        version = versions.saveAndFlush(version);

        for (FarmMembership target : targets) {
            AnnouncementRecipient recipient = new AnnouncementRecipient();
            recipient.setVersion(version);
            recipient.setMembership(target);
            recipient.setDeliveredTime(now);
            recipients.save(recipient);
        }
        outbox.enqueue(
            context.farmId(),
            correctionReason == null ? "ANNOUNCEMENT_PUBLISHED" : "ANNOUNCEMENT_CORRECTED",
            "AnnouncementVersion",
            version.getId(),
            Map.of("announcementId", announcement.getId(), "versionId", version.getId(), "recipientCount", targets.size())
        );
        return version;
    }

    private List<FarmMembership> eligibleRecipients(
        FarmMembership author,
        List<String> audience,
        List<FarmMembership> named,
        List<FarmMembership> currentMembers
    ) {
        Map<Long, FarmMembership> eligible = new LinkedHashMap<>();
        currentMembers.stream()
            .filter(member -> ACTIVE.equalsIgnoreCase(member.getStatus()))
            .filter(member -> !member.getId().equals(author.getId()))
            .filter(member -> !hasActivePlatformRole(member))
            .filter(member -> {
                FarmRole role = FarmAccessService.parseRole(member.getRole());
                return role != null && audience.contains(role.name());
            })
            .forEach(member -> eligible.put(member.getId(), member));
        named.forEach(member -> eligible.put(member.getId(), member));
        return eligible.values().stream().sorted(Comparator.comparing(FarmMembership::getId)).toList();
    }

    private List<FarmMembership> validateNamedRecipients(Long farmId, FarmMembership author, FarmRole authorRole, List<Long> requestedIds) {
        return validateNamedRecipients(farmId, author, authorRole, requestedIds, null);
    }

    private List<FarmMembership> validateNamedRecipients(
        Long farmId,
        FarmMembership author,
        FarmRole authorRole,
        List<Long> requestedIds,
        List<FarmMembership> lockedCandidates
    ) {
        if (requestedIds == null || requestedIds.isEmpty()) return List.of();
        if (requestedIds.stream().anyMatch(Objects::isNull)) throw DomainException.forbidden(FE07_INVALID_RECIPIENT);
        List<Long> ids = requestedIds.stream().distinct().sorted().toList();
        Set<String> allowedRoles = allowedRecipientRoles(authorRole);
        Map<Long, FarmMembership> found = new HashMap<>();
        if (lockedCandidates == null) {
            memberships.findByIdInAndFarm_IdAndStatusIgnoreCase(ids, farmId, ACTIVE)
                .forEach(member -> found.put(member.getId(), member));
        } else {
            Set<Long> selected = new HashSet<>(ids);
            lockedCandidates.stream().filter(member -> selected.contains(member.getId())).forEach(member -> found.put(member.getId(), member));
        }
        if (found.size() != ids.size()) throw DomainException.forbidden(FE07_INVALID_RECIPIENT);
        List<FarmMembership> named = ids.stream().map(found::get).toList();
        if (named.stream().anyMatch(member ->
            member.getId().equals(author.getId()) ||
            !ACTIVE.equalsIgnoreCase(member.getStatus()) ||
            hasActivePlatformRole(member) ||
            FarmAccessService.parseRole(member.getRole()) == null ||
            !allowedRoles.contains(FarmAccessService.parseRole(member.getRole()).name())
        )) {
            throw DomainException.forbidden(FE07_INVALID_RECIPIENT);
        }
        return named;
    }

    /** Refresh locked rows so a transaction that waited on FE-03 does not act on pre-lock managed state. */
    private List<FarmMembership> lockAndRefresh(List<FarmMembership> locked) {
        for (FarmMembership membership : locked) {
            entityManager.refresh(membership, LockModeType.PESSIMISTIC_WRITE);
        }
        return locked;
    }

    /** Recheck the publisher after serializing with FE-03's role/status change on the same membership row. */
    private FarmMembership requireCurrentAuthor(List<FarmMembership> locked, FarmMembership author, FarmContext context) {
        FarmMembership current = locked.stream()
            .filter(membership -> membership.getId().equals(author.getId()))
            .findFirst()
            .orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        if (
            !ACTIVE.equalsIgnoreCase(current.getStatus()) ||
            FarmAccessService.parseRole(current.getRole()) != context.role() ||
            !current.getUser().getId().equals(context.user().getId())
        ) {
            throw DomainException.forbidden(MessageCodes.COM_01);
        }
        return current;
    }

    private void requireAudience(List<String> roles, List<FarmMembership> named) {
        if (roles.isEmpty() && named.isEmpty()) throw DomainException.forbidden(FE07_INVALID_RECIPIENT);
    }

    private List<Long> selectedMemberIds(FarmAnnouncement announcement) {
        return memberSelectors.findByAnnouncement_IdOrderByMembership_Id(announcement.getId()).stream()
            .map(selector -> selector.getMembership().getId())
            .toList();
    }

    private void saveMemberSelectors(FarmAnnouncement announcement, List<FarmMembership> named) {
        memberSelectors.deleteByAnnouncement_Id(announcement.getId());
        if (named.isEmpty()) return;
        List<AnnouncementMemberSelector> selection = named.stream().map(member -> {
            AnnouncementMemberSelector selector = new AnnouncementMemberSelector();
            selector.setAnnouncement(announcement);
            selector.setMembership(member);
            return selector;
        }).toList();
        memberSelectors.saveAll(selection);
    }

    private AnnouncementView view(FarmAnnouncement announcement, boolean authorView, FarmMembership member) {
        boolean isAuthor = authorView && announcement.getAuthor().getId().equals(member.getId());
        List<AnnouncementVersion> history = versions.findByAnnouncement_IdOrderByVersionNoDesc(announcement.getId());
        AnnouncementVersion current = history.isEmpty() ? null : history.get(0);

        Map<Long, AnnouncementRecipient> ownDeliveries = new HashMap<>();
        for (AnnouncementRecipient delivery : recipients.findByMembership_IdOrderByDeliveredTimeDesc(member.getId())) {
            if (delivery.getVersion().getAnnouncement().getId().equals(announcement.getId())) {
                ownDeliveries.put(delivery.getVersion().getId(), delivery);
            }
        }

        AnnouncementVersion visibleCurrent = isAuthor
            ? current
            : history.stream().filter(version -> ownDeliveries.containsKey(version.getId())).findFirst().orElse(null);
        AnnouncementRecipient myCurrentDelivery = visibleCurrent == null ? null : ownDeliveries.get(visibleCurrent.getId());
        List<AnnouncementRecipient> currentDeliveries = isAuthor && current != null ? recipients.findByVersion_Id(current.getId()) : List.of();
        List<VersionView> visibleHistory = history.stream()
            .filter(version -> isAuthor || ownDeliveries.containsKey(version.getId()))
            .map(version -> {
                AnnouncementRecipient delivery = ownDeliveries.get(version.getId());
                return new VersionView(
                    version.getId(),
                    version.getVersionNo(),
                    version.getTitle(),
                    version.getBody(),
                    version.getPublishedTime(),
                    version.getCorrectionReason(),
                    delivery != null && delivery.getReadTime() == null
                );
            })
            .toList();

        String title = visibleCurrent == null ? (isAuthor ? announcement.getDraftTitle() : null) : visibleCurrent.getTitle();
        String body = visibleCurrent == null ? (isAuthor ? announcement.getDraftBody() : null) : visibleCurrent.getBody();
        List<DeliveryView> deliveryViews = isAuthor
            ? currentDeliveries.stream().map(delivery -> new DeliveryView(
                delivery.getId(),
                delivery.getMembership().getUser().getFullName(),
                delivery.getMembership().getRole(),
                delivery.getReadTime() == null ? "DELIVERED" : "READ",
                delivery.getReadTime()
            )).toList()
            : null;

        return new AnnouncementView(
            announcement.getId(),
            announcement.getState(),
            announcement.getAuthor().getUser().getFullName(),
            announcement.getAuthor().getRole(),
            isAuthor ? announcement.getDraftTitle() : null,
            isAuthor ? announcement.getDraftBody() : null,
            title,
            body,
            isAuthor ? announcement.getVersion() : visibleCurrent == null ? null : visibleCurrent.getVersionNo(),
            splitRoles(announcement.getRecipientRoles()),
            isAuthor ? selectedMemberIds(announcement) : List.of(),
            visibleHistory,
            currentDeliveries.size(),
            deliveryViews,
            visibleCurrent == null ? null : visibleCurrent.getPublishedTime(),
            announcement.getFarm().getName(),
            myCurrentDelivery != null && myCurrentDelivery.getReadTime() == null,
            myCurrentDelivery == null ? null : myCurrentDelivery.getReadTime(),
            isAuthor,
            !isAuthor && myCurrentDelivery != null,
            isAuthor && "PUBLISHED".equals(announcement.getState()),
            myCurrentDelivery == null ? null : myCurrentDelivery.getId()
        );
    }

    private MemberOption memberOption(FarmMembership membership) {
        AppUser user = membership.getUser();
        return new MemberOption(membership.getId(), user.getFullName(), membership.getRole(), ACTIVE.equalsIgnoreCase(membership.getStatus()));
    }

    /** GBR-60: a farm membership cannot make an active platform staff account an announcement recipient. */
    private boolean hasActivePlatformRole(FarmMembership membership) {
        PlatformStaffAccess platformAccess = membership.getUser().getPlatformStaffAccess();
        return platformAccess != null && ACTIVE.equalsIgnoreCase(platformAccess.getStatus());
    }

    private FarmAnnouncement load(Long farmId, Long id) {
        return announcements.findByIdAndFarm_Id(id, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private FarmMembership membership(Long farmId, Long userId) {
        return memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farmId, userId, ACTIVE)
            .orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
    }

    private void requireAuthor(FarmAnnouncement announcement, FarmMembership author) {
        if (!announcement.getAuthor().getId().equals(author.getId())) {
            throw DomainException.forbidden(MessageCodes.COM_01);
        }
    }

    private void requireDraft(FarmAnnouncement announcement) {
        if (!"DRAFT".equals(announcement.getState())) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "draft_already_published");
        }
    }

    private List<String> splitRoles(String stored) {
        if (stored == null || stored.isBlank()) {
            return List.of();
        }
        return List.of(stored.split(","));
    }

    private List<String> validateRecipients(FarmRole author, List<String> requested) {
        Set<String> allowed = allowedRecipientRoles(author);
        if (requested != null && requested.stream().anyMatch(role -> {
            FarmRole parsed = FarmAccessService.parseRole(role);
            return parsed == null || !allowed.contains(parsed.name());
        })) {
            throw DomainException.forbidden(FE07_INVALID_RECIPIENT);
        }
        List<String> values = requested == null
            ? List.of()
            : requested.stream().map(FarmAccessService::parseRole).map(FarmRole::name).distinct().sorted().toList();
        if (!allowed.containsAll(values)) {
            throw DomainException.forbidden(FE07_INVALID_RECIPIENT);
        }
        return values;
    }

    private Set<String> allowedRecipientRoles(FarmRole author) {
        return author == FarmRole.OWNER ? Set.of("MANAGER", "TECHNICIAN") : Set.of("TECHNICIAN");
    }
}
