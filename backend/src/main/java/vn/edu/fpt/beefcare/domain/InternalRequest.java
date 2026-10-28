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

    @Column(name="code",length=50,unique=true) private String code;
    @Column(name="question",length=2000) private String question;
    @Column(name="context_json",columnDefinition="text") private String contextJson;
    @Column(name="result_text",length=2000) private String resultText;
    @Column(name="created_at") private java.time.Instant createdAt;
    @Column(name="completed_at") private java.time.Instant completedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="created_by_id") private AppUser createdBy;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="domain_audit_id") private AuditLog domainAudit;
    @Version @Column(name="version",nullable=false) private Integer version;
    public String getCode(){return code;} public void setCode(String value){code=value;}
    public String getQuestion(){return question;} public void setQuestion(String value){question=value;}
    public String getContextJson(){return contextJson;} public void setContextJson(String value){contextJson=value;}
    public String getResultText(){return resultText;} public void setResultText(String value){resultText=value;}
    public java.time.Instant getCreatedAt(){return createdAt;} public void setCreatedAt(java.time.Instant value){createdAt=value;}
    public java.time.Instant getCompletedAt(){return completedAt;} public void setCompletedAt(java.time.Instant value){completedAt=value;}
    public AppUser getCreatedBy(){return createdBy;} public void setCreatedBy(AppUser value){createdBy=value;}
    public AuditLog getDomainAudit(){return domainAudit;} public void setDomainAudit(AuditLog value){domainAudit=value;}
    public Integer getVersion(){return version;} public void setVersion(Integer value){version=value;}

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
