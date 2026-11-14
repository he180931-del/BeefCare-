package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * One suspension or restoration of a user account (UC-FE03-08 step 5, D32): append-only, written with the account and its
 * audit entry in one transaction. The reason is kept here only; the central audit has the before / after status.
 */
@Entity
@Table(name = "app_user_status_change")
public class AppUserStatusChange implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "app_user_id", nullable = false, updatable = false)
    private AppUser account;

    @Column(name = "action", length = 30, nullable = false, updatable = false)
    private String action;

    @Column(name = "status_before", length = 30, nullable = false, updatable = false)
    private String statusBefore;

    @Column(name = "status_after", length = 30, nullable = false, updatable = false)
    private String statusAfter;

    @Column(name = "reason", length = 500, nullable = false, updatable = false)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_id", nullable = false, updatable = false)
    private AppUser changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected AppUserStatusChange() {}

    public AppUserStatusChange(AppUser account, String action, String statusBefore, String reason, AppUser changedBy, Instant changedAt) {
        this.account = account;
        this.action = action;
        this.statusBefore = statusBefore;
        this.statusAfter = account.getAccountStatus();
        this.reason = reason;
        this.changedBy = changedBy;
        this.changedAt = changedAt;
    }

    public Long getId() { return id; }
    public AppUser getAccount() { return account; }
    public String getAction() { return action; }
    public String getStatusBefore() { return statusBefore; }
    public String getStatusAfter() { return statusAfter; }
    public String getReason() { return reason; }
    public AppUser getChangedBy() { return changedBy; }
    public Instant getChangedAt() { return changedAt; }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof AppUserStatusChange other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
