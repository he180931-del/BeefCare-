package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AccountLinkToken;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.CashReportSnapshot;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.payment.SubscriptionNoticeJob;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** JOB-02, JOB-05 and JOB-08 against hand-built data (SRS 24.2, 24.5, 24.8). */
@ServiceIntegrationTest
@Transactional
class PlatformJobsIT extends DomainTestSupport {

    private static final ZoneId FARM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired
    DataRetentionJob retention;

    @Autowired
    SubscriptionNoticeJob notices;

    @Autowired
    FarmMembershipService memberships;

    // ------------------------------------------------------------------ JOB-08

    @Test
    void purgeRemovesLinksExpiredOverSevenDaysAndSnapshotsPastThirtyDaysOnly() {
        Instant now = clock.instant();
        User identity = identity();
        AccountLinkToken old = link(identity, now.minus(Duration.ofDays(8)));
        AccountLinkToken recent = link(identity, now.minus(Duration.ofDays(6)));
        AccountLinkToken live = link(identity, now.plus(Duration.ofHours(1)));

        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmInvitation accepted = invitation(farm, owner, "ACCEPTED", now.minus(Duration.ofDays(9)));
        FarmInvitation cancelledRecently = invitation(farm, owner, "CANCELLED", now.minus(Duration.ofDays(3)));
        FarmInvitation pending = invitation(farm, owner, "PENDING", now.minus(Duration.ofDays(9)));

        CashReportSnapshot expired = snapshot(owner, now.minusSeconds(1));
        CashReportSnapshot available = snapshot(owner, now.plus(Duration.ofDays(29)));

        DataRetentionJob.Result result = retention.purge();
        em.flush();
        em.clear();

        assertThat(em.find(AccountLinkToken.class, old.getId())).isNull();
        assertThat(em.find(AccountLinkToken.class, recent.getId())).isNotNull();
        assertThat(em.find(AccountLinkToken.class, live.getId())).isNotNull();
        FarmInvitation acceptedAfter = em.find(FarmInvitation.class, accepted.getId());
        assertThat(acceptedAfter.getTokenHash()).isNull();
        assertThat(acceptedAfter.getTokenNonce()).isNull();
        assertThat(acceptedAfter.getStatus()).isEqualTo("ACCEPTED"); // the record and its status stay
        assertThat(em.find(FarmInvitation.class, cancelledRecently.getId()).getTokenHash()).isNotNull();
        assertThat(em.find(FarmInvitation.class, pending.getId()).getTokenHash()).isNotNull(); // JOB-02 expires it first
        assertThat(em.find(CashReportSnapshot.class, expired.getId())).isNull();
        assertThat(em.find(CashReportSnapshot.class, available.getId())).isNotNull();
        assertThat(result.accountLinks()).isGreaterThanOrEqualTo(1);
        assertThat(result.snapshots()).isGreaterThanOrEqualTo(1);

        // a second run finds nothing more of this data
        retention.purge();
        em.flush();
        em.clear();
        assertThat(em.find(AccountLinkToken.class, recent.getId())).isNotNull();
        assertThat(em.find(CashReportSnapshot.class, available.getId())).isNotNull();
    }

    // ------------------------------------------------------------------ JOB-02

    @Test
    void expiryJobMarksOnlyPastDueInvitationsAndRecordsHistory() {
        Instant now = clock.instant();
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmInvitation due = invitation(farm, owner, "PENDING", now.minusSeconds(1));
        FarmInvitation valid = invitation(farm, owner, "PENDING", now.plus(Duration.ofDays(2)));

        memberships.expirePendingInvitations();
        em.flush();
        em.clear();

        FarmInvitation expired = em.find(FarmInvitation.class, due.getId());
        assertThat(expired.getStatus()).isEqualTo("EXPIRED");
        assertThat(expired.getTokenHash()).isNull();
        assertThat(em.find(FarmInvitation.class, valid.getId()).getStatus()).isEqualTo("PENDING");
        assertThat(audits("INVITE_EXPIRED", due.getId())).isEqualTo(1);
        assertThat(audits("INVITE_EXPIRED", valid.getId())).isZero();
    }

    // ------------------------------------------------------------------ JOB-05

    @Test
    void renewalOpeningNoticeIsCreatedOnceWithOneEmailForTheOwner() {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Subscription subscription = subscriptionEndingInDays(farm, 90);

        notices.run();
        notices.run(); // same day again: nothing new

        String key = "SUBSCRIPTION_NOTICE:RENEWAL_OPEN:" + farm.getId() + ":" + subscription.getLatestEnd();
        assertThat(notificationsFor(owner, key)).isEqualTo(1);
        assertThat(emailsFor(owner, "RENEWAL_OPEN")).isEqualTo(1);
    }

    @Test
    void expiringNoticesFollowThe30_7_1DayMarksAndNotOtherDays() {
        Farm in7 = farm();
        AppUser owner7 = memberWithRole(in7, FarmRole.OWNER);
        Subscription s7 = subscriptionEndingInDays(in7, 7);
        Farm in8 = farm();
        AppUser owner8 = memberWithRole(in8, FarmRole.OWNER);
        subscriptionEndingInDays(in8, 8);

        notices.run();

        assertThat(notificationsFor(owner7, "SUBSCRIPTION_NOTICE:EXPIRING_7:" + in7.getId() + ":" + s7.getLatestEnd())).isEqualTo(1);
        assertThat(emailsFor(owner7, "EXPIRING_7")).isEqualTo(1);
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id = :u", Long.class)
            .setParameter("u", owner8.getId()).getSingleResult()).isZero();
    }

    @Test
    void suspendedFarmGetsNoRenewalNoticeAndExpiredNoticeReusesTheJob04Key() {
        Farm suspended = farm("SUSPENDED");
        AppUser suspendedOwner = memberWithRole(suspended, FarmRole.OWNER);
        subscriptionEndingInDays(suspended, 90);
        Farm ended = farm("EXPIRED");
        AppUser endedOwner = memberWithRole(ended, FarmRole.OWNER);
        Subscription endedToday = subscriptionEndingInDays(ended, 0);

        notices.run();

        assertThat(emailsFor(suspendedOwner, "RENEWAL_OPEN")).isZero();
        String job04Key = "SUBSCRIPTION_EXPIRED:" + ended.getId() + ":" + endedToday.getLatestEnd();
        assertThat(notificationsFor(endedOwner, job04Key)).isEqualTo(1);
        assertThat(emailsFor(endedOwner, "EXPIRED")).isEqualTo(1);
    }

    // ------------------------------------------------------------------ helpers

    private Subscription subscriptionEndingInDays(Farm farm, int days) {
        vn.edu.fpt.beefcare.domain.PlanVersion price = new vn.edu.fpt.beefcare.domain.PlanVersion();
        price.setPrice1y(new BigDecimal("1200000"));
        price.setPrice2y(new BigDecimal("2000000"));
        price.setPrice3y(new BigDecimal("2700000"));
        price.setEffectiveAt(clock.instant().minus(Duration.ofDays(400)));
        save(price);
        Subscription s = new Subscription();
        s.setFarm(farm);
        s.setPlanVersion(price);
        s.setEntitlementStatus(days > 0 ? "ACTIVE" : "EXPIRED");
        s.setLatestEnd(TODAY.plusDays(days).atStartOfDay(FARM_ZONE).toInstant());
        return save(s);
    }

    private long notificationsFor(AppUser recipient, String eventKey) {
        return em.createQuery("select count(n) from Notification n where n.recipient.id = :u and n.eventKey = :k", Long.class)
            .setParameter("u", recipient.getId()).setParameter("k", eventKey).getSingleResult();
    }

    private long emailsFor(AppUser recipient, String notice) {
        return em.createQuery("select count(j) from EmailDeliveryJob j where lower(j.recipient) = lower(:r) and j.templateKey = 'SUBSCRIPTION_NOTICE' and j.contextRole = :n", Long.class)
            .setParameter("r", recipient.getEmail()).setParameter("n", notice).getSingleResult();
    }

    private long audits(String action, Long targetId) {
        return em.createQuery("select count(a) from AuditLog a where a.action = :a and a.targetId = :t", Long.class)
            .setParameter("a", action).setParameter("t", targetId).getSingleResult();
    }

    private User identity() {
        User u = new User();
        u.setLogin("job-user-" + next() + "@beefcare.test");
        u.setEmail(u.getLogin());
        u.setPassword("$2a$10$01234567890123456789012345678901234567890123456789012");
        u.setActivated(true);
        return save(u);
    }

    private AccountLinkToken link(User user, Instant expiresAt) {
        AccountLinkToken t = new AccountLinkToken();
        t.setUser(user);
        t.setTokenType("PASSWORD_RESET");
        t.setTokenHash(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", ""));
        t.setTokenNonce(UUID.randomUUID().toString());
        t.setCreatedAt(expiresAt.minus(Duration.ofMinutes(30)));
        t.setExpiresAt(expiresAt);
        return save(t);
    }

    private FarmInvitation invitation(Farm farm, AppUser by, String status, Instant expiresAt) {
        FarmInvitation i = new FarmInvitation();
        i.setFarm(farm);
        i.setInvitedBy(by);
        i.setInvitedEmail("invitee" + next() + "@beefcare.test");
        i.setProposedRole("TECHNICIAN");
        i.setStatus(status);
        i.setCreatedAt(expiresAt.minus(Duration.ofDays(7)));
        i.setLastSentAt(i.getCreatedAt());
        i.setExpiresAt(expiresAt);
        i.setTokenHash(UUID.randomUUID().toString().replace("-", ""));
        i.setTokenNonce(UUID.randomUUID().toString());
        return save(i);
    }

    private CashReportSnapshot snapshot(AppUser pm, Instant expiresAt) {
        CashReportSnapshot s = new CashReportSnapshot();
        s.setAsOf(expiresAt.minus(Duration.ofDays(30)));
        s.setDateFrom(TODAY.minusDays(60));
        s.setDateTo(TODAY.minusDays(31));
        s.setTotals(BigDecimal.ZERO);
        s.setPmUser(pm);
        s.setExpiresAt(expiresAt);
        return save(s);
    }
}
