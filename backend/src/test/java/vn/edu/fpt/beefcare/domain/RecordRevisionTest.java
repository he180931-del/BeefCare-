package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.RecordRevisionTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class RecordRevisionTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(RecordRevision.class);
        RecordRevision recordRevision1 = getRecordRevisionSample1();
        RecordRevision recordRevision2 = new RecordRevision();
        assertThat(recordRevision1).isNotEqualTo(recordRevision2);

        recordRevision2.setId(recordRevision1.getId());
        assertThat(recordRevision1).isEqualTo(recordRevision2);

        recordRevision2 = getRecordRevisionSample2();
        assertThat(recordRevision1).isNotEqualTo(recordRevision2);
    }
}
