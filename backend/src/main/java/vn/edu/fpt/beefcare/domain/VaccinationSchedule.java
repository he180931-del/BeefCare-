package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A VaccinationSchedule.
 */
@Entity
@Table(name = "vaccination_schedule")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class VaccinationSchedule implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 255)
    @Column(name = "target_group", length = 255, nullable = false)
    private String targetGroup;

    @NotNull
    @Column(name = "first_due_date", nullable = false)
    private LocalDate firstDueDate;

    @NotNull
    @Column(name = "dose_count", nullable = false)
    private Integer doseCount;

    @NotNull
    @Column(name = "interval_days", nullable = false)
    private Integer intervalDays;

    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Vaccine vaccine;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public VaccinationSchedule id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTargetGroup() {
        return this.targetGroup;
    }

    public VaccinationSchedule targetGroup(String targetGroup) {
        this.setTargetGroup(targetGroup);
        return this;
    }

    public void setTargetGroup(String targetGroup) {
        this.targetGroup = targetGroup;
    }

    public LocalDate getFirstDueDate() {
        return this.firstDueDate;
    }

    public VaccinationSchedule firstDueDate(LocalDate firstDueDate) {
        this.setFirstDueDate(firstDueDate);
        return this;
    }

    public void setFirstDueDate(LocalDate firstDueDate) {
        this.firstDueDate = firstDueDate;
    }

    public Integer getDoseCount() {
        return this.doseCount;
    }

    public VaccinationSchedule doseCount(Integer doseCount) {
        this.setDoseCount(doseCount);
        return this;
    }

    public void setDoseCount(Integer doseCount) {
        this.doseCount = doseCount;
    }

    public Integer getIntervalDays() {
        return this.intervalDays;
    }

    public VaccinationSchedule intervalDays(Integer intervalDays) {
        this.setIntervalDays(intervalDays);
        return this;
    }

    public void setIntervalDays(Integer intervalDays) {
        this.intervalDays = intervalDays;
    }

    public String getStatus() {
        return this.status;
    }

    public VaccinationSchedule status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public VaccinationSchedule farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    public Vaccine getVaccine() {
        return this.vaccine;
    }

    public void setVaccine(Vaccine vaccine) {
        this.vaccine = vaccine;
    }

    public VaccinationSchedule vaccine(Vaccine vaccine) {
        this.setVaccine(vaccine);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof VaccinationSchedule)) {
            return false;
        }
        return getId() != null && getId().equals(((VaccinationSchedule) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "VaccinationSchedule{" +
            "id=" + getId() +
            ", targetGroup='" + getTargetGroup() + "'" +
            ", firstDueDate='" + getFirstDueDate() + "'" +
            ", doseCount=" + getDoseCount() +
            ", intervalDays=" + getIntervalDays() +
            ", status='" + getStatus() + "'" +
            "}";
    }
}
