package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A Farm.
 */
@Entity
@Table(name = "farm")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Farm implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 255)
    @Column(name = "name", length = 255, nullable = false)
    private String name;

    @NotNull
    @Size(max = 255)
    @Column(name = "location", length = 255, nullable = false)
    private String location;

    @NotNull
    @Size(max = 255)
    @Column(name = "contact", length = 255, nullable = false)
    private String contact;

    @NotNull
    @Size(max = 30)
    @Column(name = "service_status", length = 30, nullable = false)
    private String serviceStatus;

    @JsonIgnoreProperties(value = { "farm", "planVersion" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "farm")
    private Subscription subscription;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Farm id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return this.name;
    }

    public Farm name(String name) {
        this.setName(name);
        return this;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return this.location;
    }

    public Farm location(String location) {
        this.setLocation(location);
        return this;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getContact() {
        return this.contact;
    }

    public Farm contact(String contact) {
        this.setContact(contact);
        return this;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getServiceStatus() {
        return this.serviceStatus;
    }

    public Farm serviceStatus(String serviceStatus) {
        this.setServiceStatus(serviceStatus);
        return this;
    }

    public void setServiceStatus(String serviceStatus) {
        this.serviceStatus = serviceStatus;
    }

    public Subscription getSubscription() {
        return this.subscription;
    }

    public void setSubscription(Subscription subscription) {
        if (this.subscription != null) {
            this.subscription.setFarm(null);
        }
        if (subscription != null) {
            subscription.setFarm(this);
        }
        this.subscription = subscription;
    }

    public Farm subscription(Subscription subscription) {
        this.setSubscription(subscription);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Farm)) {
            return false;
        }
        return getId() != null && getId().equals(((Farm) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Farm{" +
            "id=" + getId() +
            ", name='" + getName() + "'" +
            ", location='" + getLocation() + "'" +
            ", contact='" + getContact() + "'" +
            ", serviceStatus='" + getServiceStatus() + "'" +
            "}";
    }
}
