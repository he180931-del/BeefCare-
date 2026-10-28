package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;

@Entity
@Table(name = "pen_assignment")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PenAssignment implements Serializable {

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
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pen_id")
    private Pen pen;

    @NotNull
    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date")
    private LocalDate toDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 30, nullable = false)
    private AssignmentSource source;

    @Size(max = 500)
    @Column(name = "reason", length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criteria_version_id")
    private PenCriteriaVersion criteriaVersion;

    @Column(name = "reception_check")
    private String receptionCheck;

    @Size(max = 500)
    @Column(name = "warning_reason", length = 500)
    private String warningReason;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "moved_by_id")
    private AppUser movedBy;

    @NotNull
    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

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

    public Pen getPen() {
        return pen;
    }

    public void setPen(Pen pen) {
        this.pen = pen;
    }

    public LocalDate getFromDate() {
        return fromDate;
    }

    public void setFromDate(LocalDate fromDate) {
        this.fromDate = fromDate;
    }

    public LocalDate getToDate() {
        return toDate;
    }

    public void setToDate(LocalDate toDate) {
        this.toDate = toDate;
    }

    public AssignmentSource getSource() {
        return source;
    }

    public void setSource(AssignmentSource source) {
        this.source = source;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public PenCriteriaVersion getCriteriaVersion() {
        return criteriaVersion;
    }

    public void setCriteriaVersion(PenCriteriaVersion criteriaVersion) {
        this.criteriaVersion = criteriaVersion;
    }

    public String getReceptionCheck() {
        return receptionCheck;
    }

    public void setReceptionCheck(String receptionCheck) {
        this.receptionCheck = receptionCheck;
    }

    public String getWarningReason() {
        return warningReason;
    }

    public void setWarningReason(String warningReason) {
        this.warningReason = warningReason;
    }

    public AppUser getMovedBy() {
        return movedBy;
    }

    public void setMovedBy(AppUser movedBy) {
        this.movedBy = movedBy;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PenAssignment)) {
            return false;
        }
        return getId() != null && getId().equals(((PenAssignment) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "PenAssignment{id=" + getId() + "}";
    }
}
