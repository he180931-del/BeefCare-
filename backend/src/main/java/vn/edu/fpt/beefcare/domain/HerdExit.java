package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A HerdExit.
 */
@Entity
@Table(name = "herd_exit")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HerdExit implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * SALE | DEATH | CULL | OTHER
     */
    @Schema(description = "SALE | DEATH | CULL | OTHER", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "type", length = 30, nullable = false)
    private String type;

    @NotNull
    @Column(name = "exit_date", nullable = false)
    private LocalDate exitDate;

    @Lob
    @Column(name = "reason")
    private String reason;

    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @NotNull
    @JoinColumn(unique = true)
    private Cattle cattle;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser confirmedBy;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public HerdExit id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return this.type;
    }

    public HerdExit type(String type) {
        this.setType(type);
        return this;
    }

    public void setType(String type) {
        this.type = type;
    }

    public LocalDate getExitDate() {
        return this.exitDate;
    }

    public HerdExit exitDate(LocalDate exitDate) {
        this.setExitDate(exitDate);
        return this;
    }

    public void setExitDate(LocalDate exitDate) {
        this.exitDate = exitDate;
    }

    public String getReason() {
        return this.reason;
    }

    public HerdExit reason(String reason) {
        this.setReason(reason);
        return this;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public HerdExit cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    public AppUser getConfirmedBy() {
        return this.confirmedBy;
    }

    public void setConfirmedBy(AppUser appUser) {
        this.confirmedBy = appUser;
    }

    public HerdExit confirmedBy(AppUser appUser) {
        this.setConfirmedBy(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HerdExit)) {
            return false;
        }
        return getId() != null && getId().equals(((HerdExit) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HerdExit{" +
            "id=" + getId() +
            ", type='" + getType() + "'" +
            ", exitDate='" + getExitDate() + "'" +
            ", reason='" + getReason() + "'" +
            "}";
    }
}
