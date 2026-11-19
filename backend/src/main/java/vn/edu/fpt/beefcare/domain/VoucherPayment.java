package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;

@Entity
@Table(name = "voucher_payment")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class VoucherPayment implements Serializable {

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entry_voucher_id")
    private HerdEntryVoucher entryVoucher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exit_voucher_id")
    private HerdExitVoucher exitVoucher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feed_receipt_id")
    private FeedReceipt feedReceipt;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "direction", length = 30, nullable = false)
    private PaymentDirection direction;

    @NotNull
    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @NotNull
    @Column(name = "amount", nullable = false)
    private Long amount;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 30, nullable = false)
    private PaymentMethod method;

    @Size(max = 100)
    @Column(name = "reference", length = 100)
    private String reference;

    @Size(max = 500)
    @Column(name = "note", length = 500)
    private String note;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private PaymentRecordStatus status = PaymentRecordStatus.RECORDED;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recorded_by_id")
    private AppUser recordedBy;

    @NotNull
    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Size(max = 500)
    @Column(name = "void_reason", length = 500)
    private String voidReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voided_by_id")
    private AppUser voidedBy;

    @Column(name = "voided_at")
    private Instant voidedAt;

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

    public HerdEntryVoucher getEntryVoucher() {
        return entryVoucher;
    }

    public void setEntryVoucher(HerdEntryVoucher entryVoucher) {
        this.entryVoucher = entryVoucher;
    }

    public HerdExitVoucher getExitVoucher() {
        return exitVoucher;
    }

    public void setExitVoucher(HerdExitVoucher exitVoucher) {
        this.exitVoucher = exitVoucher;
    }

    public FeedReceipt getFeedReceipt() { return feedReceipt; }
    public void setFeedReceipt(FeedReceipt feedReceipt) { this.feedReceipt = feedReceipt; }

    public PaymentDirection getDirection() {
        return direction;
    }

    public void setDirection(PaymentDirection direction) {
        this.direction = direction;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public Long getAmount() {
        return amount;
    }

    public void setAmount(Long amount) {
        this.amount = amount;
    }

    public PaymentMethod getMethod() {
        return method;
    }

    public void setMethod(PaymentMethod method) {
        this.method = method;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public PaymentRecordStatus getStatus() {
        return status;
    }

    public void setStatus(PaymentRecordStatus status) {
        this.status = status;
    }

    public AppUser getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(AppUser recordedBy) {
        this.recordedBy = recordedBy;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
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

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof VoucherPayment)) {
            return false;
        }
        return getId() != null && getId().equals(((VoucherPayment) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "VoucherPayment{id=" + getId() + "}";
    }
}
