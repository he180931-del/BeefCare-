package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A FarmAnnouncement.
 */
@Entity
@Table(name = "farm_announcement")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class FarmAnnouncement implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "state", length = 30, nullable = false)
    private String state;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "user" }, allowSetters = true)
    private FarmMembership author;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public FarmAnnouncement id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getState() {
        return this.state;
    }

    public FarmAnnouncement state(String state) {
        this.setState(state);
        return this;
    }

    public void setState(String state) {
        this.state = state;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public FarmAnnouncement farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    public FarmMembership getAuthor() {
        return this.author;
    }

    public void setAuthor(FarmMembership farmMembership) {
        this.author = farmMembership;
    }

    public FarmAnnouncement author(FarmMembership farmMembership) {
        this.setAuthor(farmMembership);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof FarmAnnouncement)) {
            return false;
        }
        return getId() != null && getId().equals(((FarmAnnouncement) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "FarmAnnouncement{" +
            "id=" + getId() +
            ", state='" + getState() + "'" +
            "}";
    }
}
