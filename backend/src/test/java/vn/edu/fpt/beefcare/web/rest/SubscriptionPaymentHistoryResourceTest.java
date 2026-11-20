package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC-FE19-03 / D16: secured GET, real query/paging and read-only persistence. */
@ServiceIntegrationTest
@Transactional
class SubscriptionPaymentHistoryResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    protected Subscription subscription(Farm farm) {
        PlanVersion version = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(100)));
        Subscription subscription = new Subscription().farm(farm).entitlementStatus("PENDING");
        subscription.setPlanVersion(version);
        return save(subscription);
    }

    protected Payment payment(Subscription subscription, AppUser requester, String code, String state, Instant at) {
        Payment payment = new Payment().subscription(subscription).requestedBy(requester).quoteRef(code).state(state)
            .durationYears(1).amountVnd(new BigDecimal("1200000"));
        payment.setRequestedAt(at);
        payment.setExpiresAt(at.plusSeconds(86400));
        payment.setPriceVersion(subscription.getPlanVersion());
        return save(payment);
    }

    protected ResultActions history(AppUser owner, Farm farm, String query) throws Exception {
        em.flush(); em.clear();
        return mvc.perform(get(java.net.URI.create("/api/farms/" + farm.getId() + "/subscription/payments" + query))
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(owner.getEmail())));
    }

    protected JsonNode read(ResultActions result) throws Exception {
        return mapper.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    protected List<String> codes(JsonNode page) {
        List<String> codes = new ArrayList<>();
        page.path("content").forEach(p -> codes.add(p.path("quoteRef").asText()));
        return codes;
    }

    @Test
    void currentOwnerSeesFarmHistoryRegardlessOfRequesterAndServiceStateWithoutWrites() throws Exception {
        for (String state : List.of("PENDING_PAYMENT", "ACTIVE", "EXPIRED", "SUSPENDED")) {
            Farm farm = farm(state); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            Payment payment = payment(subscription(farm), user(), "BC-OLD-" + next(), "PENDING", clock.instant());
            JsonNode page = read(history(owner, farm, ""));
            assertThat(codes(page)).containsExactly(payment.getQuoteRef());
            assertThat(page.path("size").asInt()).isEqualTo(20);
            assertThat(page.path("totalElements").asLong()).isEqualTo(1);
            assertThat(em.find(Payment.class, payment.getId()).getState()).isEqualTo("PENDING");
            assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo(state);
        }
    }

    @Test
    void emptyFarmReadsNeverCreateASubscriptionOrPayment() throws Exception {
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode page = read(history(owner, farm, ""));
        assertThat(page.path("content").isArray()).isTrue();
        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
        assertThat(em.createQuery("select count(s) from Subscription s where s.farm.id=:f", Long.class)
            .setParameter("f", farm.getId()).getSingleResult()).isZero();
    }

    @Test
    void combinesLiteralCaseInsensitiveSearchAndInclusiveVietnamCreatedDates() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); Subscription sub = subscription(farm);
        clock.set(Instant.parse("2026-11-10T05:00:00Z"));
        payment(sub, owner, "BC-ALPHA-BEFORE", "PAID", Instant.parse("2026-11-07T16:59:59Z"));
        payment(sub, owner, "BC-Alpha-START", "PAID", Instant.parse("2026-11-07T17:00:00Z"));
        payment(sub, owner, "BC-alpha-END", "PAID", Instant.parse("2026-11-08T16:59:59.999999Z"));
        payment(sub, owner, "BC-ALPHA-AFTER", "PAID", Instant.parse("2026-11-08T17:00:00Z"));
        assertThat(codes(read(history(owner, farm, "?q=%20aLpHa%20&status=PAID&from=2026-11-08&to=2026-11-08"))))
            .containsExactly("BC-alpha-END", "BC-Alpha-START");
        assertThat(read(history(owner, farm, "?from=2026-11-08")).path("totalElements").asInt()).isEqualTo(3);
        assertThat(read(history(owner, farm, "?to=2026-11-08")).path("totalElements").asInt()).isEqualTo(3);
        assertThat(codes(read(history(owner, farm, "?q=%25")))).isEmpty();
        assertThat(codes(read(history(owner, farm, "?q=_")))).isEmpty();
    }

    @Test
    void pagesAfterFilteringAndUsesStableSortingForBothTimestampColumns() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); Subscription sub = subscription(farm);
        List<Payment> rows = new ArrayList<>();
        for (int i = 0; i < 23; i++) {
            Payment payment = payment(sub, owner, "BC-PAGE-" + i, "PAID", clock.instant());
            payment.setExpiresAt(clock.instant().plusSeconds(100 + i)); rows.add(payment);
        }
        JsonNode first = read(history(owner, farm, ""));
        assertThat(first.path("content")).hasSize(20);
        assertThat(first.path("totalPages").asInt()).isEqualTo(2);
        assertThat(codes(first).getFirst()).isEqualTo(rows.getLast().getQuoteRef());
        JsonNode second = read(history(owner, farm, "?page=1"));
        assertThat(codes(second)).containsExactly("BC-PAGE-2", "BC-PAGE-1", "BC-PAGE-0");
        assertThat(codes(read(history(owner, farm, "?sort=expiresAt&dir=asc"))).getFirst()).isEqualTo("BC-PAGE-0");
        assertThat(codes(read(history(owner, farm, "?sort=requestedAt&dir=asc"))).getFirst()).isEqualTo("BC-PAGE-0");
        assertThat(codes(read(history(owner, farm, "?q=PAGE-22")))).containsExactly("BC-PAGE-22");
    }

    @Test
    void filtersByEffectiveExpiryBeforePagingWithoutUpdatingStoredState() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); Subscription sub = subscription(farm);
        Payment expired = payment(sub, owner, "BC-AT-EXPIRY", "PENDING", clock.instant().minusSeconds(86400));
        payment(sub, owner, "BC-STILL-PENDING", "PENDING", clock.instant().minusSeconds(86399));
        assertThat(codes(read(history(owner, farm, "?status=EXPIRED")))).containsExactly("BC-AT-EXPIRY");
        assertThat(codes(read(history(owner, farm, "?status=PENDING")))).containsExactly("BC-STILL-PENDING");
        assertThat(em.find(Payment.class, expired.getId()).getState()).isEqualTo("PENDING");
    }

    @Test
    void rejectsInvalidRangesEnumsSortPageAndLongSearch() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        history(owner, farm, "?from=2026-11-09&to=2026-11-08").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-11"));
        for (String query : List.of("?status=HELD", "?sort=amountVnd", "?dir=sideways", "?page=-1", "?from=invalid", "?q=" + "a".repeat(101))) {
            history(owner, farm, query).andExpect(status().isBadRequest());
        }
        // Regression: page * 20 beyond int range used to reach Spring Data's offset check and answer 500.
        history(owner, farm, "?page=" + (Integer.MAX_VALUE / 20 + 1)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("page"));
        assertThat(read(history(owner, farm, "?page=" + Integer.MAX_VALUE / 20)).path("content")).isEmpty();
    }

    @Test
    void listReadsEvidenceInOneBatchAndMatchesEachRowToItsOwnEvidence() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); Subscription sub = subscription(farm);
        Instant base = clock.instant().minusSeconds(3600);
        Payment allocatedRow = receiving(payment(sub, owner, "BC-EVA-" + next(), "PAID", base));
        Payment receivedRow = receiving(payment(sub, owner, "BC-EVB-" + next(), "PENDING", base.plusSeconds(60)));
        Payment emptyRow = receiving(payment(sub, owner, "BC-EVC-" + next(), "PENDING", base.plusSeconds(120)));
        evidence(allocatedRow.getQuoteRef(), allocatedRow, base.plusSeconds(5), base.plusSeconds(7), "ACC-1");
        evidence(receivedRow.getQuoteRef().toLowerCase(java.util.Locale.ROOT), null, base.plusSeconds(65), base.plusSeconds(66), "ACC-1");
        evidence(emptyRow.getQuoteRef(), null, base.plusSeconds(125), base.plusSeconds(126), "OTHER-ACCOUNT");

        JsonNode rows = read(history(owner, farm, "?sort=requestedAt&dir=asc")).path("content");
        assertThat(rows.get(0).path("bankPaidAt").asText()).isEqualTo(base.plusSeconds(5).toString());
        assertThat(rows.get(0).path("receivedAt").asText()).isEqualTo(base.plusSeconds(7).toString());
        assertThat(rows.get(1).path("bankPaidAt").asText()).isEqualTo(base.plusSeconds(65).toString());
        assertThat(rows.get(1).path("receivedAt").asText()).isEqualTo(base.plusSeconds(66).toString());
        assertThat(rows.get(2).get("bankPaidAt").isNull()).isTrue();
        assertThat(rows.get(2).get("receivedAt").isNull()).isTrue();
        for (int i = 0; i < 3; i++) {
            JsonNode row = rows.get(i);
            JsonNode detail = read(mvc.perform(get("/api/farms/{f}/subscription/payments/{p}", farm.getId(), row.path("id").asLong())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(owner.getEmail()))));
            assertThat(row).as("list row equals detail for " + row.path("quoteRef").asText()).isEqualTo(detail);
        }

        read(history(owner, farm, "")); // warm-up outside the measured window
        long threeRows = statements(() -> read(history(owner, farm, "")));
        for (int i = 0; i < 17; i++) {
            Payment extra = receiving(payment(sub, owner, "BC-EVX-" + next(), "PAID", base.plusSeconds(200 + i)));
            evidence(extra.getQuoteRef(), extra, base.plusSeconds(201 + i), base.plusSeconds(202 + i), "ACC-1");
        }
        long twentyRows = statements(() -> assertThat(read(history(owner, farm, "")).path("content")).hasSize(20));
        assertThat(threeRows).as("statistics must observe the request").isPositive();
        assertThat(twentyRows - threeRows).as("no per-row evidence query: 3 rows %d, 20 rows %d", threeRows, twentyRows).isLessThanOrEqualTo(2);
    }

    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;

    interface Call { void run() throws Exception; }

    protected long statements(Call call) throws Exception {
        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            call.run();
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }

    protected Payment receiving(Payment payment) {
        payment.setReceivingEnvironment("MOCK"); payment.setReceivingAccountNamespace("LOCAL-MOCK"); payment.setReceivingAccount("ACC-1");
        return save(payment);
    }

    protected BankTransferEvidence evidence(String quoteRef, Payment allocatedTo, Instant bankPaidAt, Instant receivedAt, String account) {
        BankTransferEvidence evidence = new BankTransferEvidence();
        evidence.setProviderTxnId(700000L + next()); evidence.setAmount(new BigDecimal("1200000")); evidence.setBankPaidAt(bankPaidAt);
        evidence.setQuoteRef(quoteRef); evidence.setPayment(allocatedTo); evidence.setProvider("SEPAY"); evidence.setEnvironment("MOCK");
        evidence.setAccountNamespace("LOCAL-MOCK"); evidence.setAuthOutcome("VERIFIED"); evidence.setTransferDirection("IN");
        evidence.setReceivingAccount(account); evidence.setReviewStatus(allocatedTo == null ? "UNMATCHED" : "ACCEPTED");
        evidence.setFirstReceivedAt(receivedAt);
        return save(evidence);
    }

    @Test
    void guardsListsAndDetailsAgainstRolesOtherFarmsAndRevokedMembership() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Payment payment = payment(subscription(farm), owner, "BC-PRIVATE-" + next(), "PAID", clock.instant());
        for (AppUser denied : List.of(memberWithRole(farm, FarmRole.MANAGER), memberWithRole(farm, FarmRole.TECHNICIAN), user())) {
            history(denied, farm, "").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            mvc.perform(get("/api/farms/{f}/subscription/payments/{p}", farm.getId(), payment.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(denied.getEmail())))
                .andExpect(status().isForbidden());
        }
        Farm other = farm(); AppUser otherOwner = memberWithRole(other, FarmRole.OWNER);
        assertThat(codes(read(history(otherOwner, other, "")))).isEmpty();
        mvc.perform(get("/api/farms/{f}/subscription/payments/{p}", other.getId(), payment.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(otherOwner.getEmail())))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/farms/{f}/subscription/payments", farm.getId())).andExpect(status().isUnauthorized());
        em.createQuery("update FarmMembership m set m.status='INACTIVE' where m.farm.id=:f and m.user.id=:u")
            .setParameter("f", farm.getId()).setParameter("u", owner.getId()).executeUpdate(); em.clear();
        history(owner, farm, "").andExpect(status().isForbidden());
        mvc.perform(get("/api/farms/{f}/subscription/payments/{p}", farm.getId(), payment.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(owner.getEmail())))
            .andExpect(status().isForbidden());
    }

    @Test
    void detailAndListPreserveStoredSecondsSnapshotsAndNullLegacyFields() throws Exception {
        Farm farm = farm("SUSPENDED"); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Payment payment = payment(subscription(farm), user(), "BC-DETAIL-" + next(), "PAID", clock.instant().minusSeconds(86400));
        Instant confirmed = clock.instant().minusSeconds(123);
        payment.setConfirmedAt(confirmed); payment.setConfirmationSource("PM");
        payment.setPurchasedStart(confirmed); payment.setPurchasedEnd(confirmed.plusSeconds(31536000));
        em.flush(); em.clear();
        JsonNode detail = read(mvc.perform(get("/api/farms/{f}/subscription/payments/{p}", farm.getId(), payment.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(owner.getEmail()))));
        JsonNode list = read(history(owner, farm, "")).path("content").get(0);
        assertThat(list).isEqualTo(detail);
        assertThat(detail.path("confirmedAt").asText()).isEqualTo(confirmed.toString());
        assertThat(detail.path("purchasedStart").asText()).isEqualTo(confirmed.toString());
        assertThat(detail.path("priceVersionId").asLong()).isEqualTo(em.find(Payment.class, payment.getId()).getPriceVersion().getId());
        for (String field : List.of("bankPaidAt", "receivedAt", "bankCode", "accountNumber", "accountName", "receiptCode")) {
            assertThat(detail.has(field)).as(field).isTrue(); assertThat(detail.get(field).isNull()).as(field).isTrue();
        }
        assertThat(em.find(Payment.class, payment.getId()).getConfirmedAt()).isEqualTo(confirmed);
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("SUSPENDED");
    }
}
