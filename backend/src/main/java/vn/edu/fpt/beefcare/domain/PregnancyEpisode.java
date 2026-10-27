package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A PregnancyEpisode.
 */
@Entity
@Table(name = "pregnancy_episode")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PregnancyEpisode implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "expected_calving_date", nullable = false)
    private LocalDate expectedCalvingDate;

    @NotNull
    @Column(name = "parity", nullable = false)
    private Integer parity;

    /**
     * OPEN | CALVED | LOST
     */
    @Schema(description = "OPEN | CALVED | LOST", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @JsonIgnoreProperties(value = { "cattle", "linkedEvent", "pregnancyEpisode" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @NotNull
    @JoinColumn(unique = true)
    private ReproductionEvent confirmingCheck;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public PregnancyEpisode id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getExpectedCalvingDate() {
        return this.expectedCalvingDate;
    }

    public PregnancyEpisode expectedCalvingDate(LocalDate expectedCalvingDate) {
        this.setExpectedCalvingDate(expectedCalvingDate);
        return this;
    }

    public void setExpectedCalvingDate(LocalDate expectedCalvingDate) {
        this.expectedCalvingDate = expectedCalvingDate;
    }

    public Integer getParity() {
        return this.parity;
    }

    public PregnancyEpisode parity(Integer parity) {
        this.setParity(parity);
        return this;
    }

    public void setParity(Integer parity) {
        this.parity = parity;
    }

    public String getStatus() {
        return this.status;
    }

    public PregnancyEpisode status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public ReproductionEvent getConfirmingCheck() {
        return this.confirmingCheck;
    }

    public void setConfirmingCheck(ReproductionEvent reproductionEvent) {
        this.confirmingCheck = reproductionEvent;
    }

    public PregnancyEpisode confirmingCheck(ReproductionEvent reproductionEvent) {
        this.setConfirmingCheck(reproductionEvent);
        return this;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public PregnancyEpisode cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PregnancyEpisode)) {
            return false;
        }
        return getId() != null && getId().equals(((PregnancyEpisode) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PregnancyEpisode{" +
            "id=" + getId() +
            ", expectedCalvingDate='" + getExpectedCalvingDate() + "'" +
            ", parity=" + getParity() +
            ", status='" + getStatus() + "'" +
            "}";
    }
}
