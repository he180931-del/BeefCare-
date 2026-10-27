package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

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
