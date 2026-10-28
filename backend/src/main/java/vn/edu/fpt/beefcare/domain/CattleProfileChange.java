package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.ProfileFieldGroup;

@Entity
@Table(name = "cattle_profile_change")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class CattleProfileChange implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id")
    private Farm farm;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cattle_id")
    private Cattle cattle;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "field_group", length = 30, nullable = false)
    private ProfileFieldGroup fieldGroup;

    @Column(name = "old_value")
    private String oldValue;

    @NotNull
    @Column(name = "new_value", nullable = false)
    private String newValue;

    @NotNull
    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @NotNull
    @Size(max = 500)
    @Column(name = "reason", length = 500, nullable = false)
    private String reason;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_id")
    private AppUser changedBy;

    @NotNull
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Farm getFarm() {
        return farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Cattle getCattle() {
        return cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public ProfileFieldGroup getFieldGroup() {
        return fieldGroup;
    }

    public void setFieldGroup(ProfileFieldGroup fieldGroup) {
        this.fieldGroup = fieldGroup;
    }

    public String getOldValue() {
        return oldValue;
    }

    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }

    public LocalDate getEffectiveDate() {
        return effectiveDate;
    }

    public void setEffectiveDate(LocalDate effectiveDate) {
        this.effectiveDate = effectiveDate;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public AppUser getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(AppUser changedBy) {
        this.changedBy = changedBy;
    }

    public Instant getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(Instant changedAt) {
        this.changedAt = changedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CattleProfileChange)) {
            return false;
        }
        return getId() != null && getId().equals(((CattleProfileChange) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "CattleProfileChange{id=" + getId() + "}";
    }
}
