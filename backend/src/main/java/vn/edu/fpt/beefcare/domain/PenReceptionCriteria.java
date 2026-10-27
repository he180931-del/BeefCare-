package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * ERD: PK ghép pen_id + version; dùng id và cần thêm unique(pen_id, version_no)
 */
@Schema(description = "ERD: PK ghép pen_id + version; dùng id và cần thêm unique(pen_id, version_no)")
@Entity
@Table(name = "pen_reception_criteria")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PenReceptionCriteria implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Min(value = 1)
    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @NotNull
    @Size(max = 255)
    @Column(name = "accepted_purposes", length = 255, nullable = false)
    private String acceptedPurposes;

    @NotNull
    @Size(max = 30)
    @Column(name = "accepted_stages", length = 30, nullable = false)
    private String acceptedStages;

    @Size(max = 255)
    @Column(name = "thresholds", length = 255)
    private String thresholds;

    @NotNull
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Pen pen;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public PenReceptionCriteria id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getVersionNo() {
        return this.versionNo;
    }

    public PenReceptionCriteria versionNo(Integer versionNo) {
        this.setVersionNo(versionNo);
        return this;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public String getAcceptedPurposes() {
        return this.acceptedPurposes;
    }

    public PenReceptionCriteria acceptedPurposes(String acceptedPurposes) {
        this.setAcceptedPurposes(acceptedPurposes);
        return this;
    }

    public void setAcceptedPurposes(String acceptedPurposes) {
        this.acceptedPurposes = acceptedPurposes;
    }

    public String getAcceptedStages() {
        return this.acceptedStages;
    }

    public PenReceptionCriteria acceptedStages(String acceptedStages) {
        this.setAcceptedStages(acceptedStages);
        return this;
    }

    public void setAcceptedStages(String acceptedStages) {
        this.acceptedStages = acceptedStages;
    }

    public String getThresholds() {
        return this.thresholds;
    }

    public PenReceptionCriteria thresholds(String thresholds) {
        this.setThresholds(thresholds);
        return this;
    }

    public void setThresholds(String thresholds) {
        this.thresholds = thresholds;
    }

    public LocalDate getEffectiveFrom() {
        return this.effectiveFrom;
    }

    public PenReceptionCriteria effectiveFrom(LocalDate effectiveFrom) {
        this.setEffectiveFrom(effectiveFrom);
        return this;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public Pen getPen() {
        return this.pen;
    }

    public void setPen(Pen pen) {
        this.pen = pen;
    }

    public PenReceptionCriteria pen(Pen pen) {
        this.setPen(pen);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PenReceptionCriteria)) {
            return false;
        }
        return getId() != null && getId().equals(((PenReceptionCriteria) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PenReceptionCriteria{" +
            "id=" + getId() +
            ", versionNo=" + getVersionNo() +
            ", acceptedPurposes='" + getAcceptedPurposes() + "'" +
            ", acceptedStages='" + getAcceptedStages() + "'" +
            ", thresholds='" + getThresholds() + "'" +
            ", effectiveFrom='" + getEffectiveFrom() + "'" +
            "}";
    }
}
