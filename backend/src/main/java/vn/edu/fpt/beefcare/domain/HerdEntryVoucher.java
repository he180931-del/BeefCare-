package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;

@Entity
@Table(name = "herd_entry_voucher", uniqueConstraints = {@UniqueConstraint(name = "uq_entry_voucher_code", columnNames = {"farm_id", "code"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HerdEntryVoucher implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id")
    private Farm farm;

    @NotNull
    @Size(max = 30)
    @Column(name = "code", length = 30, nullable = false)
    private String code;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", length = 30, nullable = false)
    private EntryType entryType;

    @NotNull
    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id")
    private TradingPartner seller;

    @Size(max = 50)
    @Column(name = "quarantine_cert_no", length = 50)
    private String quarantineCertNo;

    @Size(max = 20)
    @Column(name = "vehicle_plate", length = 20)
    private String vehiclePlate;

    @Size(max = 1000)
    @Column(name = "note", length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_basis", length = 30)
    private PricingBasis pricingBasis;

    @NotNull
    @Column(name = "cattle_amount", nullable = false)
    private Long cattleAmount = 0L;

    @NotNull
    @Column(name = "transport_fee", nullable = false)
    private Long transportFee = 0L;

    @NotNull
    @Column(name = "amount_paid", nullable = false)
    private Long amountPaid = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_due_date")
    private LocalDate paymentDueDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private EntryVoucherStatus status = EntryVoucherStatus.DRAFT;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id")
    private AppUser createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "posted_by_id")
    private AppUser postedBy;

    @Column(name = "posted_at")
    private Instant postedAt;

    @Size(max = 500)
    @Column(name = "void_reason", length = 500)
    private String voidReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voided_by_id")
    private AppUser voidedBy;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Farm getFarm() {
        return farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public EntryType getEntryType() {
        return entryType;
    }

    public void setEntryType(EntryType entryType) {
        this.entryType = entryType;
    }

    public LocalDate getEntryDate() {
        return entryDate;
    }

    public void setEntryDate(LocalDate entryDate) {
        this.entryDate = entryDate;
    }

    public TradingPartner getSeller() {
        return seller;
    }

    public void setSeller(TradingPartner seller) {
        this.seller = seller;
    }

    public String getQuarantineCertNo() {
        return quarantineCertNo;
    }

    public void setQuarantineCertNo(String quarantineCertNo) {
        this.quarantineCertNo = quarantineCertNo;
    }

    public String getVehiclePlate() {
        return vehiclePlate;
    }

    public void setVehiclePlate(String vehiclePlate) {
        this.vehiclePlate = vehiclePlate;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public PricingBasis getPricingBasis() {
        return pricingBasis;
    }

    public void setPricingBasis(PricingBasis pricingBasis) {
        this.pricingBasis = pricingBasis;
    }

    public Long getCattleAmount() {
        return cattleAmount;
    }

    public void setCattleAmount(Long cattleAmount) {
        this.cattleAmount = cattleAmount;
    }

    public Long getTransportFee() {
        return transportFee;
    }

    public void setTransportFee(Long transportFee) {
        this.transportFee = transportFee;
    }

    public Long getAmountPaid() {
        return amountPaid;
    }

    public void setAmountPaid(Long amountPaid) {
        this.amountPaid = amountPaid;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public LocalDate getPaymentDueDate() {
        return paymentDueDate;
    }

    public void setPaymentDueDate(LocalDate paymentDueDate) {
        this.paymentDueDate = paymentDueDate;
    }

    public EntryVoucherStatus getStatus() {
        return status;
    }

    public void setStatus(EntryVoucherStatus status) {
        this.status = status;
    }

    public AppUser getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(AppUser createdBy) {
        this.createdBy = createdBy;
    }

    public AppUser getPostedBy() {
        return postedBy;
    }

    public void setPostedBy(AppUser postedBy) {
        this.postedBy = postedBy;
    }

    public Instant getPostedAt() {
        return postedAt;
    }

    public void setPostedAt(Instant postedAt) {
        this.postedAt = postedAt;
    }

    public String getVoidReason() {
        return voidReason;
    }

    public void setVoidReason(String voidReason) {
        this.voidReason = voidReason;
    }

    public AppUser getVoidedBy() {
        return voidedBy;
    }

    public void setVoidedBy(AppUser voidedBy) {
        this.voidedBy = voidedBy;
    }

    public Instant getVoidedAt() {
        return voidedAt;
    }

    public void setVoidedAt(Instant voidedAt) {
        this.voidedAt = voidedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    /** Derived (spec: generated column), never stored. */
    public long getTotalPayable() {
        return cattleAmount + transportFee;
    }

    /** Derived: total payable minus the sum of RECORDED payments (floored at 0). */
    public long getOutstandingAmount() {
        return Math.max(0L, getTotalPayable() - amountPaid);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HerdEntryVoucher)) {
            return false;
        }
        return getId() != null && getId().equals(((HerdEntryVoucher) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "HerdEntryVoucher{id=" + getId() + "}";
    }
}
