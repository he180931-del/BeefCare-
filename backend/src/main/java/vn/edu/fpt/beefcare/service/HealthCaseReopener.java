package vn.edu.fpt.beefcare.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.HealthCase;

/**
 * Mở lại ca sức khỏe đã đóng (D58), dùng chung cho FE-10 (nút "Mở lại ca") và FE-13 (bác phiếu chết / mất chờ xác nhận).
 *
 * <p>Ca về trạng thái Đang mở; kết quả, ngày đóng, lúc đóng, người xác nhận và ngày theo dõi dài hạn được xóa. Giá trị
 * trước / sau cùng lý do được lưu thành một bản ghi lịch sử (BR-D15) trong cùng giao dịch với thay đổi.
 * Ca đóng do xuất đàn ({@code CLOSED_BY_EXIT}) không bao giờ mở lại.</p>
 */
@Service
public class HealthCaseReopener {

    /** Kết quả cho phép mở lại; {@code CLOSED_BY_EXIT} cố định theo R-10-13. */
    static final Set<String> REOPENABLE_OUTCOMES = Set.of("RECOVERED", "DIED", "MISSING");

    private final RecordRevisionService revisions;
    private final AuditService audit;

    public HealthCaseReopener(RecordRevisionService revisions, AuditService audit) {
        this.revisions = revisions;
        this.audit = audit;
    }

    /**
     * Kiểm ca có mở lại được không.
     *
     * @param healthCase ca cần kiểm
     * @throws DomainException MSG-COM-05 khi ca chưa đóng hoặc đóng do xuất đàn
     */
    public void assertReopenable(HealthCase healthCase) {
        if (!"CLOSED".equals(upper(healthCase.getStatus()))) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "case_not_closed");
        }
        if (!REOPENABLE_OUTCOMES.contains(upper(healthCase.getOutcome()))) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "case_closed_by_exit");
        }
    }

    /**
     * Đưa ca đã đóng về Đang mở và lưu lịch sử thay đổi.
     *
     * @param ctx        người thực hiện và trại
     * @param healthCase ca đã đóng với kết quả Khỏi / Chết / Mất tích
     * @param reason     lý do mở lại (bắt buộc, tối đa 500 ký tự)
     * @param source     nơi gọi, ghi vào nhật ký: {@code HEALTH_CASE} hoặc {@code EXIT_DISMISS}
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void reopen(FarmContext ctx, HealthCase healthCase, String reason, String source) {
        assertReopenable(healthCase);
        Map<String, Object> before = snapshot(healthCase);
        healthCase.setStatus("OPEN");
        healthCase.setOutcome(null);
        healthCase.setClosedDate(null);
        healthCase.setClosedAt(null);
        healthCase.setClosedBy(null);
        healthCase.setChronicSince(null);
        revisions.record(ctx, "HealthCase", healthCase.getId(), RecordRevisionService.REOPEN, reason, before, snapshot(healthCase));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("caseCode", healthCase.getCaseCode());
        details.put("outcomeBefore", before.get("outcome"));
        details.put("source", source);
        audit.log(ctx, "HEALTH_CASE_REOPEN", "HealthCase", healthCase.getId(), details);
    }

    private static Map<String, Object> snapshot(HealthCase c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", c.getStatus());
        m.put("outcome", c.getOutcome());
        m.put("closedDate", c.getClosedDate());
        m.put("closedAt", c.getClosedAt());
        m.put("closedBy", c.getClosedBy() == null ? null : c.getClosedBy().getFullName());
        m.put("chronicSince", c.getChronicSince());
        return m;
    }

    private static String upper(String text) {
        return text == null ? "" : text.trim().toUpperCase(Locale.ROOT);
    }
}
