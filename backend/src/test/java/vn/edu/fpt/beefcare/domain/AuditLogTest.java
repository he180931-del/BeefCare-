package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.AuditLogTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class AuditLogTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(AuditLog.class);
        AuditLog auditLog1 = getAuditLogSample1();
        AuditLog auditLog2 = new AuditLog();
        assertThat(auditLog1).isNotEqualTo(auditLog2);

        auditLog2.setId(auditLog1.getId());
        assertThat(auditLog1).isEqualTo(auditLog2);

        auditLog2 = getAuditLogSample2();
        assertThat(auditLog1).isNotEqualTo(auditLog2);
    }

    @Test
    void actorTest() {
        AuditLog auditLog = getAuditLogRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        auditLog.setActor(appUserBack);
        assertThat(auditLog.getActor()).isEqualTo(appUserBack);

        auditLog.actor(null);
        assertThat(auditLog.getActor()).isNull();
    }

    @Test
    void farmTest() {
        AuditLog auditLog = getAuditLogRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        auditLog.setFarm(farmBack);
        assertThat(auditLog.getFarm()).isEqualTo(farmBack);

        auditLog.farm(null);
        assertThat(auditLog.getFarm()).isNull();
    }
}
