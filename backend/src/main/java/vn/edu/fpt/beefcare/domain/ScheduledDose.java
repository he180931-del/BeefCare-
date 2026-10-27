package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A ScheduledDose.
 */
@Entity
@Table(name = "scheduled_dose")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ScheduledDose implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "dose_no", nullable = false)
    private Integer doseNo;

    @NotNull
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    /**
     * PLANNED | DONE | DEFERRED | CANCELLED
     */
    @Schema(description = "PLANNED | DONE | DEFERRED | CANCELLED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Lob
    @Column(name = "deferral_reason")
    private String deferralReason;

    @Column(name = "new_expected_date")
    private LocalDate newExpectedDate;

    @JsonIgnoreProperties(value = { "cattle", "vaccine", "scheduledDose" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(unique = true)
    private Vaccination vaccination;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "vaccine" }, allowSetters = true)
    private VaccinationSchedule schedule;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public ScheduledDose id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getDoseNo() {
        return this.doseNo;
    }

    public ScheduledDose doseNo(Integer doseNo) {
        this.setDoseNo(doseNo);
        return this;
    }

    public void setDoseNo(Integer doseNo) {
        this.doseNo = doseNo;
    }

    public LocalDate getDueDate() {
        return this.dueDate;
    }

    public ScheduledDose dueDate(LocalDate dueDate) {
        this.setDueDate(dueDate);
        return this;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getStatus() {
        return this.status;
    }

    public ScheduledDose status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDeferralReason() {
        return this.deferralReason;
    }

    public ScheduledDose deferralReason(String deferralReason) {
        this.setDeferralReason(deferralReason);
        return this;
    }

    public void setDeferralReason(String deferralReason) {
        this.deferralReason = deferralReason;
    }

    public LocalDate getNewExpectedDate() {
        return this.newExpectedDate;
    }

    public ScheduledDose newExpectedDate(LocalDate newExpectedDate) {
        this.setNewExpectedDate(newExpectedDate);
        return this;
    }

    public void setNewExpectedDate(LocalDate newExpectedDate) {
        this.newExpectedDate = newExpectedDate;
    }

    public Vaccination getVaccination() {
        return this.vaccination;
    }

    public void setVaccination(Vaccination vaccination) {
        this.vaccination = vaccination;
    }

    public ScheduledDose vaccination(Vaccination vaccination) {
        this.setVaccination(vaccination);
        return this;
    }

    public VaccinationSchedule getSchedule() {
        return this.schedule;
    }

    public void setSchedule(VaccinationSchedule vaccinationSchedule) {
        this.schedule = vaccinationSchedule;
    }

    public ScheduledDose schedule(VaccinationSchedule vaccinationSchedule) {
        this.setSchedule(vaccinationSchedule);
        return this;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public ScheduledDose cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ScheduledDose)) {
            return false;
        }
        return getId() != null && getId().equals(((ScheduledDose) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ScheduledDose{" +
            "id=" + getId() +
            ", doseNo=" + getDoseNo() +
            ", dueDate='" + getDueDate() + "'" +
            ", status='" + getStatus() + "'" +
            ", deferralReason='" + getDeferralReason() + "'" +
            ", newExpectedDate='" + getNewExpectedDate() + "'" +
            "}";
    }
}
