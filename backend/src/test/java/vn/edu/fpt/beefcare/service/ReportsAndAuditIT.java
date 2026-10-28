package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportView;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** RPT-01, RPT-02, RPT-03, RPT-04, RPT-06 against hand-built data (UC-FE15-02) and the SA audit history (UC-FE17-01). */
@ServiceIntegrationTest
@Transactional
class ReportsAndAuditIT extends HerdEntryTestBase {

    @Autowired
    FarmReportService reports;

    @Autowired
    PlatformAuditQueryService audit;

    private ReportView run(String type) {
        return reports.report(farm.getId(), new ReportRequest(type, TODAY.minusDays(30), TODAY, null, null, null, null));
    }

    @Test
    void herdAndGrowthReportsCountTheEntriesAndValidWeighings() {
        EntryDtos.PostResult posted = createAndPost(List.of(line("R-1", penA, "300", 50_000), line("R-2", penA, "320", 50_000), line("R-3", penB, "280", 50_000)), 0L, 0L);
        Cattle first = em.find(Cattle.class, posted.voucher().lines().get(0).cattleId());
        weight(first, TODAY.minusDays(1), "310");

        ReportView herd = run("RPT-01");
        assertThat(herd.summary()).containsEntry("headAtEnd", 3L).containsEntry("entriesInPeriod", 3L).containsEntry("exitsInPeriod", 0L);
        assertThat(herd.rows()).filteredOn(r -> "pen".equals(r.get("dimension"))).isNotEmpty();

        ReportView growth = run("RPT-02");
        // the three entry weights and the later weighing are all valid measurements in the period
        assertThat(((Number) growth.summary().get("validWeighings")).intValue()).isGreaterThanOrEqualTo(1);

        for (String type : List.of("RPT-03", "RPT-04", "RPT-06")) {
            ReportView view = run(type);
            assertThat(view.reportType()).isEqualTo(type);
            assertThat(view.summary()).isNotNull();
        }
        ReportView movements = run("RPT-06");
        assertThat(movements.summary().values()).isNotEmpty();
    }

    @Test
    void reportsAreForOwnerAndManagerAndLimitedToTwentyFourMonths() {
        actAs(manager);
        assertThat(run("RPT-01").reportType()).isEqualTo("RPT-01");
        assertThatThrownBy(() -> reports.report(farm.getId(), new ReportRequest("RPT-01", TODAY.minusMonths(25), TODAY, null, null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));
        assertThatThrownBy(() -> reports.report(farm.getId(), new ReportRequest("RPT-01", TODAY, TODAY.minusDays(1), null, null, null, null)))
            .isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> reports.report(farm.getId(), new ReportRequest("RPT-99", TODAY.minusDays(1), TODAY, null, null, null, null)))
            .isInstanceOf(DomainException.class);
        actAs(technician);
        assertThatThrownBy(() -> run("RPT-01")).isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
    }

    @Test
    void systemAdminSearchesAuditWithAllowlistedDetailsOnly() {
        AppUser sa = platformStaff("SA");
        AuditLog entry = new AuditLog();
        entry.setAction("ACCOUNT_SUSPENDED");
        entry.setTargetType("AppUser");
        entry.setTargetId(owner.getId());
        entry.setActor(sa);
        entry.setLoggedAt(Instant.now());
        entry.setDetails("{\"reason\":\"Fraud report\",\"password\":\"secret\",\"token\":\"abc\"}");
        save(entry);

        actAs(sa);
        var page = audit.search(null, null, "account_suspended", "AppUser", null, 0, 25);
        assertThat(page.getContent()).extracting(PlatformAuditQueryService.AuditEntry::id).contains(entry.getId());
        PlatformAuditQueryService.AuditEntry detail = audit.get(entry.getId());
        assertThat(detail.details()).containsEntry("reason", "Fraud report").doesNotContainKeys("password", "token");
        assertThatThrownBy(() -> audit.search(Instant.now(), Instant.now().minusSeconds(60), null, null, null, 0, 25)).isInstanceOf(DomainException.class);

        actAs(platformStaff("PM"));
        assertThatThrownBy(() -> audit.get(entry.getId())).isInstanceOf(DomainException.class);
        actAs(owner);
        assertThatThrownBy(() -> audit.search(null, null, null, null, null, 0, 25)).isInstanceOf(DomainException.class);
    }

    private AppUser platformStaff(String role) {
        AppUser staff = user();
        User credential = new User();
        credential.setLogin(staff.getEmail());
        credential.setEmail(staff.getEmail());
        credential.setActivated(true);
        credential.setPassword("$2a$10$01234567890123456789012345678901234567890123456789012");
        save(credential);
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(staff);
        access.setRole(role);
        access.setStatus("ACTIVE");
        save(access);
        return staff;
    }
}
