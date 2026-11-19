package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.MemberChange;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class FarmMembershipServiceTest extends DomainTestSupport {

    @Autowired FarmMembershipService service;
    @Autowired vn.edu.fpt.beefcare.service.email.ActionLinkSigner linkSigner;

    @Test
    void invitedPersonAcceptsTheSingleStoredInvitationAndBecomesMember() {
        Farm farm = farm();
        var owner = memberWithRole(farm, FarmRole.OWNER);
        var invitee = user();
        actAs(owner);

        var sent = service.invite(farm.getId(), new vn.edu.fpt.beefcare.service.dto.MembershipDtos.InviteRequest(invitee.getEmail(), "MANAGER", 7));

        assertThat(sent.id()).isNotNull();
        FarmInvitation stored = em.createQuery("select i from FarmInvitation i where i.farm.id=:farm", FarmInvitation.class)
            .setParameter("farm", farm.getId()).getSingleResult();
        assertThat(stored.getId()).isEqualTo(sent.id());
        String rawToken = linkSigner.bearer("FARM_INVITATION", stored.getId(), stored.getTokenNonce());
        assertThat(linkSigner.matchesHash(rawToken, stored.getTokenHash())).isTrue();

        actAs(invitee);
        var member = service.accept(rawToken);

        assertThat(member.id()).isNotNull();
        assertThat(member.role()).isEqualTo("MANAGER");
        assertThat(em.createQuery("select count(m) from FarmMembership m where m.farm.id=:farm and m.user.id=:user", Long.class)
            .setParameter("farm", farm.getId()).setParameter("user", invitee.getId()).getSingleResult()).isEqualTo(1L);
        assertThat(service.accept(rawToken).id()).isEqualTo(member.id());
    }

    @Test
    void ownerCanChangeFixedRoleAndAuditOnlyAllowlistedMembershipState() {
        Farm farm = farm();
        var owner = memberWithRole(farm, FarmRole.OWNER);
        var manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership membership = em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user", FarmMembership.class)
            .setParameter("farm", farm.getId()).setParameter("user", manager.getId()).getSingleResult();
        actAs(owner);

        var changed = service.changeMember(farm.getId(), membership.getId(), new MemberChange("CHANGE_ROLE", "TECHNICIAN", TODAY, "Duties changed", membership.getVersion()));

        assertThat(changed.role()).isEqualTo("TECHNICIAN");
        assertThat(changed.status()).isEqualTo("ACTIVE");
        assertThat(changed.reason()).isEqualTo("Duties changed");
        assertThat(changed.effectiveDate()).isEqualTo(TODAY);
        String details = em.createQuery("select a.details from AuditLog a where a.targetId=:id", String.class)
            .setParameter("id", membership.getId()).getSingleResult();
        assertThat(details).contains("TECHNICIAN", "ACTIVE", TODAY.toString()).doesNotContain(manager.getEmail());
    }

    @Test
    void ownerCanWithdrawAccessDuringInactiveServiceButCannotReactivateOrChangeRole() {
        Farm farm = farm("EXPIRED");
        var owner = memberWithRole(farm, FarmRole.OWNER);
        var manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership membership = em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user", FarmMembership.class)
            .setParameter("farm", farm.getId()).setParameter("user", manager.getId()).getSingleResult();
        actAs(owner);

        var deactivated = service.changeMember(farm.getId(), membership.getId(), new MemberChange("DEACTIVATE", null, TODAY, "Access withdrawn", membership.getVersion()));

        assertThat(deactivated.status()).isEqualTo("INACTIVE");
        assertThatThrownBy(() -> service.changeMember(farm.getId(), membership.getId(), new MemberChange("REACTIVATE", null, TODAY, "Rejoin", membership.getVersion())))
            .isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> service.invite(farm.getId(), new vn.edu.fpt.beefcare.service.dto.MembershipDtos.InviteRequest("new@example.com", "MANAGER", 7)))
            .isInstanceOf(DomainException.class);
        assertThat(em.find(FarmMembership.class, membership.getId())).isNotNull();
    }

    @Test
    void technicianCannotChangeMembershipAndOwnerMembershipIsImmutable() {
        Farm farm = farm();
        var owner = memberWithRole(farm, FarmRole.OWNER);
        var technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        FarmMembership ownerMembership = em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user", FarmMembership.class)
            .setParameter("farm", farm.getId()).setParameter("user", owner.getId()).getSingleResult();
        actAs(technician);
        assertThatThrownBy(() -> service.changeMember(farm.getId(), ownerMembership.getId(), new MemberChange("DEACTIVATE", null, TODAY, "No", ownerMembership.getVersion())))
            .isInstanceOf(DomainException.class);
        actAs(owner);
        assertThatThrownBy(() -> service.changeMember(farm.getId(), ownerMembership.getId(), new MemberChange("DEACTIVATE", null, TODAY, "No", ownerMembership.getVersion())))
            .isInstanceOf(DomainException.class);
    }

    @Test
    void memberChangeRequiresReasonNonfutureEffectiveDateAndCurrentVersion() {
        Farm farm = farm();
        var owner = memberWithRole(farm, FarmRole.OWNER);
        var manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership membership = em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user", FarmMembership.class)
            .setParameter("farm", farm.getId()).setParameter("user", manager.getId()).getSingleResult();
        actAs(owner);
        assertThatThrownBy(() -> service.changeMember(farm.getId(), membership.getId(), new MemberChange("DEACTIVATE", null, TODAY.plusDays(1), "Future", membership.getVersion())))
            .isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> service.changeMember(farm.getId(), membership.getId(), new MemberChange("DEACTIVATE", null, TODAY, "  ", membership.getVersion())))
            .isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> service.changeMember(farm.getId(), membership.getId(), new MemberChange("DEACTIVATE", null, TODAY, "Stale", membership.getVersion() + 1)))
            .isInstanceOf(DomainException.class);
    }
}
