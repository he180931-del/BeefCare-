package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;

@Entity
@Table(name = "herd_exit", uniqueConstraints = {@UniqueConstraint(name = "uq_exit_line", columnNames = {"voucher_id", "line_no"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HerdExit implements Serializable {

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
    private HerdExitVoucher voucher;

    @NotNull
    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cattle_id")
    private Cattle cattle;

    @Column(name = "exit_weight_kg", precision = 7, scale = 2)
    private BigDecimal exitWeightKg;

    @Enumerated(EnumType.STRING)
    @Column(name = "weight_basis", length = 30)
    private WeightBasis weightBasis;

    @Column(name = "unit_price")
    private Long unitPrice;

    @NotNull
    @Column(name = "line_amount", nullable = false)
    private Long lineAmount = 0L;

    @Column(name = "check_results")
    private String checkResults;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_pen_id")
    private Pen lastPen;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private ExitLineStatus status = ExitLineStatus.DRAFT;

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

    public HerdExitVoucher getVoucher() {
        return voucher;
    }

    public void setVoucher(HerdExitVoucher voucher) {
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

    public BigDecimal getExitWeightKg() {
        return exitWeightKg;
    }

    public void setExitWeightKg(BigDecimal exitWeightKg) {
        this.exitWeightKg = exitWeightKg;
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

    public String getCheckResults() {
        return checkResults;
    }

    public void setCheckResults(String checkResults) {
        this.checkResults = checkResults;
    }

    public Pen getLastPen() {
        return lastPen;
    }

    public void setLastPen(Pen lastPen) {
        this.lastPen = lastPen;
    }

    public ExitLineStatus getStatus() {
        return status;
    }

    public void setStatus(ExitLineStatus status) {
        this.status = status;
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
        if (!(o instanceof HerdExit)) {
            return false;
        }
        return getId() != null && getId().equals(((HerdExit) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "HerdExit{id=" + getId() + "}";
    }
}
