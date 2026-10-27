package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

/**
 * A CalfOutcome.
 */
@Entity
@Table(name = "calf_outcome")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class CalfOutcome implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * LIVE | STILLBORN
     */
    @Schema(description = "LIVE | STILLBORN")
    @Size(max = 30)
    @Column(name = "outcome", length = 30)
    private String outcome;

    @Size(max = 30)
    @Column(name = "sex", length = 30)
    private String sex;

    @Column(name = "birth_weight", precision = 21, scale = 2)
    private BigDecimal birthWeight;

    @NotNull
    @Size(max = 30)
    @Column(name = "registration_state", length = 30, nullable = false)
    private String registrationState;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "dam", "episode" }, allowSetters = true)
    private CalvingEvent calving;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle registeredCattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public CalfOutcome id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOutcome() {
        return this.outcome;
    }

    public CalfOutcome outcome(String outcome) {
        this.setOutcome(outcome);
        return this;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getSex() {
        return this.sex;
    }

    public CalfOutcome sex(String sex) {
        this.setSex(sex);
        return this;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public BigDecimal getBirthWeight() {
        return this.birthWeight;
    }

    public CalfOutcome birthWeight(BigDecimal birthWeight) {
        this.setBirthWeight(birthWeight);
        return this;
    }

    public void setBirthWeight(BigDecimal birthWeight) {
        this.birthWeight = birthWeight;
    }

    public String getRegistrationState() {
        return this.registrationState;
    }

    public CalfOutcome registrationState(String registrationState) {
        this.setRegistrationState(registrationState);
        return this;
    }

    public void setRegistrationState(String registrationState) {
        this.registrationState = registrationState;
    }

    public CalvingEvent getCalving() {
        return this.calving;
    }

    public void setCalving(CalvingEvent calvingEvent) {
        this.calving = calvingEvent;
    }

    public CalfOutcome calving(CalvingEvent calvingEvent) {
        this.setCalving(calvingEvent);
        return this;
    }

    public Cattle getRegisteredCattle() {
        return this.registeredCattle;
    }

    public void setRegisteredCattle(Cattle cattle) {
        this.registeredCattle = cattle;
    }

    public CalfOutcome registeredCattle(Cattle cattle) {
        this.setRegisteredCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CalfOutcome)) {
            return false;
        }
        return getId() != null && getId().equals(((CalfOutcome) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "CalfOutcome{" +
            "id=" + getId() +
            ", outcome='" + getOutcome() + "'" +
            ", sex='" + getSex() + "'" +
            ", birthWeight=" + getBirthWeight() +
            ", registrationState='" + getRegistrationState() + "'" +
            "}";
    }
}
