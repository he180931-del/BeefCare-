package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Issue;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.VoucherPaymentDTO;

/** Builds the response DTOs of entry vouchers (list row, detail with lines, payments and history). */
@Component
public class EntryVoucherMapper {

    @PersistenceContext
    private EntityManager em;

    private final HerdEntryRepository entryRepository;
    private final PenAssignmentRepository assignmentRepository;
    private final VoucherPaymentRepository paymentRepository;
    private final DomainMessages messages;

    public EntryVoucherMapper(
        HerdEntryRepository entryRepository,
        PenAssignmentRepository assignmentRepository,
        VoucherPaymentRepository paymentRepository,
        DomainMessages messages
    ) {
        this.entryRepository = entryRepository;
        this.assignmentRepository = assignmentRepository;
        this.paymentRepository = paymentRepository;
        this.messages = messages;
    }

    public EntryDtos.Notice notice(String code, Object... kv) {
        Map<String, Object> params = DomainException.params(kv);
        return new EntryDtos.Notice(code, params, messages.resolve(code, params));
    }

    public EntryDtos.Issue issue(Issue i) {
        String message = messages.resolve(i.code(), i.params());
        return new EntryDtos.Issue(i.lineNo() == null || i.lineNo() == 0 ? null : i.lineNo(), i.severity().name(), i.code(), i.field(), i.params(), message);
    }

    /** Lines counted as "the cattle of the voucher": every line of a DRAFT / VOIDED voucher, the VALID lines of a POSTED one. */
    static boolean counted(HerdEntryVoucher v, HerdEntry line) {
        return v.getStatus() != EntryVoucherStatus.POSTED || line.getStatus() == EntryLineStatus.VALID;
    }

    @Transactional(readOnly = true)
    public EntryDtos.Voucher voucher(HerdEntryVoucher v, boolean detail) {
        List<HerdEntry> lines = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId());
        List<EntryDtos.Line> lineDtos = detail ? lines.stream().map(l -> line(v, l, true)).toList() : List.of();
        List<VoucherPaymentDTO> payments = detail
            ? paymentRepository.findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(v.getId()).stream().map(VoucherPaymentDTO::from).toList()
            : List.of();
        return voucher(v, lines, lineDtos, payments, detail ? history(v, lines) : List.of());
    }

    private EntryDtos.Voucher voucher(
        HerdEntryVoucher v,
        List<HerdEntry> lines,
        List<EntryDtos.Line> lineDtos,
        List<VoucherPaymentDTO> payments,
        List<EntryDtos.HistoryItem> history
    ) {
        List<HerdEntry> counted = lines.stream().filter(l -> counted(v, l)).toList();
        BigDecimal weight = counted.stream().map(HerdEntry::getEntryWeightKg).filter(w -> w != null).reduce(BigDecimal.ZERO, BigDecimal::add);
        int estimated = (int) counted.stream().filter(l -> l.getEntryWeightKg() != null && l.getWeightBasis() == WeightBasis.ESTIMATED).count();
        long total = v.getTotalPayable();
        boolean money = v.getEntryType() == EntryType.PURCHASE;
        PaymentState state = money && v.getStatus() != EntryVoucherStatus.DRAFT ? MoneyCalculator.paymentState(total, v.getAmountPaid()) : null;
        TradingPartner seller = v.getSeller();
        return new EntryDtos.Voucher(
            v.getId(),
            v.getCode(),
            v.getEntryType(),
            v.getStatus(),
            v.getEntryDate(),
            seller == null ? null : seller.getId(),
            seller == null ? null : seller.getName(),
            seller == null ? null : seller.getContactPhone(),
            v.getQuarantineCertNo(),
            v.getVehiclePlate(),
            v.getNote(),
            v.getPricingBasis(),
            v.getCattleAmount(),
            v.getTransportFee(),
            total,
            v.getAmountPaid(),
            v.getOutstandingAmount(),
            MoneyCalculator.overpaid(total, v.getAmountPaid()),
            state,
            v.getPaymentMethod(),
            v.getPaymentDueDate(),
            name(v.getCreatedBy()),
            name(v.getPostedBy()),
            v.getPostedAt(),
            v.getVoidReason(),
            name(v.getVoidedBy()),
            v.getVoidedAt(),
            v.getCreatedAt(),
            v.getVersion(),
            counted.size(),
            weight,
            estimated,
            lineDtos,
            payments,
            history
        );
    }

    @Transactional(readOnly = true)
    public EntryDtos.Row row(HerdEntryVoucher v, List<HerdEntry> lines) {
        List<HerdEntry> counted = lines.stream().filter(l -> counted(v, l)).toList();
        BigDecimal weight = counted.stream().map(HerdEntry::getEntryWeightKg).filter(w -> w != null).reduce(BigDecimal.ZERO, BigDecimal::add);
        int estimated = (int) counted.stream().filter(l -> l.getEntryWeightKg() != null && l.getWeightBasis() == WeightBasis.ESTIMATED).count();
        boolean purchase = v.getEntryType() == EntryType.PURCHASE;
        List<String> dams = purchase
            ? List.of()
            : counted
                .stream()
                .map(l -> l.getCalfOutcome())
                .filter(c -> c != null && c.getCalving() != null && c.getCalving().getDam() != null)
                .map(c -> c.getCalving().getDam().getDisplayCode())
                .distinct()
                .toList();
        PaymentState state = purchase && v.getStatus() != EntryVoucherStatus.DRAFT ? MoneyCalculator.paymentState(v.getTotalPayable(), v.getAmountPaid()) : null;
        return new EntryDtos.Row(
            v.getId(),
            v.getCode(),
            v.getEntryDate(),
            v.getEntryType(),
            v.getStatus(),
            v.getSeller() == null ? null : v.getSeller().getName(),
            v.getQuarantineCertNo(),
            dams,
            counted.size(),
            estimated,
            weight,
            purchase ? v.getTotalPayable() : null,
            purchase ? v.getOutstandingAmount() : null,
            state,
            v.getVoidReason(),
            v.getVersion()
        );
    }

    @Transactional(readOnly = true)
    public EntryDtos.Line line(HerdEntryVoucher v, HerdEntry l, boolean withCurrent) {
        EntryLineRequest data = EntryVoucherRules.dataOf(l);
        Cattle cattle = l.getCattle();
        LocalDate birth = cattle != null ? cattle.getBirthDate() : data.birthDate();
        if (cattle == null && data.birthDate() == null && data.ageMonths() != null) {
            birth = l.getEntryDate().minusMonths(data.ageMonths()).withDayOfMonth(1);
        }
        Integer age = EntryLineValidator.ageMonths(birth, l.getEntryDate());
        String currentStatus = null;
        Long currentPenId = null;
        String currentPenCode = null;
        if (cattle != null && withCurrent) {
            currentStatus = cattle.getHerdStatus().name();
            PenAssignment open = assignmentRepository.findFirstByCattleIdAndToDateIsNull(cattle.getId()).orElse(null);
            if (open != null) {
                currentPenId = open.getPen().getId();
                currentPenCode = open.getPen().getCode();
            }
        }
        String earTag = cattle != null ? cattle.getEarTagNumber() : data.earTagNumber();
        String damCode = l.getCalfOutcome() != null && l.getCalfOutcome().getCalving() != null && l.getCalfOutcome().getCalving().getDam() != null
            ? l.getCalfOutcome().getCalving().getDam().getDisplayCode()
            : null;
        return new EntryDtos.Line(
            l.getId(),
            l.getLineNo(),
            l.getStatus(),
            cattle == null ? null : cattle.getId(),
            cattle == null ? null : cattle.getDisplayCode(),
            earTag,
            data,
            l.getEntryDate(),
            l.getEntryWeightKg(),
            l.getWeightBasis(),
            l.getEntryWeightKg() != null && l.getWeightBasis() == WeightBasis.ESTIMATED,
            l.getUnitPrice(),
            l.getLineAmount(),
            l.getInitialPen().getId(),
            l.getInitialPen().getCode(),
            l.getQuarantineUntil(),
            age,
            EntryLineValidator.proposeLifeStage(birth, l.getEntryDate()),
            l.isCorrected(),
            l.getCalfOutcome() == null ? null : l.getCalfOutcome().getId(),
            damCode,
            currentStatus,
            currentPenId,
            currentPenCode,
            l.getVersion()
        );
    }

    private List<EntryDtos.HistoryItem> history(HerdEntryVoucher v, List<HerdEntry> lines) {
        List<EntryDtos.HistoryItem> items = new ArrayList<>();
        List<Long> lineIds = lines.stream().map(HerdEntry::getId).toList();
        List<AuditLog> audits = em
            .createQuery(
                "select a from AuditLog a where (a.targetType = 'HerdEntryVoucher' and a.targetId = :vid) or (a.targetType = 'HerdEntry' and a.targetId in :lids) order by a.loggedAt, a.id",
                AuditLog.class
            )
            .setParameter("vid", v.getId())
            .setParameter("lids", lineIds.isEmpty() ? List.of(-1L) : lineIds)
            .getResultList();
        for (AuditLog a : audits) {
            items.add(new EntryDtos.HistoryItem(a.getLoggedAt(), a.getAction(), name(a.getActor()), a.getDetails() == null ? null : JsonSupport.fromJson(a.getDetails(), Object.class)));
        }
        for (VoucherPayment p : paymentRepository.findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(v.getId())) {
            items.add(new EntryDtos.HistoryItem(p.getRecordedAt(), "PAYMENT_RECORDED", name(p.getRecordedBy()), Map.of("amount", p.getAmount(), "date", String.valueOf(p.getPaymentDate()), "method", String.valueOf(p.getMethod()))));
            if (p.getVoidedAt() != null) {
                items.add(new EntryDtos.HistoryItem(p.getVoidedAt(), "PAYMENT_VOIDED", name(p.getVoidedBy()), Map.of("amount", p.getAmount(), "reason", String.valueOf(p.getVoidReason()))));
            }
        }
        items.sort(Comparator.comparing(EntryDtos.HistoryItem::at, Comparator.nullsLast(Comparator.naturalOrder())));
        return items;
    }

    private static String name(AppUser u) {
        return u == null ? null : u.getFullName();
    }
}
