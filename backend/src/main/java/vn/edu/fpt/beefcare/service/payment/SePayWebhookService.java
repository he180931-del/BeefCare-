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

/** Authenticated SePay ingestion and the common, serialized payment confirmation rules. */
@Service
public class SePayWebhookService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern QUOTE = Pattern.compile("(?i)(?<![A-Z0-9])(BC[A-Z0-9]{12})(?![A-Z0-9])");
    private static final DateTimeFormatter SEPAY_LOCAL_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

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

    @Transactional(readOnly = true)
    public java.util.List<EvidenceDTO> unresolvedEvidence() {
        platformAccess.requireRole(PlatformRole.PM);
        return evidenceRepository.findReviewQueue(
            java.util.List.of("UNMATCHED", "HOLD", "REJECTED", "LOCKED_FOR_RETURN")
        ).stream().map(EvidenceDTO::from).toList();
    }

    @Transactional(readOnly = true)
    public java.util.List<PaymentCandidate> candidates(Long evidenceId) {
        platformAccess.requireRole(PlatformRole.PM);
        BankTransferEvidence evidence = evidenceRepository.findById(evidenceId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return payments.findEligibleAt(evidence.getAmount(), evidence.getBankPaidAt()).stream()
            .filter(payment -> !evidenceRepository.existsByPayment_Id(payment.getId()))
            .filter(payment -> java.util.Objects.equals(payment.getReceivingAccountNamespace(), evidence.getAccountNamespace()))
            .filter(payment -> sameAccount(payment.getReceivingAccount(), evidence.getReceivingAccount()))
            .map(payment -> new PaymentCandidate(
                payment.getId(),
                payment.getQuoteRef(),
                payment.getSubscription().getFarm().getId(),
                payment.getSubscription().getFarm().getName(),
                payment.getAmountVnd(),
                payment.getDurationYears(),
                payment.getExpiresAt(),
                payment.getReceivingAccountNamespace()
            )).toList();
    }

    @Transactional
    public EvidenceDTO review(Long evidenceId, ReviewCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        if (command == null || !StringUtils.hasText(command.decision()) || !StringUtils.hasText(command.reason())) {
            throw DomainException.required("decision and reason");
        }
        if (command.reason().trim().length() > 500) throw DomainException.invalid("reason");
        BankTransferEvidence evidence = evidenceRepository.lockById(evidenceId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        verifyVersion(command.version(), evidence.getVersion());
        if (evidence.isLockedForReturn()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence is locked for return");
        if ("ACCEPTED".equalsIgnoreCase(evidence.getReviewStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence is already accepted");

        String decision = command.decision().trim().toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("ACCEPT", "HOLD", "REJECT").contains(decision)) throw DomainException.invalid("decision");
        Payment payment = null;
        Farm farm = null;
        if ("ACCEPT".equals(decision)) {
            if (command.paymentId() == null) throw DomainException.required("paymentId");
            payment = payments.findById(command.paymentId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            Long farmId = payment.getSubscription().getFarm().getId();
            farm = farms.lockById(farmId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            Subscription subscription = subscriptions.lockByFarmId(farmId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            payment = payments.lockById(payment.getId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (evidenceRepository.existsByPayment_Id(payment.getId())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment already has allocated evidence");
            IncomingTransfer transfer = new IncomingTransfer(
                evidence.getProviderTxnId(), evidence.getAmount(), evidence.getBankPaidAt(), evidence.getTransferDirection(),
                evidence.getReceivingAccount(), evidence.getTransferContent(), evidence.getGateway(), evidence.getReferenceCode(), evidence.getQuoteRef()
            );
            String invalid = eligibilityReason(payment, transfer);
            if (invalid == null && (!subscription.getFarm().getId().equals(farmId) ||
                !java.util.Objects.equals(payment.getReceivingEnvironment(), evidence.getEnvironment()) ||
                !java.util.Objects.equals(payment.getReceivingAccountNamespace(), evidence.getAccountNamespace()) ||
                !sameAccount(payment.getReceivingAccount(), evidence.getReceivingAccount()))) {
                invalid = "Evidence does not match the request's receiving account";
            }
            if (invalid != null) throw new ResponseStatusException(HttpStatus.CONFLICT, invalid);
            confirm(payment, subscription, farm, evidence, transfer, actor, "PM_ACCEPT", command.reason().trim());
        } else {
            evidence.setReviewStatus("HOLD".equals(decision) ? "HOLD" : "REJECTED");
            evidence.setReviewReason(command.reason().trim());
            evidenceRepository.saveAndFlush(evidence);
        }
        EvidenceReview review = new EvidenceReview();
        review.setEvidence(evidence);
        review.setPmUser(actor);
        review.setDecision(decision);
        review.setReason(command.reason().trim());
        review.setReviewedAt(clock.now());
        EvidenceReview savedReview = reviews.saveAndFlush(review);
        audit(actor, "EVIDENCE_REVIEW", "EvidenceReview", savedReview.getId(), farm, Map.of(
            "decision", decision,
            "evidenceId", evidence.getId(),
            "paymentId", command.paymentId() == null ? 0L : command.paymentId(),
            "reason", command.reason().trim()
        ));
        return EvidenceDTO.from(evidence);
    }

    @Transactional
    public EvidenceDTO lockForReturn(Long evidenceId, ReturnCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        if (command == null || !StringUtils.hasText(command.reason())) throw DomainException.required("reason");
        BankTransferEvidence evidence = evidenceRepository.lockById(evidenceId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        verifyVersion(command.version(), evidence.getVersion());
        if ("ACCEPTED".equalsIgnoreCase(evidence.getReviewStatus()) || evidence.isLockedForReturn()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence cannot be locked in its current state");
        }
        evidence.setLockedForReturn(true);
        evidence.setReviewStatus("LOCKED_FOR_RETURN");
        evidence.setReviewReason(command.reason().trim());
        evidenceRepository.saveAndFlush(evidence);
        audit(actor, "EVIDENCE_LOCK_RETURN", "BankTransferEvidence", evidence.getId(), null, Map.of("reason", command.reason().trim()));
        return EvidenceDTO.from(evidence);
    }

    @Transactional
    public EvidenceDTO recordReturn(Long evidenceId, ReturnResultCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        if (command == null || !StringUtils.hasText(command.reference()) || !StringUtils.hasText(command.result())) {
            throw DomainException.required("reference and result");
        }
        BankTransferEvidence evidence = evidenceRepository.lockById(evidenceId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        verifyVersion(command.version(), evidence.getVersion());
        if (!evidence.isLockedForReturn()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence is not locked for return");
        evidence.setReturnReference(limit(command.reference().trim(), 255));
        evidence.setReturnResult(limit(command.result().trim(), 500));
        evidenceRepository.saveAndFlush(evidence);
        audit(actor, "EVIDENCE_RETURN_RECORDED", "BankTransferEvidence", evidence.getId(), null,
            Map.of("reference", evidence.getReturnReference(), "result", evidence.getReturnResult()));
        return EvidenceDTO.from(evidence);
    }

    @Transactional
    public EvidenceDTO unlockReturn(Long evidenceId, ReturnCommand command) {
        var actor = platformAccess.requireRole(PlatformRole.PM).user();
        if (command == null || !StringUtils.hasText(command.reason())) throw DomainException.required("reason");
        BankTransferEvidence evidence = evidenceRepository.lockById(evidenceId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        verifyVersion(command.version(), evidence.getVersion());
        if (!evidence.isLockedForReturn() || StringUtils.hasText(evidence.getReturnReference())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence cannot be unlocked after a return is recorded");
        }
        evidence.setLockedForReturn(false);
        evidence.setReviewStatus("UNMATCHED");
        evidence.setReviewReason(command.reason().trim());
        evidenceRepository.saveAndFlush(evidence);
        audit(actor, "EVIDENCE_RETURN_UNLOCK", "BankTransferEvidence", evidence.getId(), null, Map.of("reason", command.reason().trim()));
        return EvidenceDTO.from(evidence);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PlatformPayment> platformPayments(int page, int size) {
        platformAccess.requireRole(PlatformRole.PM);
        int safeSize = Math.max(1, Math.min(100, size));
        return payments.findAll(org.springframework.data.domain.PageRequest.of(
            Math.max(0, page),
            safeSize,
            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "requestedAt")
        )).map(PlatformPayment::from);
    }

    @Transactional(readOnly = true)
    public PlatformPayment platformPayment(Long paymentId) {
        platformAccess.requireRole(PlatformRole.PM);
        return payments.findById(paymentId).map(PlatformPayment::from)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private WebhookResult processWithReplayProtection(IncomingTransfer incoming, String provider, String payloadHash) {
        String namespace = StringUtils.hasText(accountNamespace) ? accountNamespace.trim() : "UNCONFIGURED";
        String env = StringUtils.hasText(environment) ? environment.trim().toUpperCase(Locale.ROOT) : "UNCONFIGURED";
        Optional<BankTransferEvidence> existing = evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId(
            provider, env, namespace, incoming.transactionId()
        );
        if (existing.isPresent()) return duplicateResult(existing.get(), payloadHash);
        try {
            return transactions.execute(status -> process(incoming, provider, env, namespace, payloadHash));
        } catch (DataIntegrityViolationException duplicateRace) {
            BankTransferEvidence saved = evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId(
                provider, env, namespace, incoming.transactionId()
            ).orElseThrow(() -> duplicateRace);
            return duplicateResult(saved, payloadHash);
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
        evidence.setReviewStatus("UNMATCHED");

        if (!"IN".equalsIgnoreCase(incoming.direction())) {
            evidence.setReviewReason("Not an incoming transfer");
            return saveEvidence(evidence, provider);
        }
        String expectedAccount = receivingAccount;
        if (!StringUtils.hasText(expectedAccount) && "MOCK".equalsIgnoreCase(provider)) expectedAccount = "MOCK-ACCOUNT";
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
        Instant start = subscription.getLatestEnd() == null || subscription.getLatestEnd().isBefore(transfer.paidAt())
            ? transfer.paidAt()
            : subscription.getLatestEnd();
        Instant end = LocalDateTime.ofInstant(start, BUSINESS_ZONE).atZone(BUSINESS_ZONE).plusYears(payment.getDurationYears()).toInstant();
        payment.setState("PAID");
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

    private WebhookResult duplicateResult(BankTransferEvidence existing, String payloadHash) {
        if (!java.util.Objects.equals(existing.getPayloadHash(), payloadHash)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The transaction id was received with a different payload");
        }
        return result(existing, true);
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
        AuditLog entry = new AuditLog();
        entry.setActor(actor);
        entry.setFarm(farm);
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setLoggedAt(clock.now());
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

    private static boolean sameAccount(String expected, String actual) {
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Evidence changed; refresh and retry");
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
        Long version
    ) {
        static EvidenceDTO from(BankTransferEvidence e) {
            return new EvidenceDTO(
                e.getId(), e.getProvider(), e.getEnvironment(), e.getAccountNamespace(), e.getProviderTxnId(), e.getAmount(),
                e.getBankPaidAt(), e.getQuoteRef(), e.getTransferDirection(), e.getReceivingAccount(), e.getTransferContent(),
                e.getGateway(), e.getReviewStatus(), e.getReviewReason(), e.isLockedForReturn(), e.getReturnReference(),
                e.getReturnResult(), e.getPayment() == null ? null : e.getPayment().getId(), e.getVersion()
            );
        }
    }

    public record PaymentCandidate(Long paymentId, String quoteRef, Long farmId, String farmName, BigDecimal amount, Integer termYears, Instant expiresAt, String accountNamespace) {}

    public record PlatformPayment(
        Long id,
        Long farmId,
        String farmName,
        String quoteRef,
        Integer termYears,
        BigDecimal amount,
        String state,
        Instant requestedAt,
        Instant expiresAt,
        Instant purchasedStart,
        Instant purchasedEnd,
        String receiptCode,
        String requestedByEmail,
        Long priceVersionId
    ) {
        static PlatformPayment from(Payment payment) {
            return new PlatformPayment(
                payment.getId(),
                payment.getSubscription().getFarm().getId(),
                payment.getSubscription().getFarm().getName(),
                payment.getQuoteRef(),
                payment.getDurationYears(),
                payment.getAmountVnd(),
                payment.getState(),
                payment.getRequestedAt(),
                payment.getExpiresAt(),
                payment.getPurchasedStart(),
                payment.getPurchasedEnd(),
                payment.getReceiptCode(),
                payment.getRequestedBy().getEmail(),
                payment.getPriceVersion().getId()
            );
        }
    }

    public record ReviewCommand(String decision, Long paymentId, String reason, Long version) {}
    public record ReturnCommand(String reason, Long version) {}
    public record ReturnResultCommand(String reference, String result, Long version) {}

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
