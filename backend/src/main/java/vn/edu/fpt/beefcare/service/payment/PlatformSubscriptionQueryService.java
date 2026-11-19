package vn.edu.fpt.beefcare.service.payment;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccessService;

/**
 * PM read models without farm operational data: SCR-61 Platform Subscriptions (UC-FE19-04), the SCR-62 filters and tiles
 * (UC-FE19-05) and SCR-70 Subscription Receipts (UC-FE21-01). A receipt is the read-only view of one PAID payment (GBR-82);
 * nothing here changes data.
 */
@Service
@Transactional(readOnly = true)
public class PlatformSubscriptionQueryService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PAGE_SIZE = 100;

    private final EntityManager em;
    private final PlatformAccessService platformAccess;
    private final FarmClock clock;

    public PlatformSubscriptionQueryService(EntityManager em, PlatformAccessService platformAccess, FarmClock clock) {
        this.em = em;
        this.platformAccess = platformAccess;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ SCR-61

    public Page<SubscriptionRow> subscriptions(String q, String coverage, String serviceStatus, LocalDate endFrom, LocalDate endTo, int page, int size) {
        platformAccess.requireRole(PlatformRole.PM);
        String cov = coverage == null || coverage.isBlank() ? "ALL" : coverage.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "CURRENT", "FUTURE_ONLY", "NONE").contains(cov)) throw DomainException.invalid("coverage");
        Instant now = clock.now();
        Map<Long, List<Payment>> paidByFarm = paidPayments().collect(Collectors.groupingBy(p -> p.getSubscription().getFarm().getId()));
        Map<Long, Subscription> subscriptionByFarm = em.createQuery("select s from Subscription s join fetch s.farm", Subscription.class)
            .getResultList().stream().collect(Collectors.toMap(s -> s.getFarm().getId(), Function.identity()));
        Map<Long, FarmMembership> owners = owners();
        String needle = normalized(q);
        List<SubscriptionRow> rows = em.createQuery("select f from Farm f order by f.id", Farm.class).getResultList().stream()
            .map(farm -> row(farm, subscriptionByFarm.get(farm.getId()), paidByFarm.getOrDefault(farm.getId(), List.of()), owners.get(farm.getId()), now))
            .filter(r -> needle == null || r.farmName().toLowerCase(Locale.ROOT).contains(needle) ||
                r.paymentCodes().stream().anyMatch(code -> code.toLowerCase(Locale.ROOT).contains(needle)))
            .filter(r -> switch (cov) {
                case "CURRENT" -> r.currentStart() != null;
                case "FUTURE_ONLY" -> r.currentStart() == null && r.confirmedUntil() != null && r.confirmedUntil().isAfter(now);
                case "NONE" -> r.confirmedUntil() == null;
                default -> true;
            })
            .filter(r -> serviceStatus == null || serviceStatus.isBlank() || serviceStatus.trim().equalsIgnoreCase(r.serviceStatus()))
            .filter(r -> endFrom == null || (r.confirmedUntil() != null && !localDate(r.confirmedUntil()).isBefore(endFrom)))
            .filter(r -> endTo == null || (r.confirmedUntil() != null && !localDate(r.confirmedUntil()).isAfter(endTo)))
            .sorted(Comparator.comparing(SubscriptionRow::confirmedUntil, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(SubscriptionRow::farmId))
            .toList();
        return page(rows, page, size);
    }

    public SubscriptionDetail subscription(Long farmId) {
        platformAccess.requireRole(PlatformRole.PM);
        Farm farm = em.find(Farm.class, farmId);
        if (farm == null) throw DomainException.notFound(MessageCodes.COM_08, "farm_id", farmId);
        Instant now = clock.now();
        List<Payment> paid = paidPayments().filter(p -> p.getSubscription().getFarm().getId().equals(farmId)).toList();
        Subscription subscription = em.createQuery("select s from Subscription s where s.farm.id = :farm", Subscription.class)
            .setParameter("farm", farmId).getResultStream().findFirst().orElse(null);
        SubscriptionRow row = row(farm, subscription, paid, owners().get(farmId), now);
        Map<Long, Instant> confirmed = confirmationTimes(paid.stream().map(Payment::getId).toList());
        List<PurchasedPeriod> periods = paid.stream()
            .sorted(Comparator.comparing(Payment::getPurchasedStart).reversed())
            .map(p -> new PurchasedPeriod(p.getId(), p.getQuoteRef(), p.getReceiptCode(), p.getDurationYears(), p.getPurchasedStart(), p.getPurchasedEnd(), confirmed.get(p.getId())))
            .toList();
        PurchasedPeriod latest = periods.stream().max(Comparator.comparing(PurchasedPeriod::start)).orElse(null);
        Instant renewalOpens = row.confirmedUntil() == null ? null : row.confirmedUntil().atZone(BUSINESS_ZONE).minusDays(90).toInstant();
        return new SubscriptionDetail(row, subscription == null ? null : subscription.getId(), "SUSPENDED".equalsIgnoreCase(farm.getServiceStatus()),
            renewalOpens, latest, periods, periods.isEmpty() ? "No subscription yet: no period or end date." : null);
    }

    private SubscriptionRow row(Farm farm, Subscription subscription, List<Payment> paid, FarmMembership owner, Instant now) {
        Payment current = paid.stream()
            .filter(p -> !p.getPurchasedStart().isAfter(now) && p.getPurchasedEnd().isAfter(now))
            .max(Comparator.comparing(Payment::getPurchasedEnd)).orElse(null);
        Instant confirmedUntil = subscription != null && subscription.getLatestEnd() != null ? subscription.getLatestEnd()
            : paid.stream().map(Payment::getPurchasedEnd).max(Comparator.naturalOrder()).orElse(null);
        return new SubscriptionRow(
            farm.getId(), farm.getName(),
            owner == null ? null : owner.getUser().getFullName(), owner == null ? null : owner.getUser().getEmail(),
            farm.getServiceStatus(),
            current == null ? null : current.getPurchasedStart(), current == null ? null : current.getPurchasedEnd(),
            confirmedUntil, paid.stream().map(Payment::getQuoteRef).filter(Objects::nonNull).toList()
        );
    }

    // ------------------------------------------------------------------ SCR-62 tiles

    public PaymentTiles paymentTiles() {
        platformAccess.requireRole(PlatformRole.PM);
        long pending = em.createQuery("select count(p) from Payment p where upper(p.state) = 'PENDING'", Long.class).getSingleResult();
        Map<String, Long> byStatus = em.createQuery("select upper(e.reviewStatus), count(e) from BankTransferEvidence e group by upper(e.reviewStatus)", Object[].class)
            .getResultList().stream().collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
        long locked = em.createQuery("select count(e) from BankTransferEvidence e where e.lockedForReturn = true", Long.class).getSingleResult();
        return new PaymentTiles(pending, byStatus.getOrDefault("UNMATCHED", 0L), byStatus.getOrDefault("HOLD", 0L), locked);
    }

    /** SCR-62 "Review status" filter: ALL, TO_REVIEW, HOLD, REJECTED, ACCEPTED, LOCKED; and the bank date range. */
    public List<BankTransferEvidence> evidence(String status, LocalDate bankFrom, LocalDate bankTo) {
        platformAccess.requireRole(PlatformRole.PM);
        String s = status == null || status.isBlank() ? "TO_REVIEW" : status.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "TO_REVIEW", "HOLD", "REJECTED", "ACCEPTED", "LOCKED").contains(s)) throw DomainException.invalid("status");
        return em.createQuery("select e from BankTransferEvidence e order by e.bankPaidAt desc, e.id desc", BankTransferEvidence.class).getResultStream()
            .filter(e -> switch (s) {
                case "TO_REVIEW" -> "UNMATCHED".equalsIgnoreCase(e.getReviewStatus()) && !e.isLockedForReturn();
                case "LOCKED" -> e.isLockedForReturn();
                case "ALL" -> true;
                default -> s.equalsIgnoreCase(e.getReviewStatus());
            })
            .filter(e -> bankFrom == null || (e.getBankPaidAt() != null && !localDate(e.getBankPaidAt()).isBefore(bankFrom)))
            .filter(e -> bankTo == null || (e.getBankPaidAt() != null && !localDate(e.getBankPaidAt()).isAfter(bankTo)))
            .toList();
    }

    public List<SePayWebhookService.EvidenceDTO> evidenceView(String status, LocalDate bankFrom, LocalDate bankTo) {
        return evidence(status, bankFrom, bankTo).stream().map(SePayWebhookService.EvidenceDTO::from).toList();
    }

    public Page<SePayWebhookService.PlatformPayment> paymentView(String state, String q, int page, int size) {
        return payments(state, q, page, size).map(SePayWebhookService.PlatformPayment::from);
    }

    /** SCR-62 "Payment requests" tab with a state filter and code / farm search. */
    public Page<Payment> payments(String state, String q, int page, int size) {
        platformAccess.requireRole(PlatformRole.PM);
        String needle = normalized(q);
        List<Payment> rows = em.createQuery("select p from Payment p join fetch p.subscription s join fetch s.farm order by p.requestedAt desc, p.id desc", Payment.class)
            .getResultStream()
            .filter(p -> state == null || state.isBlank() || state.trim().equalsIgnoreCase(p.getState()))
            .filter(p -> needle == null || (p.getQuoteRef() != null && p.getQuoteRef().toLowerCase(Locale.ROOT).contains(needle)) ||
                p.getSubscription().getFarm().getName().toLowerCase(Locale.ROOT).contains(needle))
            .toList();
        return page(rows, page, size);
    }

    // ------------------------------------------------------------------ SCR-70

    public ReceiptPage receipts(String q, Long farmId, LocalDate bankFrom, LocalDate bankTo, int page, int size) {
        platformAccess.requireRole(PlatformRole.PM);
        if (bankFrom != null && bankTo != null && bankTo.isBefore(bankFrom)) throw DomainException.invalid("bankTo");
        String needle = normalized(q);
        Map<Long, BankTransferEvidence> evidence = evidenceByPayment();
        List<ReceiptRow> rows = paidPayments()
            .map(p -> receiptRow(p, evidence.get(p.getId())))
            .filter(r -> farmId == null || farmId.equals(r.farmId()))
            .filter(r -> needle == null || (r.receiptCode() != null && r.receiptCode().toLowerCase(Locale.ROOT).contains(needle)) ||
                (r.paymentCode() != null && r.paymentCode().toLowerCase(Locale.ROOT).contains(needle)))
            .filter(r -> bankFrom == null || (r.bankPaidAt() != null && !localDate(r.bankPaidAt()).isBefore(bankFrom)))
            .filter(r -> bankTo == null || (r.bankPaidAt() != null && !localDate(r.bankPaidAt()).isAfter(bankTo)))
            .sorted(Comparator.comparing(ReceiptRow::bankPaidAt, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(ReceiptRow::paymentId, Comparator.reverseOrder()))
            .toList();
        BigDecimal total = rows.stream().map(ReceiptRow::amount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        Page<ReceiptRow> paged = page(rows, page, size);
        return new ReceiptPage(rows.size(), total, paged.items(), paged.total(), paged.page(), paged.size());
    }

    public ReceiptDetail receipt(Long paymentId) {
        platformAccess.requireRole(PlatformRole.PM);
        Payment payment = em.find(Payment.class, paymentId);
        if (payment == null || !"PAID".equalsIgnoreCase(payment.getState())) throw DomainException.notFound(MessageCodes.COM_08, "payment_id", paymentId);
        BankTransferEvidence evidence = evidenceByPayment().get(paymentId);
        Object[] review = evidence == null ? null : em.createQuery(
                "select r.reviewedAt, r.pmUser.fullName from EvidenceReview r where r.evidence.id = :e and upper(r.decision) = 'ACCEPT' order by r.reviewedAt desc", Object[].class)
            .setParameter("e", evidence.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
        Instant confirmedAt = review != null ? (Instant) review[0] : confirmationTimes(List.of(paymentId)).get(paymentId);
        return new ReceiptDetail(
            receiptRow(payment, evidence), payment.getState(), payment.getPriceVersion().getId(), confirmedAt,
            review != null ? "PM_ACCEPT" : "SEPAY_AUTOMATIC", review == null ? null : (String) review[1],
            payment.getPurchasedStart(), payment.getPurchasedEnd(),
            evidence == null ? null : evidence.getId(), evidence == null ? null : mask(evidence.getProviderTxnId())
        );
    }

    private ReceiptRow receiptRow(Payment p, BankTransferEvidence evidence) {
        Farm farm = p.getSubscription().getFarm();
        return new ReceiptRow(p.getId(), p.getReceiptCode(), p.getQuoteRef(), farm.getId(), farm.getName(), p.getDurationYears(), p.getAmountVnd(),
            evidence == null ? null : evidence.getBankPaidAt());
    }

    // ------------------------------------------------------------------ helpers

    private Stream<Payment> paidPayments() {
        return em.createQuery("select p from Payment p join fetch p.subscription s join fetch s.farm where upper(p.state) = 'PAID' and p.purchasedStart is not null", Payment.class)
            .getResultStream();
    }

    private Map<Long, BankTransferEvidence> evidenceByPayment() {
        return em.createQuery("select e from BankTransferEvidence e where e.payment is not null", BankTransferEvidence.class).getResultStream()
            .collect(Collectors.toMap(e -> e.getPayment().getId(), Function.identity(), (a, b) -> a.getId() < b.getId() ? a : b));
    }

    private Map<Long, FarmMembership> owners() {
        return em.createQuery("select m from FarmMembership m join fetch m.user where upper(m.role) = 'OWNER' and upper(m.status) = 'ACTIVE'", FarmMembership.class)
            .getResultStream().collect(Collectors.toMap(m -> m.getFarm().getId(), Function.identity(), (a, b) -> a));
    }

    /** The audit entry written when the payment became PAID (SePay or PM acceptance). */
    private Map<Long, Instant> confirmationTimes(List<Long> paymentIds) {
        if (paymentIds.isEmpty()) return Map.of();
        return em.createQuery("select a.targetId, min(a.loggedAt) from AuditLog a where a.targetType = 'Payment' and a.action like '%_PAYMENT_PAID' and a.targetId in :ids group by a.targetId", Object[].class)
            .setParameter("ids", paymentIds).getResultStream().collect(Collectors.toMap(r -> (Long) r[0], r -> (Instant) r[1]));
    }

    private static String mask(Long providerTxnId) {
        if (providerTxnId == null) return null;
        String id = providerTxnId.toString();
        return id.length() <= 4 ? "****" + id : "****" + id.substring(id.length() - 4);
    }

    private static LocalDate localDate(Instant instant) {
        return instant.atZone(BUSINESS_ZONE).toLocalDate();
    }

    private static String normalized(String q) {
        return q == null || q.isBlank() ? null : q.trim().toLowerCase(Locale.ROOT);
    }

    private static <T> Page<T> page(List<T> rows, int page, int size) {
        int safeSize = Math.max(1, Math.min(MAX_PAGE_SIZE, size));
        int safePage = Math.max(0, page);
        int from = Math.min(rows.size(), safePage * safeSize);
        return new Page<>(rows.subList(from, Math.min(rows.size(), from + safeSize)), rows.size(), safePage, safeSize);
    }

    public record Page<T>(List<T> items, long total, int page, int size) {
        public <R> Page<R> map(Function<T, R> mapper) {
            return new Page<>(items.stream().map(mapper).toList(), total, page, size);
        }
    }

    public record SubscriptionRow(Long farmId, String farmName, String ownerName, String ownerEmail, String serviceStatus,
        Instant currentStart, Instant currentEnd, Instant confirmedUntil, List<String> paymentCodes) {}

    public record PurchasedPeriod(Long paymentId, String paymentCode, String receiptCode, Integer termYears, Instant start, Instant end, Instant confirmedAt) {}

    public record SubscriptionDetail(SubscriptionRow summary, Long subscriptionId, boolean suspended, Instant renewalOpens,
        PurchasedPeriod latestPurchase, List<PurchasedPeriod> periods, String emptyMessage) {}

    public record PaymentTiles(long pendingRequests, long evidenceToReview, long hold, long lockedForReturn) {}

    public record ReceiptRow(Long paymentId, String receiptCode, String paymentCode, Long farmId, String farmName, Integer termYears,
        BigDecimal amount, Instant bankPaidAt) {}

    public record ReceiptPage(long receiptsInPeriod, BigDecimal totalAmount, List<ReceiptRow> items, long total, int page, int size) {}

    public record ReceiptDetail(ReceiptRow receipt, String paymentState, Long priceVersionId, Instant confirmedAt, String confirmationSource,
        String confirmedByPm, Instant purchasedStart, Instant purchasedEnd, Long evidenceId, String maskedTransactionId) {}
}
