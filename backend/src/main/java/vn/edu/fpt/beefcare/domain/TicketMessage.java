package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * Ticket Message (gộp Ticket Conversation, Resolution Version, Resolution Acknowledgment)
 */
@Schema(description = "Ticket Message (gộp Ticket Conversation, Resolution Version, Resolution Acknowledgment)")
@Entity
@Table(name = "ticket_message")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class TicketMessage implements Serializable {

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
    @Size(max = 30)
    @Column(name = "audience", length = 30, nullable = false)
    private String audience;

    @Lob
    @Column(name = "content", nullable = false)
    private String content;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "requester", "farm", "assignedCs" }, allowSetters = true)
    private SupportTicket ticket;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser author;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public TicketMessage id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return this.type;
    }

    public TicketMessage type(String type) {
        this.setType(type);
        return this;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getAudience() {
        return this.audience;
    }

    public TicketMessage audience(String audience) {
        this.setAudience(audience);
        return this;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    public String getContent() {
        return this.content;
    }

    public TicketMessage content(String content) {
        this.setContent(content);
        return this;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public SupportTicket getTicket() {
        return this.ticket;
    }

    public void setTicket(SupportTicket supportTicket) {
        this.ticket = supportTicket;
    }

    public TicketMessage ticket(SupportTicket supportTicket) {
        this.setTicket(supportTicket);
        return this;
    }

    public AppUser getAuthor() {
        return this.author;
    }

    public void setAuthor(AppUser appUser) {
        this.author = appUser;
    }

    public TicketMessage author(AppUser appUser) {
        this.setAuthor(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof TicketMessage)) {
            return false;
        }
        return getId() != null && getId().equals(((TicketMessage) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "TicketMessage{" +
            "id=" + getId() +
            ", type='" + getType() + "'" +
            ", audience='" + getAudience() + "'" +
            ", content='" + getContent() + "'" +
            "}";
    }
}
