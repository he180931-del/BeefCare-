package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A CalvingEvent.
 */
@Entity
@Table(name = "calving_event")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class CalvingEvent implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "birth_time", nullable = false)
    private Instant birthTime;

    @NotNull
    @Size(max = 30)
    @Column(name = "course", length = 30, nullable = false)
    private String course;

    @NotNull
    @Size(max = 30)
    @Column(name = "dam_condition", length = 30, nullable = false)
    private String damCondition;

    @NotNull
    @Column(name = "retained_placenta", nullable = false)
    private Boolean retainedPlacenta = Boolean.FALSE;

    @NotNull
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
    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source;
    @Size(max = 255)
    @Column(name = "attendant", length = 255)
    private String attendant;
    @Column(name = "recorded_at")
    private Instant recordedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    private AppUser recordedBy;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle dam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "confirmingCheck", "cattle" }, allowSetters = true)
    private PregnancyEpisode episode;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public CalvingEvent id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getBirthTime() {
        return this.birthTime;
    }

    public CalvingEvent birthTime(Instant birthTime) {
        this.setBirthTime(birthTime);
        return this;
    }

    public void setBirthTime(Instant birthTime) {
        this.birthTime = birthTime;
    }

    public String getCourse() {
        return this.course;
    }

    public CalvingEvent course(String course) {
        this.setCourse(course);
        return this;
    }

    public void setCourse(String course) {
        this.course = course;
    }

    public String getDamCondition() {
        return this.damCondition;
    }

    public CalvingEvent damCondition(String damCondition) {
        this.setDamCondition(damCondition);
        return this;
    }

    public void setDamCondition(String damCondition) {
        this.damCondition = damCondition;
    }

    public Boolean getRetainedPlacenta() { return retainedPlacenta; }
    public void setRetainedPlacenta(Boolean retainedPlacenta) { this.retainedPlacenta = retainedPlacenta; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Boolean getCorrected() { return corrected; }
    public void setCorrected(Boolean corrected) { this.corrected = corrected; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getAttendant() { return attendant; }
    public void setAttendant(String attendant) { this.attendant = attendant; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
    public AppUser getRecordedBy() { return recordedBy; }
    public void setRecordedBy(AppUser recordedBy) { this.recordedBy = recordedBy; }

    public Cattle getDam() {
        return this.dam;
    }

    public void setDam(Cattle cattle) {
        this.dam = cattle;
    }

    public CalvingEvent dam(Cattle cattle) {
        this.setDam(cattle);
        return this;
    }

    public PregnancyEpisode getEpisode() {
        return this.episode;
    }

    public void setEpisode(PregnancyEpisode pregnancyEpisode) {
        this.episode = pregnancyEpisode;
    }

    public CalvingEvent episode(PregnancyEpisode pregnancyEpisode) {
        this.setEpisode(pregnancyEpisode);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CalvingEvent)) {
            return false;
        }
        return getId() != null && getId().equals(((CalvingEvent) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "CalvingEvent{" +
            "id=" + getId() +
            ", birthTime='" + getBirthTime() + "'" +
            ", course='" + getCourse() + "'" +
            ", damCondition='" + getDamCondition() + "'" +
            "}";
    }
}
