package vn.edu.fpt.beefcare.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SupportMaintenanceJob {
    private final SupportTicketCommandService support;
    public SupportMaintenanceJob(SupportTicketCommandService support) { this.support = support; }
    @Scheduled(fixedDelayString = "${beefcare.jobs.support-requeue-delay-ms:60000}", initialDelayString = "${beefcare.jobs.support-requeue-delay-ms:60000}")
    public void requeue() { support.requeueUnavailable(); }
}
