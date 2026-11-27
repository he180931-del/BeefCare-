package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckRequest;
import vn.edu.fpt.beefcare.support.ExitTestSupport;

/**
 * Regressions for defects found by the Report 5.3 system test, Round 1 (DEF-ST-xx). Not wrapped in a test transaction:
 * each service call commits or rolls back on its own, as over HTTP.
 */
@ServiceIntegrationTest
class SystemTestRound1RegressionTest extends ExitTestSupport {

    @Autowired
    PenMoveService moves;

    @Autowired
    HerdExitVoucherService exits;

    @Autowired
    TransactionTemplate tx;

    /** DEF-ST-15: the move check of a cattle on a pending death voucher answered 500 (rollback-only transaction). */
    @Test
    void penMoveCheckOfAnExitPendingCattleReturnsTheBusinessMessage() {
        long[] ids = new long[1];
        tx.executeWithoutResult(status -> {
            setUpExitFarm();
            Cattle c = placed(penA, "300");
            HerdExitVoucher v = exitVoucher(farm, owner, null, 0, 0, ExitVoucherStatus.PENDING);
            exitLine(v, c, 1, ExitLineStatus.PENDING);
            ids[0] = c.getId();
        });
        actAs(owner);

        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(List.of(ids[0]), penB.getId(), TODAY));

        assertThat(check.cattle()).hasSize(1);
        assertThat(check.cattle().get(0).error().code()).isEqualTo(MessageCodes.COM_17);
    }

    /** DEF-ST-16 / DEF-ST-12: a MISSING loss counts as "Chết / mất"; the detail carries the buyer's phone. */
    @Test
    void missingLossIsListedUnderDeathAndDetailShowsTheBuyerPhone() {
        long[] ids = new long[2];
        tx.executeWithoutResult(status -> {
            setUpExitFarm();
            buyer.setContactPhone("0905333444");
            HerdExitVoucher missing = exitVoucher(farm, owner, null, 0, 0, ExitVoucherStatus.CONFIRMED);
            missing.setExitType(ExitType.OTHER);
            missing.setLossKind(LossKind.MISSING);
            exitLine(missing, placed(penA, null), 1, ExitLineStatus.CONFIRMED);
            HerdExitVoucher sale = exitVoucher(farm, owner, buyer, 0, 0, ExitVoucherStatus.DRAFT);
            ids[0] = missing.getId();
            ids[1] = sale.getId();
        });
        actAs(owner);

        ExitVoucherDTO.ListResult deaths = exits.list(farm.getId(), null, ExitType.DEATH, TODAY.minusDays(30), TODAY);
        assertThat(deaths.vouchers()).extracting(ExitVoucherDTO.Row::id).containsExactly(ids[0]);
        assertThat(deaths.tiles().cattleExitedByType().get(ExitType.DEATH)).isEqualTo(1);
        assertThat(deaths.tiles().cattleExitedByType().get(ExitType.OTHER)).isZero();
        assertThat(exits.list(farm.getId(), null, ExitType.OTHER, TODAY.minusDays(30), TODAY).vouchers()).isEmpty();

        assertThat(exits.get(farm.getId(), ids[1]).buyerPhone()).isEqualTo("0905333444");
    }
}
