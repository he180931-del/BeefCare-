package vn.edu.fpt.beefcare.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Header;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Issue;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Resolved;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Result;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Severity;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Whole-voucher validation shared by the pre-save checks and by posting (UC-FE06-01 steps 5 and 8): header rules,
 * every line, and the receiving pens' capacity aggregated over all lines of the voucher.
 */
@Component
public class EntryVoucherRules {

    public record Validation(List<Resolved> lines, List<Issue> issues, Map<Long, Integer> incomingByPen) {
        public boolean hasErrors() {
            return issues.stream().anyMatch(i -> i.severity() == Severity.ERROR);
        }

        public Issue firstError() {
            return issues.stream().filter(i -> i.severity() == Severity.ERROR).findFirst().orElse(null);
        }
    }

    private final EntryLineValidator lineValidator;
    private final PenRepository penRepository;
    private final FarmClock clock;

    public EntryVoucherRules(EntryLineValidator lineValidator, PenRepository penRepository, FarmClock clock) {
        this.lineValidator = lineValidator;
        this.penRepository = penRepository;
        this.clock = clock;
    }

    static EntryLineRequest dataOf(HerdEntry line) {
        EntryLineRequest data = JsonSupport.fromJson(line.getDraftData(), EntryLineRequest.class);
        return data == null ? new EntryLineRequest(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null) : data;
    }

    /** Full validation of a DRAFT voucher with its lines (capacity is not checked here; see {@link #capacityIssues}). */
    @Transactional(readOnly = true)
    public Validation validate(HerdEntryVoucher v, List<HerdEntry> lines) {
        List<Issue> issues = new ArrayList<>();
        Long farmId = v.getFarm().getId();
        boolean purchase = v.getEntryType() == EntryType.PURCHASE;

        if (v.getEntryDate() == null || v.getEntryDate().isAfter(clock.today())) {
            issues.add(EntryLineValidator.error(0, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_03, "entryDate"));
        }
        if (lines.isEmpty()) {
            issues.add(EntryLineValidator.error(0, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_16, "lines"));
        }
        TradingPartner seller = v.getSeller();
        if (purchase) {
            if (seller == null) {
                issues.add(EntryLineValidator.error(0, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "sellerId", "field", "seller"));
            } else if (seller.getStatus() != ActiveStatus.ACTIVE || !seller.isSeller()) {
                issues.add(EntryLineValidator.error(0, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "sellerId", "field", "seller"));
            }
            if (v.getQuarantineCertNo() == null || v.getQuarantineCertNo().isBlank()) {
                issues.add(EntryLineValidator.warning(0, MessageCodes.FE06_24, "quarantineCertNo"));
            }
        } else if (seller != null || v.getCattleAmount() != 0 || v.getTransportFee() != 0 || v.getAmountPaid() != 0) {
            issues.add(EntryLineValidator.error(0, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_10, "amounts", "field", "amounts"));
        }

        PricingBasis pricing = v.getPricingBasis() == null ? PricingBasis.PER_KG : v.getPricingBasis();
        Header header = new Header(farmId, v.getEntryType(), v.getEntryDate(), pricing);
        Set<String> tags = new HashSet<>();
        List<Resolved> resolved = new ArrayList<>();
        Map<Long, Integer> incoming = new TreeMap<>();
        for (HerdEntry line : lines) {
            Result r = lineValidator.validate(header, line.getLineNo(), dataOf(line), tags, true);
            issues.addAll(r.issues());
            resolved.add(r.resolved());
            if (r.resolved().pen() != null) {
                incoming.merge(r.resolved().pen().getId(), 1, Integer::sum);
            }
        }

        if (purchase) {
            long cattleAmount = resolved.stream().mapToLong(Resolved::lineAmount).sum();
            long total = MoneyCalculator.totalPayable(cattleAmount, v.getTransportFee());
            if (v.getAmountPaid() > total) {
                issues.add(EntryLineValidator.error(0, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_13, "amountPaid", "amount", total));
            }
            if (v.getAmountPaid() > 0 && v.getPaymentMethod() == null) {
                issues.add(EntryLineValidator.error(0, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "paymentMethod", "field", "paymentMethod"));
            }
        }
        return new Validation(resolved, issues, incoming);
    }

    /** Non-locking capacity view for the checks panel: errors when a pen is inactive or too small, warnings when it becomes full. */
    @Transactional(readOnly = true)
    public CapacityView capacityIssues(Long farmId, Map<Long, Integer> incomingByPen, PenOccupancyService occupancy) {
        List<Issue> issues = new ArrayList<>();
        List<PenOccupancyService.Occupancy> view = occupancy.preview(farmId, incomingByPen);
        for (PenOccupancyService.Occupancy o : view) {
            Pen pen = penRepository.findByIdAndFarmId(o.penId(), farmId).orElse(null);
            int incoming = o.after() - o.before();
            int free = Math.max(0, o.capacity() - o.before());
            if (pen == null || pen.getStatus() != ActiveStatus.ACTIVE || incoming > free) {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("pen_code", o.penCode());
                params.put("count", incoming);
                params.put("free", pen != null && pen.getStatus() == ActiveStatus.ACTIVE ? free : 0);
                issues.add(new Issue(0, Severity.ERROR, MessageCodes.FE04_05, "penId", params, HttpStatus.UNPROCESSABLE_ENTITY));
            } else if (o.willBeFull()) {
                issues.add(EntryLineValidator.warning(0, MessageCodes.FE06_17, "penId", "pen", o.penCode(), "count", o.after(), "capacity", o.capacity()));
            }
        }
        return new CapacityView(view, issues);
    }

    public record CapacityView(List<PenOccupancyService.Occupancy> occupancy, List<Issue> issues) {}
}
