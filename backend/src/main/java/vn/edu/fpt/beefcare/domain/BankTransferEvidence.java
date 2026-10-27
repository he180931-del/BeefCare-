package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Bank Transfer Evidence (gộp Webhook Delivery, Canonical Bank Source)
 */
@Schema(description = "Bank Transfer Evidence (gộp Webhook Delivery, Canonical Bank Source)")
@Entity
@Table(name = "bank_transfer_evidence")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class BankTransferEvidence implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "provider_txn_id", nullable = false)
    private Long providerTxnId;

    @NotNull
    @Column(name = "amount", precision = 21, scale = 2, nullable = false)
    private BigDecimal amount;

    @NotNull
    @Column(name = "bank_paid_at", nullable = false)
    private Instant bankPaidAt;

    /**
     * ERD: NOT NULL; để trống được vì SePay có thể gửi code = null
     */
    @Schema(description = "ERD: NOT NULL; để trống được vì SePay có thể gửi code = null")
    @Size(max = 50)
    @Column(name = "quote_ref", length = 50)
    private String quoteRef;

    /**
     * ERD: delivery/auth outcome - tách 2 cột
     */
    @Schema(description = "ERD: delivery/auth outcome - tách 2 cột")
    @Size(max = 30)
    @Column(name = "delivery_outcome", length = 30)
    private String deliveryOutcome;

    @Size(max = 30)
    @Column(name = "auth_outcome", length = 30)
    private String authOutcome;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "subscription", "requestedBy" }, allowSetters = true)
    private Payment payment;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public BankTransferEvidence id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProviderTxnId() {
        return this.providerTxnId;
    }

    public BankTransferEvidence providerTxnId(Long providerTxnId) {
        this.setProviderTxnId(providerTxnId);
        return this;
    }

    public void setProviderTxnId(Long providerTxnId) {
        this.providerTxnId = providerTxnId;
    }

    public BigDecimal getAmount() {
        return this.amount;
    }

    public BankTransferEvidence amount(BigDecimal amount) {
        this.setAmount(amount);
        return this;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Instant getBankPaidAt() {
        return this.bankPaidAt;
    }

    public BankTransferEvidence bankPaidAt(Instant bankPaidAt) {
        this.setBankPaidAt(bankPaidAt);
        return this;
    }

    public void setBankPaidAt(Instant bankPaidAt) {
        this.bankPaidAt = bankPaidAt;
    }

    public String getQuoteRef() {
        return this.quoteRef;
    }

    public BankTransferEvidence quoteRef(String quoteRef) {
        this.setQuoteRef(quoteRef);
        return this;
    }

    public void setQuoteRef(String quoteRef) {
        this.quoteRef = quoteRef;
    }

    public String getDeliveryOutcome() {
        return this.deliveryOutcome;
    }

    public BankTransferEvidence deliveryOutcome(String deliveryOutcome) {
        this.setDeliveryOutcome(deliveryOutcome);
        return this;
    }

    public void setDeliveryOutcome(String deliveryOutcome) {
        this.deliveryOutcome = deliveryOutcome;
    }

    public String getAuthOutcome() {
        return this.authOutcome;
    }

    public BankTransferEvidence authOutcome(String authOutcome) {
        this.setAuthOutcome(authOutcome);
        return this;
    }

    public void setAuthOutcome(String authOutcome) {
        this.authOutcome = authOutcome;
    }

    public Payment getPayment() {
        return this.payment;
    }

    public void setPayment(Payment payment) {
        this.payment = payment;
    }

    public BankTransferEvidence payment(Payment payment) {
        this.setPayment(payment);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof BankTransferEvidence)) {
            return false;
        }
        return getId() != null && getId().equals(((BankTransferEvidence) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "BankTransferEvidence{" +
            "id=" + getId() +
            ", providerTxnId=" + getProviderTxnId() +
            ", amount=" + getAmount() +
            ", bankPaidAt='" + getBankPaidAt() + "'" +
            ", quoteRef='" + getQuoteRef() + "'" +
            ", deliveryOutcome='" + getDeliveryOutcome() + "'" +
            ", authOutcome='" + getAuthOutcome() + "'" +
            "}";
    }
}
