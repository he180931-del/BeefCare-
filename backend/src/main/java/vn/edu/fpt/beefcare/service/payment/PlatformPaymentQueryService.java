package vn.edu.fpt.beefcare.service.payment;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.EvidenceReview;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccessService;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.Page;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.PaymentTiles;

/** D18 / UC5: read models only. Never settles a payment, imports evidence or advances stored state. */
@Service
@Transactional(readOnly = true)
public class PlatformPaymentQueryService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String LOCKED = "(e.lockedForReturn=true or upper(e.reviewStatus)='LOCKED_FOR_RETURN')";
    /** D20: only incoming money can need review (SRS 2447); legacy rows without a direction stay reviewable. */
    private static final String INCOMING = "(e.transferDirection is null or upper(e.transferDirection)='IN')";
    /** Audit actions written together with an evidence_review row of this decision (D19). */
    private static final Map<String, String> HANDLING_DECISION = Map.of(
        "EVIDENCE_LOCK_RETURN", "LOCK", "EVIDENCE_RETURN_UNLOCK", "UNLOCK", "EVIDENCE_RETURN_RECORDED", "RETURN_VERIFIED");
    private static final String PAYMENT_FETCH = " from Payment p join fetch p.subscription s join fetch s.farm left join fetch p.requestedBy";
    private final EntityManager em;
    private final PlatformAccessService access;
    private final FarmClock clock;
    private final ObjectMapper mapper;
    private final String account;
    private final String environment;
    private final String namespace;

    public PlatformPaymentQueryService(EntityManager em, PlatformAccessService access, FarmClock clock, ObjectMapper mapper,
        @Value("${beefcare.sepay.account-number:}") String account,
        @Value("${beefcare.sepay.environment:MOCK}") String environment,
        @Value("${beefcare.sepay.account-namespace:LOCAL-MOCK}") String namespace) {
        this.em = em; this.access = access; this.clock = clock; this.mapper = mapper;
        this.account = account; this.environment = environment; this.namespace = namespace;
    }

    public PaymentTiles tiles() {
        access.requireRole(PlatformRole.PM);
        long pending = em.createQuery("select count(p) from Payment p where upper(p.state)='PENDING' and p.expiresAt>:now", Long.class)
            .setParameter("now", clock.now()).getSingleResult();
        long review = evidenceCount("not " + LOCKED + " and " + INCOMING + " and upper(e.reviewStatus) in ('UNMATCHED','NEEDS_REVIEW')");
        long held = evidenceCount("not " + LOCKED + " and upper(e.reviewStatus) in ('HOLD','HELD')");
        return new PaymentTiles(pending, review, held, evidenceCount(LOCKED));
    }

    private long evidenceCount(String condition) {
        return em.createQuery("select count(e) from BankTransferEvidence e where " + condition, Long.class).getSingleResult();
    }

    public Page<EvidenceRow> evidence(String status, LocalDate from, LocalDate to, int page, int size) {
        access.requireRole(PlatformRole.PM); validatePage(page, size);
        String state = status == null || status.isBlank() ? "ALL" : status.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "TO_REVIEW", "HOLD", "REJECTED", "ACCEPTED", "LOCKED").contains(state)) throw DomainException.invalid("status");
        if (from != null && to != null && from.isAfter(to)) throw DomainException.badRequest(MessageCodes.COM_11, "field", "bankTo");
        List<String> filters = new ArrayList<>(); Map<String, Object> params = new HashMap<>();
        switch (state) {
            case "TO_REVIEW" -> filters.add("not " + LOCKED + " and " + INCOMING + " and upper(e.reviewStatus) in ('UNMATCHED','NEEDS_REVIEW')");
            case "HOLD" -> filters.add("not " + LOCKED + " and upper(e.reviewStatus) in ('HOLD','HELD')");
            case "ACCEPTED" -> filters.add("not " + LOCKED + " and (upper(e.reviewStatus) in ('MATCHED','ACCEPTED') or e.payment is not null)");
            case "REJECTED" -> filters.add("not " + LOCKED + " and upper(e.reviewStatus)='REJECTED'");
            case "LOCKED" -> filters.add(LOCKED);
            default -> { /* ALL includes processing, allocated, outgoing and unresolved evidence. */ }
        }
        if (from != null) { filters.add("e.bankPaidAt>=:from"); params.put("from", from.atStartOfDay(ZONE).toInstant()); }
        if (to != null) { filters.add("e.bankPaidAt<:to"); params.put("to", to.plusDays(1).atStartOfDay(ZONE).toInstant()); }
        String where = filters.isEmpty() ? "" : " where " + String.join(" and ", filters);
        var count = em.createQuery("select count(e) from BankTransferEvidence e" + where, Long.class);
        var query = em.createQuery("select e from BankTransferEvidence e left join fetch e.payment" + where + " order by e.bankPaidAt desc, e.id desc", BankTransferEvidence.class);
        params.forEach(count::setParameter); params.forEach(query::setParameter);
        long total = count.getSingleResult();
        List<BankTransferEvidence> rows = query.setFirstResult(page * size).setMaxResults(size).getResultList();
        Map<String, Payment> references = referencedPayments(rows);
        return new Page<>(rows.stream().map(e -> row(e, reference(e, references))).toList(), total, page, size);
    }

    public EvidenceDetail evidence(Long id) {
        access.requireRole(PlatformRole.PM);
        BankTransferEvidence e = findEvidence(id);
        Payment reference = reference(e, referencedPayments(List.of(e)));
        List<History> history = new ArrayList<>();
        Set<String> paired = new HashSet<>();
        em.createQuery("select r from EvidenceReview r join fetch r.pmUser left join fetch r.relatedPayment where r.evidence.id=:id order by r.reviewedAt desc,r.id desc", EvidenceReview.class)
            .setParameter("id", id).getResultList().forEach(r -> {
                // RETURN_VERIFIED is recorded once (D19), so its outgoing reference/result/date are the evidence's.
                boolean returned = "RETURN_VERIFIED".equals(r.getDecision());
                Payment related = r.getRelatedPayment();
                history.add(new History(r.getId(), "REVIEW", r.getDecision(), r.getReason(), returned ? e.getReturnReference() : null,
                    returned ? e.getReturnResult() : null, returned ? e.getReturnDate() : null, r.getPmUser().getId(), r.getPmUser().getFullName(), r.getReviewedAt(),
                    related == null ? null : related.getId(), related == null ? null : related.getQuoteRef()));
                paired.add(r.getDecision() + "@" + r.getReviewedAt());
            });
        // D19: lock/unlock/return write a review row and an audit event at the same time; an event without its row is
        // data from before UC6 and stays visible, so every handling step appears exactly once.
        em.createQuery("select a from AuditLog a left join fetch a.actor where a.targetType='BankTransferEvidence' and a.targetId=:id " +
            "and a.action in ('SEPAY_EVIDENCE','MOCK_EVIDENCE','EVIDENCE_LOCK_RETURN','EVIDENCE_RETURN_UNLOCK','EVIDENCE_RETURN_RECORDED')", AuditLog.class)
            .setParameter("id", id).getResultList().forEach(a -> {
                String decision = HANDLING_DECISION.get(a.getAction());
                if (decision == null || !paired.contains(decision + "@" + a.getLoggedAt())) history.add(history(a));
            });
        history.sort(Comparator.comparing(History::at).reversed().thenComparing(History::source).thenComparing(History::id, Comparator.reverseOrder()));
        return new EvidenceDetail(row(e, reference), e.getProviderTxnId().toString(), e.getReceivingAccount(), e.getGateway(),
            e.getReferenceCode(), e.getQuoteRef(), e.getFirstReceivedAt(), e.getReturnReference(), e.getReturnDate(), e.getReturnResult(), history);
    }

    public List<Candidate> candidates(Long id) {
        access.requireRole(PlatformRole.PM);
        BankTransferEvidence e = findEvidence(id);
        if (e.getPayment() != null || locked(e) || !"IN".equalsIgnoreCase(e.getTransferDirection())) return List.of();
        return em.createQuery("select p" + PAYMENT_FETCH + " where upper(p.state) in ('PENDING','EXPIRED') and p.amountVnd=:amount " +
            "and p.requestedAt<=:bank and p.expiresAt>:bank and p.receivingEnvironment=:env and p.receivingAccountNamespace=:ns " +
            "and not exists (select x.id from BankTransferEvidence x where x.payment.id=p.id) order by p.requestedAt desc,p.id desc", Payment.class)
            .setParameter("amount", e.getAmount()).setParameter("bank", e.getBankPaidAt()).setParameter("env", e.getEnvironment())
            .setParameter("ns", e.getAccountNamespace()).getResultList().stream()
            .filter(p -> Boolean.TRUE.equals(accountMatches(e, p)))
            .map(p -> new Candidate(p.getId(), p.getQuoteRef(), p.getSubscription().getFarm().getId(), p.getSubscription().getFarm().getName(),
                p.getAmountVnd(), p.getDurationYears(), p.getExpiresAt(), p.getReceivingAccountNamespace())).toList();
    }

    public Page<PaymentView> payments(String state, String search, int page, int size) {
        access.requireRole(PlatformRole.PM); validatePage(page, size);
        String filter = state == null || state.isBlank() ? "" : state.trim().toUpperCase(Locale.ROOT);
        if (!filter.isEmpty() && !List.of("PENDING", "PAID", "EXPIRED").contains(filter)) throw DomainException.invalid("state");
        String q = search == null ? "" : search.trim(); if (q.length() > 100) throw DomainException.invalid("q");
        Instant now = clock.now();
        List<String> conditions = new ArrayList<>(); Map<String, Object> params = new HashMap<>();
        if (!filter.isEmpty()) {
            switch (filter) {
                case "PENDING" -> conditions.add("upper(p.state)='PENDING' and p.expiresAt>:now");
                case "EXPIRED" -> conditions.add("(upper(p.state)='EXPIRED' or (upper(p.state)='PENDING' and p.expiresAt<=:now))");
                default -> conditions.add("upper(p.state)='PAID'");
            }
            if (!"PAID".equals(filter)) params.put("now", now);
        }
        if (!q.isEmpty()) {
            conditions.add("(lower(p.quoteRef) like :q escape '!' or lower(p.subscription.farm.name) like :q escape '!')");
            params.put("q", "%" + q.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
        }
        String where = conditions.isEmpty() ? "" : " where " + String.join(" and ", conditions);
        var count = em.createQuery("select count(p) from Payment p" + where, Long.class);
        var query = em.createQuery("select p" + PAYMENT_FETCH + where + " order by p.requestedAt desc,p.id desc", Payment.class);
        params.forEach(count::setParameter); params.forEach(query::setParameter);
        long total = count.getSingleResult(); List<Payment> rows = query.setFirstResult(page * size).setMaxResults(size).getResultList();
        Map<Long, BankTransferEvidence> allocated = allocations(rows);
        return new Page<>(rows.stream().map(p -> payment(p, allocated.get(p.getId()), now)).toList(), total, page, size);
    }

    public PaymentView payment(Long id) {
        access.requireRole(PlatformRole.PM);
        Payment p = em.createQuery("select p" + PAYMENT_FETCH + " where p.id=:id", Payment.class).setParameter("id", id).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "payment_id", id));
        return payment(p, allocations(List.of(p)).get(id), clock.now());
    }

    private BankTransferEvidence findEvidence(Long id) {
        return em.createQuery("select e from BankTransferEvidence e left join fetch e.payment where e.id=:id", BankTransferEvidence.class)
            .setParameter("id", id).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "evidence_id", id));
    }

    private Map<Long, BankTransferEvidence> allocations(List<Payment> rows) {
        if (rows.isEmpty()) return Map.of();
        Map<Long, BankTransferEvidence> result = new HashMap<>();
        em.createQuery("select e from BankTransferEvidence e where e.payment.id in :ids order by e.id", BankTransferEvidence.class)
            .setParameter("ids", rows.stream().map(Payment::getId).toList()).getResultList().forEach(e -> result.putIfAbsent(e.getPayment().getId(), e));
        return result;
    }

    private Map<String, Payment> referencedPayments(List<BankTransferEvidence> rows) {
        List<String> codes = rows.stream().map(BankTransferEvidence::getQuoteRef).filter(Objects::nonNull).map(s -> s.toUpperCase(Locale.ROOT)).distinct().toList();
        if (codes.isEmpty()) return Map.of();
        Map<String, Payment> result = new HashMap<>();
        em.createQuery("select p from Payment p where upper(p.quoteRef) in :codes", Payment.class).setParameter("codes", codes).getResultList()
            .forEach(p -> result.put(p.getQuoteRef().toUpperCase(Locale.ROOT), p));
        return result;
    }

    private static Payment reference(BankTransferEvidence e, Map<String, Payment> refs) {
        return e.getPayment() != null ? e.getPayment() : e.getQuoteRef() == null ? null : refs.get(e.getQuoteRef().toUpperCase(Locale.ROOT));
    }

    private EvidenceRow row(BankTransferEvidence e, Payment reference) {
        Payment allocated = e.getPayment();
        String id = e.getProviderTxnId().toString();
        return new EvidenceRow(e.getId(), e.getProvider(), e.getEnvironment(), e.getAccountNamespace(), "****" + id.substring(Math.max(0, id.length() - 4)),
            e.getAmount(), e.getTransferDirection(), e.getTransferContent(), e.getBankPaidAt(), reviewStatus(e), match(e, reference), e.getReviewReason(),
            accountMatches(e, reference), allocated == null ? null : allocated.getId(), allocated == null ? null : allocated.getQuoteRef(), e.getVersion());
    }

    /**
     * Same rule as SePay ingestion and UC6 ACCEPT: payment snapshot (or, without one, the configured context normalized as
     * ingestion stores it), exact environment/namespace and alphanumeric account comparison. Null only when the expected
     * context is unknown; evidence without a receiving account is a mismatch, as ingestion and ACCEPT treat it.
     */
    private Boolean accountMatches(BankTransferEvidence e, Payment p) {
        String expectedAccount = p == null ? SePayWebhookService.expectedAccount(account, e.getProvider()) : p.getReceivingAccount();
        String expectedEnv = p == null ? SePayWebhookService.storedEnvironment(environment) : p.getReceivingEnvironment();
        String expectedNs = p == null ? SePayWebhookService.storedNamespace(namespace) : p.getReceivingAccountNamespace();
        if (expectedAccount == null || expectedAccount.isBlank() || expectedEnv == null || expectedNs == null) return null;
        return expectedEnv.equals(e.getEnvironment()) && expectedNs.equals(e.getAccountNamespace())
            && SePayWebhookService.sameAccount(expectedAccount, e.getReceivingAccount());
    }

    private String match(BankTransferEvidence e, Payment p) {
        if (e.getPayment() != null && "PAID".equalsIgnoreCase(e.getPayment().getState())) {
            String source = e.getPayment().getConfirmationSource();
            return "SEPAY".equals(source) ? "PAID_AUTO" : "PM".equals(source) ? "PAID_PM" : "PAID";
        }
        if ("OUT".equalsIgnoreCase(e.getTransferDirection())) return "OUTGOING";
        if (Boolean.FALSE.equals(accountMatches(e, p))) return "ACCOUNT_MISMATCH";
        if (p == null) return e.getQuoteRef() == null || e.getQuoteRef().isBlank() ? "CODE_MISMATCH" : "NO_REQUEST";
        if (!e.getBankPaidAt().isBefore(p.getExpiresAt())) return "REQUEST_EXPIRED";
        if (e.getBankPaidAt().isBefore(p.getRequestedAt())) return "OUTSIDE_WINDOW";
        if (e.getAmount().compareTo(p.getAmountVnd()) != 0) return "AMOUNT_MISMATCH";
        return "PAID".equalsIgnoreCase(p.getState()) ? "ALREADY_ALLOCATED" : "EXACT_CODE";
    }

    private static boolean locked(BankTransferEvidence e) { return e.isLockedForReturn() || "LOCKED_FOR_RETURN".equalsIgnoreCase(e.getReviewStatus()); }
    private static String reviewStatus(BankTransferEvidence e) {
        if (locked(e)) return "LOCKED";
        if (e.getPayment() != null) return "ACCEPTED";
        return switch (e.getReviewStatus().toUpperCase(Locale.ROOT)) {
            // D20: an unresolved outgoing transfer can never fund a request, so it is not queued for review.
            case "UNMATCHED", "NEEDS_REVIEW" -> e.getTransferDirection() == null || "IN".equalsIgnoreCase(e.getTransferDirection()) ? "TO_REVIEW" : "NO_ACTION";
            case "HELD", "HOLD" -> "HOLD";
            case "MATCHED", "ACCEPTED" -> "ACCEPTED";
            case "REJECTED" -> "REJECTED";
            // RECEIVED and any state outside the declared enum: shown under ALL as processing, never as a decision.
            default -> "PROCESSING";
        };
    }

    private History history(AuditLog a) {
        JsonNode details = MissingNode.getInstance();
        try {
            JsonNode parsed = a.getDetails() == null ? null : mapper.readTree(a.getDetails());
            if (parsed != null) details = parsed;
        } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) { /* Legacy malformed details remain absent; never return raw audit JSON. */ }
        // Ingestion audit names carry the provider (SEPAY_/MOCK_EVIDENCE); the contract exposes documented event codes.
        String action = switch (a.getAction()) {
            case "SEPAY_EVIDENCE", "MOCK_EVIDENCE" -> "ACCEPTED".equalsIgnoreCase(text(details, "reviewStatus")) ? "EVIDENCE_AUTO_ACCEPTED" : "EVIDENCE_RECEIVED";
            default -> a.getAction();
        };
        return new History(a.getId(), "EVENT", action, text(details, "reason"), text(details, "reference"), text(details, "result"),
            date(text(details, "returnDate")), a.getActor() == null ? null : a.getActor().getId(), a.getActor() == null ? null : a.getActor().getFullName(), a.getLoggedAt(), null, null);
    }

    private static LocalDate date(String value) {
        try {
            return value == null ? null : LocalDate.parse(value);
        } catch (java.time.format.DateTimeParseException legacy) {
            return null;
        }
    }

    private static String text(JsonNode details, String field) {
        return details.path(field).isTextual() ? details.path(field).asText() : null;
    }

    private static PaymentView payment(Payment p, BankTransferEvidence e, Instant now) {
        String state = "PENDING".equalsIgnoreCase(p.getState()) && !now.isBefore(p.getExpiresAt()) ? "EXPIRED" : p.getState().toUpperCase(Locale.ROOT);
        return new PaymentView(p.getId(), p.getSubscription().getFarm().getId(), p.getSubscription().getFarm().getName(), p.getQuoteRef(), p.getDurationYears(),
            p.getAmountVnd(), state, p.getRequestedAt(), p.getExpiresAt(), p.getPurchasedStart(), p.getPurchasedEnd(), p.getReceiptCode(),
            p.getRequestedBy() == null ? null : p.getRequestedBy().getEmail(), p.getPriceVersion().getId(), e == null ? null : e.getId(),
            p.getConfirmedAt(), p.getConfirmationSource(), e == null ? null : e.getBankPaidAt(), e == null ? null : e.getFirstReceivedAt());
    }

    private static void validatePage(int page, int size) {
        if (size < 1 || size > 100) throw DomainException.invalid("size");
        if (page < 0 || page > Integer.MAX_VALUE / size) throw DomainException.invalid("page");
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Schema(name = "PlatformBankEvidenceRow")
    public record EvidenceRow(Long id, String provider, String environment, String accountNamespace, String maskedTransactionId, BigDecimal amount,
        @Schema(nullable = true) String direction, @Schema(nullable = true) String content, Instant bankPaidAt,
        @Schema(allowableValues = {"TO_REVIEW", "HOLD", "REJECTED", "ACCEPTED", "LOCKED", "PROCESSING", "NO_ACTION"}) String reviewStatus,
        @Schema(allowableValues = {"PAID_AUTO", "PAID_PM", "PAID", "OUTGOING", "ACCOUNT_MISMATCH", "CODE_MISMATCH", "NO_REQUEST",
            "REQUEST_EXPIRED", "OUTSIDE_WINDOW", "AMOUNT_MISMATCH", "ALREADY_ALLOCATED", "EXACT_CODE"}) String matchResult,
        @Schema(nullable = true) String reviewReason, @Schema(nullable = true) Boolean receivingAccountMatches,
        @Schema(nullable = true) Long paymentId, @Schema(nullable = true) String paymentCode, Long version) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Schema(name = "PlatformBankEvidenceDetail")
    public record EvidenceDetail(EvidenceRow summary, String transactionId, @Schema(nullable = true) String receivingAccount,
        @Schema(nullable = true) String bank, @Schema(nullable = true) String referenceCode, @Schema(nullable = true) String quoteRef,
        @Schema(nullable = true) Instant firstReceivedAt, @Schema(nullable = true) String returnReference,
        @Schema(nullable = true) LocalDate returnDate, @Schema(nullable = true) String returnResult, List<History> history) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Schema(name = "PlatformEvidenceHistory")
    public record History(Long id, @Schema(allowableValues = {"REVIEW", "EVENT"}) String source,
        @Schema(description = "REVIEW: stored PM decision ACCEPT/HOLD/REJECT/LOCK/UNLOCK/RETURN_VERIFIED. EVENT: EVIDENCE_RECEIVED, EVIDENCE_AUTO_ACCEPTED, "
            + "EVIDENCE_LOCK_RETURN, EVIDENCE_RETURN_UNLOCK or EVIDENCE_RETURN_RECORDED; never a raw audit action name") String action,
        @Schema(nullable = true) String reason, @Schema(nullable = true) String reference,
        @Schema(nullable = true) String result, @Schema(nullable = true) LocalDate returnDate,
        @Schema(nullable = true) Long pmId, @Schema(nullable = true) String pmName, Instant at,
        @Schema(nullable = true, description = "Request considered by this review, independent of the final evidence allocation; absent on legacy rows") Long relatedPaymentId,
        @Schema(nullable = true) String relatedPaymentCode) {}
    @Schema(name = "PlatformPaymentCandidate")
    public record Candidate(Long paymentId, String quoteRef, Long farmId, String farmName, BigDecimal amount, Integer termYears, Instant expiresAt, String accountNamespace) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Schema(name = "PlatformPaymentRead")
    public record PaymentView(Long id, Long farmId, String farmName, String quoteRef, Integer termYears, BigDecimal amount, String state,
        Instant requestedAt, Instant expiresAt, @Schema(nullable = true) Instant purchasedStart, @Schema(nullable = true) Instant purchasedEnd,
        @Schema(nullable = true) String receiptCode, @Schema(nullable = true) String requestedByEmail, Long priceVersionId,
        @Schema(nullable = true) Long evidenceId, @Schema(nullable = true) Instant confirmedAt, @Schema(nullable = true) String confirmationSource,
        @Schema(nullable = true) Instant bankPaidAt, @Schema(nullable = true) Instant receivedAt) {}
}
