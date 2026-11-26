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
        assertThat(((Number) herd.summary().get("headAtEnd")).longValue()).isEqualTo(3L);
        assertThat(((Number) herd.summary().get("entriesInPeriod")).longValue()).isEqualTo(3L);
        assertThat(((Number) herd.summary().get("exitsInPeriod")).longValue()).isZero();
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
        entry.setAction("ACCOUNT_SUSPEND");
        entry.setTargetType("AppUser");
        entry.setTargetId(owner.getId());
        entry.setActor(sa);
        entry.setLoggedAt(Instant.now());
        entry.setDetails("{\"statusBefore\":\"ACTIVE\",\"statusAfter\":\"SUSPENDED\",\"reason\":\"Fraud report\",\"password\":\"secret\",\"token\":\"abc\"}");
        save(entry);
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

        actAs(sa);
        var page = audit.search(today.minusDays(1), today.plusDays(1), null, false, "account_suspended", "account", 0, 20, null);
        assertThat(page.items()).extracting(PlatformAuditQueryService.AuditRow::id).contains(entry.getId());
        PlatformAuditQueryService.AuditDetail detail = audit.get(entry.getId());
        // D34 (GBR-86): before / after only – no reason, no secret
        assertThat(detail.before()).containsExactly(java.util.Map.entry("status", "ACTIVE"));
        assertThat(detail.after()).containsExactly(java.util.Map.entry("status", "SUSPENDED"));
        assertThat(detail.toString()).doesNotContain("Fraud report", "secret", "password", "token");
        assertThatThrownBy(() -> audit.search(today, today.minusDays(1), null, false, null, null, 0, 20, null)).isInstanceOf(DomainException.class);

        actAs(platformStaff("PM"));
        assertThatThrownBy(() -> audit.get(entry.getId())).isInstanceOf(DomainException.class);
        actAs(owner);
        assertThatThrownBy(() -> audit.search(today, today, null, false, null, null, 0, 20, null)).isInstanceOf(DomainException.class);
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
