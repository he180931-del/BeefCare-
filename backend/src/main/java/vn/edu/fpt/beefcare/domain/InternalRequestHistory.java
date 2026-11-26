package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import org.hibernate.annotations.Immutable;

/** Immutable, audience-scoped events for an Internal Request conversation. */
@Entity
@Table(name = "internal_request_history")
@Immutable
public class InternalRequestHistory implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "internal_request_id", nullable = false)
    private InternalRequest internalRequest;

    @Column(name = "event_type", length = 30, nullable = false)
    private String eventType;

    @Column(name = "note", length = 2000)
    private String note;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", nullable = false)
    private AppUser actor;

    @Column(name = "actor_role", length = 30, nullable = false)
    private String actorRole;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "request_version", nullable = false)
    private Integer requestVersion;

    @Column(name = "state", length = 30, nullable = false)
    private String state;

    @Column(name = "outcome", length = 30)
    private String outcome;

    public Long getId() { return id; }
    public InternalRequest getInternalRequest() { return internalRequest; }
    public void setInternalRequest(InternalRequest value) { internalRequest = value; }
    public String getEventType() { return eventType; }
    public void setEventType(String value) { eventType = value; }
    public String getNote() { return note; }
    public void setNote(String value) { note = value; }
    public AppUser getActor() { return actor; }
    public void setActor(AppUser value) { actor = value; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String value) { actorRole = value; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant value) { occurredAt = value; }
    public Integer getRequestVersion() { return requestVersion; }
    public void setRequestVersion(Integer value) { requestVersion = value; }
    public String getState() { return state; }
    public void setState(String value) { state = value; }
    public String getOutcome() { return outcome; }
    public void setOutcome(String value) { outcome = value; }
}
