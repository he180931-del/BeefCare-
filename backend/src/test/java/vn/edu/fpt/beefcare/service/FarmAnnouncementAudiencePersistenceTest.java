package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AnnouncementMemberSelectorRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.repository.FarmAnnouncementRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.AnnouncementView;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.CorrectionRequest;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.DraftRequest;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.PublishRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** H2 database readback for named FE-07 selectors, audience-only optimistic versioning, publish and correction. */
@ServiceIntegrationTest
@Transactional
class FarmAnnouncementAudiencePersistenceTest extends DomainTestSupport {

    @Autowired FarmAnnouncementService service;
    @Autowired FarmMembershipRepository memberships;
    @Autowired FarmAnnouncementRepository announcements;
    @Autowired AnnouncementMemberSelectorRepository selectors;
    @Autowired AnnouncementVersionRepository versions;
    @Autowired AnnouncementRecipientRepository deliveries;

    @Test
    void namedOnlyDraftSelectionRoundtripsAndCorrectionUsesTheOriginalDeliverySnapshot() {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        AppUser firstTechnician = memberWithRole(farm, FarmRole.TECHNICIAN);
        AppUser selectedTechnician = memberWithRole(farm, FarmRole.TECHNICIAN);
        actAs(owner);

        FarmMembership first = membership(farm, firstTechnician);
        FarmMembership selected = membership(farm, selectedTechnician);
        AnnouncementView draft = service.createDraft(farm.getId(), new DraftRequest(
            "Họp nhóm", "Họp lúc 7 giờ.", List.of(), List.of(first.getId()), null
        ));
        assertThat(draft.recipientMemberIds()).containsExactly(first.getId());

        em.flush();
        em.clear();
        assertThat(selectors.findByAnnouncement_IdOrderByMembership_Id(draft.id()))
            .extracting(selector -> selector.getMembership().getId()).containsExactly(first.getId());

        // Only the named selection changes. The scalar revision must dirty the parent and advance @Version.
        AnnouncementView updated = service.updateDraft(farm.getId(), draft.id(), new DraftRequest(
            "Họp nhóm", "Họp lúc 7 giờ.", List.of(), List.of(selected.getId()), draft.version()
        ));
        assertThat(updated.version()).isEqualTo(draft.version() + 1);
        em.flush();
        em.clear();
        assertThat(announcements.findByIdAndFarm_Id(draft.id(), farm.getId()).orElseThrow().getDraftAudienceRevision()).isEqualTo(1);
        assertThat(selectors.findByAnnouncement_IdOrderByMembership_Id(draft.id()))
            .extracting(selector -> selector.getMembership().getId()).containsExactly(selected.getId());

        AnnouncementView published = service.publish(farm.getId(), draft.id(), new PublishRequest(updated.version()));
        assertThat(published.state()).isEqualTo("PUBLISHED");
        assertThat(published.recipientCount()).isEqualTo(1);
        em.flush();
        em.clear();
        AnnouncementVersion original = versions.findByAnnouncement_IdOrderByVersionNoDesc(draft.id()).getFirst();
        assertThat(original.getVersionNo()).isEqualTo(1);
        assertThat(deliveries.findByVersion_Id(original.getId())).extracting(item -> item.getMembership().getId()).containsExactly(selected.getId());

        AppUser laterJoiner = memberWithRole(farm, FarmRole.TECHNICIAN);
        FarmMembership later = membership(farm, laterJoiner);
        AnnouncementView corrected = service.correctPublished(farm.getId(), draft.id(), new CorrectionRequest(
            "Họp nhóm mới", "Họp lúc 8 giờ.", "Đổi giờ họp", published.version()
        ));
        assertThat(corrected.version()).isEqualTo(published.version() + 1);
        em.flush();
        em.clear();
        List<AnnouncementVersion> history = versions.findByAnnouncement_IdOrderByVersionNoDesc(draft.id());
        assertThat(history).extracting(AnnouncementVersion::getVersionNo).containsExactly(2, 1);
        assertThat(deliveries.findByVersion_Id(history.get(0).getId()))
            .extracting(item -> item.getMembership().getId()).doesNotContain(later.getId(), first.getId());
        assertThat(deliveries.findByVersion_Id(history.get(0).getId()))
            .extracting(item -> item.getMembership().getId()).containsExactly(selected.getId());
    }

    private FarmMembership membership(Farm farm, AppUser user) {
        return memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farm.getId(), user.getId(), "ACTIVE").orElseThrow();
    }
}
