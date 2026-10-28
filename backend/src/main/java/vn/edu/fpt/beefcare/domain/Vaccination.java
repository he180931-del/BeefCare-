package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A Vaccination.
 */
@Entity
@Table(name = "vaccination")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Vaccination implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "vaccination_date", nullable = false)
    private LocalDate vaccinationDate;

    @NotNull
    @Column(name = "entry_time", nullable = false)
    private Instant entryTime;

    @NotNull
    @Size(max = 255)
    @Column(name = "dose", length = 255, nullable = false)
    private String dose;

    @Size(max = 50)
    @Column(name = "batch_no", length = 50)
    private String batchNo;

    /**
     * ON_FARM | HISTORICAL
     */
    @Schema(description = "ON_FARM | HISTORICAL")
    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source;

    @NotNull
    @Size(max = 255)
    @Column(name = "vaccinator", length = 255, nullable = false)
    private String vaccinator;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Vaccine vaccine;

    @JsonIgnoreProperties(value = { "vaccination", "schedule", "cattle" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "vaccination")
    private ScheduledDose scheduledDose;

    @Column(name = "withdrawal_end_date")
    private LocalDate withdrawalEndDate;

    @Column(name = "information_source", length = 255)
    private String informationSource;

    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status = "VALID";
    @Size(max = 500)
    @Column(name = "status_reason", length = 500)
    private String statusReason;
    @NotNull
    @Column(name = "is_corrected", nullable = false)
    private Boolean corrected = Boolean.FALSE;
    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;
    @Column(name = "route", length = 255)
    private String route;
    @Column(name = "withdrawal_days")
    private Integer withdrawalDays;
    @Column(name = "vaccine_name_snapshot", length = 255)
    private String vaccineNameSnapshot;
    @Column(name = "administered_at")
    private Instant administeredAt;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Vaccination id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getVaccinationDate() {
        return this.vaccinationDate;
    }

    public Vaccination vaccinationDate(LocalDate vaccinationDate) {
        this.setVaccinationDate(vaccinationDate);
        return this;
    }

    public void setVaccinationDate(LocalDate vaccinationDate) {
        this.vaccinationDate = vaccinationDate;
    }

    public Instant getEntryTime() {
        return this.entryTime;
    }

    public Vaccination entryTime(Instant entryTime) {
        this.setEntryTime(entryTime);
        return this;
    }

    public void setEntryTime(Instant entryTime) {
        this.entryTime = entryTime;
    }

    public String getDose() {
        return this.dose;
    }

    public Vaccination dose(String dose) {
        this.setDose(dose);
        return this;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public String getBatchNo() {
        return this.batchNo;
    }

    public Vaccination batchNo(String batchNo) {
        this.setBatchNo(batchNo);
        return this;
    }

    public void setBatchNo(String batchNo) {
        this.batchNo = batchNo;
    }

    public String getSource() {
        return this.source;
    }

    public Vaccination source(String source) {
        this.setSource(source);
        return this;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getVaccinator() {
        return this.vaccinator;
    }

    public Vaccination vaccinator(String vaccinator) {
        this.setVaccinator(vaccinator);
        return this;
    }

    public void setVaccinator(String vaccinator) {
        this.vaccinator = vaccinator;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public Vaccination cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    public Vaccine getVaccine() {
        return this.vaccine;
    }

    public void setVaccine(Vaccine vaccine) {
        this.vaccine = vaccine;
    }

    public Vaccination vaccine(Vaccine vaccine) {
        this.setVaccine(vaccine);
        return this;
    }

    public ScheduledDose getScheduledDose() {
        return this.scheduledDose;
    }

    public void setScheduledDose(ScheduledDose scheduledDose) {
        if (this.scheduledDose != null) {
            this.scheduledDose.setVaccination(null);
        }
        if (scheduledDose != null) {
            scheduledDose.setVaccination(this);
        }
        this.scheduledDose = scheduledDose;
    }

    public Vaccination scheduledDose(ScheduledDose scheduledDose) {
        this.setScheduledDose(scheduledDose);
        return this;
    }

    public LocalDate getWithdrawalEndDate() {
        return withdrawalEndDate;
    }

    public void setWithdrawalEndDate(LocalDate withdrawalEndDate) {
        this.withdrawalEndDate = withdrawalEndDate;
    }

    public String getInformationSource() {
        return informationSource;
    }

    public void setInformationSource(String informationSource) {
        this.informationSource = informationSource;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Boolean getCorrected() { return corrected; }
    public void setCorrected(Boolean corrected) { this.corrected = corrected; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public Integer getWithdrawalDays() { return withdrawalDays; }
    public void setWithdrawalDays(Integer withdrawalDays) { this.withdrawalDays = withdrawalDays; }
    public String getVaccineNameSnapshot() { return vaccineNameSnapshot; }
    public void setVaccineNameSnapshot(String vaccineNameSnapshot) { this.vaccineNameSnapshot = vaccineNameSnapshot; }
    public Instant getAdministeredAt() { return administeredAt; }
    public void setAdministeredAt(Instant administeredAt) { this.administeredAt = administeredAt; }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Vaccination)) {
            return false;
        }
        return getId() != null && getId().equals(((Vaccination) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Vaccination{" +
            "id=" + getId() +
            ", vaccinationDate='" + getVaccinationDate() + "'" +
            ", entryTime='" + getEntryTime() + "'" +
            ", dose='" + getDose() + "'" +
            ", batchNo='" + getBatchNo() + "'" +
            ", source='" + getSource() + "'" +
            ", vaccinator='" + getVaccinator() + "'" +
            "}";
    }
}
