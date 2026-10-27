package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A InternalRequest.
 */
@Entity
@Table(name = "internal_request")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class InternalRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "target_role", length = 30, nullable = false)
    private String targetRole;

    @NotNull
    @Size(max = 30)
    @Column(name = "state", length = 30, nullable = false)
    private String state;

    @Size(max = 30)
    @Column(name = "outcome", length = 30)
    private String outcome;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "requester", "farm", "assignedCs" }, allowSetters = true)
    private SupportTicket ticket;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser recipient;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public InternalRequest id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTargetRole() {
        return this.targetRole;
    }

    public InternalRequest targetRole(String targetRole) {
        this.setTargetRole(targetRole);
        return this;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }

    public String getState() {
        return this.state;
    }

    public InternalRequest state(String state) {
        this.setState(state);
        return this;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getOutcome() {
        return this.outcome;
    }

    public InternalRequest outcome(String outcome) {
        this.setOutcome(outcome);
        return this;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public SupportTicket getTicket() {
        return this.ticket;
    }

    public void setTicket(SupportTicket supportTicket) {
        this.ticket = supportTicket;
    }

    public InternalRequest ticket(SupportTicket supportTicket) {
        this.setTicket(supportTicket);
        return this;
    }

    public AppUser getRecipient() {
        return this.recipient;
    }

    public void setRecipient(AppUser appUser) {
        this.recipient = appUser;
    }

    public InternalRequest recipient(AppUser appUser) {
        this.setRecipient(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof InternalRequest)) {
            return false;
        }
        return getId() != null && getId().equals(((InternalRequest) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "InternalRequest{" +
            "id=" + getId() +
            ", targetRole='" + getTargetRole() + "'" +
            ", state='" + getState() + "'" +
            ", outcome='" + getOutcome() + "'" +
            "}";
    }
}
