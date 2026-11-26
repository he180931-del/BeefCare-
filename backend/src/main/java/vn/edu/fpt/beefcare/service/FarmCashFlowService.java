package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.service.dto.FarmCashFlowDtos.CashFlowItem;
import vn.edu.fpt.beefcare.service.dto.FarmCashFlowDtos.FarmCashFlowView;

/** Read-only cash flow projection from the farm's recorded payments and linked subscription receipts. */
@Service
public class FarmCashFlowService {
    private static final List<String> SOURCES = List.of("HERD_EXIT", "HERD_ENTRY", "FEED_RECEIPT", "SUBSCRIPTION");
    private static final List<String> DIRECTIONS = List.of("IN", "OUT");

    private static final Comparator<CashFlowItem> ITEM_ORDER = Comparator
        .comparing(CashFlowItem::cashDate, Comparator.reverseOrder())
        .thenComparing(CashFlowItem::source)
        .thenComparing(CashFlowItem::documentId, Comparator.reverseOrder())
        .thenComparing(CashFlowItem::id, Comparator.reverseOrder());

    private final EntityManager em;
    private final FarmAccessService access;
    private final FarmClock clock;

    public FarmCashFlowService(EntityManager em, FarmAccessService access, FarmClock clock) {
        this.em = em;
        this.access = access;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public FarmCashFlowView cashFlow(Long farmId, LocalDate from, LocalDate to, String source, String direction, int page, int size) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_REPORTS);
        String selectedSource = normalize(source);
        String selectedDirection = normalize(direction);
        validate(from, to, selectedSource, selectedDirection, page, size);

        List<CashFlowItem> all = new ArrayList<>();
        if (!"SUBSCRIPTION".equals(selectedSource)) {
            all.addAll(voucherPayments(farmId, from, to, selectedSource));
        }
        if (context.role() == FarmRole.OWNER && (selectedSource == null || "SUBSCRIPTION".equals(selectedSource))) {
            all.addAll(subscriptionPayments(farmId, from, to));
        }

        if (selectedDirection != null) {
            all.removeIf(item -> !selectedDirection.equals(item.direction()));
        }
        all.sort(ITEM_ORDER);

        BigDecimal totalIncome = total(all, "IN");
        BigDecimal totalExpense = total(all, "OUT");
        long offset = (long) page * size;
        int start = (int) Math.min(offset, all.size());
        int end = Math.min(start + size, all.size());
        return new FarmCashFlowView(
            clock.now(),
            totalIncome,
            totalExpense,
            totalIncome.subtract(totalExpense),
            all.size(),
            all.subList(start, end)
        );
    }

    private void validate(LocalDate from, LocalDate to, String source, String direction, int page, int size) {
        if (from == null) throw DomainException.invalid("from");
        if (to == null) throw DomainException.invalid("to");
        if (from.isAfter(to)) throw DomainException.invalid("to");
        clock.assertNotFuture(to);
        if (from.plusMonths(24).isBefore(to)) throw DomainException.invalid("from");
        if (source != null && !SOURCES.contains(source)) throw DomainException.invalid("source");
        if (direction != null && !DIRECTIONS.contains(direction)) throw DomainException.invalid("direction");
        if (page < 0) throw DomainException.invalid("page");
        if (size < 1 || size > 100) throw DomainException.invalid("size");
    }

    private List<CashFlowItem> voucherPayments(Long farmId, LocalDate from, LocalDate to, String source) {
        String sourceClause = switch (source == null ? "" : source) {
            case "HERD_EXIT" -> " and p.exitVoucher is not null";
            case "HERD_ENTRY" -> " and p.entryVoucher is not null";
            case "FEED_RECEIPT" -> " and p.feedReceipt is not null";
            default -> "";
        };
        String jpql = """
            select p.id, p.direction, p.paymentDate, p.amount, p.method,
                   exitVoucher.id, exitVoucher.code, entryVoucher.id, entryVoucher.code,
                   feedReceipt.id, feedReceipt.code
              from VoucherPayment p
              left join p.exitVoucher exitVoucher
              left join p.entryVoucher entryVoucher
              left join p.feedReceipt feedReceipt
             where p.farm.id = :farmId
               and p.status = :recorded
               and p.amount >= 0
               and p.paymentDate between :from and :to
               and (
                    (p.exitVoucher is not null and p.direction = :collect and exitVoucher.farm.id = :farmId and exitVoucher.status <> :exitDraft)
                 or (p.entryVoucher is not null and p.direction = :pay and entryVoucher.farm.id = :farmId and entryVoucher.status <> :entryDraft)
                 or (p.feedReceipt is not null and p.direction = :pay and feedReceipt.farm.id = :farmId and upper(feedReceipt.status) <> 'DRAFT')
               )
            """ + sourceClause;

        TypedQuery<Object[]> query = em.createQuery(jpql, Object[].class)
            .setParameter("farmId", farmId)
            .setParameter("recorded", PaymentRecordStatus.RECORDED)
            .setParameter("from", from)
            .setParameter("to", to)
            .setParameter("collect", PaymentDirection.COLLECT)
            .setParameter("pay", PaymentDirection.PAY)
            .setParameter("exitDraft", ExitVoucherStatus.DRAFT)
            .setParameter("entryDraft", EntryVoucherStatus.DRAFT);

        List<CashFlowItem> items = new ArrayList<>();
        for (Object[] row : query.getResultList()) {
            CashFlowItem item = voucherItem(row);
            if (item != null) items.add(item);
        }
        return items;
    }

    private CashFlowItem voucherItem(Object[] row) {
        Long paymentId = number(row[0]);
        LocalDate cashDate = (LocalDate) row[2];
        BigDecimal amount = money(number(row[3]));
        String method = row[4] instanceof PaymentMethod value ? value.name() : null;
        if (row[5] != null) {
            return voucherItem("HERD_EXIT", "IN", paymentId, cashDate, amount, row[5], row[6], method);
        }
        if (row[7] != null) {
            return voucherItem("HERD_ENTRY", "OUT", paymentId, cashDate, amount, row[7], row[8], method);
        }
        if (row[9] != null) {
            return voucherItem("FEED_RECEIPT", "OUT", paymentId, cashDate, amount, row[9], row[10], method);
        }
        return null;
    }

    private CashFlowItem voucherItem(String source, String direction, Long paymentId, LocalDate cashDate, BigDecimal amount, Object documentId, Object documentCode, String method) {
        return new CashFlowItem(source + ":" + paymentId, source, direction, cashDate, amount, number(documentId), (String) documentCode, method);
    }

    private List<CashFlowItem> subscriptionPayments(Long farmId, LocalDate from, LocalDate to) {
        Instant bankFrom = from.atStartOfDay(clock.zone()).toInstant();
        Instant bankUntil = to.plusDays(1).atStartOfDay(clock.zone()).toInstant();
        String jpql = """
            select p.id, p.amountVnd, coalesce(p.receiptCode, p.quoteRef), e.bankPaidAt
              from Payment p, BankTransferEvidence e
             where e.payment.id = p.id
               and p.subscription.farm.id = :farmId
               and upper(p.state) = 'PAID'
               and p.purchasedStart is not null
               and p.amountVnd >= 0
               and e.id = (select min(e2.id) from BankTransferEvidence e2 where e2.payment.id = p.id)
               and e.bankPaidAt >= :bankFrom
               and e.bankPaidAt < :bankUntil
            """;

        TypedQuery<Object[]> query = em.createQuery(jpql, Object[].class)
            .setParameter("farmId", farmId)
            .setParameter("bankFrom", bankFrom)
            .setParameter("bankUntil", bankUntil);

        List<CashFlowItem> items = new ArrayList<>();
        for (Object[] row : query.getResultList()) {
            Long paymentId = number(row[0]);
            BigDecimal amount = money((BigDecimal) row[1]);
            String code = (String) row[2];
            LocalDate bankDate = clock.toFarmDate((Instant) row[3]);
            items.add(new CashFlowItem("SUBSCRIPTION:" + paymentId, "SUBSCRIPTION", "OUT", bankDate, amount, paymentId, code, "BANK_TRANSFER"));
        }
        return items;
    }

    private static BigDecimal total(List<CashFlowItem> items, String direction) {
        return items.stream()
            .filter(item -> direction.equals(item.direction()))
            .map(CashFlowItem::amountVnd)
            .reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }

    private static BigDecimal money(Long amount) {
        return BigDecimal.valueOf(amount).setScale(2);
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.UNNECESSARY);
    }

    private static Long number(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }
}
