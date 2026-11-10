package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.PlatformFinanceService;
import vn.edu.fpt.beefcare.service.payment.SePayTransactionLookupClient;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** D19 / UC-FE19-06: secured reconciliation commands over persisted data; inherited unchanged by the PostgreSQL contract. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = {"beefcare.sepay.environment=MOCK", "beefcare.sepay.account-namespace=UC6", "beefcare.sepay.account-number=UC6-ACCOUNT",
    "spring.datasource.url=jdbc:h2:mem:uc6;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"})
class PlatformReconciliationResourceTest extends DomainTestSupport {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String BASE = "/api/platform/payments";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @MockBean SePayTransactionLookupClient lookup;

    private AppUser staff(String role) {
        AppUser actor = user();
        save(new PlatformStaffAccess().user(actor).role(role).status("ACTIVE"));
        return actor;
    }

    private Payment payment(String code, String farmStatus, String state, Instant requested, Instant expires) {
        PlanVersion plan = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(1)));
        Farm farm = farm(farmStatus); farm.setName("UC6 Farm " + next());
        memberWithRole(farm, FarmRole.OWNER);
        Subscription sub = save(new Subscription().farm(farm).planVersion(plan).entitlementStatus("PENDING"));
        Payment p = new Payment(); p.setSubscription(sub); p.setRequestedBy(user()); p.setPriceVersion(plan);
        p.setQuoteRef(code); p.setState(state); p.setDurationYears(1); p.setAmountVnd(new BigDecimal("1200000"));
        p.setRequestedAt(requested); p.setExpiresAt(expires); p.setReceivingAccount("UC6-ACCOUNT");
        p.setReceivingEnvironment("MOCK"); p.setReceivingAccountNamespace("UC6");
        return save(p);
    }

    private Payment pending(String code) {
        return payment(code, "ACTIVE", "PENDING", clock.instant().minusSeconds(3600), clock.instant().plusSeconds(3600));
    }

    private BankTransferEvidence evidence(String quoteRef, Instant bankAt) {
        BankTransferEvidence e = new BankTransferEvidence();
        e.setProvider("SEPAY"); e.setEnvironment("MOCK"); e.setAccountNamespace("UC6");
        e.setProviderTxnId(876543000000L + next()); e.setAmount(new BigDecimal("1200000")); e.setBankPaidAt(bankAt);
        e.setReviewStatus("UNMATCHED"); e.setReviewReason("No matching payment request"); e.setTransferDirection("IN");
        e.setReceivingAccount("UC6-ACCOUNT"); e.setQuoteRef(quoteRef); e.setTransferContent("Transfer " + quoteRef);
        e.setAuthOutcome("VERIFIED");
        return save(e);
    }

    private BankTransferEvidence evidence() {
        return evidence("BCTYPO" + next(), clock.instant().minusSeconds(60));
    }

    private Long versionOf(BankTransferEvidence e) {
        em.flush();
        return em.createQuery("select e.version from BankTransferEvidence e where e.id=:id", Long.class).setParameter("id", e.getId()).getSingleResult();
    }

    private ResultActions command(AppUser actor, String path, Map<String, Object> body, String key) throws Exception {
        var request = post(BASE + path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body));
        if (actor != null) request.with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail()));
        if (key != null) request.header("Idempotency-Key", key);
        return mvc.perform(request);
    }

    private ResultActions read(AppUser actor, String path) throws Exception {
        return mvc.perform(get(BASE + path).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())));
    }

    private JsonNode body(ResultActions result) throws Exception {
        return om.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static Map<String, Object> review(String decision, Long paymentId, String reason, Long version) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("decision", decision); body.put("paymentId", paymentId); body.put("reason", reason); body.put("version", version);
        return body;
    }

    private static Map<String, Object> change(String reason, Long version) {
        Map<String, Object> body = new LinkedHashMap<>(); body.put("reason", reason); body.put("version", version); return body;
    }

    private static Map<String, Object> returned(String reference, String date, String result, Long version) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reference", reference); body.put("returnDate", date); body.put("result", result); body.put("version", version);
        return body;
    }

    private long count(String entity) {
        return em.createQuery("select count(x) from " + entity + " x", Long.class).getSingleResult();
    }

    private List<String> decisions(BankTransferEvidence e) {
        return em.createQuery("select r.decision from EvidenceReview r where r.evidence.id=:id order by r.id", String.class).setParameter("id", e.getId()).getResultList();
    }

    private void blocked(ResultActions result, String reason) throws Exception {
        result.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE19-11")).andExpect(jsonPath("$.params.reason").value(reason));
    }

    @Test
    void everyCommandRequiresActivePmAndAnIdempotencyKey() throws Exception {
        BankTransferEvidence e = evidence(); Long v = versionOf(e);
        Map<String, Map<String, Object>> commands = new LinkedHashMap<>();
        commands.put("/evidence/" + e.getId() + "/review", review("HOLD", null, "Chờ sao kê", v));
        commands.put("/evidence/" + e.getId() + "/lock-return", change("Trả lại khách", v));
        commands.put("/evidence/" + e.getId() + "/unlock-return", change("Không hoàn", v));
        commands.put("/evidence/" + e.getId() + "/record-return", returned("FT-OUT-1", clock.instant().atZone(VN).toLocalDate().toString(), "Đã trả", v));
        for (var c : commands.entrySet()) {
            for (AppUser actor : List.of(user(), staff("SA"), staff("CS"))) {
                command(actor, c.getKey(), c.getValue(), "k-" + next()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            }
            command(staff("PM"), c.getKey(), c.getValue(), null).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
            command(null, c.getKey(), c.getValue(), "k-" + next()).andExpect(status().isUnauthorized());
        }
        em.flush(); em.clear();
        assertThat(count("EvidenceReview")).isZero();
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getReviewStatus()).isEqualTo("UNMATCHED");
    }

    @Test
    void acceptWithSelectedCandidateRunsTheSharedConfirmationOnceAndReplaysTheSameKey() throws Exception {
        AppUser pm = staff("PM");
        // R-19-11: a SUSPENDED farm is paid and gets its period but stays SUSPENDED.
        Payment p = payment("BCUC6SELECTED01", "SUSPENDED", "PENDING", clock.instant().minusSeconds(3600), clock.instant().plusSeconds(3600));
        BankTransferEvidence e = evidence(); Long v = versionOf(e);
        long notifications = count("Notification");
        var accept = review("ACCEPT", p.getId(), "Khách gõ sai mã; đối chiếu sao kê TK-77", v);
        JsonNode result = body(command(pm, "/evidence/" + e.getId() + "/review", accept, "uc6-accept"));
        assertThat(result.path("reviewStatus").asText()).isEqualTo("ACCEPTED");
        assertThat(result.path("paymentId").asLong()).isEqualTo(p.getId());
        JsonNode replay = body(command(pm, "/evidence/" + e.getId() + "/review", accept, "uc6-accept"));
        assertThat(replay.path("paymentId").asLong()).isEqualTo(p.getId());
        var changedBody = review("ACCEPT", p.getId(), "Lý do khác", v);
        command(pm, "/evidence/" + e.getId() + "/review", changedBody, "uc6-accept").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        // A new key with the old version is a different attempt on a changed record (E4).
        command(pm, "/evidence/" + e.getId() + "/review", accept, "uc6-accept-2").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        em.flush(); em.clear();
        Payment paid = em.find(Payment.class, p.getId());
        assertThat(paid.getState()).isEqualTo("PAID");
        assertThat(paid.getConfirmationSource()).isEqualTo("PM");
        assertThat(paid.getPurchasedStart()).isNotNull(); assertThat(paid.getPurchasedEnd()).isAfter(paid.getPurchasedStart());
        assertThat(paid.getReceiptCode()).startsWith("RC-");
        BankTransferEvidence stored = em.find(BankTransferEvidence.class, e.getId());
        assertThat(stored.getPayment().getId()).isEqualTo(p.getId());
        assertThat(stored.getReviewReason()).isEqualTo("Khách gõ sai mã; đối chiếu sao kê TK-77");
        assertThat(decisions(e)).containsExactly("ACCEPT");
        assertThat(em.find(Farm.class, p.getSubscription().getFarm().getId()).getServiceStatus()).isEqualTo("SUSPENDED");
        assertThat(count("Notification")).isEqualTo(notifications + 1);
        assertThat(em.createQuery("select count(a) from AuditLog a where a.action='PM_ACCEPT_PAYMENT_PAID' and a.targetId=:id", Long.class)
            .setParameter("id", p.getId()).getSingleResult()).isEqualTo(1);
    }

    @Test
    void acceptByExactCodeNeedsNoCandidateButAMistypedCodeDoes() throws Exception {
        AppUser pm = staff("PM");
        Payment p = pending("BCUC6EXACTCODE1");
        // Exact code stored while the receiving account was not yet configured: eligible now, no candidate needed.
        BankTransferEvidence exact = evidence(p.getQuoteRef(), clock.instant().minusSeconds(60));
        BankTransferEvidence typo = evidence();
        body(command(pm, "/evidence/" + exact.getId() + "/review", review("ACCEPT", null, "Mã đúng, đã cấu hình tài khoản", versionOf(exact)), "uc6-exact"));
        blocked(command(pm, "/evidence/" + typo.getId() + "/review", review("ACCEPT", null, "Không rõ yêu cầu", versionOf(typo)), "uc6-typo"), "NO_CANDIDATE");
        em.flush(); em.clear();
        assertThat(em.find(BankTransferEvidence.class, exact.getId()).getPayment().getId()).isEqualTo(p.getId());
        JsonNode exactHistory = body(read(pm, "/evidence/" + exact.getId())).path("history").get(0);
        assertThat(exactHistory.path("relatedPaymentId").asLong()).isEqualTo(p.getId());
        assertThat(exactHistory.path("relatedPaymentCode").asText()).isEqualTo(p.getQuoteRef());
        assertThat(em.find(BankTransferEvidence.class, typo.getId()).getPayment()).isNull();
        assertThat(decisions(typo)).isEmpty();
    }

    @Test
    void blockedAcceptanceReturnsTheRuleAndAllocatesNothing() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        Payment open = pending("BCUC6BLOCKOPEN1");
        Payment paid = payment("BCUC6BLOCKPAID1", "ACTIVE", "PAID", now.minusSeconds(3600), now.plusSeconds(3600));
        Payment allocated = pending("BCUC6BLOCKALLOC");
        BankTransferEvidence funding = evidence(); funding.setPayment(allocated); funding.setReviewStatus("ACCEPTED");
        Payment otherAccount = pending("BCUC6BLOCKACCT1"); otherAccount.setReceivingAccount("OTHER-ACCOUNT");
        Payment late = payment("BCUC6BLOCKLATE1", "ACTIVE", "PENDING", now.minusSeconds(30), now.plusSeconds(3600));

        BankTransferEvidence amount = evidence(); amount.setAmount(new BigDecimal("1199999"));
        BankTransferEvidence before = evidence(); // bank time 60 s ago is before the late request
        BankTransferEvidence manual = evidence();
        ManualFinanceRecord income = new ManualFinanceRecord(); income.setType("INCOME"); income.setState("POSTED");
        income.setAmountVnd(new BigDecimal("1200000")); income.setOccurredOn(clock.instant().atZone(VN).toLocalDate()); income.setCategory("OTHER");
        income.setRecordCode("MF-UC6-" + next()); income.setCreatedAt(clock.instant()); income.setSourceReference(PlatformFinanceService.sourceReference(manual)); save(income);
        BankTransferEvidence locked = evidence(); locked.setLockedForReturn(true); locked.setReviewStatus("LOCKED_FOR_RETURN");
        BankTransferEvidence outgoing = evidence(); outgoing.setTransferDirection("OUT");
        BankTransferEvidence plain = evidence();

        record Case(BankTransferEvidence evidence, Payment payment, String reason) {}
        for (Case c : List.of(new Case(amount, open, "AMOUNT_MISMATCH"), new Case(before, late, "OUTSIDE_WINDOW"),
            new Case(plain, otherAccount, "ACCOUNT_MISMATCH"), new Case(plain, paid, "REQUEST_NOT_PENDING"),
            new Case(plain, allocated, "REQUEST_ALLOCATED"), new Case(manual, open, "MANUAL_INCOME"),
            new Case(locked, open, "LOCKED_FOR_RETURN"), new Case(outgoing, open, "OUTGOING"), new Case(funding, open, "EVIDENCE_ALLOCATED"))) {
            blocked(command(pm, "/evidence/" + c.evidence().getId() + "/review", review("ACCEPT", c.payment().getId(), "Thử chấp nhận", versionOf(c.evidence())),
                "uc6-block-" + next()), c.reason());
        }
        for (BankTransferEvidence e : List.of(locked, funding)) {
            blocked(command(pm, "/evidence/" + e.getId() + "/review", review("HOLD", null, "Tạm giữ", versionOf(e)), "uc6-hold-" + next()),
                e == locked ? "LOCKED_FOR_RETURN" : "EVIDENCE_ALLOCATED");
        }
        command(pm, "/evidence/" + plain.getId() + "/review", review("ACCEPT", Long.MAX_VALUE, "Không tồn tại", versionOf(plain)), "uc6-missing")
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        em.flush(); em.clear();
        assertThat(count("EvidenceReview")).isZero();
        for (Payment p : List.of(open, otherAccount, late)) assertThat(em.find(Payment.class, p.getId()).getState()).isEqualTo("PENDING");
        for (BankTransferEvidence e : List.of(amount, before, manual, plain, outgoing)) assertThat(em.find(BankTransferEvidence.class, e.getId()).getPayment()).isNull();
    }

    @Test
    void decisionsRequireAReasonUpToOneThousandCharactersAndCanBeReviewedAgain() throws Exception {
        AppUser pm = staff("PM");
        Payment p = pending("BCUC6REREVIEW01");
        BankTransferEvidence e = evidence(); String path = "/evidence/" + e.getId() + "/review";
        command(pm, path, review("HOLD", null, "   ", versionOf(e)), "r1").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("reason"));
        command(pm, path, review(null, null, "Có lý do", versionOf(e)), "r2").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("decision"));
        command(pm, path, review("MAYBE", null, "Có lý do", versionOf(e)), "r3").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        command(pm, path, review("HOLD", null, "x".repeat(1001), versionOf(e)), "r4").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("reason"));
        command(pm, path, review("HOLD", null, "Có lý do", null), "r5").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("version"));
        String longest = "Đ".repeat(1000);
        body(command(pm, path, review("HOLD", null, longest, versionOf(e)), "r6"));
        body(command(pm, path, review("REJECT", null, "Không phải tiền gói", versionOf(e)), "r7"));
        body(command(pm, path, review("ACCEPT", p.getId(), "Xem lại: đúng khách, gõ sai mã", versionOf(e)), "r8"));
        em.flush(); em.clear();
        assertThat(decisions(e)).containsExactly("HOLD", "REJECT", "ACCEPT");
        assertThat(em.createQuery("select r.reason from EvidenceReview r where r.evidence.id=:id and r.decision='HOLD'", String.class)
            .setParameter("id", e.getId()).getSingleResult()).isEqualTo(longest);
        JsonNode history = body(read(pm, "/evidence/" + e.getId())).path("history");
        assertThat(history.findValuesAsText("action")).containsSubsequence("ACCEPT", "REJECT", "HOLD");
    }

    @Test
    void holdReasonOfOneThousandCharactersIsStoredOnTheEvidence() throws Exception {
        AppUser pm = staff("PM"); BankTransferEvidence e = evidence(); String longest = "a".repeat(1000);
        body(command(pm, "/evidence/" + e.getId() + "/review", review("HOLD", null, longest, versionOf(e)), "hold-long"));
        em.flush(); em.clear();
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getReviewReason()).isEqualTo(longest);
    }

    @Test
    void lockRecordAndUnlockFollowTheReturnLifecycleWithHistoryRows() throws Exception {
        AppUser pm = staff("PM");
        BankTransferEvidence e = evidence(); String id = "/evidence/" + e.getId();
        BankTransferEvidence outgoing = evidence(); outgoing.setTransferDirection("OUT");
        Payment p = pending("BCUC6LOCKALLOC1");
        BankTransferEvidence allocated = evidence(); allocated.setPayment(p); allocated.setReviewStatus("ACCEPTED");
        command(pm, id + "/lock-return", change(" ", versionOf(e)), "l0").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        command(pm, id + "/lock-return", change("x".repeat(1001), versionOf(e)), "l00").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        for (BankTransferEvidence bad : List.of(outgoing, allocated)) {
            command(pm, "/evidence/" + bad.getId() + "/lock-return", change("Trả lại", versionOf(bad)), "l-" + next())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        }
        JsonNode tilesBefore = body(read(pm, "/summary"));
        assertThat(body(command(pm, id + "/lock-return", change("Khách chuyển nhầm, trả lại", versionOf(e)), "l1")).path("lockedForReturn").asBoolean()).isTrue();
        assertThat(body(read(pm, "/summary")).path("lockedForReturn").asLong()).isEqualTo(tilesBefore.path("lockedForReturn").asLong() + 1);
        command(pm, id + "/lock-return", change("Lần hai", versionOf(e)), "l2").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        body(command(pm, id + "/unlock-return", change("Khách không cần trả", versionOf(e)), "u1"));
        assertThat(body(read(pm, id)).path("summary").path("reviewStatus").asText()).isEqualTo("TO_REVIEW");
        body(command(pm, id + "/lock-return", change("Trả lại sau đối chiếu", versionOf(e)), "l3"));

        LocalDate today = clock.instant().atZone(VN).toLocalDate();
        String bankDay = e.getBankPaidAt().atZone(VN).toLocalDate().toString();
        command(pm, id + "/record-return", returned("FT-OUT-9", null, "Đã trả", versionOf(e)), "rr0").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("returnDate"));
        command(pm, id + "/record-return", returned("FT-OUT-9", today.plusDays(1).toString(), "Đã trả", versionOf(e)), "rr1").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-07"));
        command(pm, id + "/record-return", returned("FT-OUT-9", LocalDate.parse(bankDay).minusDays(1).toString(), "Đã trả", versionOf(e)), "rr2")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("returnDate"));
        body(command(pm, id + "/record-return", returned("FT-OUT-9", bankDay, "Đã hoàn đủ 1.200.000", versionOf(e)), "rr3"));
        command(pm, id + "/record-return", returned("FT-OUT-10", bankDay, "Ghi lại", versionOf(e)), "rr4").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        command(pm, id + "/unlock-return", change("Mở lại", versionOf(e)), "u2").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        blocked(command(pm, id + "/review", review("ACCEPT", p.getId(), "Không được", versionOf(e)), "a1"), "LOCKED_FOR_RETURN");
        em.flush(); em.clear();

        assertThat(decisions(e)).containsExactly("LOCK", "UNLOCK", "LOCK", "RETURN_VERIFIED");
        JsonNode detail = body(read(pm, id));
        assertThat(detail.path("returnReference").asText()).isEqualTo("FT-OUT-9");
        assertThat(detail.path("returnDate").asText()).isEqualTo(bankDay);
        assertThat(detail.path("returnResult").asText()).isEqualTo("Đã hoàn đủ 1.200.000");
        JsonNode history = detail.path("history");
        assertThat(history.findValuesAsText("action")).containsExactly("RETURN_VERIFIED", "LOCK", "UNLOCK", "LOCK");
        assertThat(history.findValuesAsText("source")).containsOnly("REVIEW");
        assertThat(history.get(0).path("reference").asText()).isEqualTo("FT-OUT-9");
        assertThat(history.get(0).path("result").asText()).isEqualTo("Đã hoàn đủ 1.200.000");
        assertThat(history.get(0).path("returnDate").asText()).isEqualTo(bankDay);
        assertThat(history.get(1).path("pmName").asText()).isEqualTo(pm.getFullName());
        assertThat(history.get(1).path("reason").asText()).isEqualTo("Trả lại sau đối chiếu");
        assertThat(em.createQuery("select count(a) from AuditLog a where a.targetType='BankTransferEvidence' and a.targetId=:id", Long.class)
            .setParameter("id", e.getId()).getSingleResult()).isEqualTo(4);
    }

    @Test
    void legacyAuditOnlyLockEventsStayVisibleNextToReviewRows() throws Exception {
        AppUser pm = staff("PM");
        BankTransferEvidence legacy = evidence(); legacy.setLockedForReturn(true); legacy.setReviewStatus("LOCKED_FOR_RETURN");
        AuditLog event = new AuditLog(); event.setActor(pm); event.setTargetType("BankTransferEvidence"); event.setTargetId(legacy.getId());
        event.setAction("EVIDENCE_LOCK_RETURN"); event.setLoggedAt(clock.instant().minusSeconds(30)); event.setDetails("{\"reason\":\"Khóa trước UC6\"}"); save(event);
        em.flush(); em.clear();
        body(command(pm, "/evidence/" + legacy.getId() + "/unlock-return", change("Mở khóa sau UC6", versionOf(legacy)), "legacy-unlock"));
        em.flush(); em.clear();
        JsonNode history = body(read(pm, "/evidence/" + legacy.getId())).path("history");
        assertThat(history.findValuesAsText("action")).containsExactly("UNLOCK", "EVIDENCE_LOCK_RETURN");
        assertThat(history.findValuesAsText("reason")).containsExactly("Mở khóa sau UC6", "Khóa trước UC6");
    }

    @Test
    void eachReviewKeepsItsOwnRelatedPaymentWithoutAllocatingHoldOrReject() throws Exception {
        AppUser pm = staff("PM");
        Payment first = pending("BCUC6HISTORYA1"), accepted = pending("BCUC6HISTORYB1");
        BankTransferEvidence e = evidence(); String path = "/evidence/" + e.getId() + "/review";
        var hold = review("HOLD", first.getId(), "Đang đối chiếu yêu cầu A", versionOf(e));
        body(command(pm, path, hold, "history-hold"));
        body(command(pm, path, hold, "history-hold"));
        em.flush(); em.clear();
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getPayment()).isNull();
        assertThat(em.find(Payment.class, first.getId()).getState()).isEqualTo("PENDING");
        body(command(pm, path, review("REJECT", null, "Chưa tìm được yêu cầu", versionOf(e)), "history-reject"));
        body(command(pm, path, review("ACCEPT", accepted.getId(), "Đã đối chiếu yêu cầu B", versionOf(e)), "history-accept"));
        // A legacy review has no reliable related request; do not infer B from the current evidence allocation.
        save(new EvidenceReview().evidence(em.find(BankTransferEvidence.class, e.getId())).pmUser(pm)
            .decision("HOLD").reason("Lịch sử cũ").reviewedAt(clock.instant().minusSeconds(600)));
        em.flush(); em.clear();
        JsonNode history = body(read(pm, "/evidence/" + e.getId())).path("history");
        assertThat(history.size()).isEqualTo(4);
        for (JsonNode h : history) {
            assertThat(h.has("relatedPaymentId")).isTrue();
            assertThat(h.has("relatedPaymentCode")).isTrue();
            if ("Đang đối chiếu yêu cầu A".equals(h.path("reason").asText())) {
                assertThat(h.path("relatedPaymentId").asLong()).isEqualTo(first.getId());
                assertThat(h.path("relatedPaymentCode").asText()).isEqualTo(first.getQuoteRef());
            } else if ("ACCEPT".equals(h.path("action").asText())) {
                assertThat(h.path("relatedPaymentId").asLong()).isEqualTo(accepted.getId());
                assertThat(h.path("relatedPaymentCode").asText()).isEqualTo(accepted.getQuoteRef());
            } else {
                assertThat(h.path("relatedPaymentId").isNull()).isTrue();
                assertThat(h.path("relatedPaymentCode").isNull()).isTrue();
            }
        }
        @SuppressWarnings("unchecked")
        List<Object[]> stored = em.createNativeQuery("select decision, related_payment_id from evidence_review where evidence_id=:id order by id")
            .setParameter("id", e.getId()).getResultList();
        assertThat(stored).hasSize(4);
        assertThat(((Number) stored.get(0)[1]).longValue()).isEqualTo(first.getId());
        assertThat(stored.get(1)[1]).isNull();
        assertThat(((Number) stored.get(2)[1]).longValue()).isEqualTo(accepted.getId());
        assertThat(stored.get(3)[1]).isNull();
        assertThat(em.find(Payment.class, first.getId()).getState()).isEqualTo("PENDING");
    }

    @Test
    void holdAndRejectRejectAnUnknownRelatedRequestWithoutSavingAnything() throws Exception {
        AppUser pm = staff("PM"); BankTransferEvidence e = evidence(); Long initialVersion = versionOf(e);
        for (String decision : List.of("HOLD", "REJECT")) {
            command(pm, "/evidence/" + e.getId() + "/review", review(decision, Long.MAX_VALUE, "Đối chiếu", initialVersion), "unknown-" + decision)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        }
        em.flush(); em.clear();
        assertThat(count("EvidenceReview")).isZero();
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getReviewStatus()).isEqualTo("UNMATCHED");
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getVersion()).isEqualTo(initialVersion);
    }

    @Test
    void lookupAutomaticallyConfirmsAValidTransferWithoutPmAcceptanceAndNeverGrantsTwice() throws Exception {
        AppUser pm = staff("PM"); Payment p = pending("BCUC6AUTO00001");
        Instant bank = clock.instant().minusSeconds(120);
        String time = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(bank);
        when(lookup.find(9201L)).thenReturn(new SePayPayload(9201L, "BIDV", time, "UC6-ACCOUNT", p.getQuoteRef(),
            "Thanh toan " + p.getQuoteRef(), "IN", p.getAmountVnd(), "BANK-9201"));
        long notices = count("Notification");
        JsonNode first = body(command(pm, "/lookup/9201", Map.of(), null));
        assertThat(first.path("paymentId").asLong()).isEqualTo(p.getId());
        assertThat(first.path("reviewStatus").asText()).isEqualTo("ACCEPTED");
        em.flush(); em.clear();
        Payment paid = em.find(Payment.class, p.getId());
        assertThat(paid.getState()).isEqualTo("PAID");
        assertThat(paid.getConfirmationSource()).isEqualTo("SEPAY");
        assertThat(paid.getPurchasedStart()).isEqualTo(clock.instant());
        assertThat(paid.getPurchasedEnd()).isEqualTo(clock.instant().atZone(VN).plusYears(1).toInstant());
        assertThat(paid.getReceiptCode()).startsWith("RC-");
        assertThat(paid.getSubscription().getLatestEnd()).isEqualTo(paid.getPurchasedEnd());
        assertThat(paid.getSubscription().getFarm().getServiceStatus()).isEqualTo("ACTIVE");
        assertThat(em.find(BankTransferEvidence.class, first.path("evidenceId").asLong()).getPayment().getId()).isEqualTo(p.getId());
        assertThat(count("EvidenceReview")).isZero();
        assertThat(count("Notification")).isEqualTo(notices + 1);
        Instant start = paid.getPurchasedStart(), end = paid.getPurchasedEnd(); String receipt = paid.getReceiptCode();
        JsonNode replay = body(command(pm, "/lookup/9201", Map.of(), null));
        assertThat(replay.path("duplicate").asBoolean()).isTrue();
        assertThat(replay.path("evidenceId")).isEqualTo(first.path("evidenceId"));
        em.flush(); em.clear();
        paid = em.find(Payment.class, p.getId());
        assertThat(paid.getPurchasedStart()).isEqualTo(start); assertThat(paid.getPurchasedEnd()).isEqualTo(end);
        assertThat(paid.getReceiptCode()).isEqualTo(receipt);
        assertThat(count("BankTransferEvidence")).isEqualTo(1);
        assertThat(count("Notification")).isEqualTo(notices + 1);
    }

    @Test
    void lookupRetainsMismatchedTransfersForReviewWithoutGrantingAServicePeriod() throws Exception {
        AppUser pm = staff("PM"); Payment p = pending("BCUC6BAD000001");
        Instant bank = clock.instant().minusSeconds(120);
        String time = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(bank);
        List<SePayPayload> transfers = List.of(
            new SePayPayload(9301L, "BIDV", time, "UC6-ACCOUNT", p.getQuoteRef(), p.getQuoteRef(), "IN", new BigDecimal("1199999"), "R1"),
            new SePayPayload(9302L, "BIDV", time, "WRONG-ACCOUNT", p.getQuoteRef(), p.getQuoteRef(), "IN", p.getAmountVnd(), "R2"),
            new SePayPayload(9303L, "BIDV", p.getExpiresAt().toString(), "UC6-ACCOUNT", p.getQuoteRef(), p.getQuoteRef(), "IN", p.getAmountVnd(), "R3"),
            new SePayPayload(9304L, "BIDV", time, "UC6-ACCOUNT", null, "Sai noi dung", "IN", p.getAmountVnd(), "R4"),
            new SePayPayload(9305L, "BIDV", time, "UC6-ACCOUNT", p.getQuoteRef(), p.getQuoteRef(), "OUT", p.getAmountVnd(), "R5"));
        for (SePayPayload transfer : transfers) {
            when(lookup.find(transfer.id())).thenReturn(transfer);
            JsonNode found = body(command(pm, "/lookup/" + transfer.id(), Map.of(), null));
            assertThat(found.path("paymentId").isNull()).isTrue();
            assertThat(found.path("reviewStatus").asText()).isEqualTo("UNMATCHED");
        }
        em.flush(); em.clear();
        Payment unchanged = em.find(Payment.class, p.getId());
        assertThat(unchanged.getState()).isEqualTo("PENDING");
        assertThat(unchanged.getPurchasedStart()).isNull(); assertThat(unchanged.getPurchasedEnd()).isNull();
        assertThat(unchanged.getReceiptCode()).isNull();
        assertThat(count("BankTransferEvidence")).isEqualTo(5);
        assertThat(count("EvidenceReview")).isZero();
    }

    @Test
    void lookupStoresATransactionOnceAndProviderTextDifferencesAreStillDuplicates() throws Exception {
        AppUser pm = staff("PM");
        Instant bank = clock.instant().minusSeconds(120);
        String time = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(bank);
        when(lookup.find(9001L)).thenReturn(
            new SePayPayload(9001L, "BIDV", time, "UC6-ACCOUNT", null, "BCUC6 LOOKUP", "IN", new BigDecimal("500000.00"), "REF-1"),
            new SePayPayload(9001L, "BIDV Bank", time, "UC6-ACCOUNT", null, "BCUC6  LOOKUP ", "IN", new BigDecimal("500000"), "REF-1"),
            new SePayPayload(9001L, "BIDV", time, "UC6-ACCOUNT", null, "BCUC6 LOOKUP", "IN", new BigDecimal("500001"), "REF-1"));
        JsonNode first = body(command(pm, "/lookup/9001", Map.of(), null));
        assertThat(first.path("duplicate").asBoolean()).isFalse();
        JsonNode second = body(command(pm, "/lookup/9001", Map.of(), null));
        assertThat(second.path("duplicate").asBoolean()).isTrue();
        assertThat(second.path("evidenceId").asLong()).isEqualTo(first.path("evidenceId").asLong());
        command(pm, "/lookup/9001", Map.of(), null).andExpect(status().isConflict());
        when(lookup.find(9002L)).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SePay lookup is not configured"));
        command(pm, "/lookup/9002", Map.of(), null).andExpect(status().isServiceUnavailable());
        em.flush(); em.clear();
        assertThat(em.createQuery("select count(e) from BankTransferEvidence e where e.providerTxnId=9001", Long.class).getSingleResult()).isEqualTo(1);
    }

    @Test
    void periodLookupListsSePayTransactionsWithStoredEvidenceAndValidatesTheRange() throws Exception {
        AppUser pm = staff("PM");
        Instant bank = clock.instant().minusSeconds(120);
        String time = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(bank);
        BankTransferEvidence stored = evidence(); stored.setProviderTxnId(9101L);
        when(lookup.list(any(), any(), eq("UC6-ACCOUNT"), anyInt())).thenReturn(List.of(
            new SePayPayload(9101L, "BIDV", time, "UC6-ACCOUNT", null, "Đã lưu", "IN", new BigDecimal("1200000.00"), "REF-9101"),
            new SePayPayload(9102L, "BIDV", time, "UC6-ACCOUNT", null, "Chưa lưu", "OUT", new BigDecimal("300000.00"), null)));
        em.flush(); long before = count("BankTransferEvidence");
        JsonNode page = body(read(pm, "/lookup?from=2026-10-01&to=2026-10-31"));
        assertThat(page.path("limit").asInt()).isEqualTo(200);
        assertThat(page.path("items").findValuesAsText("transactionId")).containsExactly("9101", "9102");
        assertThat(page.path("items").get(0).path("evidenceId").asLong()).isEqualTo(stored.getId());
        assertThat(page.path("items").get(1).path("evidenceId").isNull()).isTrue();
        assertThat(page.path("items").get(1).path("direction").asText()).isEqualTo("OUT");
        assertThat(page.path("items").get(0).path("amount").decimalValue()).isEqualByComparingTo("1200000");
        verify(lookup).list(eq(LocalDate.of(2026, 10, 1).atStartOfDay(VN).toInstant()), eq(LocalDate.of(2026, 11, 1).atStartOfDay(VN).toInstant()), eq("UC6-ACCOUNT"), eq(200));
        read(pm, "/lookup?from=2026-10-01").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        read(pm, "/lookup?from=2026-10-31&to=2026-10-01").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-11"));
        read(pm, "/lookup?from=2026-10-01&to=2026-11-01").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        read(user(), "/lookup?from=2026-10-01&to=2026-10-31").andExpect(status().isForbidden());
        em.flush();
        assertThat(count("BankTransferEvidence")).isEqualTo(before);
    }

    /** Another request of the same farm and subscription as {@code existing} (BR-D23 allows it once the first expired). */
    private Payment sameFarmRequest(Payment existing, String code, Instant requested, Instant expires) {
        Payment p = new Payment(); p.setSubscription(existing.getSubscription()); p.setRequestedBy(existing.getRequestedBy());
        p.setPriceVersion(existing.getPriceVersion()); p.setQuoteRef(code); p.setState("PENDING"); p.setDurationYears(1);
        p.setAmountVnd(existing.getAmountVnd()); p.setRequestedAt(requested); p.setExpiresAt(expires);
        p.setReceivingAccount("UC6-ACCOUNT"); p.setReceivingEnvironment("MOCK"); p.setReceivingAccountNamespace("UC6");
        return save(p);
    }

    private Long auditActor(String action, Long targetId) {
        return em.createQuery("select u.id from AuditLog a left join a.actor u where a.action=:action and a.targetId=:id", Long.class)
            .setParameter("action", action).setParameter("id", targetId).getSingleResult();
    }

    @Test
    void anExactCodeFundsOnlyRequestsOfItsOwnFarm() throws Exception {
        AppUser pm = staff("PM"); Instant now = clock.instant();
        // D22: farm A's Owner reused the code of expired request X to pay the new request Z of the same farm.
        Payment x = payment("BCUC6OLDCODE01", "ACTIVE", "EXPIRED", now.minusSeconds(7200), now.minusSeconds(1800));
        Payment z = sameFarmRequest(x, "BCUC6NEWCODE01", now.minusSeconds(600), now.plusSeconds(3600));
        // Farm B has a request with the same amount and window: farm A's money must never fund it.
        Payment y = payment("BCUC6OTHERFARM", "ACTIVE", "PENDING", now.minusSeconds(600), now.plusSeconds(3600));
        BankTransferEvidence e = evidence(x.getQuoteRef(), now.minusSeconds(60));
        String path = "/evidence/" + e.getId() + "/review";

        assertThat(body(read(pm, "/evidence/" + e.getId() + "/candidates")).findValuesAsText("paymentId")).containsExactly(String.valueOf(z.getId()));
        blocked(command(pm, path, review("ACCEPT", y.getId(), "Chọn yêu cầu trại khác", versionOf(e)), "uc6-other-farm"), "OTHER_FARM");
        em.flush(); em.clear();
        assertThat(em.find(Payment.class, y.getId()).getState()).isEqualTo("PENDING");
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getPayment()).isNull();
        assertThat(decisions(e)).isEmpty();

        body(command(pm, path, review("ACCEPT", z.getId(), "Owner dùng lại mã cũ của trại cho yêu cầu mới", versionOf(e)), "uc6-same-farm"));
        em.flush(); em.clear();
        assertThat(em.find(Payment.class, z.getId()).getState()).isEqualTo("PAID");
        assertThat(em.find(BankTransferEvidence.class, e.getId()).getPayment().getId()).isEqualTo(z.getId());
        // A mistyped code identifies no request, so a matching request of any farm stays a candidate (GBR-72).
        BankTransferEvidence typo = evidence();
        assertThat(body(read(pm, "/evidence/" + typo.getId() + "/candidates")).findValuesAsText("paymentId")).contains(String.valueOf(y.getId()));
    }

    @Test
    void lookupRecordsThePmWhoLookedUpTheTransaction() throws Exception {
        AppUser pm = staff("PM"); Payment p = pending("BCUC6ACTOR0001");
        String time = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(clock.instant().minusSeconds(120));
        when(lookup.find(9501L)).thenReturn(new SePayPayload(9501L, "BIDV", time, "UC6-ACCOUNT", p.getQuoteRef(),
            "Thanh toan " + p.getQuoteRef(), "IN", p.getAmountVnd(), "B-9501"));
        when(lookup.find(9502L)).thenReturn(new SePayPayload(9502L, "BIDV", time, "UC6-ACCOUNT", null, "Khong ro noi dung", "IN",
            new BigDecimal("700000"), "B-9502"));
        long paidEvidence = body(command(pm, "/lookup/9501", Map.of(), null)).path("evidenceId").asLong();
        long keptEvidence = body(command(pm, "/lookup/9502", Map.of(), null)).path("evidenceId").asLong();
        em.flush(); em.clear();
        // GBR-86: the acceptance and each stored evidence name the PM who looked them up; the source stays SePay (D21).
        assertThat(em.find(Payment.class, p.getId()).getConfirmationSource()).isEqualTo("SEPAY");
        assertThat(auditActor("SEPAY_PAYMENT_PAID", p.getId())).isEqualTo(pm.getId());
        assertThat(auditActor("SEPAY_EVIDENCE", paidEvidence)).isEqualTo(pm.getId());
        assertThat(auditActor("SEPAY_EVIDENCE", keptEvidence)).isEqualTo(pm.getId());
        assertThat(body(read(pm, "/evidence/" + paidEvidence)).path("history").findValuesAsText("pmName")).contains(pm.getFullName());
        assertThat(body(read(pm, "/evidence/" + keptEvidence)).path("history").findValuesAsText("pmName")).contains(pm.getFullName());
    }

    @Test
    void invalidSePayDataIsAProviderFailureAndStoresNothing() throws Exception {
        AppUser pm = staff("PM");
        String time = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(clock.instant().minusSeconds(120));
        when(lookup.find(9601L)).thenReturn(new SePayPayload(9601L, "BIDV", "10/11/2026 10:00", "UC6-ACCOUNT", null, "Sai giờ", "IN",
            new BigDecimal("500000"), null));
        when(lookup.find(9602L)).thenReturn(new SePayPayload(9602L, "BIDV", time, "UC6-ACCOUNT", null, "Không có tiền", "IN", BigDecimal.ZERO, null));
        command(pm, "/lookup/9601", Map.of(), null).andExpect(status().isBadGateway());
        command(pm, "/lookup/9602", Map.of(), null).andExpect(status().isBadGateway());
        // A malformed row fails the whole period read instead of hiding a transaction from the PM.
        when(lookup.list(any(), any(), eq("UC6-ACCOUNT"), anyInt())).thenReturn(List.of(
            new SePayPayload(9603L, "BIDV", time, "UC6-ACCOUNT", null, "Hợp lệ", "IN", new BigDecimal("1200000"), "R-9603"),
            new SePayPayload(9604L, "BIDV", "", "UC6-ACCOUNT", null, "Thiếu giờ", "IN", new BigDecimal("1200000"), "R-9604")));
        read(pm, "/lookup?from=2026-10-01&to=2026-10-31").andExpect(status().isBadGateway());
        em.flush();
        assertThat(count("BankTransferEvidence")).isZero();
    }
}
