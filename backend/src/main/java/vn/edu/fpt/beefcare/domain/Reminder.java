package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A Reminder.
 */
@Entity
@Table(name = "reminder")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Reminder implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "rule_type", length = 30, nullable = false)
    private String ruleType;

    @NotNull
    @Size(max = 255)
    @Column(name = "source_record", length = 255, nullable = false)
    private String sourceRecord;

    @NotNull
    @Column(name = "due_time", nullable = false)
    private Instant dueTime;

    /**
     * ACTIVE | RESOLVED | CANCELLED | SUPERSEDED
     */
    @Schema(description = "ACTIVE | RESOLVED | CANCELLED | SUPERSEDED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Reminder id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRuleType() {
        return this.ruleType;
    }

    public Reminder ruleType(String ruleType) {
        this.setRuleType(ruleType);
        return this;
    }

    public void setRuleType(String ruleType) {
        this.ruleType = ruleType;
    }

    public String getSourceRecord() {
        return this.sourceRecord;
    }

    public Reminder sourceRecord(String sourceRecord) {
        this.setSourceRecord(sourceRecord);
        return this;
    }

    public void setSourceRecord(String sourceRecord) {
        this.sourceRecord = sourceRecord;
    }

    public Instant getDueTime() {
        return this.dueTime;
    }

    public Reminder dueTime(Instant dueTime) {
        this.setDueTime(dueTime);
        return this;
    }

    public void setDueTime(Instant dueTime) {
        this.dueTime = dueTime;
    }

    public String getStatus() {
        return this.status;
    }

    public Reminder status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Reminder farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public Reminder cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Reminder)) {
            return false;
        }
        return getId() != null && getId().equals(((Reminder) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Reminder{" +
            "id=" + getId() +
            ", ruleType='" + getRuleType() + "'" +
            ", sourceRecord='" + getSourceRecord() + "'" +
            ", dueTime='" + getDueTime() + "'" +
            ", status='" + getStatus() + "'" +
            "}";
    }
}
