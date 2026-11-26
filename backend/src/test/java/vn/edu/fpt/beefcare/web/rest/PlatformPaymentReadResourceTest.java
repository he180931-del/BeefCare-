package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.PlatformAccessService;
import vn.edu.fpt.beefcare.service.payment.PlatformPaymentQueryService;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** D18: real security + persisted read models; inherited unchanged by the PostgreSQL contract. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = {"beefcare.sepay.environment=MOCK", "beefcare.sepay.account-namespace=UC5", "beefcare.sepay.account-number=UC5-ACCOUNT",
    "spring.datasource.url=jdbc:h2:mem:uc5;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"})
class PlatformPaymentReadResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired PlatformAccessService access;
    @Autowired FarmClock farmClock;

    private AppUser staff(String role) {
        AppUser actor = user();
        save(new PlatformStaffAccess().user(actor).role(role).status("ACTIVE"));
        return actor;
    }

    private Payment payment(String code, String state, Instant requested, Instant expires) {
        PlanVersion plan = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(1)));
        Farm farm = farm("SUSPENDED"); farm.setName("UC5 Farm %_ " + next());
        Subscription sub = save(new Subscription().farm(farm).planVersion(plan).entitlementStatus("PENDING"));
        Payment p = new Payment(); p.setSubscription(sub); p.setRequestedBy(user()); p.setPriceVersion(plan);
        p.setQuoteRef(code); p.setState(state); p.setDurationYears(1); p.setAmountVnd(new BigDecimal("1200000"));
        p.setRequestedAt(requested); p.setExpiresAt(expires); p.setReceivingAccount("UC5-ACCOUNT");
        p.setReceivingEnvironment("MOCK"); p.setReceivingAccountNamespace("UC5");
        return save(p);
    }

    private BankTransferEvidence evidence(String state, Instant bankAt, Payment allocated) {
        BankTransferEvidence e = new BankTransferEvidence();
        e.setProvider("SEPAY"); e.setEnvironment("MOCK"); e.setAccountNamespace("UC5");
        e.setProviderTxnId(987654000000L + next()); e.setAmount(new BigDecimal("1200000")); e.setBankPaidAt(bankAt);
        e.setReviewStatus(state); e.setTransferDirection("IN"); e.setReceivingAccount("UC5-ACCOUNT");
        e.setTransferContent("Stored transfer " + next()); e.setAuthOutcome("VERIFIED"); e.setPayment(allocated);
        return save(e);
    }

    private ResultActions read(AppUser actor, String path) throws Exception {
        String[] parts = path.split("\\?", 2);
        var request = get("/api/platform/payments" + parts[0]).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail()));
        if (parts.length > 1) for (String item : parts[1].split("&")) {
            String[] p = item.split("=", 2);
            request.param(p[0], java.net.URLDecoder.decode(p.length == 1 ? "" : p[1], java.nio.charset.StandardCharsets.UTF_8));
        }
        return mvc.perform(request);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return om.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private List<Long> ids(JsonNode page) {
        List<Long> result = new ArrayList<>(); page.path("items").forEach(row -> result.add(row.path("id").asLong())); return result;
    }

    private void event(BankTransferEvidence evidence, String action, String details, Instant at) {
        AuditLog event = new AuditLog(); event.setTargetType("BankTransferEvidence"); event.setTargetId(evidence.getId());
        event.setAction(action); event.setLoggedAt(at); event.setDetails(details); save(event);
    }

    @Test
    void onlyActivePmCanReadEveryEndpointAndRevocationAppliesImmediately() throws Exception {
        Payment p = payment("BCUC5AUTH", "PENDING", clock.instant(), clock.instant().plusSeconds(86400));
        BankTransferEvidence e = evidence("UNMATCHED", clock.instant(), null);
        List<String> paths = List.of("", "/summary", "/" + p.getId(), "/evidence", "/evidence/" + e.getId(), "/evidence/" + e.getId() + "/candidates");
        for (AppUser actor : List.of(user(), staff("SA"), staff("CS"))) for (String path : paths) {
            read(actor, path).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        AppUser inactive = staff("PM"); inactive.setAccountStatus("SUSPENDED"); em.flush();
        for (String path : paths) read(inactive, path).andExpect(status().isForbidden());
        AppUser pm = staff("PM");
        for (String path : paths) read(pm, path).andExpect(status().isOk());
        em.createQuery("update PlatformStaffAccess a set a.status='INACTIVE' where a.user.id=:id").setParameter("id", pm.getId()).executeUpdate();
        em.clear();
        for (String path : paths) read(pm, path).andExpect(status().isForbidden());
        for (String path : paths) mvc.perform(get("/api/platform/payments" + path)).andExpect(status().isUnauthorized());
    }

    @Test
    void globalTilesAndStatusAliasesAgreeAndExcludeExpiredPendingAndLockedHolds() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        JsonNode before = body(read(pm, "/summary"));
        payment("BCUC5LIVE", "PENDING", now.minusSeconds(1), now.plusSeconds(1));
        payment("BCUC5EXPIRED", "PENDING", now.minusSeconds(86400), now);
        evidence("UNMATCHED", now, null); evidence("NEEDS_REVIEW", now, null);
        evidence("HOLD", now, null); evidence("HELD", now, null);
        BankTransferEvidence locked = evidence("HOLD", now, null); locked.setLockedForReturn(true);
        evidence("LOCKED_FOR_RETURN", now, null);
        BankTransferEvidence matched = evidence("MATCHED", now, null);
        em.flush(); em.clear();
        JsonNode tiles = body(read(pm, "/summary"));
        assertThat(tiles.path("pendingRequests").asLong() - before.path("pendingRequests").asLong()).isEqualTo(1);
        assertThat(tiles.path("evidenceToReview").asLong() - before.path("evidenceToReview").asLong()).isEqualTo(2);
        assertThat(tiles.path("hold").asLong() - before.path("hold").asLong()).isEqualTo(2);
        assertThat(tiles.path("lockedForReturn").asLong() - before.path("lockedForReturn").asLong()).isEqualTo(2);
        assertThat(ids(body(read(pm, "/evidence?status=ACCEPTED")))).contains(matched.getId());
        assertThat(ids(body(read(pm, "/evidence?status=HOLD")))).doesNotContain(locked.getId());
        assertThat(ids(body(read(pm, "/evidence")))).contains(matched.getId(), locked.getId());
    }

    @Test
    void evidenceDatesAreInclusiveVietnamDaysAndPagingMasksFullTransactionIds() throws Exception {
        AppUser pm = staff("PM"); Instant bank = Instant.parse("2026-10-01T17:00:00Z");
        List<Long> expected = new ArrayList<>();
        BankTransferEvidence last = null;
        for (int i = 0; i < 23; i++) { last = evidence("UNMATCHED", bank, null); expected.addFirst(last.getId()); }
        evidence("UNMATCHED", bank.minusSeconds(1), null); evidence("UNMATCHED", bank.plusSeconds(86400), null);
        em.flush(); em.clear();
        JsonNode first = body(read(pm, "/evidence?bankFrom=2026-10-02&bankTo=2026-10-02"));
        assertThat(first.path("total").asLong()).isEqualTo(23); assertThat(first.path("size").asInt()).isEqualTo(20);
        assertThat(ids(first)).containsExactlyElementsOf(expected.subList(0, 20));
        assertThat(first.path("items").get(0).path("maskedTransactionId").asText()).isEqualTo("****" + last.getProviderTxnId().toString().substring(8));
        assertThat(first.path("items").get(0).has("transactionId")).isFalse();
        assertThat(first.toString()).doesNotContain(last.getProviderTxnId().toString());
        assertThat(ids(body(read(pm, "/evidence?bankFrom=2026-10-02&bankTo=2026-10-02&page=1")))).containsExactlyElementsOf(expected.subList(20, 23));
        assertThat(ids(body(read(pm, "/evidence?bankTo=2026-10-01")))).hasSize(1);
        assertThat(ids(body(read(pm, "/evidence?bankFrom=2026-10-03")))).hasSize(1);
    }

    @Test
    void paymentSearchAndEffectiveExpiryRunBeforeStablePagingWithoutWritingState() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant(); List<Long> expected = new ArrayList<>();
        for (int i = 0; i < 23; i++) expected.addFirst(payment("BCUC5_%_" + i, "PENDING", now.minusSeconds(86400), now).getId());
        payment("BCUC5_OTHER", "PENDING", now, now.plusSeconds(10)); em.flush(); em.clear();
        JsonNode first = body(read(pm, "?q=uc5_%25_&state=EXPIRED"));
        assertThat(first.path("total").asLong()).isEqualTo(23); assertThat(first.path("size").asInt()).isEqualTo(20);
        assertThat(ids(first)).containsExactlyElementsOf(expected.subList(0, 20));
        assertThat(first.path("items").get(0).path("state").asText()).isEqualTo("EXPIRED");
        assertThat(ids(body(read(pm, "?q=uc5_%25_&state=PENDING")))).isEmpty();
        assertThat(ids(body(read(pm, "?q=uc5_%25_&state=EXPIRED&page=1")))).containsExactlyElementsOf(expected.subList(20, 23));
        em.clear(); assertThat(em.find(Payment.class, expected.getFirst()).getState()).isEqualTo("PENDING");
    }

    @Test
    void detailsReadExactAllocationStoredClocksAndCommittedHistoryWithLegacyNulls() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        Payment p = payment("BCUC5DETAIL", "PAID", now.minusSeconds(100), now.plusSeconds(100));
        p.setConfirmedAt(now.minusSeconds(1)); p.setConfirmationSource("SEPAY"); p.setPurchasedStart(now); p.setPurchasedEnd(now.plusSeconds(1000));
        BankTransferEvidence e = evidence("ACCEPTED", now.minusSeconds(50), p); e.setFirstReceivedAt(now.minusSeconds(20));
        e.setReferenceCode("BANK-REF"); e.setQuoteRef(p.getQuoteRef());
        EvidenceReview review = new EvidenceReview(); review.setEvidence(e); review.setPmUser(pm); review.setDecision("HOLD");
        review.setReason("Persisted reason with ticket TK-UC5"); review.setReviewedAt(now.minusSeconds(10)); save(review);
        AuditLog event = new AuditLog(); event.setActor(pm); event.setTargetType("BankTransferEvidence"); event.setTargetId(e.getId());
        event.setAction("EVIDENCE_LOCK_RETURN"); event.setLoggedAt(now.minusSeconds(5)); event.setDetails("{\"reason\":\"Stored lock reason\",\"secretPayload\":\"MUST_NOT_LEAK\"}"); save(event);
        BankTransferEvidence legacy = evidence("UNMATCHED", now, null); em.flush(); em.clear();
        JsonNode detail = body(read(pm, "/evidence/" + e.getId()));
        assertThat(detail.path("transactionId").asText()).isEqualTo(e.getProviderTxnId().toString());
        assertThat(detail.path("summary").path("matchResult").asText()).isEqualTo("PAID_AUTO");
        assertThat(detail.path("summary").path("receivingAccountMatches").asBoolean()).isTrue();
        assertThat(detail.path("firstReceivedAt").asText()).isEqualTo(now.minusSeconds(20).toString());
        assertThat(detail.path("history")).hasSize(2); assertThat(detail.toString()).contains("Stored lock reason", "Persisted reason", "TK-UC5").doesNotContain("MUST_NOT_LEAK", "secretPayload");
        JsonNode payment = body(read(pm, "/" + p.getId()));
        assertThat(payment.path("evidenceId").asLong()).isEqualTo(e.getId());
        assertThat(payment.path("bankPaidAt").asText()).isEqualTo(now.minusSeconds(50).toString());
        assertThat(payment.path("receivedAt").asText()).isEqualTo(now.minusSeconds(20).toString());
        assertThat(payment.path("confirmedAt").asText()).isEqualTo(now.minusSeconds(1).toString());
        assertThat(body(read(pm, "/evidence/" + legacy.getId())).path("firstReceivedAt").isNull()).isTrue();
    }

    @Test
    void matchingUsesOriginalBankWindowAndSnapshotAccountInsteadOfCurrentExpiry() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        Payment p = payment("BCUC5WINDOW", "EXPIRED", now.minusSeconds(200), now.minusSeconds(100));
        BankTransferEvidence valid = evidence("NEEDS_REVIEW", now.minusSeconds(150), null); valid.setQuoteRef(p.getQuoteRef());
        BankTransferEvidence late = evidence("UNMATCHED", p.getExpiresAt(), null); late.setQuoteRef(p.getQuoteRef());
        BankTransferEvidence wrong = evidence("UNMATCHED", now.minusSeconds(150), null); wrong.setQuoteRef(p.getQuoteRef()); wrong.setReceivingAccount("WRONG");
        em.flush(); em.clear();
        assertThat(body(read(pm, "/evidence/" + valid.getId())).path("summary").path("matchResult").asText()).isEqualTo("EXACT_CODE");
        assertThat(body(read(pm, "/evidence/" + late.getId())).path("summary").path("matchResult").asText()).isEqualTo("REQUEST_EXPIRED");
        assertThat(body(read(pm, "/evidence/" + wrong.getId())).path("summary").path("receivingAccountMatches").asBoolean()).isFalse();
        assertThat(body(read(pm, "/evidence/" + wrong.getId())).path("summary").path("matchResult").asText()).isEqualTo("ACCOUNT_MISMATCH");
    }

    @Test
    void accountChecksAndCandidatesUseTheSameAccountRuleAsIngestionAndAccept() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        // SePay ingestion and UC6 ACCEPT compare letters and digits only; a snapshot may keep the configured separators.
        Payment p = payment("BCUC5FORMAT", "PENDING", now.minusSeconds(100), now.plusSeconds(100)); p.setReceivingAccount("uc5.account");
        BankTransferEvidence coded = evidence("UNMATCHED", now.minusSeconds(50), null); coded.setQuoteRef(p.getQuoteRef());
        BankTransferEvidence uncoded = evidence("UNMATCHED", now.minusSeconds(50), null);
        em.flush(); em.clear();
        JsonNode summary = body(read(pm, "/evidence/" + coded.getId())).path("summary");
        assertThat(summary.path("receivingAccountMatches").asBoolean()).isTrue();
        assertThat(summary.path("matchResult").asText()).isEqualTo("EXACT_CODE");
        assertThat(body(read(pm, "/evidence/" + uncoded.getId() + "/candidates")).findValuesAsText("paymentId")).contains(p.getId().toString());
        // Configuration typed with another case or spacing is compared as ingestion stored it, not as raw text.
        actAs(pm);
        var reads = new PlatformPaymentQueryService(em, access, farmClock, om, " uc5 account ", " mock ", " UC5 ");
        var row = reads.evidence(uncoded.getId()).summary();
        assertThat(row.receivingAccountMatches()).isTrue();
        assertThat(row.matchResult()).isEqualTo("CODE_MISMATCH");
    }

    @Test
    void candidatesListOnlyUnallocatedRequestsTheAcceptCommandWouldTake() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant(); Instant bank = now.minusSeconds(50);
        BigDecimal amount = new BigDecimal("1234000");
        // Expired now, but the bank time is inside its original window: eligible exactly like UC6 ACCEPT.
        Payment eligible = payment("BCUC5CANDOK", "EXPIRED", now.minusSeconds(100), now.minusSeconds(10));
        Payment otherEnvironment = payment("BCUC5CANDENV", "PENDING", now.minusSeconds(100), now.plusSeconds(100));
        otherEnvironment.setReceivingEnvironment("LIVE");
        Payment otherNamespace = payment("BCUC5CANDNS", "PENDING", now.minusSeconds(100), now.plusSeconds(100));
        otherNamespace.setReceivingAccountNamespace("OTHER");
        Payment otherAccount = payment("BCUC5CANDACC", "PENDING", now.minusSeconds(100), now.plusSeconds(100));
        otherAccount.setReceivingAccount("OTHER-ACCOUNT");
        Payment paid = payment("BCUC5CANDPAID", "PAID", now.minusSeconds(100), now.plusSeconds(100));
        Payment requestedLater = payment("BCUC5CANDLATE", "PENDING", bank.plusSeconds(1), now.plusSeconds(100));
        Payment allocated = payment("BCUC5CANDALLOC", "PENDING", now.minusSeconds(100), now.plusSeconds(100));
        payment("BCUC5CANDAMT", "PENDING", now.minusSeconds(100), now.plusSeconds(100));
        for (Payment p : List.of(eligible, otherEnvironment, otherNamespace, otherAccount, paid, requestedLater, allocated)) p.setAmountVnd(amount);
        BankTransferEvidence open = evidence("UNMATCHED", bank, null);
        BankTransferEvidence locked = evidence("UNMATCHED", bank, null); locked.setLockedForReturn(true);
        BankTransferEvidence outgoing = evidence("UNMATCHED", bank, null); outgoing.setTransferDirection("OUT");
        BankTransferEvidence accepted = evidence("ACCEPTED", bank, allocated);
        for (BankTransferEvidence e : List.of(open, locked, outgoing, accepted)) e.setAmount(amount);
        em.flush(); em.clear();
        JsonNode candidates = body(read(pm, "/evidence/" + open.getId() + "/candidates"));
        assertThat(candidates.findValuesAsText("paymentId")).containsExactly(eligible.getId().toString());
        assertThat(candidates.get(0).path("quoteRef").asText()).isEqualTo("BCUC5CANDOK");
        assertThat(candidates.get(0).path("farmName").asText()).isEqualTo(eligible.getSubscription().getFarm().getName());
        assertThat(candidates.get(0).path("accountNamespace").asText()).isEqualTo("UC5");
        for (BankTransferEvidence e : List.of(locked, outgoing, accepted)) {
            assertThat(body(read(pm, "/evidence/" + e.getId() + "/candidates"))).as("no candidates for evidence " + e.getId()).isEmpty();
        }
    }

    @Test
    void unknownStoredReviewStatusesStayInsideTheDeclaredEnum() throws Exception {
        AppUser pm = staff("PM"); Instant bank = Instant.parse("2026-09-15T03:00:00Z");
        evidence("RECEIVED", bank, null); evidence("FUTURE_PROVIDER_STATE", bank, null);
        em.flush(); em.clear();
        String day = "&bankFrom=2026-09-15&bankTo=2026-09-15";
        assertThat(body(read(pm, "/evidence?status=ALL" + day)).path("items").findValuesAsText("reviewStatus")).containsExactly("PROCESSING", "PROCESSING");
        for (String status : List.of("TO_REVIEW", "HOLD", "REJECTED", "ACCEPTED", "LOCKED")) {
            assertThat(ids(body(read(pm, "/evidence?status=" + status + day)))).as(status).isEmpty();
        }
    }

    @Test
    void outgoingTransfersAreNotQueuedForReviewButStayVisibleUnderAll() throws Exception {
        // D20: SRS 2447 lists only incoming problems as "needing review"; money sent out can never fund a request.
        AppUser pm = staff("PM"); Instant bank = Instant.parse("2026-09-20T03:00:00Z");
        JsonNode before = body(read(pm, "/summary"));
        BankTransferEvidence incoming = evidence("UNMATCHED", bank, null);
        BankTransferEvidence outgoing = evidence("UNMATCHED", bank, null); outgoing.setTransferDirection("OUT");
        BankTransferEvidence outgoingHeld = evidence("HOLD", bank, null); outgoingHeld.setTransferDirection("OUT");
        em.flush(); em.clear();
        JsonNode tiles = body(read(pm, "/summary"));
        assertThat(tiles.path("evidenceToReview").asLong() - before.path("evidenceToReview").asLong()).isEqualTo(1);
        assertThat(tiles.path("hold").asLong() - before.path("hold").asLong()).isEqualTo(1);
        String day = "&bankFrom=2026-09-20&bankTo=2026-09-20";
        assertThat(ids(body(read(pm, "/evidence?status=TO_REVIEW" + day)))).containsExactly(incoming.getId());
        JsonNode all = body(read(pm, "/evidence?status=ALL" + day));
        assertThat(ids(all)).contains(outgoing.getId(), outgoingHeld.getId());
        for (JsonNode row : all.path("items")) {
            long id = row.path("id").asLong();
            if (id == outgoing.getId()) assertThat(row.path("reviewStatus").asText()).isEqualTo("NO_ACTION");
            if (id == outgoingHeld.getId()) assertThat(row.path("reviewStatus").asText()).isEqualTo("HOLD");
            if (id == incoming.getId()) assertThat(row.path("reviewStatus").asText()).isEqualTo("TO_REVIEW");
        }
    }

    @Test
    void historyNamesIngestionEventsWithDocumentedCodesInsteadOfAuditActions() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        Payment p = payment("BCUC5AUTOHIST", "PAID", now.minusSeconds(100), now.plusSeconds(100)); p.setConfirmationSource("SEPAY");
        BankTransferEvidence auto = evidence("ACCEPTED", now.minusSeconds(50), p);
        BankTransferEvidence manual = evidence("UNMATCHED", now.minusSeconds(40), null);
        event(auto, "SEPAY_EVIDENCE", "{\"reviewStatus\":\"ACCEPTED\",\"reason\":\"Automatically matched by exact payment reference and amount\"}", now.minusSeconds(49));
        event(manual, "MOCK_EVIDENCE", "{\"reviewStatus\":\"UNMATCHED\",\"reason\":\"No matching payment request\"}", now.minusSeconds(39));
        event(manual, "PM_ACCEPT_EVIDENCE", "{\"reviewStatus\":\"ACCEPTED\",\"reason\":\"Duplicate of the review row\"}", now.minusSeconds(30));
        em.flush(); em.clear();
        JsonNode autoHistory = body(read(pm, "/evidence/" + auto.getId())).path("history");
        assertThat(autoHistory.findValuesAsText("action")).containsExactly("EVIDENCE_AUTO_ACCEPTED");
        JsonNode manualHistory = body(read(pm, "/evidence/" + manual.getId())).path("history");
        assertThat(manualHistory.findValuesAsText("action")).containsExactly("EVIDENCE_RECEIVED");
        assertThat(manualHistory.get(0).path("reason").asText()).isEqualTo("No matching payment request");
        assertThat(autoHistory + manualHistory.toString()).doesNotContain("SEPAY_EVIDENCE", "MOCK_EVIDENCE", "PM_ACCEPT_EVIDENCE", "Duplicate of the review row");
    }

    @Test
    void rejectsInvalidFiltersDatesAndPagingAndMissingDetailsWithDomainCodes() throws Exception {
        AppUser pm = staff("PM");
        for (String path : List.of("?state=OTHER", "?q=" + "x".repeat(101), "?page=-1", "?page=107374183", "?size=0", "?size=101",
            "/evidence?status=OTHER", "/evidence?page=-1", "/evidence?page=107374183", "/evidence?size=0", "/evidence?size=101")) {
            read(pm, path).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        }
        read(pm, "/evidence?bankFrom=2026-10-03&bankTo=2026-10-02").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-11"));
        for (String path : List.of("/9223372036854775807", "/evidence/9223372036854775807")) {
            read(pm, path).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        }
    }

    @Test
    void allReadsLeavePaymentEvidenceHistoryAndCommercialStateUnchanged() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        Payment p = payment("BCUC5NOWRITE", "PENDING", now.minusSeconds(86400), now);
        BankTransferEvidence e = evidence("UNMATCHED", now.minusSeconds(1), null); e.setQuoteRef(p.getQuoteRef()); em.flush(); em.clear();
        List<String> entities = List.of("Payment", "Subscription", "BankTransferEvidence", "EvidenceReview", "AuditLog", "Notification");
        List<Long> counts = entities.stream().map(name -> em.createQuery("select count(x) from " + name + " x", Long.class).getSingleResult()).toList();
        for (String path : List.of("", "/summary", "/" + p.getId(), "/evidence", "/evidence/" + e.getId(), "/evidence/" + e.getId() + "/candidates")) body(read(pm, path));
        em.flush(); em.clear();
        assertThat(entities.stream().map(name -> em.createQuery("select count(x) from " + name + " x", Long.class).getSingleResult()).toList()).isEqualTo(counts);
        assertThat(em.find(Payment.class, p.getId()).getState()).isEqualTo("PENDING");
        assertThat(em.find(Payment.class, p.getId()).getConfirmedAt()).isNull();
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getPayment()).isNull();
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getReviewStatus()).isEqualTo("UNMATCHED");
        assertThat(em.find(Farm.class, p.getSubscription().getFarm().getId()).getServiceStatus()).isEqualTo("SUSPENDED");
    }
}
