package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A SupportHistory.
 */
@Entity
@Table(name = "support_history")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class SupportHistory implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "event_type", length = 30, nullable = false)
    private String eventType;

    /**
     * ERD: prior/new state - tách 2 cột; priorState để trống được cho sự kiện đầu tiên
     */
    @Schema(description = "ERD: prior/new state - tách 2 cột; priorState để trống được cho sự kiện đầu tiên")
    @Size(max = 30)
    @Column(name = "prior_state", length = 30)
    private String priorState;

    @NotNull
    @Size(max = 30)
    @Column(name = "new_state", length = 30, nullable = false)
    private String newState;

    /**
     * ERD: time
     */
    @Schema(description = "ERD: time", required = true)
    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "requester", "farm", "assignedCs" }, allowSetters = true)
    private SupportTicket ticket;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser actor;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public SupportHistory id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEventType() {
        return this.eventType;
    }

    public SupportHistory eventType(String eventType) {
        this.setEventType(eventType);
        return this;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getPriorState() {
        return this.priorState;
    }

    public SupportHistory priorState(String priorState) {
        this.setPriorState(priorState);
        return this;
    }

    public void setPriorState(String priorState) {
        this.priorState = priorState;
    }

    public String getNewState() {
        return this.newState;
    }

    public SupportHistory newState(String newState) {
        this.setNewState(newState);
        return this;
    }

    public void setNewState(String newState) {
        this.newState = newState;
    }

    public Instant getOccurredAt() {
        return this.occurredAt;
    }

    public SupportHistory occurredAt(Instant occurredAt) {
        this.setOccurredAt(occurredAt);
        return this;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }

    public SupportTicket getTicket() {
        return this.ticket;
    }

    public void setTicket(SupportTicket supportTicket) {
        this.ticket = supportTicket;
    }

    public SupportHistory ticket(SupportTicket supportTicket) {
        this.setTicket(supportTicket);
        return this;
    }

    public AppUser getActor() {
        return this.actor;
    }

    public void setActor(AppUser appUser) {
        this.actor = appUser;
    }

    public SupportHistory actor(AppUser appUser) {
        this.setActor(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof SupportHistory)) {
            return false;
        }
        return getId() != null && getId().equals(((SupportHistory) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "SupportHistory{" +
            "id=" + getId() +
            ", eventType='" + getEventType() + "'" +
            ", priorState='" + getPriorState() + "'" +
            ", newState='" + getNewState() + "'" +
            ", occurredAt='" + getOccurredAt() + "'" +
            "}";
    }
}
