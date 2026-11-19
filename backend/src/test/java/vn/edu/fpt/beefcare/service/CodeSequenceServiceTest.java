package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class CodeSequenceServiceTest extends DomainTestSupport {

    @Autowired
    CodeSequenceService codes;

    @Test
    void voucherCodesAreSequentialPerYearAndPerType() {
        Farm farm = farm();
        assertThat(codes.nextHerdEntryCode(farm.getId())).isEqualTo("PN-2026-0001");
        assertThat(codes.nextHerdEntryCode(farm.getId())).isEqualTo("PN-2026-0002");
        assertThat(codes.nextHerdExitCode(farm.getId())).isEqualTo("PX-2026-0001");
        assertThat(codes.nextHerdEntryCode(farm.getId())).isEqualTo("PN-2026-0003");
    }

    @Test
    void voucherSequenceRestartsEachYear() {
        Farm farm = farm();
        assertThat(codes.nextHerdEntryCode(farm.getId())).isEqualTo("PN-2026-0001");
        clock.setFarmToday(LocalDate.of(2027, 1, 2));
        assertThat(codes.nextHerdEntryCode(farm.getId())).isEqualTo("PN-2027-0001");
        clock.setFarmToday(TODAY);
        assertThat(codes.nextHerdEntryCode(farm.getId())).isEqualTo("PN-2026-0002");
    }

    @Test
    void farmsHaveIndependentSequences() {
        Farm a = farm();
        Farm b = farm();
        assertThat(codes.nextCattleCode(a.getId())).isEqualTo("BC-000001");
        assertThat(codes.nextCattleCode(a.getId())).isEqualTo("BC-000002");
        assertThat(codes.nextCattleCode(b.getId())).isEqualTo("BC-000001");
    }

    @Test
    void cattleCodeDoesNotResetAcrossYears() {
        Farm farm = farm();
        assertThat(codes.nextCattleCode(farm.getId())).isEqualTo("BC-000001");
        clock.setFarmToday(LocalDate.of(2027, 3, 1));
        assertThat(codes.nextCattleCode(farm.getId())).isEqualTo("BC-000002");
    }

    @Test
    void qrTagCodesAreGloballyUniqueBecauseTheyCarryTheFarm() {
        Farm a = farm();
        Farm b = farm();
        String a1 = codes.nextQrTagCode(a.getId());
        String b1 = codes.nextQrTagCode(b.getId());
        assertThat(a1).isNotEqualTo(b1);
        assertThat(a1).isEqualTo("QR-" + a.getId() + "-000001");
        assertThat(codes.nextQrTagCode(a.getId())).isEqualTo("QR-" + a.getId() + "-000002");
    }

    @Test
    void unknownFarmIsRejected() {
        assertThatThrownBy(() -> codes.nextCattleCode(-5L)).isInstanceOf(DomainException.class);
    }
}
