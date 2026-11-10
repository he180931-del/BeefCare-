package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** JOB-06 intent, committed with its evidence. A lease can expire after a worker exits; evidence is never deleted. */
@Entity
@Table(name = "bank_evidence_job")
public class BankEvidenceJob {
    @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator") @SequenceGenerator(name = "sequenceGenerator")
    private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "evidence_id", nullable = false, unique = true)
    private BankTransferEvidence evidence;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "requested_by_id")
    private AppUser requestedBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "available_at", nullable = false) private Instant availableAt;
    @Column(name = "lease_until") private Instant leaseUntil;
    @Column(name = "first_failure_at") private Instant firstFailureAt;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "status", nullable = false, length = 20) private String status;
    @Column(name = "attempts", nullable = false) private int attempts;
    @Column(name = "last_error", length = 100) private String lastError;

    public Long getId() { return id; }
    public BankTransferEvidence getEvidence() { return evidence; }
    public void setEvidence(BankTransferEvidence value) { evidence = value; }
    public AppUser getRequestedBy() { return requestedBy; }
    public void setRequestedBy(AppUser value) { requestedBy = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant value) { createdAt = value; }
    public Instant getAvailableAt() { return availableAt; }
    public void setAvailableAt(Instant value) { availableAt = value; }
    public Instant getLeaseUntil() { return leaseUntil; }
    public void setLeaseUntil(Instant value) { leaseUntil = value; }
    public Instant getFirstFailureAt() { return firstFailureAt; }
    public void setFirstFailureAt(Instant value) { firstFailureAt = value; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant value) { completedAt = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int value) { attempts = value; }
    public String getLastError() { return lastError; }
    public void setLastError(String value) { lastError = value; }
}
