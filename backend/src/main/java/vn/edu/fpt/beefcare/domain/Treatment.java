package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A Treatment.
 */
@Entity
@Table(name = "treatment")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Treatment implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "treatment_time", nullable = false)
    private Instant treatmentTime;

    @NotNull
    @Column(name = "entry_time", nullable = false)
    private Instant entryTime;

    @NotNull
    @Size(max = 255)
    @Column(name = "treatment_detail", length = 255, nullable = false)
    private String treatmentDetail;

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
    @Column(name = "withdrawal_period", length = 255, nullable = false)
    private String withdrawalPeriod;

    @NotNull
    @Size(max = 30)
    @Column(name = "result", length = 30, nullable = false)
    private String result;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "cattle" }, allowSetters = true)
    private HealthCase healthCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Medicine medicine;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Treatment id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getTreatmentTime() {
        return this.treatmentTime;
    }

    public Treatment treatmentTime(Instant treatmentTime) {
        this.setTreatmentTime(treatmentTime);
        return this;
    }

    public void setTreatmentTime(Instant treatmentTime) {
        this.treatmentTime = treatmentTime;
    }

    public Instant getEntryTime() {
        return this.entryTime;
    }

    public Treatment entryTime(Instant entryTime) {
        this.setEntryTime(entryTime);
        return this;
    }

    public void setEntryTime(Instant entryTime) {
        this.entryTime = entryTime;
    }

    public String getTreatmentDetail() {
        return this.treatmentDetail;
    }

    public Treatment treatmentDetail(String treatmentDetail) {
        this.setTreatmentDetail(treatmentDetail);
        return this;
    }

    public void setTreatmentDetail(String treatmentDetail) {
        this.treatmentDetail = treatmentDetail;
    }

    public String getDose() {
        return this.dose;
    }

    public Treatment dose(String dose) {
        this.setDose(dose);
        return this;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public String getRoute() {
        return this.route;
    }

    public Treatment route(String route) {
        this.setRoute(route);
        return this;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public String getWithdrawalPeriod() {
        return this.withdrawalPeriod;
    }

    public Treatment withdrawalPeriod(String withdrawalPeriod) {
        this.setWithdrawalPeriod(withdrawalPeriod);
        return this;
    }

    public void setWithdrawalPeriod(String withdrawalPeriod) {
        this.withdrawalPeriod = withdrawalPeriod;
    }

    public String getResult() {
        return this.result;
    }

    public Treatment result(String result) {
        this.setResult(result);
        return this;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public HealthCase getHealthCase() {
        return this.healthCase;
    }

    public void setHealthCase(HealthCase healthCase) {
        this.healthCase = healthCase;
    }

    public Treatment healthCase(HealthCase healthCase) {
        this.setHealthCase(healthCase);
        return this;
    }

    public Medicine getMedicine() {
        return this.medicine;
    }

    public void setMedicine(Medicine medicine) {
        this.medicine = medicine;
    }

    public Treatment medicine(Medicine medicine) {
        this.setMedicine(medicine);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Treatment)) {
            return false;
        }
        return getId() != null && getId().equals(((Treatment) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Treatment{" +
            "id=" + getId() +
            ", treatmentTime='" + getTreatmentTime() + "'" +
            ", entryTime='" + getEntryTime() + "'" +
            ", treatmentDetail='" + getTreatmentDetail() + "'" +
            ", dose='" + getDose() + "'" +
            ", route='" + getRoute() + "'" +
            ", withdrawalPeriod='" + getWithdrawalPeriod() + "'" +
            ", result='" + getResult() + "'" +
            "}";
    }
}
