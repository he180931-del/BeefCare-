package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
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

    private final FarmAccessService farmAccess;
    private final FarmRepository farms;
    private final SubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final PlanVersionRepository plans;
    private final AuditLogRepository auditLogs;
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
        PlanVersion price = plans.findFirstByEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(now).orElse(null);
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
    public List<PaymentDTO> history(Long farmId) {
        FarmContext context = farmAccess.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        return payments.findAllBySubscription_Farm_IdAndRequestedBy_IdOrderByRequestedAtDescIdDesc(farmId, context.user().getId())
            .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public PaymentDTO paymentDetails(Long farmId, Long paymentId) {
        FarmContext context = farmAccess.require(farmId, FarmAction.VIEW_FARM_INFORMATION);
        Payment payment = payments.findFirstByIdAndSubscription_Farm_IdAndRequestedBy_Id(paymentId, farmId, context.user().getId())
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        return toDto(payment);
    }

    @Transactional
    public PaymentDTO requestPayment(Long farmId, PaymentRequest request) {
        FarmContext context = farmAccess.require(farmId, FarmAction.MANAGE_FARM_INFORMATION);
        if (request == null || request.durationYears() == null || !List.of(1, 2, 3).contains(request.durationYears())) {
            throw DomainException.invalid("durationYears");
        }
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        PlanVersion price = currentPrice();
        if (price == null) throw DomainException.conflict("MSG-FE19-PRICE_UNAVAILABLE");
        Subscription subscription = subscriptions.lockByFarmId(farmId).orElseGet(() -> {
            Subscription newSubscription = new Subscription();
            newSubscription.setFarm(farm);
            newSubscription.setPlanVersion(price);
            newSubscription.setEntitlementStatus("PENDING");
            return subscriptions.saveAndFlush(newSubscription);
        });
        if (subscription.getLatestEnd() != null && subscription.getLatestEnd().isAfter(clock.now().plus(RENEWAL_WINDOW))) {
            throw DomainException.conflict("MSG-FE19-RENEWAL_NOT_OPEN");
        }
        Payment existing = payments.findFirstBySubscription_IdAndStateIgnoreCaseOrderByRequestedAtDesc(subscription.getId(), "PENDING").orElse(null);
        if (existing != null && existing.getExpiresAt().isAfter(clock.now())) return toDto(existing);
        if (existing != null) {
            existing.setState("EXPIRED");
            payments.save(existing);
        }
        BigDecimal amount = switch (request.durationYears()) {
            case 1 -> price.getPrice1y();
            case 2 -> price.getPrice2y();
            case 3 -> price.getPrice3y();
            default -> throw DomainException.invalid("durationYears");
        };
        Instant now = clock.now();
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
        payment.setReceivingAccount(StringUtils.hasText(accountNumber) ? accountNumber.trim() : ("MOCK".equalsIgnoreCase(paymentEnvironment) ? "MOCK-ACCOUNT" : null));
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
        return plans.findFirstByEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(clock.now()).orElse(null);
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
        return new PaymentDTO(
            p.getId(),
            p.getQuoteRef(),
            p.getDurationYears(),
            p.getAmountVnd(),
            p.getState(),
            p.getRequestedAt(),
            p.getExpiresAt(),
            p.getPurchasedStart(),
            p.getPurchasedEnd(),
            p.getReceiptCode(),
            p.getPriceVersion().getId(),
            p.getReceivingBankCode(),
            p.getReceivingAccount(),
            p.getReceivingAccountName(),
            qrUrl(p)
        );
    }

    public record PaymentRequest(Integer durationYears) {}
    public record PriceDTO(Long id, BigDecimal price1y, BigDecimal price2y, BigDecimal price3y, Instant effectiveAt) {
        static PriceDTO from(PlanVersion p) { return new PriceDTO(p.getId(), p.getPrice1y(), p.getPrice2y(), p.getPrice3y(), p.getEffectiveAt()); }
    }
    public record PaymentDTO(
        Long id,
        String quoteRef,
        Integer durationYears,
        BigDecimal amountVnd,
        String state,
        Instant requestedAt,
        Instant expiresAt,
        Instant purchasedStart,
        Instant purchasedEnd,
        String receiptCode,
        Long priceVersionId,
        String bankCode,
        String accountNumber,
        String accountName,
        String qrImageUrl
    ) {
    }
    @Schema(requiredProperties = {"farmId", "serviceStatus", "latestEnd", "entitlementStatus", "currentPrices", "pendingPayment",
        "renewalOpensAt", "farmName", "suspended", "suspendedSince", "currentPeriod", "daysRemaining", "futurePeriods", "periods", "eligibility"})
    public record SubscriptionOverview(
        Long farmId,
        @Schema(allowableValues = {"PENDING_PAYMENT", "ACTIVE", "EXPIRED", "SUSPENDED"})
        String serviceStatus,
        @Schema(nullable = true) Instant latestEnd,
        @Schema(allowableValues = {"CURRENT", "FUTURE_ONLY", "NONE"})
        String entitlementStatus,
        @Schema(nullable = true) PriceDTO currentPrices,
        @Schema(nullable = true) PaymentDTO pendingPayment,
        @Schema(nullable = true) Instant renewalOpensAt,
        String farmName,
        boolean suspended,
        @Schema(nullable = true) Instant suspendedSince,
        @Schema(nullable = true) PurchasedPeriod currentPeriod,
        @Schema(nullable = true, description = "Whole 24-hour days remaining, rounded down (D14); null without current coverage, including while suspended.")
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
