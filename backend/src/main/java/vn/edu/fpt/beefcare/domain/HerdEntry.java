package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntrySource;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;

@Entity
@Table(name = "herd_entry", uniqueConstraints = {@UniqueConstraint(name = "uq_entry_line", columnNames = {"voucher_id", "line_no"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HerdEntry implements Serializable {

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
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "voucher_id")
    private HerdEntryVoucher voucher;

    @NotNull
    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cattle_id")
    private Cattle cattle;

    @Column(name = "draft_data")
    private String draftData;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 30, nullable = false)
    private EntrySource source;

    @NotNull
    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(name = "entry_weight_kg", precision = 7, scale = 2)
    private BigDecimal entryWeightKg;

    @Enumerated(EnumType.STRING)
    @Column(name = "weight_basis", length = 30)
    private WeightBasis weightBasis;

    @Column(name = "unit_price")
    private Long unitPrice;

    @NotNull
    @Column(name = "line_amount", nullable = false)
    private Long lineAmount = 0L;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calf_outcome_id")
    private CalfOutcome calfOutcome;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "initial_pen_id")
    private Pen initialPen;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private EntryLineStatus status = EntryLineStatus.DRAFT;

    @NotNull
    @Column(name = "is_corrected", nullable = false)
    private boolean corrected = false;

    @Column(name = "quarantine_until")
    private LocalDate quarantineUntil;

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

    public HerdEntryVoucher getVoucher() {
        return voucher;
    }

    public void setVoucher(HerdEntryVoucher voucher) {
        this.voucher = voucher;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
    }

    public Cattle getCattle() {
        return cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public String getDraftData() {
        return draftData;
    }

    public void setDraftData(String draftData) {
        this.draftData = draftData;
    }

    public EntrySource getSource() {
        return source;
    }

    public void setSource(EntrySource source) {
        this.source = source;
    }

    public LocalDate getEntryDate() {
        return entryDate;
    }

    public void setEntryDate(LocalDate entryDate) {
        this.entryDate = entryDate;
    }

    public BigDecimal getEntryWeightKg() {
        return entryWeightKg;
    }

    public void setEntryWeightKg(BigDecimal entryWeightKg) {
        this.entryWeightKg = entryWeightKg;
    }

    public WeightBasis getWeightBasis() {
        return weightBasis;
    }

    public void setWeightBasis(WeightBasis weightBasis) {
        this.weightBasis = weightBasis;
    }

    public Long getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(Long unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Long getLineAmount() {
        return lineAmount;
    }

    public void setLineAmount(Long lineAmount) {
        this.lineAmount = lineAmount;
    }

    public CalfOutcome getCalfOutcome() {
        return calfOutcome;
    }

    public void setCalfOutcome(CalfOutcome calfOutcome) {
        this.calfOutcome = calfOutcome;
    }

    public Pen getInitialPen() {
        return initialPen;
    }

    public void setInitialPen(Pen initialPen) {
        this.initialPen = initialPen;
    }

    public EntryLineStatus getStatus() {
        return status;
    }

    public void setStatus(EntryLineStatus status) {
        this.status = status;
    }

    public boolean isCorrected() {
        return corrected;
    }

    public void setCorrected(boolean corrected) {
        this.corrected = corrected;
    }

    public LocalDate getQuarantineUntil() {
        return quarantineUntil;
    }

    public void setQuarantineUntil(LocalDate quarantineUntil) {
        this.quarantineUntil = quarantineUntil;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HerdEntry)) {
            return false;
        }
        return getId() != null && getId().equals(((HerdEntry) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "HerdEntry{id=" + getId() + "}";
    }
}
