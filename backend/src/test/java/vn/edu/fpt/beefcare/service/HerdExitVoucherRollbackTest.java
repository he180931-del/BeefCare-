package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherRequests;
import vn.edu.fpt.beefcare.support.ExitTestSupport;

/**
 * Not wrapped in a test transaction: every service call is a real transaction, so a failure half way through the
 * confirmation must leave no partial exit (GBR-35, GBR-94 "if any cattle is no longer ACTIVE nothing is confirmed").
 */
@ServiceIntegrationTest
class HerdExitVoucherRollbackTest extends ExitTestSupport {

    @Autowired
    HerdExitVoucherService service;

    @Autowired
    TransactionTemplate tx;

    @Autowired
    HerdExitRepository exitLines;

    @Autowired
    PenAssignmentRepository assignments;

    @Autowired
    VoucherPaymentRepository paymentRepository;

    @Test
    void aFailureOnTheSecondCattleRollsBackTheFirstOne() {
        long[] ids = new long[2];
        tx.executeWithoutResult(status -> {
            setUpExitFarm();
            ids[0] = placed(penA, "300").getId();
            ids[1] = placed(penA, "310").getId();
        });
        actAs(owner);
        ExitVoucherRequests.Save req = saveReq(
            ExitType.SALE,
            TODAY,
            buyer.getId(),
            null,
            0,
            100_000L,
            PaymentMethod.CASH,
            List.of(
                new ExitVoucherRequests.Line(ids[0], null, null, 50_000L),
                new ExitVoucherRequests.Line(ids[1], null, null, 50_000L)
            )
        );
        ExitVoucherDTO.Detail draft = service.create(farm.getId(), req);
        assertThat(draft.cattleCount()).isEqualTo(2);

        // data fault on the second cattle: it has lost its open placement, so closing it fails after the first one was exited
        tx.executeWithoutResult(status -> em.createQuery("delete from PenAssignment a where a.cattle.id = :c").setParameter("c", ids[1]).executeUpdate());

        assertThatThrownBy(() -> service.confirm(farm.getId(), draft.id(), new ExitVoucherRequests.Confirm(true, null), null))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
            });

        tx.executeWithoutResult(status -> {
            Cattle first = em.find(Cattle.class, ids[0]);
            assertThat(first.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
            assertThat(first.getExitType()).isNull();
            assertThat(first.getExitDate()).isNull();
            assertThat(assignments.findFirstByCattleIdAndToDateIsNull(ids[0])).isPresent();
            assertThat(em.find(Cattle.class, ids[1]).getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
            HerdExitVoucher v = em.find(HerdExitVoucher.class, draft.id());
            assertThat(v.getStatus()).isEqualTo(ExitVoucherStatus.DRAFT);
            assertThat(v.getConfirmedAt()).isNull();
            assertThat(exitLines.findAllByVoucherIdOrderByLineNoAsc(draft.id())).extracting(HerdExit::getStatus).containsOnly(ExitLineStatus.DRAFT);
            assertThat(exitLines.findAllByVoucherIdOrderByLineNoAsc(draft.id())).extracting(HerdExit::getCheckResults).containsOnlyNulls();
            assertThat(paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(draft.id())).isEmpty();
        });
    }
}
