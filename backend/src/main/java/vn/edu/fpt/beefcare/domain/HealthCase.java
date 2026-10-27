package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A HealthCase.
 */
@Entity
@Table(name = "health_case")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HealthCase implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "opened_date", nullable = false)
    private LocalDate openedDate;

    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Size(max = 30)
    @Column(name = "outcome", length = 30)
    private String outcome;

    @Column(name = "closed_date")
    private LocalDate closedDate;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public HealthCase id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getOpenedDate() {
        return this.openedDate;
    }

    public HealthCase openedDate(LocalDate openedDate) {
        this.setOpenedDate(openedDate);
        return this;
    }

    public void setOpenedDate(LocalDate openedDate) {
        this.openedDate = openedDate;
    }

    public String getStatus() {
        return this.status;
    }

    public HealthCase status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOutcome() {
        return this.outcome;
    }

    public HealthCase outcome(String outcome) {
        this.setOutcome(outcome);
        return this;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public LocalDate getClosedDate() {
        return this.closedDate;
    }

    public HealthCase closedDate(LocalDate closedDate) {
        this.setClosedDate(closedDate);
        return this;
    }

    public void setClosedDate(LocalDate closedDate) {
        this.closedDate = closedDate;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public HealthCase cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HealthCase)) {
            return false;
        }
        return getId() != null && getId().equals(((HealthCase) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HealthCase{" +
            "id=" + getId() +
            ", openedDate='" + getOpenedDate() + "'" +
            ", status='" + getStatus() + "'" +
            ", outcome='" + getOutcome() + "'" +
            ", closedDate='" + getClosedDate() + "'" +
            "}";
    }
}
