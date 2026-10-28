package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** SCR-48 "Getting started" panel of UC-FE15-01. */
@ServiceIntegrationTest
@Transactional
class FarmOnboardingServiceIT extends DomainTestSupport {

    @Autowired
    FarmOnboardingService onboarding;

    @Test
    void stepsFollowTheFarmDataAndThePanelHidesWhenDismissed() {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        actAs(owner);

        var first = onboarding.view(farm.getId());
        assertThat(first.visible()).isTrue();
        assertThat(done(first)).containsEntry("CREATE_PENS", false).containsEntry("ADD_REFERENCE_MEDICINES", false)
            .containsEntry("FIRST_HERD_ENTRY_VOUCHER", false).containsEntry("INVITE_MEMBERS", false);

        pen(farm, "P" + next(), 5);
        Medicine medicine = new Medicine();
        medicine.setFarm(farm);
        medicine.setCode("MED" + next());
        medicine.setName("Oxytetracycline");
        medicine.setDose("1 ml / 10 kg");
        medicine.setRoute("IM");
        medicine.setWithdrawalInfo("28 days");
        medicine.setAvailable(true);
        save(medicine);
        entryVoucher(farm, owner, partner(farm, owner, true, false), 1000L, 0L, EntryVoucherStatus.POSTED);
        memberWithRole(farm, FarmRole.MANAGER);

        var later = onboarding.view(farm.getId());
        assertThat(done(later)).containsEntry("CREATE_PENS", true).containsEntry("ADD_REFERENCE_MEDICINES", true)
            .containsEntry("FIRST_HERD_ENTRY_VOUCHER", true).containsEntry("INVITE_MEMBERS", true);

        // review steps can be ticked; data steps cannot
        assertThat(done(onboarding.markDone(farm.getId(), "check_farm_parameters"))).containsEntry("CHECK_FARM_PARAMETERS", true);
        assertThatThrownBy(() -> onboarding.markDone(farm.getId(), "CREATE_PENS")).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> onboarding.markDone(farm.getId(), "NOPE")).isInstanceOf(DomainException.class);

        var dismissed = onboarding.dismiss(farm.getId());
        assertThat(dismissed.visible()).isFalse();
        assertThat(dismissed.dismissed()).isTrue();
    }

    @Test
    void managerDoesNotSeeTheInviteStepAndTechnicianHasNoPanel() {
        Farm farm = farm();
        memberWithRole(farm, FarmRole.OWNER);
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        AppUser technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        actAs(manager);
        assertThat(done(onboarding.view(farm.getId()))).doesNotContainKey("INVITE_MEMBERS");
        actAs(technician);
        assertThatThrownBy(() -> onboarding.view(farm.getId())).isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        Farm other = farm();
        AppUser stranger = memberWithRole(other, FarmRole.OWNER);
        actAs(stranger);
        assertThatThrownBy(() -> onboarding.dismiss(farm.getId())).isInstanceOf(DomainException.class);
    }

    private static Map<String, Boolean> done(FarmOnboardingService.GettingStarted view) {
        return view.steps().stream().collect(Collectors.toMap(FarmOnboardingService.StepView::step, FarmOnboardingService.StepView::done));
    }
}
