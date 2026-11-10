package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.stream.Collectors;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import io.swagger.v3.oas.annotations.media.Schema;

/** Owner quote flow. The persisted price version and amount are immutable once the 24-hour request is issued. */
@Service
public class SubscriptionPaymentService {
    private static final Duration REQUEST_TTL = Duration.ofHours(24);
    private static final ZoneId FARM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** GBR-71: renewal opens 90 days before the latest confirmed end (also shown on SCR-11 by FarmWorkspaceService). */
    static final Duration RENEWAL_WINDOW = Duration.ofDays(90);
    /** SCR-60 / Table III-1: fixed 20 rows; the page cap keeps the JPA offset within int range (400 instead of 500). */
    static final int HISTORY_PAGE_SIZE = 20;
    static final int MAX_HISTORY_PAGE = Integer.MAX_VALUE / HISTORY_PAGE_SIZE;

    private final FarmAccessService farmAccess;
    private final FarmRepository farms;
    private final SubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final PlanVersionRepository plans;
    private final AuditLogRepository auditLogs;
    private final BankTransferEvidenceRepository evidences;
    private final FarmClock clock;
    private final FarmServiceFacts serviceFacts;
    private final String bankCode;
    private final String accountNumber;
    private final String accountName;
    private final String accountNamespace;
    private final String paymentEnvironment;

    public SubscriptionPaymentService(
        FarmAccessService farmAccess,
        FarmRepository farms,
        SubscriptionRepository subscriptions,
        PaymentRepository payments,
        PlanVersionRepository plans,
        AuditLogRepository auditLogs,
        BankTransferEvidenceRepository evidences,
        FarmClock clock,
        FarmServiceFacts serviceFacts,
        @Value("$" + "{beefcare.sepay.bank-code:}") String bankCode,
        @Value("$" + "{beefcare.sepay.account-number:}") String accountNumber,
        @Value("$" + "{beefcare.sepay.account-name:}") String accountName,
        @Value("$" + "{beefcare.sepay.account-namespace:LOCAL-MOCK}") String accountNamespace,
        @Value("$" + "{beefcare.sepay.environment:MOCK}") String paymentEnvironment
    ) {
        this.farmAccess = farmAccess;
        this.farms = farms;
        this.subscriptions = subscriptions;
        this.payments = payments;
        this.plans = plans;
        this.auditLogs = auditLogs;
        this.evidences = evidences;
        this.clock = clock;
        this.serviceFacts = serviceFacts;
        this.bankCode = bankCode;
        this.accountNumber = accountNumber;
        this.accountName = accountName;
        this.accountNamespace = accountNamespace;
        this.paymentEnvironment = paymentEnvironment;
    }

    @Transactional(readOnly = true)
    public SubscriptionOverview overview(Long farmId) {
        FarmContext context = farmAccess.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        Instant now = clock.now();
        List<Payment> requests = payments.findAllBySubscription_Farm_IdOrderByRequestedAtDescIdDesc(farmId);
        List<PurchasedPeriod> periods = requests.stream()
            .filter(p -> "PAID".equalsIgnoreCase(p.getState()))
            .map(p -> PurchasedPeriod.from(p, now))
            .sorted(Comparator.comparing(PurchasedPeriod::start).reversed())
            .toList();
        PurchasedPeriod current = periods.stream().filter(p -> "CURRENT".equals(p.status())).findFirst().orElse(null);
        List<PurchasedPeriod> future = periods.stream().filter(p -> "FUTURE".equals(p.status())).toList();
        Instant latestEnd = periods.stream().map(PurchasedPeriod::end).max(Comparator.naturalOrder()).orElse(null);
        Instant renewalOpensAt = latestEnd == null ? null : latestEnd.atZone(FARM_ZONE).minusDays(90).toInstant();
        boolean suspended = "SUSPENDED".equalsIgnoreCase(context.farm().getServiceStatus());
        FarmServiceFacts.Suspension suspension = suspended ? serviceFacts.lastSuspension(List.of(farmId)).get(farmId) : null;
        String serviceStatus = suspended ? "SUSPENDED" : current != null ? "ACTIVE" : periods.isEmpty() ? "PENDING_PAYMENT" : "EXPIRED";
        String coverage = current != null ? "CURRENT" : future.isEmpty() ? "NONE" : "FUTURE_ONLY";
        PlanVersion price = plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(now).orElse(null);
        Payment pending = requests.stream().filter(p -> "PENDING".equalsIgnoreCase(p.getState()) && p.getExpiresAt().isAfter(now))
            .findFirst().orElse(null);
        RequestEligibility eligibility = suspended ? new RequestEligibility(false, "SUSPENDED", null)
            : price == null ? new RequestEligibility(false, "PRICE_UNAVAILABLE", null)
            : renewalOpensAt != null && now.isBefore(renewalOpensAt) ? new RequestEligibility(false, "OUTSIDE_WINDOW", renewalOpensAt)
            : new RequestEligibility(true, null, null);
        return new SubscriptionOverview(
            farmId, serviceStatus, latestEnd, coverage, price == null ? null : PriceDTO.from(price),
            pending == null ? null : toDto(pending), renewalOpensAt, context.farm().getName(), suspended,
            suspension == null ? null : suspension.at(), current,
            current == null ? null : Math.max(0, Duration.between(now, current.end()).toDays()),
            future, periods, eligibility
        );
    }

    @Transactional(readOnly = true)
    public PaymentHistoryPage history(Long farmId, String q, String status, LocalDate from, LocalDate to, String sort, String dir, int page) {
        farmAccess.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        String search = q == null ? "" : q.trim();
        if (search.length() > 100) throw DomainException.invalid("q");
        if (status != null && !List.of("PENDING", "PAID", "EXPIRED").contains(status)) throw DomainException.invalid("status");
        if (from != null && to != null && from.isAfter(to)) throw DomainException.badRequest(MessageCodes.COM_11, "field", "from");
        if (!List.of("requestedAt", "expiresAt").contains(sort)) throw DomainException.invalid("sort");
        if (!List.of("asc", "desc").contains(dir)) throw DomainException.invalid("dir");
        if (page < 0 || page > MAX_HISTORY_PAGE) throw DomainException.invalid("page");
        Instant now = clock.now();
        Instant start = from == null ? null : from.atStartOfDay(FARM_ZONE).toInstant();
        Instant end = to == null ? null : to.plusDays(1).atStartOfDay(FARM_ZONE).toInstant();
        String pattern = "%" + search.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        var result = payments.findAll((root, query, cb) -> {
            List<Predicate> filters = new ArrayList<>();
            filters.add(cb.equal(root.get("subscription").get("farm").get("id"), farmId));
            if (!search.isEmpty()) filters.add(cb.like(cb.lower(root.get("quoteRef")), pattern, '!'));
            if (start != null) filters.add(cb.greaterThanOrEqualTo(root.get("requestedAt"), start));
            if (end != null) filters.add(cb.lessThan(root.get("requestedAt"), end));
            if (status != null) {
                var effectiveState = cb.<String>selectCase().when(cb.and(
                    cb.equal(cb.upper(root.get("state")), "PENDING"), cb.lessThanOrEqualTo(root.get("expiresAt"), now)
                ), "EXPIRED").otherwise(cb.upper(root.get("state")));
                filters.add(cb.equal(effectiveState, status));
            }
            return cb.and(filters.toArray(Predicate[]::new));
        }, PageRequest.of(page, HISTORY_PAGE_SIZE, Sort.by(Sort.Direction.fromString(dir), sort, "id")));
        Evidence evidence = evidenceFor(result.getContent());
        return new PaymentHistoryPage(result.getContent().stream().map(p -> toDto(p, false, now, evidence)).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public PaymentDTO paymentDetails(Long farmId, Long paymentId) {
        farmAccess.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        Payment payment = payments.findFirstByIdAndSubscription_Farm_Id(paymentId, farmId)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        return toDto(payment);
    }

    @Transactional
    public PaymentDTO requestPayment(Long farmId, PaymentRequest request) {
        FarmContext context = farmAccess.require(farmId, FarmAction.MANAGE_FARM_INFORMATION);
        if (request == null || request.durationYears() == null || !List.of(1, 2, 3).contains(request.durationYears())) {
            throw DomainException.invalid("durationYears");
        }
        if (request.reviewedPriceVersion() == null || request.reviewedPriceVersion() <= 0) throw DomainException.required("reviewedPriceVersion");
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        Instant now = clock.now();
        List<Payment> requests = payments.findAllBySubscription_Farm_IdOrderByRequestedAtDescIdDesc(farmId);
        Payment existing = requests.stream().filter(p -> "PENDING".equalsIgnoreCase(p.getState()) && p.getExpiresAt().isAfter(now))
            .findFirst().orElse(null);
        if (existing != null) return toDto(existing, true);
        if ("SUSPENDED".equalsIgnoreCase(farm.getServiceStatus())) {
            throw DomainException.conflict("MSG-FE19-09", "farmName", farm.getName());
        }
        Instant latestEnd = requests.stream().filter(p -> "PAID".equalsIgnoreCase(p.getState()))
            .map(Payment::getPurchasedEnd).filter(java.util.Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
        Instant opensAt = latestEnd == null ? null : latestEnd.atZone(FARM_ZONE).minusDays(90).toInstant();
        if (opensAt != null && now.isBefore(opensAt)) {
            throw DomainException.conflict("MSG-FE19-03", "confirmedEnd", latestEnd, "opensAt", opensAt);
        }
        PlanVersion price = currentPrice();
        if (price == null || !StringUtils.hasText(bankCode) || !StringUtils.hasText(accountNumber)
            || !StringUtils.hasText(accountName) || !StringUtils.hasText(accountNamespace) || !StringUtils.hasText(paymentEnvironment)) {
            throw DomainException.conflict("MSG-FE19-04");
        }
        if (!price.getId().equals(request.reviewedPriceVersion())) {
            PlanVersion reviewed = plans.findById(request.reviewedPriceVersion()).orElseThrow(() -> DomainException.invalid("reviewedPriceVersion"));
            throw DomainException.conflict("MSG-FE19-02", "seen", Map.of("version", reviewed.getId(), "term", request.durationYears(),
                "amountVnd", amountFor(reviewed, request.durationYears())), "current", Map.of("version", price.getId(), "term", request.durationYears(),
                "amountVnd", amountFor(price, request.durationYears())));
        }
        Subscription subscription = subscriptions.lockByFarmId(farmId).orElseGet(() -> {
            Subscription newSubscription = new Subscription();
            newSubscription.setFarm(farm);
            newSubscription.setPlanVersion(price);
            newSubscription.setEntitlementStatus("PENDING");
            return subscriptions.saveAndFlush(newSubscription);
        });
        requests.stream().filter(p -> "PENDING".equalsIgnoreCase(p.getState())).forEach(p -> p.setState("EXPIRED"));
        BigDecimal amount = amountFor(price, request.durationYears());
        Payment payment = new Payment();
        payment.setQuoteRef("BC" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT));
        payment.setDurationYears(request.durationYears());
        payment.setAmountVnd(amount);
        payment.setState("PENDING");
        payment.setRequestedAt(now);
        payment.setExpiresAt(now.plus(REQUEST_TTL));
        payment.setSubscription(subscription);
        payment.setRequestedBy(context.user());
        payment.setPriceVersion(price);
        payment.setReceivingAccountNamespace(accountNamespace);
        payment.setReceivingEnvironment(paymentEnvironment == null ? null : paymentEnvironment.trim().toUpperCase(Locale.ROOT));
        payment.setReceivingAccount(accountNumber.trim());
        payment.setReceivingBankCode(StringUtils.hasText(bankCode) ? bankCode.trim() : null);
        payment.setReceivingAccountName(StringUtils.hasText(accountName) ? accountName.trim() : null);
        Payment saved = payments.saveAndFlush(payment);
        AuditLog event = new AuditLog();
        event.setFarm(farm);
        event.setActor(context.user());
        event.setAction("PAYMENT_REQUEST");
        event.setTargetType("Payment");
        event.setTargetId(saved.getId());
        event.setLoggedAt(now);
        event.setDetails(JsonSupport.toJson(Map.of(
            "quoteRef", saved.getQuoteRef(),
            "termYears", saved.getDurationYears(),
            "amountVnd", saved.getAmountVnd(),
            "priceVersionId", price.getId()
        )));
        auditLogs.save(event);
        return toDto(saved);
    }

    private PlanVersion currentPrice() {
        return plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(clock.now()).orElse(null);
    }

    private BigDecimal amountFor(PlanVersion price, int years) {
        return switch (years) { case 1 -> price.getPrice1y(); case 2 -> price.getPrice2y(); case 3 -> price.getPrice3y();
            default -> throw DomainException.invalid("durationYears"); };
    }

    private String qrUrl(Payment payment) {
        if (!StringUtils.hasText(payment.getReceivingAccount()) || !StringUtils.hasText(payment.getReceivingBankCode())) return null;
        return UriComponentsBuilder.fromUriString("https://qr.sepay.vn/img")
            .queryParam("acc", payment.getReceivingAccount())
            .queryParam("bank", payment.getReceivingBankCode())
            .queryParam("amount", payment.getAmountVnd().toBigIntegerExact())
            .queryParam("des", payment.getQuoteRef())
            .build()
            .encode()
            .toUriString();
    }

    private PaymentDTO toDto(Payment p) {
        return toDto(p, false);
    }

    private PaymentDTO toDto(Payment p, boolean reopened) {
        return toDto(p, reopened, clock.now());
    }

    private PaymentDTO toDto(Payment p, boolean reopened, Instant now) {
        return toDto(p, reopened, now, evidenceFor(List.of(p)));
    }

    /** Two queries for any number of payments, so an SCR-60 page does not issue per-row evidence reads. */
    private Evidence evidenceFor(List<Payment> page) {
        if (page.isEmpty()) return new Evidence(Map.of(), Map.of());
        Map<Long, BankTransferEvidence> allocated = new HashMap<>();
        evidences.findAllByPayment_IdInOrderByIdAsc(page.stream().map(Payment::getId).toList())
            .forEach(e -> allocated.putIfAbsent(e.getPayment().getId(), e));
        Map<String, List<BankTransferEvidence>> byQuoteRef = evidences.findAllByUpperQuoteRefIn(
            page.stream().map(p -> p.getQuoteRef().toUpperCase(Locale.ROOT)).distinct().toList()
        ).stream().collect(Collectors.groupingBy(e -> e.getQuoteRef().toUpperCase(Locale.ROOT)));
        return new Evidence(allocated, byQuoteRef);
    }

    private PaymentDTO toDto(Payment p, boolean reopened, Instant now, Evidence evidence) {
        BankTransferEvidence allocated = evidence.allocated().get(p.getId());
        BankTransferEvidence first = evidence.byQuoteRef().getOrDefault(p.getQuoteRef().toUpperCase(Locale.ROOT), List.of()).stream()
            .filter(e -> "VERIFIED".equalsIgnoreCase(e.getAuthOutcome()) && "IN".equalsIgnoreCase(e.getTransferDirection())
                && java.util.Objects.equals(p.getReceivingEnvironment(), e.getEnvironment())
                && java.util.Objects.equals(p.getReceivingAccountNamespace(), e.getAccountNamespace())
                && sameAccount(p.getReceivingAccount(), e.getReceivingAccount()) && e.getFirstReceivedAt() != null)
            .min(Comparator.comparing(BankTransferEvidence::getFirstReceivedAt).thenComparing(BankTransferEvidence::getId)).orElse(null);
        if (first == null) first = allocated;
        String state = "PENDING".equalsIgnoreCase(p.getState()) && !p.getExpiresAt().isAfter(now) ? "EXPIRED" : p.getState();
        return new PaymentDTO(
            p.getId(),
            p.getQuoteRef(),
            p.getDurationYears(),
            p.getAmountVnd(),
            state,
            p.getRequestedAt(),
            p.getExpiresAt(),
            p.getPurchasedStart(),
            p.getPurchasedEnd(),
            p.getReceiptCode(),
            p.getPriceVersion().getId(),
            p.getReceivingBankCode(),
            p.getReceivingAccount(),
            p.getReceivingAccountName(),
            qrUrl(p), reopened,
            allocated != null ? allocated.getBankPaidAt() : first == null ? null : first.getBankPaidAt(),
            first == null ? null : first.getFirstReceivedAt(), p.getConfirmedAt(), p.getConfirmationSource()
        );
    }

    private boolean sameAccount(String a, String b) {
        return a != null && b != null && a.replaceAll("\\s+", "").equalsIgnoreCase(b.replaceAll("\\s+", ""));
    }

    private record Evidence(Map<Long, BankTransferEvidence> allocated, Map<String, List<BankTransferEvidence>> byQuoteRef) {}

    public record PaymentRequest(Integer durationYears, Long reviewedPriceVersion) {}
    @Schema(requiredProperties = {"content", "number", "size", "totalElements", "totalPages"})
    public record PaymentHistoryPage(List<PaymentDTO> content, int number, int size, long totalElements, int totalPages) {}
    public record PriceDTO(Long id, BigDecimal price1y, BigDecimal price2y, BigDecimal price3y, Instant effectiveAt) {
        static PriceDTO from(PlanVersion p) { return new PriceDTO(p.getId(), p.getPrice1y(), p.getPrice2y(), p.getPrice3y(), p.getEffectiveAt()); }
    }
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
    public record PaymentDTO(
        Long id,
        String quoteRef,
        Integer durationYears,
        BigDecimal amountVnd,
        @Schema(allowableValues = {"PENDING", "PAID", "EXPIRED"}) String state,
        Instant requestedAt,
        Instant expiresAt,
        Instant purchasedStart,
        Instant purchasedEnd,
        String receiptCode,
        Long priceVersionId,
        String bankCode,
        String accountNumber,
        String accountName,
        String qrImageUrl,
        boolean reopened,
        @Schema(nullable = true) Instant bankPaidAt,
        @Schema(nullable = true) Instant receivedAt,
        @Schema(nullable = true) Instant confirmedAt,
        @Schema(nullable = true, allowableValues = {"SEPAY", "PM"}) String confirmationSource
    ) {
    }
    @Schema(requiredProperties = {"farmId", "serviceStatus", "latestEnd", "entitlementStatus", "currentPrices", "pendingPayment",
        "renewalOpensAt", "farmName", "suspended", "suspendedSince", "currentPeriod", "daysRemaining", "futurePeriods", "periods", "eligibility"})
    public record SubscriptionOverview(
        Long farmId,
        @Schema(allowableValues = {"PENDING_PAYMENT", "ACTIVE", "EXPIRED", "SUSPENDED"})
        String serviceStatus,
        @Schema(nullable = true) Instant latestEnd,
        @Schema(allowableValues = {"CURRENT", "FUTURE_ONLY", "NONE"}, description = "Coverage at read time: CURRENT when a PAID period " +
            "covers now, FUTURE_ONLY when only later periods exist, NONE otherwise. Not the stored Subscription.entitlementStatus column " +
            "(PENDING / ACTIVE / EXPIRED / PENDING_PAYMENT).")
        String entitlementStatus,
        @Schema(nullable = true) PriceDTO currentPrices,
        @Schema(nullable = true) PaymentDTO pendingPayment,
        @Schema(nullable = true) Instant renewalOpensAt,
        String farmName,
        boolean suspended,
        @Schema(nullable = true) Instant suspendedSince,
        @Schema(nullable = true) PurchasedPeriod currentPeriod,
        @Schema(nullable = true, description = "Whole 24-hour days until the current period ends, rounded down, minimum 0 (D14). " +
            "Null when no PAID period covers now; still counted while SUSPENDED.")
        Long daysRemaining,
        List<PurchasedPeriod> futurePeriods,
        List<PurchasedPeriod> periods,
        RequestEligibility eligibility
    ) {}

    @Schema(name = "SubscriptionPurchasedPeriod")
    public record PurchasedPeriod(String paymentCode, Integer durationYears, BigDecimal amountVnd, Instant start, Instant end,
        @Schema(allowableValues = {"CURRENT", "FUTURE", "PAST"}) String status) {
        static PurchasedPeriod from(Payment payment, Instant now) {
            String status = !payment.getPurchasedEnd().isAfter(now) ? "PAST"
                : payment.getPurchasedStart().isAfter(now) ? "FUTURE" : "CURRENT";
            return new PurchasedPeriod(payment.getQuoteRef(), payment.getDurationYears(), payment.getAmountVnd(),
                payment.getPurchasedStart(), payment.getPurchasedEnd(), status);
        }
    }

    @Schema(name = "SubscriptionRequestEligibility")
    public record RequestEligibility(boolean ok,
        @Schema(allowableValues = {"SUSPENDED", "PRICE_UNAVAILABLE", "OUTSIDE_WINDOW"}) String reason, Instant opensAt) {}
}
