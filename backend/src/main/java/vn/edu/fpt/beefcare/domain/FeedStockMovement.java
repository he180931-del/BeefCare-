package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/** Immutable stock ledger entry; the feed item's current stock is only a checked summary. */
@Entity
@Table(name = "feed_stock_movement", indexes = @Index(name = "ix_feed_movement_farm_feed_time", columnList = "farm_id,feed_item_id,occurred_at"))
public class FeedStockMovement implements Serializable {
    @Serial private static final long serialVersionUID = 1L;
    @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator") @SequenceGenerator(name = "sequenceGenerator")
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "farm_id", nullable = false)
    private Farm farm;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "feed_item_id", nullable = false)
    private FeedItem feedItem;
    @Column(name = "movement_type", length = 30, nullable = false) private String movementType;
    @Column(name = "quantity_kg", precision = 14, scale = 3, nullable = false) private BigDecimal quantityKg;
    @Column(name = "unit_cost", precision = 14, scale = 2, nullable = false) private BigDecimal unitCost;
    @Column(name = "balance_after_kg", precision = 14, scale = 3, nullable = false) private BigDecimal balanceAfterKg;
    @Column(name = "source_type", length = 30, nullable = false) private String sourceType;
    @Column(name = "source_id") private Long sourceId;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "recorded_by_id") private AppUser recordedBy;
    public Long getId(){return id;} public Farm getFarm(){return farm;} public void setFarm(Farm v){farm=v;}
    public FeedItem getFeedItem(){return feedItem;} public void setFeedItem(FeedItem v){feedItem=v;}
    public String getMovementType(){return movementType;} public void setMovementType(String v){movementType=v;}
    public BigDecimal getQuantityKg(){return quantityKg;} public void setQuantityKg(BigDecimal v){quantityKg=v;}
    public BigDecimal getUnitCost(){return unitCost;} public void setUnitCost(BigDecimal v){unitCost=v;}
    public BigDecimal getBalanceAfterKg(){return balanceAfterKg;} public void setBalanceAfterKg(BigDecimal v){balanceAfterKg=v;}
    public String getSourceType(){return sourceType;} public void setSourceType(String v){sourceType=v;}
    public Long getSourceId(){return sourceId;} public void setSourceId(Long v){sourceId=v;}
    public Instant getOccurredAt(){return occurredAt;} public void setOccurredAt(Instant v){occurredAt=v;}
    public AppUser getRecordedBy(){return recordedBy;} public void setRecordedBy(AppUser v){recordedBy=v;}
}
