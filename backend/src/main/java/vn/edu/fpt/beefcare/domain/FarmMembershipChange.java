package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One change of a farm membership (UC-FE03-06 step 6, D30): append-only, written with the membership and its audit entry
 * in one transaction. The effective date is recorded as entered; permissions change from the member's next request.
 */
@Entity
@Table(name = "farm_membership_change")
public class FarmMembershipChange implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membership_id", nullable = false, updatable = false)
    private FarmMembership membership;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id", nullable = false, updatable = false)
    private Farm farm;

    @Column(name = "action", length = 30, nullable = false, updatable = false)
    private String action;

    @Column(name = "role_before", length = 30, nullable = false, updatable = false)
    private String roleBefore;

    @Column(name = "role_after", length = 30, nullable = false, updatable = false)
    private String roleAfter;

    @Column(name = "status_before", length = 30, nullable = false, updatable = false)
    private String statusBefore;

    @Column(name = "status_after", length = 30, nullable = false, updatable = false)
    private String statusAfter;

    @Column(name = "effective_date", nullable = false, updatable = false)
    private LocalDate effectiveDate;

    @Column(name = "reason", length = 500, nullable = false, updatable = false)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_id", nullable = false, updatable = false)
    private AppUser changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected FarmMembershipChange() {}

    public FarmMembershipChange(FarmMembership membership, String action, String roleBefore, String statusBefore, LocalDate effectiveDate,
        String reason, AppUser changedBy, Instant changedAt) {
        this.membership = membership;
        this.farm = membership.getFarm();
        this.action = action;
        this.roleBefore = roleBefore;
        this.roleAfter = membership.getRole();
        this.statusBefore = statusBefore;
        this.statusAfter = membership.getStatus();
        this.effectiveDate = effectiveDate;
        this.reason = reason;
        this.changedBy = changedBy;
        this.changedAt = changedAt;
    }

    public Long getId() { return id; }
    public FarmMembership getMembership() { return membership; }
    public Farm getFarm() { return farm; }
    public String getAction() { return action; }
    public String getRoleBefore() { return roleBefore; }
    public String getRoleAfter() { return roleAfter; }
    public String getStatusBefore() { return statusBefore; }
    public String getStatusAfter() { return statusAfter; }
    public LocalDate getEffectiveDate() { return effectiveDate; }
    public String getReason() { return reason; }
    public AppUser getChangedBy() { return changedBy; }
    public Instant getChangedAt() { return changedAt; }

    @Override
    public boolean equals(Object o) {
        return this == o || (o instanceof FarmMembershipChange other && id != null && id.equals(other.id));
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
