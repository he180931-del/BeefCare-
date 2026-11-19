package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** Durable mail dispatch metadata. The job references a hashed action-link row; it never stores bearer tokens. */
@Entity
@Table(name = "email_delivery_job")
public class EmailDeliveryJob {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    private Long id;

    @NotNull
    @Size(max = 255)
    @Column(name = "recipient", nullable = false, length = 255)
    private String recipient;

    @NotNull
    @Size(max = 255)
    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @NotNull
    @Size(max = 30)
    @Column(name = "template_key", nullable = false, length = 30)
    private String templateKey;

    @NotNull
    @Size(max = 30)
    @Column(name = "link_source", nullable = false, length = 30)
    private String linkSource;

    @NotNull
    @Column(name = "link_source_id", nullable = false)
    private Long linkSourceId;

    @Size(max = 255)
    @Column(name = "display_name", length = 255)
    private String displayName;

    @Size(max = 255)
    @Column(name = "context_name", length = 255)
    private String contextName;

    @Size(max = 30)
    @Column(name = "context_role", length = 30)
    private String contextRole;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @NotNull
    @Column(name = "available_at", nullable = false)
    private Instant availableAt;

    @Column(name = "lease_until")
    private Instant leaseUntil;

    @NotNull
    @Size(max = 20)
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @NotNull
    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_error", length = 80)
    private String lastError;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    public Long getId() { return id; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getTemplateKey() { return templateKey; }
    public void setTemplateKey(String templateKey) { this.templateKey = templateKey; }
    public String getLinkSource() { return linkSource; }
    public void setLinkSource(String linkSource) { this.linkSource = linkSource; }
    public Long getLinkSourceId() { return linkSourceId; }
    public void setLinkSourceId(Long linkSourceId) { this.linkSourceId = linkSourceId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getContextName() { return contextName; }
    public void setContextName(String contextName) { this.contextName = contextName; }
    public String getContextRole() { return contextRole; }
    public void setContextRole(String contextRole) { this.contextRole = contextRole; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getAvailableAt() { return availableAt; }
    public void setAvailableAt(Instant availableAt) { this.availableAt = availableAt; }
    public Instant getLeaseUntil() { return leaseUntil; }
    public void setLeaseUntil(Instant leaseUntil) { this.leaseUntil = leaseUntil; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
