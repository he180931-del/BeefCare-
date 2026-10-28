package vn.edu.fpt.beefcare.service.payment;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.service.NotificationService;

/**
 * UC-FE14-04 / JOB-06 step 4: every ACTIVE Platform Manager is told about bank evidence that needs review. The notice is
 * deduplicated per evidence and carries only the transaction id, amount and reason, never the transfer content.
 */
@Service
public class ReconciliationNoticeService {

    private final PlatformStaffAccessRepository staff;
    private final NotificationService notifications;

    public ReconciliationNoticeService(PlatformStaffAccessRepository staff, NotificationService notifications) {
        this.staff = staff;
        this.notifications = notifications;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void evidenceNeedsReview(BankTransferEvidence evidence) {
        String reason = evidence.getReviewReason() == null ? "Cần đối soát thủ công" : evidence.getReviewReason();
        String summary = "Giao dịch " + evidence.getProviderTxnId() + " – " + evidence.getAmount() + " VND: " + reason;
        if (summary.length() > 500) summary = summary.substring(0, 500);
        String eventKey = "EVIDENCE_REVIEW:" + evidence.getId();
        for (var access : staff.findAllByRoleIgnoreCaseAndStatusIgnoreCaseOrderById("PM", "ACTIVE")) {
            notifications.notify(access.getUser(), "reconciliation", "BANK_TRANSFER_EVIDENCE", evidence.getId(),
                "Chứng từ ngân hàng cần đối soát", summary, eventKey);
        }
    }
}
