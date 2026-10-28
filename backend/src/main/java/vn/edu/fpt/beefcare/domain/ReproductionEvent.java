package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import vn.edu.fpt.beefcare.domain.enumeration.EstrusSign;

/**
 * Reproduction Event (gộp Estrus Event, Breeding Event, Pregnancy Check)
 */
@Schema(description = "Reproduction Event (gộp Estrus Event, Breeding Event, Pregnancy Check)")
@Entity
@Table(name = "reproduction_event")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ReproductionEvent implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * ESTRUS | BREEDING | PREGNANCY_CHECK
     */
    @Schema(description = "ESTRUS | BREEDING | PREGNANCY_CHECK", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "type", length = 30, nullable = false)
    private String type;

    @NotNull
    @Column(name = "event_time", nullable = false)
    private Instant eventTime;

    @Size(max = 30)
    @Column(name = "method", length = 30)
    private String method;

    @NotNull
    @Size(max = 30)
    @Column(name = "result", length = 30, nullable = false)
    private String result;

    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source;

    @Convert(converter = EstrusSignSetConverter.class)
    @Column(name = "signs", length = 100)
    private Set<EstrusSign> signs;

    @Min(1)
    @Max(9)
    @Column(name = "est_months_pregnant")
    private Integer estMonthsPregnant;

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
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Size(max = 1000)
    @Column(name = "description", length = 1000)
    private String description;
    @Column(name = "recorded_at")
    private Instant recordedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by_id")
    private AppUser recordedBy;
    @Size(max = 255) @Column(name = "performed_by", length = 255) private String performedBy;
    @Size(max = 100) @Column(name = "observer", length = 100) private String observer;
    @Size(max = 255) @Column(name = "examiner", length = 255) private String examiner;
    @Size(max = 30) @Column(name = "sire_source", length = 30) private String sireSource;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sire_id") private Cattle sire;
    @Size(max = 255) @Column(name = "external_sire_name", length = 255) private String externalSireName;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sire_breed_id") private Breed sireBreed;
    @Size(max = 100) @Column(name = "semen_batch", length = 100) private String semenBatch;
    @Size(max = 255) @Column(name = "supplier", length = 255) private String supplier;
    @Column(name = "tentative_expected_calving_date") private LocalDate tentativeExpectedCalvingDate;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "cattle", "linkedEvent", "pregnancyEpisode" }, allowSetters = true)
    private ReproductionEvent linkedEvent;

    @JsonIgnoreProperties(value = { "confirmingCheck", "cattle" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "confirmingCheck")
    private PregnancyEpisode pregnancyEpisode;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public ReproductionEvent id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return this.type;
    }

    public ReproductionEvent type(String type) {
        this.setType(type);
        return this;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Instant getEventTime() {
        return this.eventTime;
    }

    public ReproductionEvent eventTime(Instant eventTime) {
        this.setEventTime(eventTime);
        return this;
    }

    public void setEventTime(Instant eventTime) {
        this.eventTime = eventTime;
    }

    public String getMethod() {
        return this.method;
    }

    public ReproductionEvent method(String method) {
        this.setMethod(method);
        return this;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getResult() {
        return this.result;
    }

    public ReproductionEvent result(String result) {
        this.setResult(result);
        return this;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public String getSource() {
        return this.source;
    }

    public ReproductionEvent source(String source) {
        this.setSource(source);
        return this;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Set<EstrusSign> getSigns() { return signs; }
    public void setSigns(Set<EstrusSign> signs) { this.signs = signs; }
    public Integer getEstMonthsPregnant() { return estMonthsPregnant; }
    public void setEstMonthsPregnant(Integer estMonthsPregnant) { this.estMonthsPregnant = estMonthsPregnant; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Boolean getCorrected() { return corrected; }
    public void setCorrected(Boolean corrected) { this.corrected = corrected; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
    public AppUser getRecordedBy() { return recordedBy; }
    public void setRecordedBy(AppUser recordedBy) { this.recordedBy = recordedBy; }
    public String getPerformedBy() { return performedBy; }
    public void setPerformedBy(String performedBy) { this.performedBy = performedBy; }
    public String getObserver() { return observer; }
    public void setObserver(String observer) { this.observer = observer; }
    public String getExaminer() { return examiner; }
    public void setExaminer(String examiner) { this.examiner = examiner; }
    public String getSireSource() { return sireSource; }
    public void setSireSource(String sireSource) { this.sireSource = sireSource; }
    public Cattle getSire() { return sire; }
    public void setSire(Cattle sire) { this.sire = sire; }
    public String getExternalSireName() { return externalSireName; }
    public void setExternalSireName(String externalSireName) { this.externalSireName = externalSireName; }
    public Breed getSireBreed() { return sireBreed; }
    public void setSireBreed(Breed sireBreed) { this.sireBreed = sireBreed; }
    public String getSemenBatch() { return semenBatch; }
    public void setSemenBatch(String semenBatch) { this.semenBatch = semenBatch; }
    public String getSupplier() { return supplier; }
    public void setSupplier(String supplier) { this.supplier = supplier; }
    public LocalDate getTentativeExpectedCalvingDate() { return tentativeExpectedCalvingDate; }
    public void setTentativeExpectedCalvingDate(LocalDate date) { this.tentativeExpectedCalvingDate = date; }

    @PrePersist
    @PreUpdate
    void touch() { if (updatedAt == null || updatedAt.isBefore(eventTime)) updatedAt = Instant.now(); }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public ReproductionEvent cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    public ReproductionEvent getLinkedEvent() {
        return this.linkedEvent;
    }

    public void setLinkedEvent(ReproductionEvent reproductionEvent) {
        this.linkedEvent = reproductionEvent;
    }

    public ReproductionEvent linkedEvent(ReproductionEvent reproductionEvent) {
        this.setLinkedEvent(reproductionEvent);
        return this;
    }

    public PregnancyEpisode getPregnancyEpisode() {
        return this.pregnancyEpisode;
    }

    public void setPregnancyEpisode(PregnancyEpisode pregnancyEpisode) {
        if (this.pregnancyEpisode != null) {
            this.pregnancyEpisode.setConfirmingCheck(null);
        }
        if (pregnancyEpisode != null) {
            pregnancyEpisode.setConfirmingCheck(this);
        }
        this.pregnancyEpisode = pregnancyEpisode;
    }

    public ReproductionEvent pregnancyEpisode(PregnancyEpisode pregnancyEpisode) {
        this.setPregnancyEpisode(pregnancyEpisode);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ReproductionEvent)) {
            return false;
        }
        return getId() != null && getId().equals(((ReproductionEvent) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ReproductionEvent{" +
            "id=" + getId() +
            ", type='" + getType() + "'" +
            ", eventTime='" + getEventTime() + "'" +
            ", method='" + getMethod() + "'" +
            ", result='" + getResult() + "'" +
            ", source='" + getSource() + "'" +
            "}";
    }
}
