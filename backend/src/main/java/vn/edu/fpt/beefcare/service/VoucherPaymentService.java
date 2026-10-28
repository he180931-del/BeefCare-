package vn.edu.fpt.beefcare.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.HerdExitVoucherRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.PaymentResultDTO;
import vn.edu.fpt.beefcare.service.dto.PaymentSummaryDTO;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoucherPaymentDTO;

/**
 * Payments to a seller (entry voucher, PAY) and collections from a buyer (exit voucher, COLLECT): GBR-91, BR-D39.
 * A payment is never edited; a wrong one is voided with a reason and recorded again. The voucher row is locked while
 * the outstanding amount is computed, so two concurrent payments cannot together exceed the total.
 */
@Service
public class VoucherPaymentService {

    private final FarmAccessService access;
    private final FarmClock clock;
    private final HerdEntryVoucherRepository entryRepository;
    private final HerdExitVoucherRepository exitRepository;
    private final VoucherPaymentRepository paymentRepository;
    private final AuditService audit;
    private final RecordRevisionService revisions;

    public VoucherPaymentService(
        FarmAccessService access,
        FarmClock clock,
        HerdEntryVoucherRepository entryRepository,
        HerdExitVoucherRepository exitRepository,
        VoucherPaymentRepository paymentRepository,
        AuditService audit,
        RecordRevisionService revisions
    ) {
        this.access = access;
        this.clock = clock;
        this.entryRepository = entryRepository;
        this.exitRepository = exitRepository;
        this.paymentRepository = paymentRepository;
        this.audit = audit;
        this.revisions = revisions;
    }

    /** Voucher-independent view of what a payment needs to know. */
    private record Target(VoucherKind kind, Long id, String code, LocalDate date, long total, Integer version, HerdEntryVoucher entry, HerdExitVoucher exit) {
        long sumRecorded(VoucherPaymentRepository repo) {
            return kind == VoucherKind.ENTRY ? repo.sumByEntryVoucher(id, PaymentRecordStatus.RECORDED) : repo.sumByExitVoucher(id, PaymentRecordStatus.RECORDED);
        }
    }

    // ------------------------------------------------------------------ REST-facing commands

    /** POST /api/farms/{farmId}/vouchers/{type}/{id}/payments: PAY = Owner or Manager, COLLECT = Owner. */
    @Transactional
    public PaymentResultDTO record(Long farmId, VoucherKind kind, Long voucherId, RecordPaymentRequest req) {
        FarmContext ctx = access.require(farmId, kind == VoucherKind.ENTRY ? FarmAction.RECORD_ENTRY_PAYMENT : FarmAction.RECORD_EXIT_COLLECTION);
        Target target = lockTarget(farmId, kind, voucherId);
        boolean open = kind == VoucherKind.ENTRY
            ? target.entry().getStatus() == EntryVoucherStatus.POSTED
            : target.exit().getStatus() == ExitVoucherStatus.CONFIRMED;
        if (!open) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        VersionGuard.check(target.version(), req.voucherVersion());
        VoucherPayment payment = apply(ctx, target, req.amount(), req.paymentDate(), req.method(), req.reference(), req.note());
        return PaymentResultDTO.of(VoucherPaymentDTO.from(payment), summaryOf(target));
    }

    /** POST /api/farms/{farmId}/payments/{paymentId}/void */
    @Transactional
    public PaymentResultDTO voidPayment(Long farmId, Long paymentId, VoidPaymentRequest req) {
        VoucherPayment found = paymentRepository.findByIdAndFarmId(paymentId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        VoucherKind kind = found.getEntryVoucher() != null ? VoucherKind.ENTRY : VoucherKind.EXIT;
        FarmContext ctx = access.require(farmId, kind == VoucherKind.ENTRY ? FarmAction.RECORD_ENTRY_PAYMENT : FarmAction.RECORD_EXIT_COLLECTION);
        Target target = lockTarget(farmId, kind, kind == VoucherKind.ENTRY ? found.getEntryVoucher().getId() : found.getExitVoucher().getId());
        VoucherPayment payment = paymentRepository.findByIdAndFarmId(paymentId, farmId).orElseThrow();
        VersionGuard.check(payment.getVersion(), req.version());
        if (payment.getStatus() != PaymentRecordStatus.RECORDED) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        boolean open = kind == VoucherKind.ENTRY
            ? target.entry().getStatus() == EntryVoucherStatus.POSTED
            : target.exit().getStatus() == ExitVoucherStatus.CONFIRMED;
        if (!open) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        if (req.reason() == null || req.reason().isBlank()) {
            throw DomainException.required("reason");
        }
        Map<String, Object> before = snapshot(payment);
        payment.setStatus(PaymentRecordStatus.VOIDED);
        payment.setVoidReason(req.reason().trim());
        payment.setVoidedBy(ctx.user());
        payment.setVoidedAt(clock.now());
        paymentRepository.saveAndFlush(payment);
        syncPaid(target);
        revisions.record(ctx, "VoucherPayment", payment.getId(), RecordRevisionService.VOID, req.reason(), before, snapshot(payment));
        audit.log(ctx, "PAYMENT_VOID", "VoucherPayment", payment.getId(), Map.of("voucher", target.code(), "amount", payment.getAmount()));
        return PaymentResultDTO.of(VoucherPaymentDTO.from(payment), summaryOf(target));
    }

    /** GET /api/farms/{farmId}/vouchers/{type}/{id}/payments */
    @Transactional(readOnly = true)
    public PaymentResultDTO list(Long farmId, VoucherKind kind, Long voucherId) {
        access.require(farmId, kind == VoucherKind.ENTRY ? FarmAction.VIEW_ENTRY_VOUCHERS : FarmAction.VIEW_EXIT_VOUCHERS);
        Target target = loadTarget(farmId, kind, voucherId);
        List<VoucherPayment> payments = kind == VoucherKind.ENTRY
            ? paymentRepository.findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(voucherId)
            : paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(voucherId);
        return PaymentResultDTO.list(payments.stream().map(VoucherPaymentDTO::from).toList(), summaryOf(target));
    }

    @Transactional(readOnly = true)
    public PaymentSummaryDTO summary(Long farmId, VoucherKind kind, Long voucherId) {
        access.require(farmId, kind == VoucherKind.ENTRY ? FarmAction.VIEW_ENTRY_VOUCHERS : FarmAction.VIEW_EXIT_VOUCHERS);
        return summaryOf(loadTarget(farmId, kind, voucherId));
    }

    // ------------------------------------------------------------------ internal use by post / confirm

    /**
     * The initial payment of an entry voucher, recorded inside the post transaction (the voucher is being set to
     * POSTED by the caller). Role and voucher state are the caller's business; amount rules (BR-D39) still apply.
     * A zero amount records nothing and returns null.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public VoucherPayment recordInitialPayment(FarmContext ctx, HerdEntryVoucher voucher, long amount, PaymentMethod method, String reference) {
        if (amount == 0L) {
            return null;
        }
        Target target = lockTarget(voucher.getFarm().getId(), VoucherKind.ENTRY, voucher.getId());
        return apply(ctx, target, amount, voucher.getEntryDate(), method, reference, null);
    }

    /** The deposit collected on an exit voucher, recorded inside the confirm transaction (COLLECT). */
    @Transactional(propagation = Propagation.MANDATORY)
    public VoucherPayment recordInitialCollection(FarmContext ctx, HerdExitVoucher voucher, long amount, PaymentMethod method, String reference) {
        if (amount == 0L) {
            return null;
        }
        Target target = lockTarget(voucher.getFarm().getId(), VoucherKind.EXIT, voucher.getId());
        return apply(ctx, target, amount, voucher.getExitDate(), method, reference, null);
    }

    // ------------------------------------------------------------------ rules

    private VoucherPayment apply(
        FarmContext ctx,
        Target target,
        Long amount,
        LocalDate date,
        PaymentMethod method,
        String reference,
        String note
    ) {
        if (amount == null) {
            throw DomainException.required("amount");
        }
        if (amount <= 0) {
            throw DomainException.invalid("amount");
        }
        if (method == null) {
            throw DomainException.required("method");
        }
        if (date == null) {
            throw DomainException.required("paymentDate");
        }
        clock.assertNotFuture(date);
        if (date.isBefore(target.date())) {
            throw DomainException.unprocessable(MessageCodes.COM_15, "date", target.date());
        }
        if ((reference != null && reference.length() > 100) || (note != null && note.length() > 500)) {
            throw DomainException.invalid(reference != null && reference.length() > 100 ? "reference" : "note");
        }
        long paid = target.sumRecorded(paymentRepository);
        long outstanding = MoneyCalculator.outstanding(target.total(), paid);
        if (amount > outstanding) {
            throw DomainException.unprocessable(MessageCodes.FE06_13, "amount", outstanding);
        }
        VoucherPayment p = new VoucherPayment();
        p.setFarm(ctx.farm());
        if (target.kind() == VoucherKind.ENTRY) {
            p.setEntryVoucher(target.entry());
            p.setDirection(PaymentDirection.PAY);
        } else {
            p.setExitVoucher(target.exit());
            p.setDirection(PaymentDirection.COLLECT);
        }
        p.setPaymentDate(date);
        p.setAmount(amount);
        p.setMethod(method);
        p.setReference(blankToNull(reference));
        p.setNote(blankToNull(note));
        p.setStatus(PaymentRecordStatus.RECORDED);
        p.setRecordedBy(ctx.user());
        p.setRecordedAt(clock.now());
        paymentRepository.saveAndFlush(p);
        syncPaid(target);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("voucher", target.code());
        details.put("direction", p.getDirection());
        details.put("amount", amount);
        audit.log(ctx, "PAYMENT_RECORD", "VoucherPayment", p.getId(), details);
        return p;
    }

    /** Keeps the cached amount_paid / amount_collected equal to the sum of RECORDED payments. */
    private void syncPaid(Target target) {
        long paid = target.sumRecorded(paymentRepository);
        if (target.kind() == VoucherKind.ENTRY) {
            target.entry().setAmountPaid(paid);
            entryRepository.saveAndFlush(target.entry());
        } else {
            target.exit().setAmountCollected(paid);
            exitRepository.saveAndFlush(target.exit());
        }
    }

    private Target lockTarget(Long farmId, VoucherKind kind, Long voucherId) {
        if (kind == VoucherKind.ENTRY) {
            HerdEntryVoucher v = entryRepository.lockByIdAndFarmId(farmId, voucherId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
            return entryTarget(v);
        }
        HerdExitVoucher v = exitRepository.lockByIdAndFarmId(farmId, voucherId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        return exitTarget(v);
    }

    private Target loadTarget(Long farmId, VoucherKind kind, Long voucherId) {
        if (kind == VoucherKind.ENTRY) {
            return entryTarget(entryRepository.findByIdAndFarmId(voucherId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08)));
        }
        return exitTarget(exitRepository.findByIdAndFarmId(voucherId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08)));
    }

    private static Target entryTarget(HerdEntryVoucher v) {
        return new Target(VoucherKind.ENTRY, v.getId(), v.getCode(), v.getEntryDate(), v.getTotalPayable(), v.getVersion(), v, null);
    }

    private static Target exitTarget(HerdExitVoucher v) {
        return new Target(VoucherKind.EXIT, v.getId(), v.getCode(), v.getExitDate(), v.getTotalReceivable(), v.getVersion(), null, v);
    }

    private PaymentSummaryDTO summaryOf(Target t) {
        // re-read the version: syncPaid() may have bumped it
        Integer version = t.kind() == VoucherKind.ENTRY ? t.entry().getVersion() : t.exit().getVersion();
        long paid = t.sumRecorded(paymentRepository);
        return new PaymentSummaryDTO(
            t.kind().name(),
            t.id(),
            t.code(),
            t.total(),
            paid,
            MoneyCalculator.outstanding(t.total(), paid),
            MoneyCalculator.overpaid(t.total(), paid),
            MoneyCalculator.paymentState(t.total(), paid),
            version
        );
    }

    private static Map<String, Object> snapshot(VoucherPayment p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", p.getStatus());
        m.put("amount", p.getAmount());
        m.put("paymentDate", p.getPaymentDate());
        m.put("method", p.getMethod());
        m.put("voidReason", p.getVoidReason());
        return m;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
