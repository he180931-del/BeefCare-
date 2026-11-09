package vn.edu.fpt.beefcare.service.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.EvidenceReview;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.EvidenceReviewRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.NotificationService;
import vn.edu.fpt.beefcare.service.PlatformAccessService;
import vn.edu.fpt.beefcare.service.JsonSupport;
import vn.edu.fpt.beefcare.service.MessageCodes;

/** Authenticated SePay ingestion and the common, serialized payment confirmation rules. */
@Service
public class SePayWebhookService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern QUOTE = Pattern.compile("(?i)(?<![A-Z0-9])(BC[A-Z0-9]{12})(?![A-Z0-9])");
    private static final DateTimeFormatter SEPAY_LOCAL_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int REASON_MAX = 1000;
    private static final int LOOKUP_MAX_DAYS = 31;
    private static final int LOOKUP_LIMIT = 200;

    private final SePaySignatureVerifier signatures;
    private final SePayTransactionLookupClient lookupClient;
    private final ObjectMapper mapper;
    private final PaymentRepository payments;
    private final ManualFinanceRecordRepository manualFinanceRecords;
    private final SubscriptionRepository subscriptions;
    private final FarmRepository farms;
    private final FarmMembershipRepository memberships;
    private final BankTransferEvidenceRepository evidenceRepository;
    private final EvidenceReviewRepository reviews;
    private final AuditLogRepository auditLogs;
    private final NotificationService notifications;
    private final ReconciliationNoticeService reconciliationNotices;
    private final PlatformAccessService platformAccess;
    private final FarmClock clock;
    private final String environment;
    private final String accountNamespace;
    private final String receivingAccount;
    private final TransactionTemplate transactions;

    public SePayWebhookService(
        SePaySignatureVerifier signatures,
        SePayTransactionLookupClient lookupClient,
        ObjectMapper mapper,
        PaymentRepository payments,
        ManualFinanceRecordRepository manualFinanceRecords,
        SubscriptionRepository subscriptions,
        FarmRepository farms,
        FarmMembershipRepository memberships,
        BankTransferEvidenceRepository evidenceRepository,
        EvidenceReviewRepository reviews,
        AuditLogRepository auditLogs,
        NotificationService notifications,
        ReconciliationNoticeService reconciliationNotices,
        PlatformAccessService platformAccess,
        FarmClock clock,
        @Value("$" + "{beefcare.sepay.environment:MOCK}") String environment,
        @Value("$" + "{beefcare.sepay.account-namespace:LOCAL-MOCK}") String accountNamespace,
        @Value("$" + "{beefcare.sepay.account-number:}") String receivingAccount,
        PlatformTransactionManager transactionManager
    ) {
        this.signatures = signatures;
        this.lookupClient = lookupClient;
        this.mapper = mapper;
        this.payments = payments;
        this.manualFinanceRecords = manualFinanceRecords;
        this.subscriptions = subscriptions;
        this.farms = farms;
        this.memberships = memberships;
        this.evidenceRepository = evidenceRepository;
        this.reviews = reviews;
        this.auditLogs = auditLogs;
        this.notifications = notifications;
        this.reconciliationNotices = reconciliationNotices;
        this.platformAccess = platformAccess;
        this.clock = clock;
        this.environment = environment;
        this.accountNamespace = accountNamespace;
        this.receivingAccount = receivingAccount;
        this.transactions = new TransactionTemplate(transactionManager);
        if ("LIVE".equalsIgnoreCase(environment) &&
            (!StringUtils.hasText(accountNamespace) || "LOCAL-MOCK".equalsIgnoreCase(accountNamespace.trim()) || !StringUtils.hasText(receivingAccount))) {
            throw new IllegalStateException("Live SePay requires an explicit account namespace and receiving account");
        }
    }

    public WebhookResult receive(String timestamp, String signature, byte[] rawBody) {
        if (!signatures.verify(timestamp, signature, rawBody)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook authentication");
        }
        final SePayPayload payload;
        try {
            payload = mapper.readValue(rawBody, SePayPayload.class);
        } catch (IOException invalidJson) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid SePay payload");
        }
        IncomingTransfer incoming = transfer(payload);
        return processWithReplayProtection(incoming, "SEPAY", fingerprint(incoming));
    }

    /** Local simulator calls the same normalization and settlement pipeline, after an explicit PM role check. */
    public WebhookResult receiveMock(SePayPayload payload) {
        platformAccess.requireRole(PlatformRole.PM);
        if (!"MOCK".equalsIgnoreCase(environment) && !"TEST".equalsIgnoreCase(environment)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        IncomingTransfer incoming = transfer(payload);
        return processWithReplayProtection(incoming, "MOCK", fingerprint(incoming));
    }

    public WebhookResult lookupAndImport(Long transactionId) {
        platformAccess.requireRole(PlatformRole.PM);
        IncomingTransfer incoming = transfer(lookupClient.find(transactionId));
        return processWithReplayProtection(incoming, "SEPAY", fingerprint(incoming));
    }

    /** API-03 by period (D19): SePay rows of the receiving account; read-only, the PM stores a row by its ID. */
    public LookupPage lookupPeriod(java.time.LocalDate from, java.time.LocalDate to) {
        platformAccess.requireRole(PlatformRole.PM);
        if (from == null) throw DomainException.required("from");
        if (to == null) throw DomainException.required("to");
        if (from.isAfter(to)) throw DomainException.badRequest(MessageCodes.COM_11, "field", "to");
        if (to.isAfter(from.plusDays(LOOKUP_MAX_DAYS - 1L))) throw DomainException.invalid("to");
        if (!StringUtils.hasText(receivingAccount)) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SePay lookup is not configured");
        java.util.List<IncomingTransfer> rows = lookupClient.list(from.atStartOfDay(BUSINESS_ZONE).toInstant(),
            to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant(), receivingAccount.trim(), LOOKUP_LIMIT).stream().map(this::transfer).toList();
        java.util.Map<Long, Long> stored = new java.util.HashMap<>();
        if (!rows.isEmpty()) {
            evidenceRepository.findAllByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnIdIn("SEPAY", storedEnvironment(environment),
                storedNamespace(accountNamespace), rows.stream().map(IncomingTransfer::transactionId).toList())
                .forEach(e -> stored.put(e.getProviderTxnId(), e.getId()));
        }
        return new LookupPage(rows.stream().map(r -> new LookupRow(r.transactionId(), r.paidAt(), r.amount(), r.direction(), r.content(),
            r.referenceCode(), stored.get(r.transactionId()))).toList(), LOOKUP_LIMIT);
    }

    /**
     * UC-FE19-06 PM decision (D19). ACCEPT re-runs the shared GBR-72/GBR-84 confirmation serialized per farm; HOLD and
     * REJECT keep the evidence unresolved. Every decision is one immutable evidence_review row plus audit.
     */
    @Transactional
    public EvidenceDTO review(Long evidenceId, ReviewCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        String decision = command == null || !StringUtils.hasText(command.decision()) ? null : command.decision().trim().toUpperCase(Locale.ROOT);
        if (decision == null) throw DomainException.required("decision");
        if (!java.util.Set.of("ACCEPT", "HOLD", "REJECT").contains(decision)) throw DomainException.invalid("decision");
        String reason = reason(command.reason());
        BankTransferEvidence evidence = lockedEvidence(evidenceId, command.version());
        if (evidence.getPayment() != null || "ACCEPTED".equalsIgnoreCase(evidence.getReviewStatus())) throw blocked("EVIDENCE_ALLOCATED");
        if (evidence.isLockedForReturn() || "LOCKED_FOR_RETURN".equalsIgnoreCase(evidence.getReviewStatus())) throw blocked("LOCKED_FOR_RETURN");

        Instant now = clock.now();
        Farm farm = null;
        if ("ACCEPT".equals(decision)) {
            if (!"IN".equalsIgnoreCase(evidence.getTransferDirection())) throw blocked("OUTGOING");
            Long paymentId = command.paymentId() != null ? command.paymentId() : exactRequest(evidence);
            Payment selected = payments.findById(paymentId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "paymentId"));
            Long farmId = selected.getSubscription().getFarm().getId();
            farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "paymentId"));
            Subscription subscription = subscriptions.lockByFarmId(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "paymentId"));
            Payment payment = payments.lockById(selected.getId()).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "paymentId"));
            String rule = acceptanceBlock(payment, evidence);
            if (rule != null) throw blocked(rule);
            confirm(payment, subscription, farm, evidence, storedTransfer(evidence), actor, "PM_ACCEPT", reason);
        } else {
            evidence.setReviewStatus("HOLD".equals(decision) ? "HOLD" : "REJECTED");
            evidence.setReviewReason(reason);
            evidenceRepository.saveAndFlush(evidence);
        }
        EvidenceReview saved = saveReview(evidence, actor, decision, reason, now);
        audit(actor, "EVIDENCE_REVIEW", "EvidenceReview", saved.getId(), farm, Map.of(
            "decision", decision,
            "evidenceId", evidence.getId(),
            "paymentId", evidence.getPayment() == null ? 0L : evidence.getPayment().getId(),
            "reason", reason
        ), now);
        return EvidenceDTO.from(evidence);
    }

    @Transactional
    public EvidenceDTO lockForReturn(Long evidenceId, ReturnCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        String reason = reason(command == null ? null : command.reason());
        BankTransferEvidence evidence = lockedEvidence(evidenceId, command.version());
        if (evidence.getPayment() != null || "ACCEPTED".equalsIgnoreCase(evidence.getReviewStatus())) throw stale("EVIDENCE_ALLOCATED");
        if (evidence.isLockedForReturn()) throw stale("ALREADY_LOCKED");
        if (!"IN".equalsIgnoreCase(evidence.getTransferDirection())) throw stale("OUTGOING");
        Instant now = clock.now();
        evidence.setLockedForReturn(true);
        evidence.setReviewStatus("LOCKED_FOR_RETURN");
        evidence.setReviewReason(reason);
        evidenceRepository.saveAndFlush(evidence);
        saveReview(evidence, actor, "LOCK", reason, now);
        audit(actor, "EVIDENCE_LOCK_RETURN", "BankTransferEvidence", evidence.getId(), null, Map.of("reason", reason), now);
        return EvidenceDTO.from(evidence);
    }

    @Transactional
    public EvidenceDTO recordReturn(Long evidenceId, ReturnResultCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        String reference = text(command == null ? null : command.reference(), "reference", 255);
        if (command.returnDate() == null) throw DomainException.required("returnDate");
        String result = text(command.result(), "result", 500);
        BankTransferEvidence evidence = lockedEvidence(evidenceId, command.version());
        if (!evidence.isLockedForReturn()) throw stale("NOT_LOCKED");
        if (StringUtils.hasText(evidence.getReturnReference())) throw stale("ALREADY_RECORDED");
        Instant now = clock.now();
        if (command.returnDate().isAfter(now.atZone(BUSINESS_ZONE).toLocalDate())) throw DomainException.badRequest(MessageCodes.COM_07, "field", "returnDate");
        if (command.returnDate().isBefore(evidence.getBankPaidAt().atZone(BUSINESS_ZONE).toLocalDate())) throw DomainException.invalid("returnDate");
        evidence.setReturnReference(reference);
        evidence.setReturnDate(command.returnDate());
        evidence.setReturnResult(result);
        evidenceRepository.saveAndFlush(evidence);
        saveReview(evidence, actor, "RETURN_VERIFIED", null, now);
        audit(actor, "EVIDENCE_RETURN_RECORDED", "BankTransferEvidence", evidence.getId(), null,
            Map.of("reference", reference, "result", result, "returnDate", command.returnDate().toString()), now);
        return EvidenceDTO.from(evidence);
    }

    @Transactional
    public EvidenceDTO unlockReturn(Long evidenceId, ReturnCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        String reason = reason(command == null ? null : command.reason());
        BankTransferEvidence evidence = lockedEvidence(evidenceId, command.version());
        if (!evidence.isLockedForReturn()) throw stale("NOT_LOCKED");
        if (StringUtils.hasText(evidence.getReturnReference())) throw stale("RETURN_RECORDED");
        Instant now = clock.now();
        evidence.setLockedForReturn(false);
        evidence.setReviewStatus("UNMATCHED");
        evidence.setReviewReason(reason);
        evidenceRepository.saveAndFlush(evidence);
        saveReview(evidence, actor, "UNLOCK", reason, now);
        audit(actor, "EVIDENCE_RETURN_UNLOCK", "BankTransferEvidence", evidence.getId(), null, Map.of("reason", reason), now);
        return EvidenceDTO.from(evidence);
    }

    /** One field "Reason and evidence references" (SRS 4961, D19): required, trimmed, up to 1,000 characters. */
    private static String reason(String value) {
        return text(value, "reason", REASON_MAX);
    }

    private static String text(String value, String field, int max) {
        if (!StringUtils.hasText(value)) throw DomainException.required(field);
        String trimmed = value.trim();
        if (trimmed.length() > max) throw DomainException.invalid(field);
        return trimmed;
    }

    private BankTransferEvidence lockedEvidence(Long evidenceId, Long version) {
        if (version == null) throw DomainException.required("version");
        BankTransferEvidence evidence = evidenceRepository.lockById(evidenceId)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "evidenceId"));
        verifyVersion(version, evidence.getVersion());
        return evidence;
    }

    /** SRS 4959 / GBR-72: without a selected candidate only the exact payment code identifies the request. */
    private Long exactRequest(BankTransferEvidence evidence) {
        if (!StringUtils.hasText(evidence.getQuoteRef())) throw blocked("NO_CANDIDATE");
        return payments.findFirstByQuoteRefIgnoreCase(evidence.getQuoteRef().trim()).map(Payment::getId).orElseThrow(() -> blocked("NO_CANDIDATE"));
    }

    /** GBR-72 and GBR-84 for PM acceptance, as rule codes for MSG-FE19-11; null when the request may be funded. */
    private String acceptanceBlock(Payment payment, BankTransferEvidence evidence) {
        if (!"PENDING".equalsIgnoreCase(payment.getState()) && !"EXPIRED".equalsIgnoreCase(payment.getState())) return "REQUEST_NOT_PENDING";
        if (evidenceRepository.existsByPayment_Id(payment.getId())) return "REQUEST_ALLOCATED";
        if (evidence.getBankPaidAt().isBefore(payment.getRequestedAt()) || !evidence.getBankPaidAt().isBefore(payment.getExpiresAt())) return "OUTSIDE_WINDOW";
        if (evidence.getAmount().compareTo(payment.getAmountVnd()) != 0) return "AMOUNT_MISMATCH";
        if (!java.util.Objects.equals(payment.getReceivingEnvironment(), evidence.getEnvironment())
            || !java.util.Objects.equals(payment.getReceivingAccountNamespace(), evidence.getAccountNamespace())
            || !StringUtils.hasText(payment.getReceivingAccount()) || !sameAccount(payment.getReceivingAccount(), evidence.getReceivingAccount())) {
            return "ACCOUNT_MISMATCH";
        }
        if (manualFinanceRecords.existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase(
            vn.edu.fpt.beefcare.service.PlatformFinanceService.sourceReference(evidence), "INCOME", "POSTED")) {
            return "MANUAL_INCOME";
        }
        return null;
    }

    private static IncomingTransfer storedTransfer(BankTransferEvidence evidence) {
        return new IncomingTransfer(
            evidence.getProviderTxnId(), evidence.getAmount(), evidence.getBankPaidAt(), evidence.getTransferDirection(),
            evidence.getReceivingAccount(), evidence.getTransferContent(), evidence.getGateway(), evidence.getReferenceCode(), evidence.getQuoteRef()
        );
    }

    private EvidenceReview saveReview(BankTransferEvidence evidence, vn.edu.fpt.beefcare.domain.AppUser actor, String decision, String reason, Instant at) {
        EvidenceReview review = new EvidenceReview();
        review.setEvidence(evidence);
        review.setPmUser(actor);
        review.setDecision(decision);
        review.setReason(reason);
        review.setReviewedAt(at);
        return reviews.saveAndFlush(review);
    }

    private static DomainException blocked(String rule) {
        return DomainException.conflict(MessageCodes.FE19_11, "reason", rule);
    }

    /** Lock / unlock / record are only offered in valid states, so another state means the PM saw stale data. */
    private static DomainException stale(String state) {
        return DomainException.conflict(MessageCodes.COM_05, "reason", state);
    }

    /*
     * Receiving context as ingestion stores it and as UC6 ACCEPT compares it. PlatformPaymentQueryService (SCR-62
     * reads, D18) uses these same rules so its account check and candidates never disagree with ingestion/ACCEPT.
     */
    static String storedEnvironment(String configured) {
        return StringUtils.hasText(configured) ? configured.trim().toUpperCase(Locale.ROOT) : "UNCONFIGURED";
    }

    static String storedNamespace(String configured) {
        return StringUtils.hasText(configured) ? configured.trim() : "UNCONFIGURED";
    }

    static String expectedAccount(String configured, String provider) {
        return !StringUtils.hasText(configured) && "MOCK".equalsIgnoreCase(provider) ? "MOCK-ACCOUNT" : configured;
    }

    private WebhookResult processWithReplayProtection(IncomingTransfer incoming, String provider, String payloadHash) {
        String namespace = storedNamespace(accountNamespace);
        String env = storedEnvironment(environment);
        Optional<BankTransferEvidence> existing = evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId(
            provider, env, namespace, incoming.transactionId()
        );
        if (existing.isPresent()) return duplicateResult(existing.get(), incoming, payloadHash);
        try {
            return transactions.execute(status -> process(incoming, provider, env, namespace, payloadHash));
        } catch (DataIntegrityViolationException duplicateRace) {
            BankTransferEvidence saved = evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId(
                provider, env, namespace, incoming.transactionId()
            ).orElseThrow(() -> duplicateRace);
            return duplicateResult(saved, incoming, payloadHash);
        }
    }

    private WebhookResult process(IncomingTransfer incoming, String provider, String env, String namespace, String payloadHash) {
        validate(incoming);

        BankTransferEvidence evidence = new BankTransferEvidence();
        evidence.setProvider(provider);
        evidence.setEnvironment(env);
        evidence.setAccountNamespace(namespace);
        evidence.setPayloadHash(payloadHash);
        evidence.setProviderTxnId(incoming.transactionId());
        evidence.setAmount(incoming.amount());
        evidence.setBankPaidAt(incoming.paidAt());
        evidence.setQuoteRef(incoming.quoteRef());
        evidence.setTransferDirection(incoming.direction());
        evidence.setReceivingAccount(incoming.receivingAccount());
        evidence.setTransferContent(limit(incoming.content(), 255));
        evidence.setGateway(limit(incoming.gateway(), 100));
        evidence.setReferenceCode(limit(incoming.referenceCode(), 100));
        evidence.setDeliveryOutcome("STORED");
        evidence.setAuthOutcome("VERIFIED");
        evidence.setFirstReceivedAt(clock.now());
        evidence.setReviewStatus("UNMATCHED");

        if (!"IN".equalsIgnoreCase(incoming.direction())) {
            evidence.setReviewReason("Not an incoming transfer");
            return saveEvidence(evidence, provider);
        }
        String expectedAccount = expectedAccount(receivingAccount, provider);
        if (!StringUtils.hasText(expectedAccount)) {
            evidence.setReviewReason("Receiving account is not configured");
            return saveEvidence(evidence, provider);
        }
        if (!sameAccount(expectedAccount, incoming.receivingAccount())) {
            evidence.setReviewReason("Receiving account does not match the configured account");
            return saveEvidence(evidence, provider);
        }
        if (!StringUtils.hasText(incoming.quoteRef())) {
            evidence.setReviewReason("No payment reference found");
            return saveEvidence(evidence, provider);
        }

        Payment candidate = payments.findFirstByQuoteRefIgnoreCase(incoming.quoteRef()).orElse(null);
        if (candidate == null) {
            evidence.setReviewReason("No matching payment request");
            return saveEvidence(evidence, provider);
        }
        Long farmId = candidate.getSubscription().getFarm().getId();
        Farm farm = farms.lockById(farmId).orElseThrow(() -> new IllegalStateException("Subscription farm disappeared"));
        Subscription subscription = subscriptions.lockByFarmId(farmId).orElseThrow(() -> new IllegalStateException("Payment request has no subscription"));
        candidate = payments.lockById(candidate.getId()).orElseThrow(() -> new IllegalStateException("Payment request disappeared"));
        if (evidenceRepository.existsByPayment_Id(candidate.getId())) {
            evidence.setReviewReason("Payment request already has evidence");
            return saveEvidence(evidence, provider);
        }
        String invalidReason = eligibilityReason(candidate, incoming);
        if (invalidReason == null && (!env.equals(candidate.getReceivingEnvironment()) ||
            !namespace.equals(candidate.getReceivingAccountNamespace()) ||
            !sameAccount(candidate.getReceivingAccount(), incoming.receivingAccount()))) {
            invalidReason = "Transfer was sent to a different receiving account than the request";
        }
        if (invalidReason != null) {
            evidence.setReviewReason(invalidReason);
            return saveEvidence(evidence, provider);
        }
        if (manualFinanceRecords.existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase(
            vn.edu.fpt.beefcare.service.PlatformFinanceService.sourceReference(evidence), "INCOME", "POSTED")) {
            evidence.setReviewReason("Bank transaction is already recognized as manual income");
            return saveEvidence(evidence, provider);
        }
        BankTransferEvidence saved = confirm(candidate, subscription, farm, evidence, incoming, null, provider, "Automatically matched by exact payment reference and amount");
        return result(saved, false);
    }

    private BankTransferEvidence confirm(
        Payment payment,
        Subscription subscription,
        Farm farm,
        BankTransferEvidence evidence,
        IncomingTransfer transfer,
        vn.edu.fpt.beefcare.domain.AppUser actor,
        String channel,
        String reason
    ) {
        String invalid = eligibilityReason(payment, transfer);
        if (invalid != null) throw new ResponseStatusException(HttpStatus.CONFLICT, invalid);
        if (manualFinanceRecords.existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase(
            vn.edu.fpt.beefcare.service.PlatformFinanceService.sourceReference(evidence), "INCOME", "POSTED")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bank transaction is already recognized as manual income");
        }
        if (!"IN".equalsIgnoreCase(transfer.direction()) ||
            !java.util.Objects.equals(payment.getReceivingEnvironment(), evidence.getEnvironment()) ||
            !java.util.Objects.equals(payment.getReceivingAccountNamespace(), evidence.getAccountNamespace()) ||
            !sameAccount(payment.getReceivingAccount(), transfer.receivingAccount())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence does not match the request's receiving account");
        }
        Instant confirmedAt = clock.now();
        Instant start = subscription.getLatestEnd() == null || subscription.getLatestEnd().isBefore(confirmedAt)
            ? confirmedAt
            : subscription.getLatestEnd();
        Instant end = LocalDateTime.ofInstant(start, BUSINESS_ZONE).atZone(BUSINESS_ZONE).plusYears(payment.getDurationYears()).toInstant();
        payment.setState("PAID");
        payment.setConfirmedAt(confirmedAt);
        payment.setConfirmationSource(actor == null ? "SEPAY" : "PM");
        payment.setPurchasedStart(start);
        payment.setPurchasedEnd(end);
        payment.setReceiptCode(receiptCode(payment.getId(), transfer.paidAt()));
        subscription.setLatestEnd(end);
        subscription.setEntitlementStatus("ACTIVE");
        if (!"SUSPENDED".equalsIgnoreCase(farm.getServiceStatus())) farm.setServiceStatus("ACTIVE");
        evidence.setPayment(payment);
        evidence.setReviewStatus("ACCEPTED");
        evidence.setReviewReason(reason);
        payments.saveAndFlush(payment);
        subscriptions.save(subscription);
        farms.save(farm);
        BankTransferEvidence saved = evidenceRepository.saveAndFlush(evidence);
        audit(actor, channel + "_PAYMENT_PAID", "Payment", payment.getId(), farm, Map.of(
            "quoteRef", payment.getQuoteRef(),
            "amountVnd", payment.getAmountVnd(),
            "termYears", payment.getDurationYears(),
            "periodStart", start,
            "periodEnd", end,
            "receiptCode", payment.getReceiptCode()
        ));
        audit(actor, channel + "_EVIDENCE", "BankTransferEvidence", saved.getId(), farm, Map.of(
            "providerTxnId", transfer.transactionId(),
            "amount", transfer.amount(),
            "reviewStatus", "ACCEPTED",
            "quoteRef", payment.getQuoteRef(),
            "reason", reason
        ));
        memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farm.getId(), "OWNER", "ACTIVE").ifPresent(owner ->
            notifications.notify(owner.getUser(), "subscription", "SUBSCRIPTION", farm.getId(), "Thanh toán gói dịch vụ đã được xác nhận",
                "Mã biên nhận " + payment.getReceiptCode() + ". Thời hạn mới kết thúc ngày " + end.atZone(BUSINESS_ZONE).toLocalDate(),
                "PAYMENT_PAID:" + payment.getId())
        );
        return saved;
    }

    private WebhookResult saveEvidence(BankTransferEvidence evidence, String provider) {
        BankTransferEvidence saved = evidenceRepository.saveAndFlush(evidence);
        audit(null, provider + "_EVIDENCE", "BankTransferEvidence", saved.getId(), null, Map.of(
            "providerTxnId", evidence.getProviderTxnId(),
            "amount", evidence.getAmount(),
            "reviewStatus", evidence.getReviewStatus(),
            "quoteRef", evidence.getQuoteRef() == null ? "" : evidence.getQuoteRef(),
            "reason", evidence.getReviewReason() == null ? "" : evidence.getReviewReason()
        ));
        reconciliationNotices.evidenceNeedsReview(saved);
        return result(saved, false);
    }

    /**
     * The webhook and API-03 lookup describe one SePay transaction with different text (gateway name, spacing, amount
     * scale). Same identity + same amount, direction, bank time and receiving account is the same transfer (D19);
     * any other difference is still rejected as a changed payload.
     */
    private WebhookResult duplicateResult(BankTransferEvidence existing, IncomingTransfer incoming, String payloadHash) {
        if (!java.util.Objects.equals(existing.getPayloadHash(), payloadHash) && !sameTransfer(existing, incoming)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The transaction id was received with a different payload");
        }
        return result(existing, true);
    }

    private static boolean sameTransfer(BankTransferEvidence existing, IncomingTransfer incoming) {
        boolean sameReceiver = !StringUtils.hasText(existing.getReceivingAccount())
            ? !StringUtils.hasText(incoming.receivingAccount())
            : sameAccount(existing.getReceivingAccount(), incoming.receivingAccount());
        return existing.getAmount() != null && incoming.amount() != null && existing.getAmount().compareTo(incoming.amount()) == 0
            && existing.getTransferDirection() != null && existing.getTransferDirection().equalsIgnoreCase(incoming.direction())
            && java.util.Objects.equals(existing.getBankPaidAt(), incoming.paidAt()) && sameReceiver;
    }

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (java.security.GeneralSecurityException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    private static String fingerprint(IncomingTransfer incoming) {
        return sha256(JsonSupport.toJson(incoming).getBytes(StandardCharsets.UTF_8));
    }

    private void audit(vn.edu.fpt.beefcare.domain.AppUser actor, String action, String targetType, Long targetId, Farm farm, Object details) {
        audit(actor, action, targetType, targetId, farm, details, clock.now());
    }

    /** One command writes its review row and audit event with the same time, so history can show the pair once. */
    private void audit(vn.edu.fpt.beefcare.domain.AppUser actor, String action, String targetType, Long targetId, Farm farm, Object details, Instant at) {
        AuditLog entry = new AuditLog();
        entry.setActor(actor);
        entry.setFarm(farm);
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setLoggedAt(at);
        entry.setDetails(JsonSupport.toJson(details));
        auditLogs.save(entry);
    }

    private String eligibilityReason(Payment payment, IncomingTransfer transfer) {
        if (!"PENDING".equalsIgnoreCase(payment.getState()) && !"EXPIRED".equalsIgnoreCase(payment.getState())) return "Payment request is not pending";
        if (transfer.paidAt().isBefore(payment.getRequestedAt()) || !transfer.paidAt().isBefore(payment.getExpiresAt())) return "Bank-paid time is outside the request window";
        if (transfer.amount().compareTo(payment.getAmountVnd()) != 0) return "Transfer amount does not match the requested amount";
        return null;
    }

    private IncomingTransfer transfer(SePayPayload payload) {
        if (payload == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing SePay payload");
        String direction = payload.transferType() == null ? null : payload.transferType().trim().toUpperCase(Locale.ROOT);
        if ("IN".equals(direction)) direction = "IN";
        else if ("OUT".equals(direction)) direction = "OUT";
        String reference = firstText(payload.code(), payload.referenceCode());
        String content = payload.content();
        String quote = findQuote(reference);
        if (quote == null) quote = findQuote(content);
        return new IncomingTransfer(
            payload.id(),
            payload.transferAmount(),
            parsePaidAt(payload.transactionDate()),
            direction,
            payload.accountNumber(),
            content,
            payload.gateway(),
            payload.referenceCode(),
            quote
        );
    }

    private static Instant parsePaidAt(String value) {
        if (!StringUtils.hasText(value)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing transactionDate");
        try {
            return Instant.parse(value);
        } catch (RuntimeException notInstant) {
            try {
                return LocalDateTime.parse(value.trim(), SEPAY_LOCAL_TIME).atZone(BUSINESS_ZONE).toInstant();
            } catch (RuntimeException invalid) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid transactionDate");
            }
        }
    }

    private static void validate(IncomingTransfer transfer) {
        if (transfer.transactionId() == null || transfer.transactionId() <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid transaction id");
        if (transfer.amount() == null || transfer.amount().signum() <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid transfer amount");
        if (!StringUtils.hasText(transfer.direction())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing transfer direction");
        if (transfer.paidAt() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing transaction time");
    }

    private static String findQuote(String text) {
        if (!StringUtils.hasText(text)) return null;
        Matcher matcher = QUOTE.matcher(text.toUpperCase(Locale.ROOT));
        return matcher.find() ? matcher.group(1).toUpperCase(Locale.ROOT) : null;
    }

    private static String firstText(String first, String second) {
        if (StringUtils.hasText(first)) return first.trim();
        return StringUtils.hasText(second) ? second.trim() : null;
    }

    static boolean sameAccount(String expected, String actual) {
        if (!StringUtils.hasText(actual)) return false;
        return canonicalAccount(expected).equals(canonicalAccount(actual));
    }

    private static String canonicalAccount(String value) {
        return value.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private static String limit(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String receiptCode(Long id, Instant paidAt) {
        int year = paidAt.atZone(BUSINESS_ZONE).getYear() % 100;
        return String.format(Locale.ROOT, "RC-%02d-%06d", year, id);
    }

    private static WebhookResult result(BankTransferEvidence evidence, boolean duplicate) {
        return new WebhookResult(true, duplicate, evidence.getId(), evidence.getReviewStatus(), evidence.getPayment() == null ? null : evidence.getPayment().getId());
    }

    private static void verifyVersion(Long expected, Long actual) {
        if (expected == null || !java.util.Objects.equals(expected, actual)) {
            throw DomainException.conflict(MessageCodes.COM_05, "field", "version");
        }
    }

    public record EvidenceDTO(
        Long id,
        String provider,
        String environment,
        String accountNamespace,
        Long providerTransactionId,
        BigDecimal amount,
        Instant bankPaidAt,
        String quoteRef,
        String direction,
        String receivingAccount,
        String content,
        String gateway,
        String reviewStatus,
        String reviewReason,
        boolean lockedForReturn,
        String returnReference,
        String returnResult,
        Long paymentId,
        Long version,
        java.time.LocalDate returnDate
    ) {
        static EvidenceDTO from(BankTransferEvidence e) {
            return new EvidenceDTO(
                e.getId(), e.getProvider(), e.getEnvironment(), e.getAccountNamespace(), e.getProviderTxnId(), e.getAmount(),
                e.getBankPaidAt(), e.getQuoteRef(), e.getTransferDirection(), e.getReceivingAccount(), e.getTransferContent(),
                e.getGateway(), e.getReviewStatus(), e.getReviewReason(), e.isLockedForReturn(), e.getReturnReference(),
                e.getReturnResult(), e.getPayment() == null ? null : e.getPayment().getId(), e.getVersion(), e.getReturnDate()
            );
        }
    }

    public record ReviewCommand(String decision, Long paymentId, String reason, Long version) {}
    public record ReturnCommand(String reason, Long version) {}
    public record ReturnResultCommand(String reference, java.time.LocalDate returnDate, String result, Long version) {}

    /** API-03 period lookup (D19): SePay data, not stored until the PM saves the row by its transaction ID. */
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
    @io.swagger.v3.oas.annotations.media.Schema(name = "SePayLookupRow")
    public record LookupRow(Long transactionId, Instant bankPaidAt, BigDecimal amount,
        @io.swagger.v3.oas.annotations.media.Schema(allowableValues = {"IN", "OUT"}) String direction,
        @io.swagger.v3.oas.annotations.media.Schema(nullable = true) String content,
        @io.swagger.v3.oas.annotations.media.Schema(nullable = true) String referenceCode,
        @io.swagger.v3.oas.annotations.media.Schema(nullable = true, description = "Stored evidence of this transaction, if any") Long evidenceId) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "SePayLookupPage")
    public record LookupPage(java.util.List<LookupRow> items, @io.swagger.v3.oas.annotations.media.Schema(description = "At most this many rows are returned") int limit) {}

    public record SePayPayload(
        Long id,
        String gateway,
        String transactionDate,
        String accountNumber,
        String code,
        String content,
        String transferType,
        BigDecimal transferAmount,
        String referenceCode
    ) {}

    private record IncomingTransfer(
        Long transactionId,
        BigDecimal amount,
        Instant paidAt,
        String direction,
        String receivingAccount,
        String content,
        String gateway,
        String referenceCode,
        String quoteRef
    ) {}

    public record WebhookResult(boolean success, boolean duplicate, Long evidenceId, String reviewStatus, Long paymentId) {}
}
