package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * Lời mời thành viên (gộp Invitation Permission)
 */
@Schema(description = "Lời mời thành viên (gộp Invitation Permission)")
@Entity
@Table(name = "farm_invitation")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class FarmInvitation implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 255)
    @Column(name = "invited_email", length = 255, nullable = false)
    private String invitedEmail;

    @NotNull
    @Size(max = 30)
    @Column(name = "proposed_role", length = 30, nullable = false)
    private String proposedRole;

    @Size(max = 255)
    @Column(name = "proposed_permissions", length = 255)
    private String proposedPermissions;

    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @NotNull
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public FarmInvitation id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getInvitedEmail() {
        return this.invitedEmail;
    }

    public FarmInvitation invitedEmail(String invitedEmail) {
        this.setInvitedEmail(invitedEmail);
        return this;
    }

    public void setInvitedEmail(String invitedEmail) {
        this.invitedEmail = invitedEmail;
    }

    public String getProposedRole() {
        return this.proposedRole;
    }

    public FarmInvitation proposedRole(String proposedRole) {
        this.setProposedRole(proposedRole);
        return this;
    }

    public void setProposedRole(String proposedRole) {
        this.proposedRole = proposedRole;
    }

    public String getProposedPermissions() {
        return this.proposedPermissions;
    }

    public FarmInvitation proposedPermissions(String proposedPermissions) {
        this.setProposedPermissions(proposedPermissions);
        return this;
    }

    public void setProposedPermissions(String proposedPermissions) {
        this.proposedPermissions = proposedPermissions;
    }

    public String getStatus() {
        return this.status;
    }

    public FarmInvitation status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getExpiresAt() {
        return this.expiresAt;
    }

    public FarmInvitation expiresAt(Instant expiresAt) {
        this.setExpiresAt(expiresAt);
        return this;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public FarmInvitation farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof FarmInvitation)) {
            return false;
        }
        return getId() != null && getId().equals(((FarmInvitation) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "FarmInvitation{" +
            "id=" + getId() +
            ", invitedEmail='" + getInvitedEmail() + "'" +
            ", proposedRole='" + getProposedRole() + "'" +
            ", proposedPermissions='" + getProposedPermissions() + "'" +
            ", status='" + getStatus() + "'" +
            ", expiresAt='" + getExpiresAt() + "'" +
            "}";
    }
}
