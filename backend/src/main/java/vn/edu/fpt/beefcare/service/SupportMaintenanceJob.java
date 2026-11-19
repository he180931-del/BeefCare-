package vn.edu.fpt.beefcare.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SupportMaintenanceJob {
    private final SupportTicketCommandService support;
    private final InternalSupportRequestService internalRequests;
    public SupportMaintenanceJob(SupportTicketCommandService support, InternalSupportRequestService internalRequests) {
        this.support = support;
        this.internalRequests = internalRequests;
    }
    @Scheduled(fixedDelayString = "${beefcare.jobs.support-requeue-delay-ms:60000}", initialDelayString = "${beefcare.jobs.support-requeue-delay-ms:60000}")
    public void requeue() { support.requeueUnavailable(); }
    /** JOB-07 step 4, on the JOB-07 one-minute cadence. */
    @Scheduled(fixedDelayString = "${beefcare.jobs.support-requeue-delay-ms:60000}", initialDelayString = "${beefcare.jobs.support-requeue-delay-ms:60000}")
    public void remindOpenInternalRequests() { internalRequests.remindLongOpenRequests(); }
}
