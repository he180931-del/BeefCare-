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
 * Payment (gộp Subscription Receipt)
 */
@Schema(description = "Payment (gộp Subscription Receipt)")
@Entity
@Table(name = "payment")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Payment implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 50)
    @Column(name = "quote_ref", length = 50, nullable = false, unique = true)
    private String quoteRef;

    /**
     * ERD: varchar(255); giá trị 1, 2 hoặc 3 năm
     */
    @Schema(description = "ERD: varchar(255); giá trị 1, 2 hoặc 3 năm", required = true)
    @NotNull
    @Min(value = 1)
    @Max(value = 3)
    @Column(name = "duration_years", nullable = false)
    private Integer durationYears;

    @NotNull
    @Column(name = "amount_vnd", precision = 21, scale = 2, nullable = false)
    private BigDecimal amountVnd;

    /**
     * PENDING | PAID | EXPIRED
     */
    @Schema(description = "PENDING | PAID | EXPIRED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "state", length = 30, nullable = false)
    private String state;

    @NotNull
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /**
     * ERD: purchased_start/end varchar(255) - tách 2 cột thời điểm, chỉ có khi PAID
     */
    @Schema(description = "ERD: purchased_start/end varchar(255) - tách 2 cột thời điểm, chỉ có khi PAID")
    @Column(name = "purchased_start")
    private Instant purchasedStart;

    @Column(name = "purchased_end")
    private Instant purchasedEnd;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "planVersion" }, allowSetters = true)
    private Subscription subscription;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser requestedBy;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @NotNull
    @JsonIgnoreProperties(value = {}, allowSetters = true)
    private PlanVersion priceVersion;

    @NotNull
    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Size(max = 40)
    @Column(name = "receipt_code", length = 40, unique = true)
    private String receiptCode;

    @Size(max = 100)
    @Column(name = "receiving_account_namespace", length = 100)
    private String receivingAccountNamespace;

    @Column(name = "receiving_environment", length = 20)
    private String receivingEnvironment;

    @Size(max = 50)
    @Column(name = "receiving_account", length = 50)
    private String receivingAccount;

    @Size(max = 30)
    @Column(name = "receiving_bank_code", length = 30)
    private String receivingBankCode;

    @Size(max = 150)
    @Column(name = "receiving_account_name", length = 150)
    private String receivingAccountName;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Payment id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQuoteRef() {
        return this.quoteRef;
    }

    public Payment quoteRef(String quoteRef) {
        this.setQuoteRef(quoteRef);
        return this;
    }

    public void setQuoteRef(String quoteRef) {
        this.quoteRef = quoteRef;
    }

    public Integer getDurationYears() {
        return this.durationYears;
    }

    public Payment durationYears(Integer durationYears) {
        this.setDurationYears(durationYears);
        return this;
    }

    public void setDurationYears(Integer durationYears) {
        this.durationYears = durationYears;
    }

    public BigDecimal getAmountVnd() {
        return this.amountVnd;
    }

    public Payment amountVnd(BigDecimal amountVnd) {
        this.setAmountVnd(amountVnd);
        return this;
    }

    public void setAmountVnd(BigDecimal amountVnd) {
        this.amountVnd = amountVnd;
    }

    public String getState() {
        return this.state;
    }

    public Payment state(String state) {
        this.setState(state);
        return this;
    }

    public void setState(String state) {
        this.state = state;
    }

    public Instant getExpiresAt() {
        return this.expiresAt;
    }

    public Payment expiresAt(Instant expiresAt) {
        this.setExpiresAt(expiresAt);
        return this;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getPurchasedStart() {
        return this.purchasedStart;
    }

    public Payment purchasedStart(Instant purchasedStart) {
        this.setPurchasedStart(purchasedStart);
        return this;
    }

    public void setPurchasedStart(Instant purchasedStart) {
        this.purchasedStart = purchasedStart;
    }

    public Instant getPurchasedEnd() {
        return this.purchasedEnd;
    }

    public Payment purchasedEnd(Instant purchasedEnd) {
        this.setPurchasedEnd(purchasedEnd);
        return this;
    }

    public void setPurchasedEnd(Instant purchasedEnd) {
        this.purchasedEnd = purchasedEnd;
    }

    public Subscription getSubscription() {
        return this.subscription;
    }

    public void setSubscription(Subscription subscription) {
        this.subscription = subscription;
    }

    public Payment subscription(Subscription subscription) {
        this.setSubscription(subscription);
        return this;
    }

    public AppUser getRequestedBy() {
        return this.requestedBy;
    }

    public void setRequestedBy(AppUser appUser) {
        this.requestedBy = appUser;
    }

    public Payment requestedBy(AppUser appUser) {
        this.setRequestedBy(appUser);
        return this;
    }

    public PlanVersion getPriceVersion() { return priceVersion; }
    public void setPriceVersion(PlanVersion priceVersion) { this.priceVersion = priceVersion; }
    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public String getReceiptCode() { return receiptCode; }
    public void setReceiptCode(String receiptCode) { this.receiptCode = receiptCode; }
    public String getReceivingAccountNamespace() { return receivingAccountNamespace; }
    public void setReceivingAccountNamespace(String receivingAccountNamespace) { this.receivingAccountNamespace = receivingAccountNamespace; }
    public String getReceivingEnvironment() { return receivingEnvironment; }
    public void setReceivingEnvironment(String receivingEnvironment) { this.receivingEnvironment = receivingEnvironment; }
    public String getReceivingAccount() { return receivingAccount; }
    public void setReceivingAccount(String receivingAccount) { this.receivingAccount = receivingAccount; }
    public String getReceivingBankCode() { return receivingBankCode; }
    public void setReceivingBankCode(String receivingBankCode) { this.receivingBankCode = receivingBankCode; }
    public String getReceivingAccountName() { return receivingAccountName; }
    public void setReceivingAccountName(String receivingAccountName) { this.receivingAccountName = receivingAccountName; }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Payment)) {
            return false;
        }
        return getId() != null && getId().equals(((Payment) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Payment{" +
            "id=" + getId() +
            ", quoteRef='" + getQuoteRef() + "'" +
            ", durationYears=" + getDurationYears() +
            ", amountVnd=" + getAmountVnd() +
            ", state='" + getState() + "'" +
            ", expiresAt='" + getExpiresAt() + "'" +
            ", purchasedStart='" + getPurchasedStart() + "'" +
            ", purchasedEnd='" + getPurchasedEnd() + "'" +
            "}";
    }
}
