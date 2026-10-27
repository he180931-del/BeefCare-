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

    @NotNull
    @Column(name = "weight_kg", precision = 21, scale = 2, nullable = false)
    private BigDecimal weightKg;

    /**
     * MEASURED | ESTIMATED
     */
    @Schema(description = "MEASURED | ESTIMATED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "weight_type", length = 30, nullable = false)
    private String weightType;

    @NotNull
    @Column(name = "bcs", nullable = false)
    private Integer bcs;

    /**
     * VALID | CORRECTED | EXCLUDED
     */
    @Schema(description = "VALID | CORRECTED | EXCLUDED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Lob
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
