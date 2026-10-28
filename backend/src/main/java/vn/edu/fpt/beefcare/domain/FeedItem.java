package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

/** A farm-scoped feed catalogue item and its current stock summary. */
@Entity
@Table(name = "feed_item", uniqueConstraints = @UniqueConstraint(name = "uq_feed_item_farm_code", columnNames = { "farm_id", "code" }))
public class FeedItem implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 50)
    @Column(name = "code", length = 50, nullable = false)
    private String code;

    @NotNull
    @Size(max = 150)
    @Column(name = "name", length = 150, nullable = false)
    private String name;

    @NotNull
    @Size(max = 30)
    @Column(name = "feed_group", length = 30, nullable = false)
    private String feedGroup;

    @Size(max = 30)
    @Column(name = "purchase_unit", length = 30)
    private String purchaseUnit;

    @Column(name = "kg_per_purchase_unit", precision = 12, scale = 3)
    private BigDecimal kgPerPurchaseUnit;

    @NotNull
    @Size(max = 30)
    @Column(name = "stock_unit", length = 30, nullable = false)
    private String stockUnit = "kg";

    @NotNull
    @Column(name = "on_hand_kg", precision = 14, scale = 3, nullable = false)
    private BigDecimal onHandKg = BigDecimal.ZERO;

    @NotNull
    @Column(name = "avg_unit_cost", precision = 14, scale = 2, nullable = false)
    private BigDecimal avgUnitCost = BigDecimal.ZERO;

    @Column(name = "minimum_stock_kg", precision = 14, scale = 3)
    private BigDecimal minimumStockKg;

    @NotNull
    @Column(name = "available", nullable = false)
    private Boolean available = Boolean.TRUE;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id", nullable = false)
    @JsonIgnoreProperties(value = { "subscription", "mainBreeds" }, allowSetters = true)
    private Farm farm;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFeedGroup() { return feedGroup; }
    public void setFeedGroup(String feedGroup) { this.feedGroup = feedGroup; }
    public String getPurchaseUnit() { return purchaseUnit; }
    public void setPurchaseUnit(String purchaseUnit) { this.purchaseUnit = purchaseUnit; }
    public BigDecimal getKgPerPurchaseUnit() { return kgPerPurchaseUnit; }
    public void setKgPerPurchaseUnit(BigDecimal kgPerPurchaseUnit) { this.kgPerPurchaseUnit = kgPerPurchaseUnit; }
    public String getStockUnit() { return stockUnit; }
    public void setStockUnit(String stockUnit) { this.stockUnit = stockUnit; }
    public BigDecimal getOnHandKg() { return onHandKg; }
    public void setOnHandKg(BigDecimal onHandKg) { this.onHandKg = onHandKg; }
    public BigDecimal getAvgUnitCost() { return avgUnitCost; }
    public void setAvgUnitCost(BigDecimal avgUnitCost) { this.avgUnitCost = avgUnitCost; }
    public BigDecimal getMinimumStockKg() { return minimumStockKg; }
    public void setMinimumStockKg(BigDecimal minimumStockKg) { this.minimumStockKg = minimumStockKg; }
    public Boolean getAvailable() { return available; }
    public void setAvailable(Boolean available) { this.available = available; }
    public Farm getFarm() { return farm; }
    public void setFarm(Farm farm) { this.farm = farm; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
