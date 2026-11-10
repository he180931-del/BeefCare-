package vn.edu.fpt.beefcare.service.payment;

import jakarta.persistence.EntityManager;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.HashMap;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.FarmServiceFacts;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccessService;

/**
 * PM read models without farm operational data: SCR-61 Platform Subscriptions (UC-FE19-04) and SCR-70 Subscription
 * Receipts (UC-FE21-01). A receipt is the read-only view of one PAID payment (GBR-82);
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
    private final FarmServiceFacts facts;

    public PlatformSubscriptionQueryService(EntityManager em, PlatformAccessService platformAccess, FarmClock clock, FarmServiceFacts facts) {
        this.em = em;
        this.platformAccess = platformAccess;
        this.clock = clock;
        this.facts = facts;
    }

    // ------------------------------------------------------------------ SCR-61

    public Page<SubscriptionRow> subscriptions(String q, String coverage, String serviceStatus, LocalDate endFrom, LocalDate endTo, int page, int size) {
        return subscriptions(q, coverage, serviceStatus, endFrom, endTo, "confirmedUntil", "desc", page, size);
    }

    /** D17: filter/count/sort in storage before paging; derive service at one captured read time. */
    public Page<SubscriptionRow> subscriptions(String q, String coverage, String serviceStatus, LocalDate endFrom, LocalDate endTo,
        String sort, String dir, int page, int size) {
        platformAccess.requireRole(PlatformRole.PM);
        String search = q == null ? "" : q.trim();
        if (search.length() > 100) throw DomainException.invalid("q");
        String cov = coverage == null || coverage.isBlank() ? "ALL" : coverage.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "CURRENT", "FUTURE_ONLY", "NONE").contains(cov)) throw DomainException.invalid("coverage");
        String state = serviceStatus == null || serviceStatus.isBlank() ? null : serviceStatus.trim().toUpperCase(Locale.ROOT);
        if (state != null && !List.of("ACTIVE", "PENDING_PAYMENT", "EXPIRED", "SUSPENDED").contains(state)) throw DomainException.invalid("serviceStatus");
        if (endFrom != null && endTo != null && endFrom.isAfter(endTo)) throw DomainException.badRequest(MessageCodes.COM_11, "field", "endTo");
        if (!"confirmedUntil".equals(sort)) throw DomainException.invalid("sort");
        if (!List.of("asc", "desc").contains(dir)) throw DomainException.invalid("dir");
        if (size < 1 || size > MAX_PAGE_SIZE) throw DomainException.invalid("size");
        if (page < 0 || page > Integer.MAX_VALUE / size) throw DomainException.invalid("page");
        Instant now = clock.now();
        String paid = " from Payment p where p.subscription.farm.id=f.id and upper(p.state)='PAID' and p.purchasedStart is not null and p.purchasedEnd is not null";
        String current = "exists (select p.id" + paid + " and p.purchasedStart<=:now and p.purchasedEnd>:now)";
        String future = "exists (select p.id" + paid + " and p.purchasedStart>:now)";
        String latestEnd = "(select max(p.purchasedEnd)" + paid + ")";
        List<String> filters = new ArrayList<>();
        Map<String, Object> parameters = new HashMap<>();
        if (!search.isEmpty()) {
            parameters.put("q", "%" + search.toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
            filters.add("(lower(f.name) like :q escape '!' or exists (select p.id" + paid + " and lower(p.quoteRef) like :q escape '!'))");
        }
        switch (cov) {
            case "CURRENT" -> filters.add(current);
            case "FUTURE_ONLY" -> filters.add("not " + current + " and " + future);
            case "NONE" -> filters.add("not " + current + " and not " + future);
            default -> { }
        }
        if (state != null) {
            filters.add("(case when upper(f.serviceStatus)='SUSPENDED' then 'SUSPENDED' when " + current
                + " then 'ACTIVE' when exists (select p.id" + paid + ") then 'EXPIRED' else 'PENDING_PAYMENT' end)=:state");
            parameters.put("state", state);
        }
        // end is exclusive: its last covered day belongs to [from,to] iff end > from00 and end <= (to+1)00.
        if (endFrom != null) { filters.add(latestEnd + ">:endFrom"); parameters.put("endFrom", endFrom.atStartOfDay(BUSINESS_ZONE).toInstant()); }
        if (endTo != null) { filters.add(latestEnd + "<=:endTo"); parameters.put("endTo", endTo.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant()); }
        String where = filters.isEmpty() ? "" : " where " + String.join(" and ", filters);
        if (where.contains(":now")) parameters.put("now", now);
        var count = em.createQuery("select count(f) from Farm f" + where, Long.class);
        parameters.forEach(count::setParameter);
        long total = count.getSingleResult();
        var query = em.createQuery("select f from Farm f" + where + " order by case when " + latestEnd
            + " is null then 1 else 0 end, " + latestEnd + " " + dir + ", f.id asc", Farm.class);
        parameters.forEach(query::setParameter);
        List<Farm> farms = query.setFirstResult(page * size).setMaxResults(size).getResultList();
        List<Long> ids = farms.stream().map(Farm::getId).toList();
        Map<Long, List<Payment>> paidByFarm = paidForFarms(ids).stream().collect(Collectors.groupingBy(p -> p.getSubscription().getFarm().getId()));
        Map<Long, AppUser> owners = facts.owners(ids);
        return new Page<>(farms.stream().map(f -> row(f, paidByFarm.getOrDefault(f.getId(), List.of()), owners.get(f.getId()), now)).toList(), total, page, size);
    }

    public SubscriptionDetail subscription(Long farmId) {
        platformAccess.requireRole(PlatformRole.PM);
        Farm farm = em.find(Farm.class, farmId);
        if (farm == null) throw DomainException.notFound(MessageCodes.COM_08, "farm_id", farmId);
        Instant now = clock.now();
        List<Payment> paid = paidForFarms(List.of(farmId));
        Long subscriptionId = em.createQuery("select s.id from Subscription s where s.farm.id = :farm", Long.class)
            .setParameter("farm", farmId).getResultStream().findFirst().orElse(null);
        SubscriptionRow row = row(farm, paid, facts.owners(List.of(farmId)).get(farmId), now);
        List<PurchasedPeriod> periods = paid.stream()
            .sorted(Comparator.comparing(Payment::getPurchasedStart).reversed())
            .map(p -> new PurchasedPeriod(p.getId(), p.getQuoteRef(), p.getReceiptCode(), p.getDurationYears(), p.getPurchasedStart(), p.getPurchasedEnd(),
                p.getConfirmedAt(), periodStatus(p, now)))
            .toList();
        PurchasedPeriod latest = periods.stream().sorted(Comparator.comparing(PurchasedPeriod::confirmedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(PurchasedPeriod::paymentId, Comparator.reverseOrder())).findFirst().orElse(null);
        Instant renewalOpens = row.confirmedUntil() == null ? null : row.confirmedUntil().atZone(BUSINESS_ZONE).minusDays(90).toInstant();
        boolean suspended = "SUSPENDED".equals(row.serviceStatus());
        FarmServiceFacts.Suspension suspension = suspended ? facts.lastSuspension(List.of(farmId)).get(farmId) : null;
        String emptyMessage = !periods.isEmpty() ? null : subscriptionId == null
            ? "No subscription yet: no period or end date." : "Subscription exists: no purchased period yet.";
        return new SubscriptionDetail(row, subscriptionId, suspended, suspension == null ? null : suspension.at(), renewalOpens, latest, periods, emptyMessage);
    }

    /** Same [start,end) rule and read clock as the summary (D17), so the UI never mixes server and browser time. */
    private static String periodStatus(Payment p, Instant now) {
        return !p.getPurchasedEnd().isAfter(now) ? "PAST" : p.getPurchasedStart().isAfter(now) ? "FUTURE" : "CURRENT";
    }

    private List<Payment> paidForFarms(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        return em.createQuery("select p from Payment p join fetch p.subscription s join fetch s.farm where s.farm.id in :ids "
            + "and upper(p.state)='PAID' and p.purchasedStart is not null and p.purchasedEnd is not null", Payment.class)
            .setParameter("ids", ids).getResultList();
    }

    private SubscriptionRow row(Farm farm, List<Payment> paid, AppUser owner, Instant now) {
        Payment current = paid.stream()
            .filter(p -> !p.getPurchasedStart().isAfter(now) && p.getPurchasedEnd().isAfter(now))
            .max(Comparator.comparing(Payment::getPurchasedEnd)).orElse(null);
        Instant confirmedUntil = paid.stream().map(Payment::getPurchasedEnd).max(Comparator.naturalOrder()).orElse(null);
        String status = "SUSPENDED".equalsIgnoreCase(farm.getServiceStatus()) ? "SUSPENDED" : current != null ? "ACTIVE" : paid.isEmpty() ? "PENDING_PAYMENT" : "EXPIRED";
        return new SubscriptionRow(
            farm.getId(), farm.getName(),
            owner == null ? null : owner.getFullName(), owner == null ? null : owner.getEmail(), status,
            current == null ? null : current.getPurchasedStart(), current == null ? null : current.getPurchasedEnd(),
            confirmedUntil, paid.stream().map(Payment::getQuoteRef).filter(Objects::nonNull).toList()
        );
    }

    // SCR-62 reads (UC-FE19-05, D18) live in PlatformPaymentQueryService; only the shared PaymentTiles/Page records stay here.

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

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record SubscriptionRow(Long farmId, String farmName, @Schema(nullable = true) String ownerName, @Schema(nullable = true) String ownerEmail, String serviceStatus,
        @Schema(nullable = true) Instant currentStart, @Schema(nullable = true) Instant currentEnd, @Schema(nullable = true) Instant confirmedUntil, List<String> paymentCodes) {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record PurchasedPeriod(Long paymentId, String paymentCode, @Schema(nullable = true) String receiptCode, Integer termYears, Instant start, Instant end,
        @Schema(nullable = true) Instant confirmedAt, @Schema(allowableValues = {"CURRENT", "FUTURE", "PAST"}) String status) {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record SubscriptionDetail(SubscriptionRow summary, @Schema(nullable = true) Long subscriptionId, boolean suspended, @Schema(nullable = true) Instant suspendedSince,
        @Schema(nullable = true) Instant renewalOpens, @Schema(nullable = true) PurchasedPeriod latestPurchase, List<PurchasedPeriod> periods, @Schema(nullable = true) String emptyMessage) {}

    public record PaymentTiles(long pendingRequests, long evidenceToReview, long hold, long lockedForReturn) {}

    public record ReceiptRow(Long paymentId, String receiptCode, String paymentCode, Long farmId, String farmName, Integer termYears,
        BigDecimal amount, Instant bankPaidAt) {}

    public record ReceiptPage(long receiptsInPeriod, BigDecimal totalAmount, List<ReceiptRow> items, long total, int page, int size) {}

    public record ReceiptDetail(ReceiptRow receipt, String paymentState, Long priceVersionId, Instant confirmedAt, String confirmationSource,
        String confirmedByPm, Instant purchasedStart, Instant purchasedEnd, Long evidenceId, String maskedTransactionId) {}
}
