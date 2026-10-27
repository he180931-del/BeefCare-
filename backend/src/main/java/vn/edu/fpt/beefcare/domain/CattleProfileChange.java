package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A CattleProfileChange.
 */
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

    /**
     * ERD: field
     */
    @Schema(description = "ERD: field", required = true)
    @NotNull
    @Size(max = 255)
    @Column(name = "field_name", length = 255, nullable = false)
    private String fieldName;

    @NotNull
    @Size(max = 255)
    @Column(name = "old_value", length = 255, nullable = false)
    private String oldValue;

    @NotNull
    @Size(max = 255)
    @Column(name = "new_value", length = 255, nullable = false)
    private String newValue;

    @NotNull
    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @Lob
    @Column(name = "reason")
    private String reason;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public CattleProfileChange id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFieldName() {
        return this.fieldName;
    }

    public CattleProfileChange fieldName(String fieldName) {
        this.setFieldName(fieldName);
        return this;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getOldValue() {
        return this.oldValue;
    }

    public CattleProfileChange oldValue(String oldValue) {
        this.setOldValue(oldValue);
        return this;
    }

    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }

    public String getNewValue() {
        return this.newValue;
    }

    public CattleProfileChange newValue(String newValue) {
        this.setNewValue(newValue);
        return this;
    }

    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }

    public LocalDate getEffectiveDate() {
        return this.effectiveDate;
    }

    public CattleProfileChange effectiveDate(LocalDate effectiveDate) {
        this.setEffectiveDate(effectiveDate);
        return this;
    }

    public void setEffectiveDate(LocalDate effectiveDate) {
        this.effectiveDate = effectiveDate;
    }

    public String getReason() {
        return this.reason;
    }

    public CattleProfileChange reason(String reason) {
        this.setReason(reason);
        return this;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public CattleProfileChange cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

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
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "CattleProfileChange{" +
            "id=" + getId() +
            ", fieldName='" + getFieldName() + "'" +
            ", oldValue='" + getOldValue() + "'" +
            ", newValue='" + getNewValue() + "'" +
            ", effectiveDate='" + getEffectiveDate() + "'" +
            ", reason='" + getReason() + "'" +
            "}";
    }
}
