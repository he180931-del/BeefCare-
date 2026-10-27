package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A ManualFinanceRecord.
 */
@Entity
@Table(name = "manual_finance_record")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ManualFinanceRecord implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * INCOME | EXPENSE
     */
    @Schema(description = "INCOME | EXPENSE", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "type", length = 30, nullable = false)
    private String type;

    @NotNull
    @Size(max = 30)
    @Column(name = "category", length = 30, nullable = false)
    private String category;

    @NotNull
    @Column(name = "amount_vnd", precision = 21, scale = 2, nullable = false)
    private BigDecimal amountVnd;

    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    /**
     * DRAFT | POSTED | VOID
     */
    @Schema(description = "DRAFT | POSTED | VOID", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "state", length = 30, nullable = false)
    private String state;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public ManualFinanceRecord id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return this.type;
    }

    public ManualFinanceRecord type(String type) {
        this.setType(type);
        return this;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCategory() {
        return this.category;
    }

    public ManualFinanceRecord category(String category) {
        this.setCategory(category);
        return this;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getAmountVnd() {
        return this.amountVnd;
    }

    public ManualFinanceRecord amountVnd(BigDecimal amountVnd) {
        this.setAmountVnd(amountVnd);
        return this;
    }

    public void setAmountVnd(BigDecimal amountVnd) {
        this.amountVnd = amountVnd;
    }

    public LocalDate getOccurredOn() {
        return this.occurredOn;
    }

    public ManualFinanceRecord occurredOn(LocalDate occurredOn) {
        this.setOccurredOn(occurredOn);
        return this;
    }

    public void setOccurredOn(LocalDate occurredOn) {
        this.occurredOn = occurredOn;
    }

    public String getState() {
        return this.state;
    }

    public ManualFinanceRecord state(String state) {
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

    public ManualFinanceRecord farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ManualFinanceRecord)) {
            return false;
        }
        return getId() != null && getId().equals(((ManualFinanceRecord) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ManualFinanceRecord{" +
            "id=" + getId() +
            ", type='" + getType() + "'" +
            ", category='" + getCategory() + "'" +
            ", amountVnd=" + getAmountVnd() +
            ", occurredOn='" + getOccurredOn() + "'" +
            ", state='" + getState() + "'" +
            "}";
    }
}
