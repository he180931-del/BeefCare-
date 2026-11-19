package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.BankTransferEvidenceTestSamples.*;
import static vn.edu.fpt.beefcare.domain.EvidenceReviewTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class EvidenceReviewTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(EvidenceReview.class);
        EvidenceReview evidenceReview1 = getEvidenceReviewSample1();
        EvidenceReview evidenceReview2 = new EvidenceReview();
        assertThat(evidenceReview1).isNotEqualTo(evidenceReview2);

        evidenceReview2.setId(evidenceReview1.getId());
        assertThat(evidenceReview1).isEqualTo(evidenceReview2);

        evidenceReview2 = getEvidenceReviewSample2();
        assertThat(evidenceReview1).isNotEqualTo(evidenceReview2);
    }

    @Test
    void evidenceTest() {
        EvidenceReview evidenceReview = getEvidenceReviewRandomSampleGenerator();
        BankTransferEvidence bankTransferEvidenceBack = getBankTransferEvidenceRandomSampleGenerator();

        evidenceReview.setEvidence(bankTransferEvidenceBack);
        assertThat(evidenceReview.getEvidence()).isEqualTo(bankTransferEvidenceBack);

        evidenceReview.evidence(null);
        assertThat(evidenceReview.getEvidence()).isNull();
    }

    @Test
    void pmUserTest() {
        EvidenceReview evidenceReview = getEvidenceReviewRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        evidenceReview.setPmUser(appUserBack);
        assertThat(evidenceReview.getPmUser()).isEqualTo(appUserBack);

        evidenceReview.pmUser(null);
        assertThat(evidenceReview.getPmUser()).isNull();
    }
}
