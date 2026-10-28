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

    @NotNull
    @Size(max = 30)
    @Column(name = "record_code", length = 30, nullable = false, unique = true)
    private String recordCode;

    @NotNull
    @Size(max = 20)
    @Column(name = "scope", length = 20, nullable = false)
    private String scope = "GENERAL";

    @Size(max = 100)
    @Column(name = "document_number", length = 100)
    private String documentNumber;

    @Size(max = 500)
    @Column(name = "description", length = 500)
    private String description;

    @NotNull
    @Size(max = 30)
    @Column(name = "source_type", length = 30, nullable = false)
    private String sourceType = "MANUAL";

    @Size(max = 255)
    @Column(name = "source_reference", length = 255)
    private String sourceReference;

    @NotNull
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private java.time.Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private AppUser createdBy;

    @Column(name = "updated_at")
    private java.time.Instant updatedAt;

    @Column(name = "posted_at")
    private java.time.Instant postedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "posted_by_id")
    private AppUser postedBy;

    @Column(name = "voided_at")
    private java.time.Instant voidedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voided_by_id")
    private AppUser voidedBy;

    @Size(max = 500)
    @Column(name = "void_reason", length = 500)
    private String voidReason;

    @Column(name = "discarded_at")
    private java.time.Instant discardedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "discarded_by_id")
    private AppUser discardedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replacement_record_id")
    private ManualFinanceRecord replacementRecord;

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

    public String getRecordCode() { return recordCode; }
    public void setRecordCode(String recordCode) { this.recordCode = recordCode; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getSourceReference() { return sourceReference; }
    public void setSourceReference(String sourceReference) { this.sourceReference = sourceReference; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public java.time.Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(java.time.Instant createdAt) { this.createdAt = createdAt; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public java.time.Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.Instant updatedAt) { this.updatedAt = updatedAt; }
    public java.time.Instant getPostedAt() { return postedAt; }
    public void setPostedAt(java.time.Instant postedAt) { this.postedAt = postedAt; }
    public AppUser getPostedBy() { return postedBy; }
    public void setPostedBy(AppUser postedBy) { this.postedBy = postedBy; }
    public java.time.Instant getVoidedAt() { return voidedAt; }
    public void setVoidedAt(java.time.Instant voidedAt) { this.voidedAt = voidedAt; }
    public AppUser getVoidedBy() { return voidedBy; }
    public void setVoidedBy(AppUser voidedBy) { this.voidedBy = voidedBy; }
    public String getVoidReason() { return voidReason; }
    public void setVoidReason(String voidReason) { this.voidReason = voidReason; }
    public java.time.Instant getDiscardedAt() { return discardedAt; }
    public void setDiscardedAt(java.time.Instant discardedAt) { this.discardedAt = discardedAt; }
    public AppUser getDiscardedBy() { return discardedBy; }
    public void setDiscardedBy(AppUser discardedBy) { this.discardedBy = discardedBy; }
    public ManualFinanceRecord getReplacementRecord() { return replacementRecord; }
    public void setReplacementRecord(ManualFinanceRecord replacementRecord) { this.replacementRecord = replacementRecord; }

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
