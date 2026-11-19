package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.BankTransferEvidenceTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PaymentTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class BankTransferEvidenceTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(BankTransferEvidence.class);
        BankTransferEvidence bankTransferEvidence1 = getBankTransferEvidenceSample1();
        BankTransferEvidence bankTransferEvidence2 = new BankTransferEvidence();
        assertThat(bankTransferEvidence1).isNotEqualTo(bankTransferEvidence2);

        bankTransferEvidence2.setId(bankTransferEvidence1.getId());
        assertThat(bankTransferEvidence1).isEqualTo(bankTransferEvidence2);

        bankTransferEvidence2 = getBankTransferEvidenceSample2();
        assertThat(bankTransferEvidence1).isNotEqualTo(bankTransferEvidence2);
    }

    @Test
    void paymentTest() {
        BankTransferEvidence bankTransferEvidence = getBankTransferEvidenceRandomSampleGenerator();
        Payment paymentBack = getPaymentRandomSampleGenerator();

        bankTransferEvidence.setPayment(paymentBack);
        assertThat(bankTransferEvidence.getPayment()).isEqualTo(paymentBack);

        bankTransferEvidence.payment(null);
        assertThat(bankTransferEvidence.getPayment()).isNull();
    }
}
