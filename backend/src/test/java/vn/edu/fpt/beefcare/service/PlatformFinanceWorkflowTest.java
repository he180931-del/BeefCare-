package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceBankClaimRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceHistoryRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.*;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.support.DomainTestSupport;
import vn.edu.fpt.beefcare.web.rest.PlatformFinanceResource;

/** FE-21 manual finance workflow, command idempotency (GBR-88), bank-source exclusion (GBR-84) and cash snapshots (GBR-85). */
@ServiceIntegrationTest
@Transactional
class PlatformFinanceWorkflowTest extends DomainTestSupport {
    @Autowired PlatformFinanceService finance;
    @Autowired IdempotencyCommandService commands;
    @Autowired SePayWebhookService sepay;
    @Autowired ManualFinanceRecordRepository records;
    @Autowired ManualFinanceHistoryRepository history;
    @Autowired ManualFinanceBankClaimRepository claims;
    @Autowired CashReportSnapshotRepository snapshots;
    @Autowired BankTransferEvidenceRepository evidences;

    private static final AtomicInteger KEYS = new AtomicInteger();
    private static final long BASE_TXN = 910_000L;

    /** The real REST adapter, so action names and the Idempotency-Key header wiring are what is tested. */
    private PlatformFinanceResource api() { return new PlatformFinanceResource(finance, commands); }
    private String key() { return "fin-key-" + KEYS.incrementAndGet(); }

    private AppUser pm() {
        AppUser u = user();
        User identity = new User();
        identity.setLogin(u.getEmail()); identity.setEmail(u.getEmail());
        identity.setPassword("$2a$10$01234567890123456789012345678901234567890123456789012"); identity.setActivated(true);
        save(identity);
        PlatformStaffAccess p = new PlatformStaffAccess(); p.setUser(u); p.setRole(PlatformRole.PM.name()); p.setStatus("ACTIVE"); save(p);
        actAs(u);
        return u;
    }
    private AppUser staff(PlatformRole role) {
        AppUser u = user(); PlatformStaffAccess p = new PlatformStaffAccess(); p.setUser(u); p.setRole(role.name()); p.setStatus("ACTIVE"); save(p); return u;
    }

    private RecordFields fields(String type, String category, long amount, LocalDate on, Long farmId) {
        return new RecordFields(type, category, BigDecimal.valueOf(amount), on, farmId == null ? "GENERAL" : "FARM", farmId, "DOC-1", "Khoản thử nghiệm", "MANUAL");
    }
    private RecordFields income(long amount) { return fields("INCOME", "OTHER_INCOME", amount, TODAY.minusDays(2), null); }
    private RecordDTO create(RecordFields f) { return api().create(new CreateRecord(f, null), key()).getBody(); }
    private RecordDTO post(RecordDTO r) { return api().post(r.id(), new VersionedAction(r.version(), null), key()); }
    private RecordDTO voided(RecordDTO r, String reason) { return api().voidPosted(r.id(), new VersionedAction(r.version(), reason), key()); }
    private RecordDTO posted(RecordFields f) { return post(create(f)); }
    private List<String> actions(Long id) { return history.findAllByRecord_IdOrderByChangedAtAscIdAsc(id).stream().map(ManualFinanceHistory::getAction).toList(); }
    private long audits(String action) { return em.createQuery("select count(a) from AuditLog a where a.action = :a", Long.class).setParameter("a", action).getSingleResult(); }

    private static void assertCode(Throwable failure, String code, int status) {
        assertThat(failure).isInstanceOfSatisfying(DomainException.class, e -> { assertThat(e.getCode()).isEqualTo(code); assertThat(e.getStatus().value()).isEqualTo(status); });
    }

    private BankTransferEvidence bankTransfer(long txn, String direction, long amount, String quoteRef) {
        BankTransferEvidence e = new BankTransferEvidence();
        e.setProviderTxnId(BASE_TXN + txn); e.setAmount(BigDecimal.valueOf(amount)); e.setBankPaidAt(clock.instant().minusSeconds(86_400));
        e.setProvider("SEPAY"); e.setEnvironment("MOCK"); e.setAccountNamespace("LOCAL-MOCK"); e.setGateway("Mock bank");
        e.setTransferDirection(direction); e.setQuoteRef(quoteRef); e.setDeliveryOutcome("STORED"); e.setAuthOutcome("VERIFIED");
        e.setReviewStatus("UNMATCHED"); e.setLockedForReturn(false);
        return save(e);
    }
    private RecordDTO createFromBank(BankTransferEvidence e, String type, String category) {
        RecordFields f = new RecordFields(type, category, e.getAmount(), TODAY, "GENERAL", null, null, "Từ giao dịch ngân hàng", "BANK_TRANSACTION");
        return api().create(new CreateRecord(f, e.getId()), key()).getBody();
    }

    /** A real accepted subscription receipt of 1,200,000 VND for the farm, paid at the current clock time, via the SePay flow. */
    private Payment paidReceipt(Farm farm, AppUser owner, long txn, String quoteRef) {
        PlanVersion price = new PlanVersion();
        price.setPrice1y(new BigDecimal("1200000")); price.setPrice2y(new BigDecimal("2000000")); price.setPrice3y(new BigDecimal("2700000"));
        price.setEffectiveAt(clock.instant().minusSeconds(60)); save(price);
        Subscription subscription = new Subscription(); subscription.setFarm(farm); subscription.setPlanVersion(price); subscription.setEntitlementStatus("PENDING"); save(subscription);
        Payment p = new Payment();
        p.setQuoteRef(quoteRef); p.setDurationYears(1); p.setAmountVnd(new BigDecimal("1200000")); p.setState("PENDING");
        p.setRequestedAt(clock.instant().minusSeconds(60)); p.setExpiresAt(clock.instant().plusSeconds(86_340));
        p.setSubscription(subscription); p.setRequestedBy(owner); p.setPriceVersion(price);
        p.setReceivingAccountNamespace("LOCAL-MOCK"); p.setReceivingEnvironment("MOCK"); p.setReceivingAccount("MOCK-ACCOUNT"); p.setReceivingBankCode("MOCKBANK"); p.setVersion(0L);
        save(p);
        var result = sepay.receiveMock(new SePayPayload(txn, "Mock bank",
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(clock.instant()),
            "MOCK-ACCOUNT", quoteRef, "Payment " + quoteRef, "IN", new BigDecimal("1200000"), "mock-reference-" + txn));
        assertThat(result.reviewStatus()).isEqualTo("ACCEPTED");
        return p;
    }

    @Test void draftPostVoidReplacementKeepsHistoryAuditAndLinks() {
        pm();
        RecordDTO draft = create(income(500_000));
        assertThat(draft.state()).isEqualTo("DRAFT"); assertThat(draft.recordCode()).matches("FR-\\d{4,}");
        assertThat(draft.sourceType()).isEqualTo("MANUAL"); assertThat(draft.postedAt()).isNull();

        RecordFields edited = new RecordFields("INCOME", "INTEREST", new BigDecimal("520000"), TODAY.minusDays(1), "GENERAL", null, "DOC-2", "Đã sửa", "MANUAL");
        RecordDTO updated = api().update(draft.id(), new VersionedRecord(edited, null, draft.version()), key());
        assertThat(updated.category()).isEqualTo("INTEREST"); assertThat(updated.amountVnd()).isEqualByComparingTo("520000");
        assertThat(updated.version()).isGreaterThan(draft.version());

        RecordDTO posted = post(updated);
        assertThat(posted.state()).isEqualTo("POSTED"); assertThat(posted.postedBy()).isNotBlank(); assertThat(posted.postedAt()).isNotNull();
        // POSTED is immutable (GBR-83)
        RecordDTO current = posted;
        assertCode(catchThrowable(() -> api().update(current.id(), new VersionedRecord(edited, null, current.version()), key())), "MSG-COM-05", 409);
        assertCode(catchThrowable(() -> api().discard(current.id(), new VersionedAction(current.version(), null), key())), "MSG-COM-05", 409);
        assertCode(catchThrowable(() -> post(current)), "MSG-COM-05", 409);

        RecordDTO voided = voided(posted, "  Nhập sai số tiền  ");
        assertThat(voided.state()).isEqualTo("VOID"); assertThat(voided.voidReason()).isEqualTo("Nhập sai số tiền");
        assertThat(voided.voidedBy()).isNotBlank(); assertThat(voided.voidedAt()).isNotNull();
        assertCode(catchThrowable(() -> voided(voided, "again")), "MSG-COM-05", 409);

        RecordDTO replacement = api().replacement(voided.id(), null, key()).getBody();
        assertThat(replacement.state()).isEqualTo("DRAFT"); assertThat(replacement.id()).isNotEqualTo(voided.id());
        assertThat(replacement.recordCode()).isNotEqualTo(voided.recordCode());
        assertThat(replacement.replacementRecordId()).isEqualTo(voided.id());
        assertThat(replacement.amountVnd()).isEqualByComparingTo("520000"); assertThat(replacement.category()).isEqualTo("INTEREST");
        assertThat(replacement.occurredOn()).isEqualTo(voided.occurredOn()); assertThat(replacement.postedAt()).isNull(); assertThat(replacement.voidReason()).isNull();
        // only a VOID record can be replaced
        assertCode(catchThrowable(() -> api().replacement(replacement.id(), null, key())), "MSG-COM-05", 409);

        assertThat(actions(draft.id())).containsExactly("CREATE", "EDIT", "POST", "VOID");
        assertThat(actions(replacement.id())).containsExactly("REPLACEMENT_CREATE");
        var detail = finance.detail(draft.id());
        assertThat(detail.history()).extracting(HistoryDTO::actor).doesNotContainNull();
        assertThat(detail.history().get(3).reason()).isEqualTo("Nhập sai số tiền");
        assertThat(audits("FINANCE_DRAFT_CREATE")).isEqualTo(1); assertThat(audits("FINANCE_DRAFT_EDIT")).isEqualTo(1);
        assertThat(audits("FINANCE_RECORD_POST")).isEqualTo(1); assertThat(audits("FINANCE_RECORD_VOID")).isEqualTo(1);
        assertThat(audits("FINANCE_REPLACEMENT_CREATE")).isEqualTo(1);
    }

    @Test void discardedDraftLeavesReportsAndCannotBePostedOrEdited() {
        pm();
        RecordDTO draft = create(income(70_000));
        RecordDTO discarded = api().discard(draft.id(), new VersionedAction(draft.version(), "Không cần nữa"), key());
        assertThat(discarded.state()).isEqualTo("DISCARDED");
        assertThat(actions(draft.id())).containsExactly("CREATE", "DISCARD");
        assertCode(catchThrowable(() -> post(discarded)), "MSG-COM-05", 409);
        assertCode(catchThrowable(() -> api().update(discarded.id(), new VersionedRecord(income(80_000), null, discarded.version()), key())), "MSG-COM-05", 409);
        assertThat(finance.runReport(new ReportRequest(TODAY.minusDays(30), TODAY, null, "ALL")).summary().totalIncome()).isEqualByComparingTo("0");
    }

    @Test void staleVersionIsRejectedForEveryChangingCommandAndNothingChanges() {
        pm();
        RecordDTO draft = create(income(100_000));
        RecordDTO edited = api().update(draft.id(), new VersionedRecord(income(110_000), null, draft.version()), key());
        // `draft` is now stale (GBR-89)
        assertCode(catchThrowable(() -> api().update(draft.id(), new VersionedRecord(income(120_000), null, draft.version()), key())), "MSG-COM-05", 409);
        assertCode(catchThrowable(() -> post(draft)), "MSG-COM-05", 409);
        assertCode(catchThrowable(() -> api().discard(draft.id(), new VersionedAction(draft.version(), null), key())), "MSG-COM-05", 409);
        assertCode(catchThrowable(() -> api().post(draft.id(), new VersionedAction(null, null), key())), "MSG-COM-05", 409);
        assertThat(records.findById(draft.id()).orElseThrow().getAmountVnd()).isEqualByComparingTo("110000");
        assertThat(records.findById(draft.id()).orElseThrow().getState()).isEqualTo("DRAFT");

        RecordDTO posted = post(edited);
        assertCode(catchThrowable(() -> voided(edited, "stale")), "MSG-COM-05", 409);
        assertThat(records.findById(draft.id()).orElseThrow().getState()).isEqualTo("POSTED");
        assertThat(posted.version()).isGreaterThan(edited.version());
    }

    @Test void voidNeedsAReasonAndPostedRecordStaysPostedOtherwise() {
        pm();
        RecordDTO posted = posted(income(250_000));
        assertCode(catchThrowable(() -> api().voidPosted(posted.id(), new VersionedAction(posted.version(), null), key())), "MSG-COM-06", 400);
        assertCode(catchThrowable(() -> api().voidPosted(posted.id(), new VersionedAction(posted.version(), "   "), key())), "MSG-COM-06", 400);
        assertCode(catchThrowable(() -> api().voidPosted(posted.id(), new VersionedAction(posted.version(), "x".repeat(501)), key())), "MSG-COM-10", 400);
        assertThat(records.findById(posted.id()).orElseThrow().getState()).isEqualTo("POSTED");
        assertThat(actions(posted.id())).containsExactly("CREATE", "POST");
        assertThat(voided(posted, "x".repeat(500)).state()).isEqualTo("VOID");
    }

    @Test void onlyAnActivePlatformManagerMayRunFinanceCommandsOrReadThem() {
        AppUser manager = pm();
        RecordDTO draft = create(income(90_000));
        Farm farm = farm();
        List<AppUser> outsiders = List.of(staff(PlatformRole.CS), staff(PlatformRole.SA), memberWithRole(farm, FarmRole.OWNER), user());
        for (AppUser outsider : outsiders) {
            actAs(outsider);
            assertCode(catchThrowable(() -> api().create(new CreateRecord(income(1_000), null), key())), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> api().update(draft.id(), new VersionedRecord(income(1_000), null, draft.version()), key())), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> post(draft)), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> api().discard(draft.id(), new VersionedAction(draft.version(), null), key())), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> api().replacement(draft.id(), null, key())), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> api().runReport(new ReportRequest(TODAY.minusDays(5), TODAY, null, "ALL"), key())), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> api().detail(draft.id())), "MSG-COM-01", 403);
            assertCode(catchThrowable(() -> api().records(null, null, null, null, null, null, null, 0, 25)), "MSG-COM-01", 403);
        }
        // a suspended PM loses access immediately
        PlatformStaffAccess access = em.createQuery("select p from PlatformStaffAccess p where p.user.id = :id", PlatformStaffAccess.class).setParameter("id", manager.getId()).getSingleResult();
        access.setStatus("SUSPENDED"); em.flush(); actAs(manager);
        assertCode(catchThrowable(() -> post(draft)), "MSG-COM-01", 403);
        assertThat(records.count()).isEqualTo(1);
        assertThat(records.findById(draft.id()).orElseThrow().getState()).isEqualTo("DRAFT");
    }

    @Test void sameKeyReplaysStoredResultWithoutDuplicatesForEveryCommand() {
        pm();
        // create
        CreateRecord createBody = new CreateRecord(income(300_000), null);
        RecordDTO first = api().create(createBody, "create-1").getBody();
        RecordDTO replay = api().create(createBody, "create-1").getBody();
        assertThat(replay).isEqualTo(first); assertThat(records.count()).isEqualTo(1); assertThat(actions(first.id())).containsExactly("CREATE");
        // update
        VersionedRecord updateBody = new VersionedRecord(income(310_000), null, first.version());
        RecordDTO updated = api().update(first.id(), updateBody, "update-1");
        assertThat(api().update(first.id(), updateBody, "update-1")).isEqualTo(updated);
        assertThat(actions(first.id())).containsExactly("CREATE", "EDIT");
        // post (the body's version is stale after the first run: only the stored replay can succeed)
        VersionedAction postBody = new VersionedAction(updated.version(), null);
        RecordDTO posted = api().post(first.id(), postBody, "post-1");
        assertThat(api().post(first.id(), postBody, "post-1")).isEqualTo(posted);
        assertThat(audits("FINANCE_RECORD_POST")).isEqualTo(1); assertThat(actions(first.id())).containsExactly("CREATE", "EDIT", "POST");
        // a different key with the same stale body is a genuine new command and is rejected
        assertCode(catchThrowable(() -> api().post(first.id(), postBody, "post-2")), "MSG-COM-05", 409);
        // void
        VersionedAction voidBody = new VersionedAction(posted.version(), "Sai chứng từ");
        RecordDTO voided = api().voidPosted(first.id(), voidBody, "void-1");
        assertThat(api().voidPosted(first.id(), voidBody, "void-1")).isEqualTo(voided);
        assertThat(audits("FINANCE_RECORD_VOID")).isEqualTo(1);
        // replacement
        RecordDTO replacement = api().replacement(first.id(), null, "replace-1").getBody();
        assertThat(api().replacement(first.id(), null, "replace-1").getBody()).isEqualTo(replacement);
        assertThat(records.count()).isEqualTo(2); assertThat(actions(replacement.id())).containsExactly("REPLACEMENT_CREATE");
        // discard
        VersionedAction discardBody = new VersionedAction(replacement.version(), "Bỏ");
        RecordDTO discarded = api().discard(replacement.id(), discardBody, "discard-1");
        assertThat(api().discard(replacement.id(), discardBody, "discard-1")).isEqualTo(discarded);
        assertThat(actions(replacement.id())).containsExactly("REPLACEMENT_CREATE", "DISCARD");
        // report run
        ReportRequest report = new ReportRequest(TODAY.minusDays(10), TODAY, null, "ALL");
        CashReport run = api().runReport(report, "report-1").getBody();
        assertThat(api().runReport(report, "report-1").getBody()).isEqualTo(run);
        assertThat(snapshots.count()).isEqualTo(1);
        CashReport refreshed = api().runReport(report, "report-2").getBody();
        assertThat(refreshed.id()).isNotEqualTo(run.id()); assertThat(snapshots.count()).isEqualTo(2);
        // the Idempotency-Key header is mandatory
        assertCode(catchThrowable(() -> api().create(createBody, " ")), "MSG-COM-19", 400);
        assertThat(records.count()).isEqualTo(2);
    }

    @Test void sameKeyWithDifferentBodyIsRejectedAndNothingIsWritten() {
        pm();
        api().create(new CreateRecord(income(500_000), null), "dup-key");
        assertCode(catchThrowable(() -> api().create(new CreateRecord(income(600_000), null), "dup-key")), "MSG-COM-19", 409);
        assertThat(records.count()).isEqualTo(1);
        assertThat(records.findAll().get(0).getAmountVnd()).isEqualByComparingTo("500000");

        RecordDTO draft = records.findAll().stream().map(r -> finance.detail(r.getId()).record()).findFirst().orElseThrow();
        api().post(draft.id(), new VersionedAction(draft.version(), null), "post-key");
        assertCode(catchThrowable(() -> api().post(draft.id(), new VersionedAction(draft.version() + 5, null), "post-key")), "MSG-COM-19", 409);
        // the same key is scoped per action and record: another record may reuse it
        RecordDTO other = create(income(5_000));
        assertThat(api().post(other.id(), new VersionedAction(other.version(), null), "post-key").state()).isEqualTo("POSTED");
        // a different PM does not share the replay record either
        pm();
        RecordDTO mine = api().create(new CreateRecord(income(500_000), null), "dup-key").getBody();
        assertThat(mine.id()).isNotEqualTo(draft.id()); assertThat(records.count()).isEqualTo(3);
    }

    @Test void aBankTransactionCanBeClaimedByOnlyOneRecordAndIsReleasedOnDiscardOrVoid() {
        pm();
        BankTransferEvidence transfer = bankTransfer(1, "IN", 750_000, null);
        assertThat(finance.bankTransactions()).extracting(BankTransactionChoice::transactionId).contains(transfer.getProviderTxnId());

        RecordDTO first = createFromBank(transfer, "INCOME", "OTHER_INCOME");
        assertThat(first.sourceType()).isEqualTo("BANK_TRANSACTION"); assertThat(first.amountVnd()).isEqualByComparingTo("750000");
        assertThat(first.sourceReference()).isEqualTo(PlatformFinanceService.sourceReference(transfer));
        assertThat(claims.existsById(first.sourceReference())).isTrue();
        assertThat(finance.bankTransactions()).extracting(BankTransactionChoice::transactionId).doesNotContain(transfer.getProviderTxnId());

        assertCode(catchThrowable(() -> createFromBank(transfer, "INCOME", "OTHER_INCOME")), "MSG-FE21-08", 409);
        assertThat(records.count()).isEqualTo(1);

        // releasing by discard lets a second record take it, and the first can no longer be posted from a lost claim
        api().discard(first.id(), new VersionedAction(first.version(), "Nhầm giao dịch"), key());
        assertThat(claims.existsById(first.sourceReference())).isFalse();
        RecordDTO second = createFromBank(transfer, "INCOME", "OTHER_INCOME");
        RecordDTO postedSecond = post(second);
        assertCode(catchThrowable(() -> createFromBank(transfer, "INCOME", "OTHER_INCOME")), "MSG-FE21-08", 409);
        // posted manual income is also visible to SePay acceptance
        assertThat(finance.hasPostedManualIncome(first.sourceReference())).isTrue();

        // voiding releases the claim (POST-2)
        RecordDTO voidedSecond = voided(postedSecond, "Giao dịch thuộc khoản khác");
        assertThat(claims.existsById(first.sourceReference())).isFalse();
        assertThat(finance.hasPostedManualIncome(first.sourceReference())).isFalse();
        RecordDTO third = createFromBank(transfer, "INCOME", "OTHER_INCOME");
        assertThat(third.state()).isEqualTo("DRAFT"); assertThat(voidedSecond.state()).isEqualTo("VOID");
    }

    @Test void bankSourceRulesRejectSubscriptionTransfersWrongDirectionAndAcceptedPayments() {
        pm();
        // unmatched transfer that carries a quote reference is a known subscription-origin transfer (GBR-84)
        BankTransferEvidence quoted = bankTransfer(10, "IN", 100_000, "BC000000000001");
        assertCode(catchThrowable(() -> createFromBank(quoted, "INCOME", "OTHER_INCOME")), "MSG-FE21-08", 409);
        // income needs an incoming transfer, expense an outgoing one
        BankTransferEvidence outgoing = bankTransfer(11, "OUT", 100_000, null), incoming = bankTransfer(12, "IN", 100_000, null);
        assertCode(catchThrowable(() -> createFromBank(outgoing, "INCOME", "OTHER_INCOME")), "MSG-FE21-08", 409);
        assertCode(catchThrowable(() -> createFromBank(incoming, "EXPENSE", "OPERATIONS")), "MSG-FE21-08", 409);
        assertThat(createFromBank(outgoing, "EXPENSE", "OPERATIONS").state()).isEqualTo("DRAFT");
        // unauthenticated delivery is never a usable source
        BankTransferEvidence unverified = bankTransfer(13, "IN", 100_000, null);
        unverified.setAuthOutcome("REJECTED"); em.flush();
        assertCode(catchThrowable(() -> createFromBank(unverified, "INCOME", "OTHER_INCOME")), "MSG-FE21-08", 409);

        // a transfer already accepted as a subscription payment cannot be recognised as other income
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        paidReceipt(farm, owner, 82_001L, "BC123456789012");
        BankTransferEvidence accepted = evidences.findAll().stream().filter(e -> e.getPayment() != null).findFirst().orElseThrow();
        assertCode(catchThrowable(() -> createFromBank(accepted, "INCOME", "OTHER_INCOME")), "MSG-FE21-08", 409);
        assertThat(finance.bankTransactions()).extracting(BankTransactionChoice::transactionId).doesNotContain(accepted.getProviderTxnId());
        assertThat(records.count()).isEqualTo(1);
    }

    @Test void fieldValidationUsesTheSpecMessageCodes() {
        pm();
        Farm farm = farm();
        assertCode(catchThrowable(() -> create(fields("INCOME", "OTHER_INCOME", 0, TODAY, null))), "MSG-FE21-09", 400);
        assertCode(catchThrowable(() -> create(fields("INCOME", "OTHER_INCOME", -5, TODAY, null))), "MSG-FE21-09", 400);
        RecordFields fractional = new RecordFields("INCOME", "OTHER_INCOME", new BigDecimal("10.5"), TODAY, "GENERAL", null, null, null, "MANUAL");
        assertCode(catchThrowable(() -> create(fractional)), "MSG-FE21-09", 400);
        assertCode(catchThrowable(() -> create(fields("INCOME", "OPERATIONS", 10, TODAY, null))), "MSG-FE21-10", 400);
        assertCode(catchThrowable(() -> create(fields("EXPENSE", "INTEREST", 10, TODAY, null))), "MSG-FE21-10", 400);
        assertCode(catchThrowable(() -> create(fields("INCOME", "OTHER_INCOME", 10, TODAY.plusDays(1), null))), "MSG-COM-10", 400);
        assertCode(catchThrowable(() -> create(fields(null, "OTHER_INCOME", 10, TODAY, null))), "MSG-COM-06", 400);
        RecordFields farmWithoutFarm = new RecordFields("INCOME", "OTHER_INCOME", BigDecimal.TEN, TODAY, "FARM", null, null, null, "MANUAL");
        assertCode(catchThrowable(() -> create(farmWithoutFarm)), "MSG-COM-10", 400);
        RecordFields generalWithFarm = new RecordFields("INCOME", "OTHER_INCOME", BigDecimal.TEN, TODAY, "GENERAL", farm.getId(), null, null, "MANUAL");
        assertCode(catchThrowable(() -> create(generalWithFarm)), "MSG-COM-10", 400);
        RecordFields longText = new RecordFields("INCOME", "OTHER_INCOME", BigDecimal.TEN, TODAY, "GENERAL", null, null, "d".repeat(501), "MANUAL");
        assertCode(catchThrowable(() -> create(longText)), "MSG-COM-10", 400);
        assertThat(records.count()).isZero();
        RecordDTO farmRecord = create(fields("expense", "software", 10, TODAY, farm.getId()));
        assertThat(farmRecord.type()).isEqualTo("EXPENSE"); assertThat(farmRecord.category()).isEqualTo("SOFTWARE"); assertThat(farmRecord.farmId()).isEqualTo(farm.getId());
    }

    @Test void cashReportSnapshotSumsReceiptsPostedIncomeAndPostedExpenseOnly() {
        AppUser manager = pm();
        Farm farmA = farm("PENDING_PAYMENT"), farmB = farm();
        AppUser owner = memberWithRole(farmA, FarmRole.OWNER);
        paidReceipt(farmA, owner, 82_100L, "BC999999999991");           // receipt 1,200,000 on TODAY (farm A)
        actAs(manager);
        LocalDate from = LocalDate.of(2026, 10, 1);

        posted(fields("INCOME", "OTHER_INCOME", 300_000, LocalDate.of(2026, 10, 20), null));       // general income 300,000
        posted(fields("INCOME", "INTEREST", 50_000, LocalDate.of(2026, 10, 25), farmA.getId()));   // farm A income 50,000
        posted(fields("EXPENSE", "OPERATIONS", 200_000, LocalDate.of(2026, 10, 22), null));        // general expense 200,000
        posted(fields("EXPENSE", "MARKETING", 80_000, LocalDate.of(2026, 10, 26), farmA.getId())); // farm A expense 80,000
        posted(fields("EXPENSE", "SOFTWARE", 15_000, LocalDate.of(2026, 10, 27), farmB.getId()));  // farm B expense 15,000
        posted(fields("INCOME", "OTHER_INCOME", 777_000, LocalDate.of(2026, 8, 1), null));         // outside the period
        voided(posted(fields("INCOME", "REFUND", 999_000, LocalDate.of(2026, 10, 21), null)), "Ghi nhầm"); // VOID: excluded
        create(fields("EXPENSE", "BANK_FEE", 111_000, LocalDate.of(2026, 10, 23), null));          // DRAFT: excluded

        CashReport all = api().runReport(new ReportRequest(from, TODAY, null, "ALL"), key()).getBody();
        ReportSummary s = all.summary();
        assertThat(s.subscriptionReceipts()).isEqualByComparingTo("1200000");
        assertThat(s.otherIncome()).isEqualByComparingTo("350000");
        assertThat(s.totalIncome()).isEqualByComparingTo("1550000");
        assertThat(s.totalExpense()).isEqualByComparingTo("295000");
        assertThat(s.netCashFlow()).isEqualByComparingTo("1255000");
        assertThat(s.note()).contains("not statutory profit");
        assertThat(s.dailyIncome()).extracting(DailyTotals::date).containsExactly(LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 25), TODAY);
        assertThat(totals(s, "PLATFORM", null).expense()).isEqualByComparingTo("295000");
        assertThat(totals(s, "GENERAL", null).otherIncome()).isEqualByComparingTo("300000");
        assertThat(totals(s, "GENERAL", null).expense()).isEqualByComparingTo("200000");
        ScopeTotals a = totals(s, "FARM", farmA.getId());
        assertThat(a.subscriptionReceipts()).isEqualByComparingTo("1200000"); assertThat(a.otherIncome()).isEqualByComparingTo("50000"); assertThat(a.expense()).isEqualByComparingTo("80000");
        assertThat(totals(s, "FARM", farmB.getId()).expense()).isEqualByComparingTo("15000");
        assertThat(all.expiresAt()).isEqualTo(all.generatedAt().plusSeconds(30L * 24 * 3600));

        // a selected farm includes only that farm's sources; GENERAL items only appear in the platform total
        ReportSummary farmOnly = api().runReport(new ReportRequest(from, TODAY, farmA.getId(), "ALL"), key()).getBody().summary();
        assertThat(farmOnly.subscriptionReceipts()).isEqualByComparingTo("1200000"); assertThat(farmOnly.otherIncome()).isEqualByComparingTo("50000");
        assertThat(farmOnly.totalExpense()).isEqualByComparingTo("80000"); assertThat(farmOnly.netCashFlow()).isEqualByComparingTo("1170000");
        assertThat(farmOnly.scopes()).noneMatch(x -> "GENERAL".equals(x.scope()));
        ReportSummary farmBOnly = api().runReport(new ReportRequest(from, TODAY, farmB.getId(), "ALL"), key()).getBody().summary();
        assertThat(farmBOnly.totalIncome()).isEqualByComparingTo("0"); assertThat(farmBOnly.netCashFlow()).isEqualByComparingTo("-15000");

        // source filters
        ReportSummary receipts = api().runReport(new ReportRequest(from, TODAY, null, "RECEIPTS_ONLY"), key()).getBody().summary();
        assertThat(receipts.totalIncome()).isEqualByComparingTo("1200000"); assertThat(receipts.totalExpense()).isEqualByComparingTo("0");
        ReportSummary manual = api().runReport(new ReportRequest(from, TODAY, null, "MANUAL_ONLY"), key()).getBody().summary();
        assertThat(manual.subscriptionReceipts()).isEqualByComparingTo("0"); assertThat(manual.netCashFlow()).isEqualByComparingTo("55000");

        // a narrower period excludes records outside it (by occurrence date) and the receipt (by bank-paid date)
        ReportSummary narrow = api().runReport(new ReportRequest(LocalDate.of(2026, 10, 21), LocalDate.of(2026, 10, 24), null, "ALL"), key()).getBody().summary();
        assertThat(narrow.subscriptionReceipts()).isEqualByComparingTo("0"); assertThat(narrow.totalExpense()).isEqualByComparingTo("200000"); assertThat(narrow.totalIncome()).isEqualByComparingTo("0");

        // snapshots are immutable: later posting does not change the stored result, a refresh does
        long before = snapshots.count();
        posted(fields("INCOME", "OTHER_INCOME", 1_000, LocalDate.of(2026, 10, 24), null));
        assertThat(finance.report(all.id()).summary()).isEqualTo(all.summary());
        assertThat(finance.exportSnapshot(all.id()).lines()).extracting(ReportLine::amount).doesNotContain(new BigDecimal("999000"), new BigDecimal("111000"), new BigDecimal("777000"));
        assertThat(finance.exportSnapshot(all.id()).lines()).hasSize(6);
        ReportSummary refreshed = api().runReport(new ReportRequest(from, TODAY, null, "ALL"), key()).getBody().summary();
        assertThat(refreshed.otherIncome()).isEqualByComparingTo("351000"); assertThat(snapshots.count()).isEqualTo(before + 1);

        // validation of criteria
        assertCode(catchThrowable(() -> api().runReport(new ReportRequest(TODAY, from, null, "ALL"), key())), "MSG-COM-10", 400);
        assertCode(catchThrowable(() -> api().runReport(new ReportRequest(TODAY.minusYears(3), TODAY, null, "ALL"), key())), "MSG-COM-10", 400);
        assertCode(catchThrowable(() -> api().runReport(new ReportRequest(from, TODAY, null, "NOPE"), key())), "MSG-COM-10", 400);
    }

    @Test void expiredSnapshotIsGoneAndCannotBeExported() {
        pm();
        CashReport run = api().runReport(new ReportRequest(TODAY.minusDays(3), TODAY, null, "ALL"), key()).getBody();
        clock.set(run.expiresAt().plusSeconds(1));
        // UC-FE21-08/09 E1: MSG-FE21-12, the PM must run the report again
        assertThatThrownBy(() -> finance.report(run.id())).isInstanceOfSatisfying(DomainException.class, e -> {
            assertThat(e.getCode()).isEqualTo("MSG-FE21-12");
            assertThat(e.getStatus()).isEqualTo(org.springframework.http.HttpStatus.GONE);
        });
        assertThatThrownBy(() -> finance.exportSnapshot(run.id())).isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo("MSG-FE21-12"));
    }

    private static ScopeTotals totals(ReportSummary summary, String scope, Long farmId) {
        return summary.scopes().stream().filter(s -> scope.equals(s.scope()) && java.util.Objects.equals(farmId, s.farmId())).findFirst().orElseThrow();
    }

    private static Throwable catchThrowable(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        return org.assertj.core.api.Assertions.catchThrowable(callable);
    }
}
