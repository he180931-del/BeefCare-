package vn.edu.fpt.beefcare.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.function.Function;
import java.util.function.ToIntFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;

/**
 * JOB-08 (SRS 24.8): removes technical data that is no longer needed. Verification, reset and invitation link hashes
 * that expired more than 7 days ago are deleted (invitation records and statuses stay) and cash report snapshots past
 * their 30-day availability are deleted. Each batch of up to 5,000 rows commits on its own, so a failed batch is rolled
 * back and the rest is picked up by the next run; no business record is touched.
 */
@Component
public class DataRetentionJob {

    static final int BATCH_SIZE = 5_000;
    static final Duration LINK_GRACE = Duration.ofDays(7);
    private static final int MAX_BATCHES_PER_STEP = 200;
    private static final Logger LOG = LoggerFactory.getLogger(DataRetentionJob.class);

    private final AccountLinkTokenRepository accountLinks;
    private final FarmInvitationRepository invitations;
    private final CashReportSnapshotRepository snapshots;
    private final FarmClock clock;
    private final TransactionTemplate batch;

    public DataRetentionJob(
        AccountLinkTokenRepository accountLinks,
        FarmInvitationRepository invitations,
        CashReportSnapshotRepository snapshots,
        FarmClock clock,
        PlatformTransactionManager transactionManager
    ) {
        this.accountLinks = accountLinks;
        this.invitations = invitations;
        this.snapshots = snapshots;
        this.clock = clock;
        this.batch = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "${beefcare.jobs.retention-cron:0 0 2 * * *}", zone = "${beefcare.jobs.retention-zone:Asia/Ho_Chi_Minh}")
    public void purgeExpired() {
        Result result = purge();
        if (result.total() > 0) {
            LOG.info("JOB-08 removed {} account links, cleared {} invitation links and deleted {} cash report snapshots",
                result.accountLinks(), result.invitationLinks(), result.snapshots());
        }
    }

    /** One complete run; returns the counts it logged. */
    public Result purge() {
        Instant now = clock.now();
        Instant linkCutoff = now.minus(LINK_GRACE);
        int links = inBatches("account links", page -> accountLinks.findIdsExpiredBefore(linkCutoff, page), accountLinks::deleteByIdIn);
        int invitationLinks = inBatches("invitation links", page -> invitations.findIdsWithLinkExpiredBefore(linkCutoff, page), invitations::clearLinks);
        int reports = inBatches("cash report snapshots", page -> snapshots.findIdsExpiredAt(now, page), snapshots::deleteByIdIn);
        return new Result(links, invitationLinks, reports);
    }

    private int inBatches(String label, Function<Pageable, List<Long>> nextIds, ToIntFunction<List<Long>> apply) {
        int total = 0;
        for (int round = 0; round < MAX_BATCHES_PER_STEP; round++) {
            Integer done;
            try {
                done = batch.execute(status -> {
                    List<Long> ids = nextIds.apply(PageRequest.of(0, BATCH_SIZE));
                    return ids.isEmpty() ? 0 : apply.applyAsInt(ids);
                });
            } catch (RuntimeException failure) {
                LOG.error("JOB-08 batch of {} failed; it is retried at the next run", label, failure);
                return total;
            }
            if (done == null || done == 0) return total;
            total += done;
            if (done < BATCH_SIZE) return total;
        }
        return total;
    }

    public record Result(int accountLinks, int invitationLinks, int snapshots) {
        int total() {
            return accountLinks + invitationLinks + snapshots;
        }
    }
}
