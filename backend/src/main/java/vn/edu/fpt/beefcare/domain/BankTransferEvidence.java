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

    @NotNull
    @Size(max = 20)
    @Column(name = "provider", length = 20, nullable = false)
    private String provider;

    @NotNull
    @Size(max = 20)
    @Column(name = "environment", length = 20, nullable = false)
    private String environment;

    @NotNull
    @Size(max = 100)
    @Column(name = "account_namespace", length = 100, nullable = false)
    private String accountNamespace;

    @Size(max = 20)
    @Column(name = "transfer_direction", length = 20)
    private String transferDirection;

    @Size(max = 50)
    @Column(name = "receiving_account", length = 50)
    private String receivingAccount;

    @Size(max = 255)
    @Column(name = "transfer_content", length = 255)
    private String transferContent;

    @Size(max = 100)
    @Column(name = "gateway", length = 100)
    private String gateway;

    @Size(max = 100)
    @Column(name = "reference_code", length = 100)
    private String referenceCode;

    @NotNull
    @Size(max = 30)
    @Column(name = "review_status", length = 30, nullable = false)
    private String reviewStatus;

    @Size(max = 500)
    @Column(name = "review_reason", length = 500)
    private String reviewReason;

    @Column(name = "locked_for_return", nullable = false)
    private boolean lockedForReturn;

    @Size(max = 255)
    @Column(name = "return_reference", length = 255)
    private String returnReference;

    @Size(max = 500)
    @Column(name = "return_result", length = 500)
    private String returnResult;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Size(max = 64)
    @Column(name = "payload_hash", length = 64)
    private String payloadHash;

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

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }
    public String getAccountNamespace() { return accountNamespace; }
    public void setAccountNamespace(String accountNamespace) { this.accountNamespace = accountNamespace; }
    public String getTransferDirection() { return transferDirection; }
    public void setTransferDirection(String transferDirection) { this.transferDirection = transferDirection; }
    public String getReceivingAccount() { return receivingAccount; }
    public void setReceivingAccount(String receivingAccount) { this.receivingAccount = receivingAccount; }
    public String getTransferContent() { return transferContent; }
    public void setTransferContent(String transferContent) { this.transferContent = transferContent; }
    public String getGateway() { return gateway; }
    public void setGateway(String gateway) { this.gateway = gateway; }
    public String getReferenceCode() { return referenceCode; }
    public void setReferenceCode(String referenceCode) { this.referenceCode = referenceCode; }
    public String getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(String reviewStatus) { this.reviewStatus = reviewStatus; }
    public String getReviewReason() { return reviewReason; }
    public void setReviewReason(String reviewReason) { this.reviewReason = reviewReason; }
    public boolean isLockedForReturn() { return lockedForReturn; }
    public void setLockedForReturn(boolean lockedForReturn) { this.lockedForReturn = lockedForReturn; }
    public String getReturnReference() { return returnReference; }
    public void setReturnReference(String returnReference) { this.returnReference = returnReference; }
    public String getReturnResult() { return returnResult; }
    public void setReturnResult(String returnResult) { this.returnResult = returnResult; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public String getPayloadHash() { return payloadHash; }
    public void setPayloadHash(String payloadHash) { this.payloadHash = payloadHash; }

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
