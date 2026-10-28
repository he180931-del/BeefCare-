package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.Set;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;

@Entity
@Table(name = "pen_criteria_version", uniqueConstraints = {@UniqueConstraint(name = "uq_pen_criteria_version", columnNames = {"pen_id", "version_no"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PenCriteriaVersion implements Serializable {

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
    @JoinColumn(name = "pen_id")
    private Pen pen;

    @NotNull
    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Convert(converter = PurposeTypeSetConverter.class)
    @Column(name = "purpose_types")
    private Set<PurposeType> purposeTypes;

    @Convert(converter = LifeStageSetConverter.class)
    @Column(name = "life_stages")
    private Set<LifeStage> lifeStages;

    @Enumerated(EnumType.STRING)
    @Column(name = "sex", length = 30)
    private Sex sex;

    @Column(name = "min_age_months")
    private Integer minAgeMonths;

    @Column(name = "min_weight_kg", precision = 7, scale = 2)
    private BigDecimal minWeightKg;

    @NotNull
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_id")
    private AppUser changedBy;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

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

    public Pen getPen() {
        return pen;
    }

    public void setPen(Pen pen) {
        this.pen = pen;
    }

    public Integer getVersionNo() {
        return versionNo;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public Set<PurposeType> getPurposeTypes() {
        return purposeTypes;
    }

    public void setPurposeTypes(Set<PurposeType> purposeTypes) {
        this.purposeTypes = purposeTypes;
    }

    public Set<LifeStage> getLifeStages() {
        return lifeStages;
    }

    public void setLifeStages(Set<LifeStage> lifeStages) {
        this.lifeStages = lifeStages;
    }

    public Sex getSex() {
        return sex;
    }

    public void setSex(Sex sex) {
        this.sex = sex;
    }

    public Integer getMinAgeMonths() {
        return minAgeMonths;
    }

    public void setMinAgeMonths(Integer minAgeMonths) {
        this.minAgeMonths = minAgeMonths;
    }

    public BigDecimal getMinWeightKg() {
        return minWeightKg;
    }

    public void setMinWeightKg(BigDecimal minWeightKg) {
        this.minWeightKg = minWeightKg;
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public AppUser getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(AppUser changedBy) {
        this.changedBy = changedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PenCriteriaVersion)) {
            return false;
        }
        return getId() != null && getId().equals(((PenCriteriaVersion) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "PenCriteriaVersion{id=" + getId() + "}";
    }
}
