package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;

@Entity
@Table(name = "herd_exit_voucher", uniqueConstraints = {@UniqueConstraint(name = "uq_exit_voucher_code", columnNames = {"farm_id", "code"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HerdExitVoucher implements Serializable {

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
    @Column(name = "exit_type", length = 30, nullable = false)
    private ExitType exitType;

    @NotNull
    @Column(name = "exit_date", nullable = false)
    private LocalDate exitDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buyer_id")
    private TradingPartner buyer;

    @Size(max = 150)
    @Column(name = "destination", length = 150)
    private String destination;

    @Size(max = 50)
    @Column(name = "transport_cert_no", length = 50)
    private String transportCertNo;

    @Size(max = 20)
    @Column(name = "vehicle_plate", length = 20)
    private String vehiclePlate;

    @Size(max = 1000)
    @Column(name = "notes", length = 1000)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "loss_kind", length = 30)
    private LossKind lossKind;

    @Size(max = 1000)
    @Column(name = "death_cause", length = 1000)
    private String deathCause;

    @Size(max = 255)
    @Column(name = "carcass_disposal", length = 255)
    private String carcassDisposal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_health_case_id")
    private HealthCase sourceHealthCase;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_basis", length = 30)
    private PricingBasis pricingBasis;

    @NotNull
    @Column(name = "cattle_amount", nullable = false)
    private Long cattleAmount = 0L;

    @NotNull
    @Column(name = "deductions", nullable = false)
    private Long deductions = 0L;

    @NotNull
    @Column(name = "amount_collected", nullable = false)
    private Long amountCollected = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "collection_due_date")
    private LocalDate collectionDueDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private ExitVoucherStatus status = ExitVoucherStatus.DRAFT;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reported_by_id")
    private AppUser reportedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_by_id")
    private AppUser confirmedBy;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Size(max = 500)
    @Column(name = "close_reason", length = 500)
    private String closeReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by_id")
    private AppUser closedBy;

    @Column(name = "closed_at")
    private Instant closedAt;

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

    public ExitType getExitType() {
        return exitType;
    }

    public void setExitType(ExitType exitType) {
        this.exitType = exitType;
    }

    public LocalDate getExitDate() {
        return exitDate;
    }

    public void setExitDate(LocalDate exitDate) {
        this.exitDate = exitDate;
    }

    public TradingPartner getBuyer() {
        return buyer;
    }

    public void setBuyer(TradingPartner buyer) {
        this.buyer = buyer;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public String getTransportCertNo() {
        return transportCertNo;
    }

    public void setTransportCertNo(String transportCertNo) {
        this.transportCertNo = transportCertNo;
    }

    public String getVehiclePlate() {
        return vehiclePlate;
    }

    public void setVehiclePlate(String vehiclePlate) {
        this.vehiclePlate = vehiclePlate;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LossKind getLossKind() {
        return lossKind;
    }

    public void setLossKind(LossKind lossKind) {
        this.lossKind = lossKind;
    }

    public String getDeathCause() {
        return deathCause;
    }

    public void setDeathCause(String deathCause) {
        this.deathCause = deathCause;
    }

    public String getCarcassDisposal() {
        return carcassDisposal;
    }

    public void setCarcassDisposal(String carcassDisposal) {
        this.carcassDisposal = carcassDisposal;
    }

    public HealthCase getSourceHealthCase() {
        return sourceHealthCase;
    }

    public void setSourceHealthCase(HealthCase sourceHealthCase) {
        this.sourceHealthCase = sourceHealthCase;
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

    public Long getDeductions() {
        return deductions;
    }

    public void setDeductions(Long deductions) {
        this.deductions = deductions;
    }

    public Long getAmountCollected() {
        return amountCollected;
    }

    public void setAmountCollected(Long amountCollected) {
        this.amountCollected = amountCollected;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public LocalDate getCollectionDueDate() {
        return collectionDueDate;
    }

    public void setCollectionDueDate(LocalDate collectionDueDate) {
        this.collectionDueDate = collectionDueDate;
    }

    public ExitVoucherStatus getStatus() {
        return status;
    }

    public void setStatus(ExitVoucherStatus status) {
        this.status = status;
    }

    public AppUser getReportedBy() {
        return reportedBy;
    }

    public void setReportedBy(AppUser reportedBy) {
        this.reportedBy = reportedBy;
    }

    public AppUser getConfirmedBy() {
        return confirmedBy;
    }

    public void setConfirmedBy(AppUser confirmedBy) {
        this.confirmedBy = confirmedBy;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(Instant confirmedAt) {
        this.confirmedAt = confirmedAt;
    }

    public String getCloseReason() {
        return closeReason;
    }

    public void setCloseReason(String closeReason) {
        this.closeReason = closeReason;
    }

    public AppUser getClosedBy() {
        return closedBy;
    }

    public void setClosedBy(AppUser closedBy) {
        this.closedBy = closedBy;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
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
    public long getTotalReceivable() {
        return cattleAmount - deductions;
    }

    /** Derived: total receivable minus the sum of RECORDED collections (floored at 0). */
    public long getOutstandingAmount() {
        return Math.max(0L, getTotalReceivable() - amountCollected);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HerdExitVoucher)) {
            return false;
        }
        return getId() != null && getId().equals(((HerdExitVoucher) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "HerdExitVoucher{id=" + getId() + "}";
    }
}
