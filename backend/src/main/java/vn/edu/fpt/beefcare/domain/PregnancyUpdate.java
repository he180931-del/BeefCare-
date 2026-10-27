package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A PregnancyUpdate.
 */
@Entity
@Table(name = "pregnancy_update")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PregnancyUpdate implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "type", length = 30, nullable = false)
    private String type;

    @NotNull
    @Column(name = "occurred_time", nullable = false)
    private Instant occurredTime;

    @Lob
    @Column(name = "details")
    private String details;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "confirmingCheck", "cattle" }, allowSetters = true)
    private PregnancyEpisode episode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "cattle" }, allowSetters = true)
    private HealthCase healthCase;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public PregnancyUpdate id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return this.type;
    }

    public PregnancyUpdate type(String type) {
        this.setType(type);
        return this;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Instant getOccurredTime() {
        return this.occurredTime;
    }

    public PregnancyUpdate occurredTime(Instant occurredTime) {
        this.setOccurredTime(occurredTime);
        return this;
    }

    public void setOccurredTime(Instant occurredTime) {
        this.occurredTime = occurredTime;
    }

    public String getDetails() {
        return this.details;
    }

    public PregnancyUpdate details(String details) {
        this.setDetails(details);
        return this;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public PregnancyEpisode getEpisode() {
        return this.episode;
    }

    public void setEpisode(PregnancyEpisode pregnancyEpisode) {
        this.episode = pregnancyEpisode;
    }

    public PregnancyUpdate episode(PregnancyEpisode pregnancyEpisode) {
        this.setEpisode(pregnancyEpisode);
        return this;
    }

    public HealthCase getHealthCase() {
        return this.healthCase;
    }

    public void setHealthCase(HealthCase healthCase) {
        this.healthCase = healthCase;
    }

    public PregnancyUpdate healthCase(HealthCase healthCase) {
        this.setHealthCase(healthCase);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PregnancyUpdate)) {
            return false;
        }
        return getId() != null && getId().equals(((PregnancyUpdate) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PregnancyUpdate{" +
            "id=" + getId() +
            ", type='" + getType() + "'" +
            ", occurredTime='" + getOccurredTime() + "'" +
            ", details='" + getDetails() + "'" +
            "}";
    }
}
