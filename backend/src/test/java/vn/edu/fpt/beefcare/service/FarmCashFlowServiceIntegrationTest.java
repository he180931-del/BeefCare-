package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.service.dto.FarmCashFlowDtos.FarmCashFlowView;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class FarmCashFlowServiceIntegrationTest extends DomainTestSupport {
    @Autowired FarmCashFlowService cashFlow;
    @Autowired VoucherPaymentService payments;

    @Test
    void usesRecordedPaymentDatesExcludesVoidedPaymentsAndKeepsRecordedCashOnVoidedVouchersWithinOneFarm() {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        TradingPartner seller = partner(farm, owner, true, false);
        TradingPartner buyer = partner(farm, owner, false, true);
        var entry = entryVoucher(farm, owner, seller, 50_000L, 0L, EntryVoucherStatus.POSTED);
        HerdExitVoucher exit = exitVoucher(farm, owner, buyer, 50_000L, 0L, ExitVoucherStatus.CONFIRMED);

        actAs(owner);
        var voided = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), payment(TODAY.minusDays(1), 10_000L));
        payments.voidPayment(farm.getId(), voided.payment().id(), new VoidPaymentRequest("Ghi nhầm", versionOf(vn.edu.fpt.beefcare.domain.VoucherPayment.class, voided.payment().id())));
        var recordedEntry = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), payment(TODAY, 15_000L));
        var recordedExit = payments.record(farm.getId(), VoucherKind.EXIT, exit.getId(), payment(TODAY.minusDays(2), 20_000L));
        exit.setStatus(ExitVoucherStatus.VOIDED);
        em.flush();

        Farm otherFarm = farm();
        AppUser otherOwner = memberWithRole(otherFarm, FarmRole.OWNER);
        TradingPartner otherBuyer = partner(otherFarm, otherOwner, false, true);
        HerdExitVoucher otherExit = exitVoucher(otherFarm, otherOwner, otherBuyer, 50_000L, 0L, ExitVoucherStatus.CONFIRMED);
        actAs(otherOwner);
        payments.record(otherFarm.getId(), VoucherKind.EXIT, otherExit.getId(), payment(TODAY, 90_000L));
        actAs(owner);

        FarmCashFlowView firstPage = cashFlow.cashFlow(farm.getId(), TODAY.minusDays(5), TODAY, null, null, 0, 1);
        FarmCashFlowView secondPage = cashFlow.cashFlow(farm.getId(), TODAY.minusDays(5), TODAY, null, null, 1, 1);

        assertThat(firstPage.totalIncome()).isEqualByComparingTo("20000.00");
        assertThat(firstPage.totalExpense()).isEqualByComparingTo("15000.00");
        assertThat(firstPage.netCashFlow()).isEqualByComparingTo("5000.00");
        assertThat(firstPage.totalElements()).isEqualTo(2);
        assertThat(firstPage.items()).singleElement().satisfies(item -> {
            assertThat(item.source()).isEqualTo("HERD_ENTRY");
            assertThat(item.cashDate()).isEqualTo(TODAY);
            assertThat(item.documentId()).isEqualTo(entry.getId());
            assertThat(item.id()).isEqualTo("HERD_ENTRY:" + recordedEntry.payment().id());
        });
        assertThat(secondPage.items()).singleElement().satisfies(item -> {
            assertThat(item.source()).isEqualTo("HERD_EXIT");
            assertThat(item.cashDate()).isEqualTo(TODAY.minusDays(2));
            assertThat(item.documentId()).isEqualTo(exit.getId());
            assertThat(item.id()).isEqualTo("HERD_EXIT:" + recordedExit.payment().id());
        });
    }

    private RecordPaymentRequest payment(LocalDate date, long amount) {
        return new RecordPaymentRequest(date, amount, PaymentMethod.CASH, null, null, null);
    }
}
