package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A SupportTicket.
 */
@Entity
@Table(name = "support_ticket")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class SupportTicket implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "category", length = 30, nullable = false)
    private String category;

    @NotNull
    @Size(max = 30)
    @Column(name = "priority", length = 30, nullable = false)
    private String priority;

    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser requester;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser assignedCs;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public SupportTicket id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategory() {
        return this.category;
    }

    public SupportTicket category(String category) {
        this.setCategory(category);
        return this;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getPriority() {
        return this.priority;
    }

    public SupportTicket priority(String priority) {
        this.setPriority(priority);
        return this;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return this.status;
    }

    public SupportTicket status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public AppUser getRequester() {
        return this.requester;
    }

    public void setRequester(AppUser appUser) {
        this.requester = appUser;
    }

    public SupportTicket requester(AppUser appUser) {
        this.setRequester(appUser);
        return this;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public SupportTicket farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    public AppUser getAssignedCs() {
        return this.assignedCs;
    }

    public void setAssignedCs(AppUser appUser) {
        this.assignedCs = appUser;
    }

    public SupportTicket assignedCs(AppUser appUser) {
        this.setAssignedCs(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof SupportTicket)) {
            return false;
        }
        return getId() != null && getId().equals(((SupportTicket) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "SupportTicket{" +
            "id=" + getId() +
            ", category='" + getCategory() + "'" +
            ", priority='" + getPriority() + "'" +
            ", status='" + getStatus() + "'" +
            "}";
    }
}
