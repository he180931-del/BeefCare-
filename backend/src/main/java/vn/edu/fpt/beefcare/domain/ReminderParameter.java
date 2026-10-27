package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A ReminderParameter.
 */
@Entity
@Table(name = "reminder_parameter")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ReminderParameter implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "parameter_type", length = 30, nullable = false)
    private String parameterType;

    /**
     * ERD: value
     */
    @Schema(description = "ERD: value", required = true)
    @NotNull
    @Size(max = 255)
    @Column(name = "param_value", length = 255, nullable = false)
    private String paramValue;

    /**
     * ERD: version
     */
    @Schema(description = "ERD: version", required = true)
    @NotNull
    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @NotNull
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public ReminderParameter id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getParameterType() {
        return this.parameterType;
    }

    public ReminderParameter parameterType(String parameterType) {
        this.setParameterType(parameterType);
        return this;
    }

    public void setParameterType(String parameterType) {
        this.parameterType = parameterType;
    }

    public String getParamValue() {
        return this.paramValue;
    }

    public ReminderParameter paramValue(String paramValue) {
        this.setParamValue(paramValue);
        return this;
    }

    public void setParamValue(String paramValue) {
        this.paramValue = paramValue;
    }

    public Integer getVersionNo() {
        return this.versionNo;
    }

    public ReminderParameter versionNo(Integer versionNo) {
        this.setVersionNo(versionNo);
        return this;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public LocalDate getEffectiveFrom() {
        return this.effectiveFrom;
    }

    public ReminderParameter effectiveFrom(LocalDate effectiveFrom) {
        this.setEffectiveFrom(effectiveFrom);
        return this;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public ReminderParameter farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ReminderParameter)) {
            return false;
        }
        return getId() != null && getId().equals(((ReminderParameter) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ReminderParameter{" +
            "id=" + getId() +
            ", parameterType='" + getParameterType() + "'" +
            ", paramValue='" + getParamValue() + "'" +
            ", versionNo=" + getVersionNo() +
            ", effectiveFrom='" + getEffectiveFrom() + "'" +
            "}";
    }
}
