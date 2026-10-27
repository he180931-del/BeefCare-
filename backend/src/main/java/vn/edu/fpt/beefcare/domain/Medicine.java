package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A Medicine.
 */
@Entity
@Table(name = "medicine")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Medicine implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 50)
    @Column(name = "code", length = 50, nullable = false)
    private String code;

    @NotNull
    @Size(max = 255)
    @Column(name = "name", length = 255, nullable = false)
    private String name;

    @Lob
    @Column(name = "description")
    private String description;

    /**
     * ERD: dose / route - tách 2 cột
     */
    @Schema(description = "ERD: dose / route - tách 2 cột", required = true)
    @NotNull
    @Size(max = 255)
    @Column(name = "dose", length = 255, nullable = false)
    private String dose;

    @NotNull
    @Size(max = 255)
    @Column(name = "route", length = 255, nullable = false)
    private String route;

    @NotNull
    @Size(max = 255)
    @Column(name = "withdrawal_info", length = 255, nullable = false)
    private String withdrawalInfo;

    @NotNull
    @Column(name = "available", nullable = false)
    private Boolean available;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Medicine id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return this.code;
    }

    public Medicine code(String code) {
        this.setCode(code);
        return this;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return this.name;
    }

    public Medicine name(String name) {
        this.setName(name);
        return this;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return this.description;
    }

    public Medicine description(String description) {
        this.setDescription(description);
        return this;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDose() {
        return this.dose;
    }

    public Medicine dose(String dose) {
        this.setDose(dose);
        return this;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public String getRoute() {
        return this.route;
    }

    public Medicine route(String route) {
        this.setRoute(route);
        return this;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public String getWithdrawalInfo() {
        return this.withdrawalInfo;
    }

    public Medicine withdrawalInfo(String withdrawalInfo) {
        this.setWithdrawalInfo(withdrawalInfo);
        return this;
    }

    public void setWithdrawalInfo(String withdrawalInfo) {
        this.withdrawalInfo = withdrawalInfo;
    }

    public Boolean getAvailable() {
        return this.available;
    }

    public Medicine available(Boolean available) {
        this.setAvailable(available);
        return this;
    }

    public void setAvailable(Boolean available) {
        this.available = available;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Medicine farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Medicine)) {
            return false;
        }
        return getId() != null && getId().equals(((Medicine) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Medicine{" +
            "id=" + getId() +
            ", code='" + getCode() + "'" +
            ", name='" + getName() + "'" +
            ", description='" + getDescription() + "'" +
            ", dose='" + getDose() + "'" +
            ", route='" + getRoute() + "'" +
            ", withdrawalInfo='" + getWithdrawalInfo() + "'" +
            ", available='" + getAvailable() + "'" +
            "}";
    }
}
