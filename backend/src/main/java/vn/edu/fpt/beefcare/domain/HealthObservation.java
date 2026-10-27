package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A HealthObservation.
 */
@Entity
@Table(name = "health_observation")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HealthObservation implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "observed_time", nullable = false)
    private Instant observedTime;

    @NotNull
    @Column(name = "entry_time", nullable = false)
    private Instant entryTime;

    /**
     * ERD: signs / progress
     */
    @Schema(description = "ERD: signs / progress", required = true)
    @Lob
    @Column(name = "signs_progress", nullable = false)
    private String signsProgress;

    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "cattle" }, allowSetters = true)
    private HealthCase healthCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "cattle", "vaccine", "scheduledDose" }, allowSetters = true)
    private Vaccination vaccination;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public HealthObservation id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getObservedTime() {
        return this.observedTime;
    }

    public HealthObservation observedTime(Instant observedTime) {
        this.setObservedTime(observedTime);
        return this;
    }

    public void setObservedTime(Instant observedTime) {
        this.observedTime = observedTime;
    }

    public Instant getEntryTime() {
        return this.entryTime;
    }

    public HealthObservation entryTime(Instant entryTime) {
        this.setEntryTime(entryTime);
        return this;
    }

    public void setEntryTime(Instant entryTime) {
        this.entryTime = entryTime;
    }

    public String getSignsProgress() {
        return this.signsProgress;
    }

    public HealthObservation signsProgress(String signsProgress) {
        this.setSignsProgress(signsProgress);
        return this;
    }

    public void setSignsProgress(String signsProgress) {
        this.signsProgress = signsProgress;
    }

    public String getSource() {
        return this.source;
    }

    public HealthObservation source(String source) {
        this.setSource(source);
        return this;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public HealthCase getHealthCase() {
        return this.healthCase;
    }

    public void setHealthCase(HealthCase healthCase) {
        this.healthCase = healthCase;
    }

    public HealthObservation healthCase(HealthCase healthCase) {
        this.setHealthCase(healthCase);
        return this;
    }

    public Vaccination getVaccination() {
        return this.vaccination;
    }

    public void setVaccination(Vaccination vaccination) {
        this.vaccination = vaccination;
    }

    public HealthObservation vaccination(Vaccination vaccination) {
        this.setVaccination(vaccination);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HealthObservation)) {
            return false;
        }
        return getId() != null && getId().equals(((HealthObservation) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HealthObservation{" +
            "id=" + getId() +
            ", observedTime='" + getObservedTime() + "'" +
            ", entryTime='" + getEntryTime() + "'" +
            ", signsProgress='" + getSignsProgress() + "'" +
            ", source='" + getSource() + "'" +
            "}";
    }
}
