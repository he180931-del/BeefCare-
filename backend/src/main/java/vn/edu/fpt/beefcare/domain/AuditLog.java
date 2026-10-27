package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A AuditLog.
 */
@Entity
@Table(name = "audit_log")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class AuditLog implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "action", length = 30, nullable = false)
    private String action;

    /**
     * ERD: target_type/id - tách thành 2 cột
     */
    @Schema(description = "ERD: target_type/id - tách thành 2 cột", required = true)
    @NotNull
    @Size(max = 50)
    @Column(name = "target_type", length = 50, nullable = false)
    private String targetType;

    @NotNull
    @Column(name = "target_id", nullable = false)
    private Long targetId;

    /**
     * ERD: time
     */
    @Schema(description = "ERD: time", required = true)
    @NotNull
    @Column(name = "logged_at", nullable = false)
    private Instant loggedAt;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser actor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public AuditLog id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAction() {
        return this.action;
    }

    public AuditLog action(String action) {
        this.setAction(action);
        return this;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getTargetType() {
        return this.targetType;
    }

    public AuditLog targetType(String targetType) {
        this.setTargetType(targetType);
        return this;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public Long getTargetId() {
        return this.targetId;
    }

    public AuditLog targetId(Long targetId) {
        this.setTargetId(targetId);
        return this;
    }

    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }

    public Instant getLoggedAt() {
        return this.loggedAt;
    }

    public AuditLog loggedAt(Instant loggedAt) {
        this.setLoggedAt(loggedAt);
        return this;
    }

    public void setLoggedAt(Instant loggedAt) {
        this.loggedAt = loggedAt;
    }

    public AppUser getActor() {
        return this.actor;
    }

    public void setActor(AppUser appUser) {
        this.actor = appUser;
    }

    public AuditLog actor(AppUser appUser) {
        this.setActor(appUser);
        return this;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public AuditLog farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AuditLog)) {
            return false;
        }
        return getId() != null && getId().equals(((AuditLog) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "AuditLog{" +
            "id=" + getId() +
            ", action='" + getAction() + "'" +
            ", targetType='" + getTargetType() + "'" +
            ", targetId=" + getTargetId() +
            ", loggedAt='" + getLoggedAt() + "'" +
            "}";
    }
}
