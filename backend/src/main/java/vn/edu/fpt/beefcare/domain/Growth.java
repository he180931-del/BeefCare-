package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A Growth.
 */
@Entity
@Table(name = "growth")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Growth implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    @NotNull
    @Column(name = "entry_time", nullable = false)
    private Instant entryTime;

    @Column(name = "weight_kg", precision = 21, scale = 2)
    private BigDecimal weightKg;

    /**
     * MEASURED | ESTIMATED
     */
    @Schema(description = "MEASURED | ESTIMATED", required = true)
    @Size(max = 30)
    @Column(name = "weight_type", length = 30)
    private String weightType;

    @NotNull
    @Size(max = 30)
    @Column(name = "method", length = 30, nullable = false)
    private String method = "OTHER";

    @Column(name = "bcs")
    private Integer bcs;

    @Column(name="bcs_score",precision=3,scale=1)
    private BigDecimal bcsScore;
    @Column(name="observed_at")
    private Instant observedAt;
    @ManyToOne(fetch=FetchType.LAZY)
    @JoinColumn(name="measured_by_id")
    private AppUser measuredBy;
    @Column(name="note",length=500)
    private String note;
    @Column(name="is_corrected",nullable=false)
    private boolean corrected;
    @Version
    @Column(name="version",nullable=false)
    private Integer version;

    @DecimalMin("50.0")
    @DecimalMax("300.0")
    @Digits(integer = 3, fraction = 1)
    @Column(name = "heart_girth_cm", precision = 5, scale = 1)
    private BigDecimal heartGirthCm;

    @DecimalMin("30.0")
    @DecimalMax("250.0")
    @Digits(integer = 3, fraction = 1)
    @Column(name = "body_length_cm", precision = 5, scale = 1)
    private BigDecimal bodyLengthCm;

    /**
     * VALID | CORRECTED | EXCLUDED
     */
    @Schema(description = "VALID | CORRECTED | EXCLUDED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    @Column(name = "correction_reason")
    private String correctionReason;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Growth id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getCheckDate() {
        return this.checkDate;
    }

    public Growth checkDate(LocalDate checkDate) {
        this.setCheckDate(checkDate);
        return this;
    }

    public void setCheckDate(LocalDate checkDate) {
        this.checkDate = checkDate;
    }

    public Instant getEntryTime() {
        return this.entryTime;
    }

    public Growth entryTime(Instant entryTime) {
        this.setEntryTime(entryTime);
        return this;
    }

    public void setEntryTime(Instant entryTime) {
        this.entryTime = entryTime;
    }

    public BigDecimal getWeightKg() {
        return this.weightKg;
    }

    public Growth weightKg(BigDecimal weightKg) {
        this.setWeightKg(weightKg);
        return this;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public String getWeightType() {
        return this.weightType;
    }

    public Growth weightType(String weightType) {
        this.setWeightType(weightType);
        return this;
    }

    public void setWeightType(String weightType) {
        this.weightType = weightType;
    }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public Integer getBcs() {
        return this.bcs;
    }

    public Growth bcs(Integer bcs) {
        this.setBcs(bcs);
        return this;
    }

    public void setBcs(Integer bcs) {
        this.bcs = bcs;
    }

    public BigDecimal getHeartGirthCm() { return heartGirthCm; }
    public BigDecimal getBcsScore() { return bcsScore==null && bcs!=null?BigDecimal.valueOf(bcs):bcsScore; }
    public void setBcsScore(BigDecimal value) { bcsScore=value; }
    public Instant getObservedAt() { return observedAt; }
    public void setObservedAt(Instant value) { observedAt=value; }
    public AppUser getMeasuredBy() { return measuredBy; }
    public void setMeasuredBy(AppUser value) { measuredBy=value; }
    public String getNote() { return note; }
    public void setNote(String value) { note=value; }
    public boolean isCorrected() { return corrected; }
    public void setCorrected(boolean value) { corrected=value; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer value) { version=value; }
    public void setHeartGirthCm(BigDecimal heartGirthCm) { this.heartGirthCm = heartGirthCm; }
    public BigDecimal getBodyLengthCm() { return bodyLengthCm; }
    public void setBodyLengthCm(BigDecimal bodyLengthCm) { this.bodyLengthCm = bodyLengthCm; }

    public String getStatus() {
        return this.status;
    }

    public Growth status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCorrectionReason() {
        return this.correctionReason;
    }

    public Growth correctionReason(String correctionReason) {
        this.setCorrectionReason(correctionReason);
        return this;
    }

    public void setCorrectionReason(String correctionReason) {
        this.correctionReason = correctionReason;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public Growth cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Growth)) {
            return false;
        }
        return getId() != null && getId().equals(((Growth) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Growth{" +
            "id=" + getId() +
            ", checkDate='" + getCheckDate() + "'" +
            ", entryTime='" + getEntryTime() + "'" +
            ", weightKg=" + getWeightKg() +
            ", weightType='" + getWeightType() + "'" +
            ", bcs=" + getBcs() +
            ", status='" + getStatus() + "'" +
            ", correctionReason='" + getCorrectionReason() + "'" +
            "}";
    }
}
