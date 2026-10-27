package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A Vaccine.
 */
@Entity
@Table(name = "vaccine")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Vaccine implements Serializable {

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

    @NotNull
    @Size(max = 255)
    @Column(name = "disease_prevented", length = 255, nullable = false)
    private String diseasePrevented;

    @NotNull
    @Size(max = 255)
    @Column(name = "manufacturer", length = 255, nullable = false)
    private String manufacturer;

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
    @Column(name = "booster_interval", nullable = false)
    private Integer boosterInterval;

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

    public Vaccine id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return this.code;
    }

    public Vaccine code(String code) {
        this.setCode(code);
        return this;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return this.name;
    }

    public Vaccine name(String name) {
        this.setName(name);
        return this;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDiseasePrevented() {
        return this.diseasePrevented;
    }

    public Vaccine diseasePrevented(String diseasePrevented) {
        this.setDiseasePrevented(diseasePrevented);
        return this;
    }

    public void setDiseasePrevented(String diseasePrevented) {
        this.diseasePrevented = diseasePrevented;
    }

    public String getManufacturer() {
        return this.manufacturer;
    }

    public Vaccine manufacturer(String manufacturer) {
        this.setManufacturer(manufacturer);
        return this;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getDose() {
        return this.dose;
    }

    public Vaccine dose(String dose) {
        this.setDose(dose);
        return this;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public String getRoute() {
        return this.route;
    }

    public Vaccine route(String route) {
        this.setRoute(route);
        return this;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public Integer getBoosterInterval() {
        return this.boosterInterval;
    }

    public Vaccine boosterInterval(Integer boosterInterval) {
        this.setBoosterInterval(boosterInterval);
        return this;
    }

    public void setBoosterInterval(Integer boosterInterval) {
        this.boosterInterval = boosterInterval;
    }

    public String getWithdrawalInfo() {
        return this.withdrawalInfo;
    }

    public Vaccine withdrawalInfo(String withdrawalInfo) {
        this.setWithdrawalInfo(withdrawalInfo);
        return this;
    }

    public void setWithdrawalInfo(String withdrawalInfo) {
        this.withdrawalInfo = withdrawalInfo;
    }

    public Boolean getAvailable() {
        return this.available;
    }

    public Vaccine available(Boolean available) {
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

    public Vaccine farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Vaccine)) {
            return false;
        }
        return getId() != null && getId().equals(((Vaccine) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Vaccine{" +
            "id=" + getId() +
            ", code='" + getCode() + "'" +
            ", name='" + getName() + "'" +
            ", diseasePrevented='" + getDiseasePrevented() + "'" +
            ", manufacturer='" + getManufacturer() + "'" +
            ", dose='" + getDose() + "'" +
            ", route='" + getRoute() + "'" +
            ", boosterInterval=" + getBoosterInterval() +
            ", withdrawalInfo='" + getWithdrawalInfo() + "'" +
            ", available='" + getAvailable() + "'" +
            "}";
    }
}
