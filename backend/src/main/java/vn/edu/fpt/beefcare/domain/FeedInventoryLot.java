package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Remaining balance for a dated feed lot; consumption is allocated FEFO. */
@Entity
@Table(name="feed_inventory_lot",uniqueConstraints={
    @UniqueConstraint(name="uq_feed_lot_receipt_line",columnNames="receipt_line_id"),
    @UniqueConstraint(name="uq_feed_lot_source",columnNames={"feed_item_id","source_type","source_id"})
})
public class FeedInventoryLot implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="farm_id",nullable=false) private Farm farm;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feed_item_id",nullable=false) private FeedItem feedItem;
    @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="receipt_line_id") private FeedReceiptLine receiptLine;
    @Column(name="source_type",length=30,nullable=false) private String sourceType;
    @Column(name="source_id",length=100,nullable=false) private String sourceId;
    @Column(name="lot_number",length=30) private String lotNumber;
    @Column(name="expiry_date") private LocalDate expiryDate;
    @Column(name="received_kg",precision=14,scale=3,nullable=false) private BigDecimal receivedKg;
    @Column(name="remaining_kg",precision=14,scale=3,nullable=false) private BigDecimal remainingKg;
    @Column(name="unit_cost",precision=14,scale=2,nullable=false) private BigDecimal unitCost;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Version @Column(name="version",nullable=false) private Integer version=0;
    public Long getId(){return id;} public Farm getFarm(){return farm;} public void setFarm(Farm v){farm=v;} public FeedItem getFeedItem(){return feedItem;} public void setFeedItem(FeedItem v){feedItem=v;}
    public FeedReceiptLine getReceiptLine(){return receiptLine;} public void setReceiptLine(FeedReceiptLine v){receiptLine=v;} public String getSourceType(){return sourceType;} public void setSourceType(String v){sourceType=v;}
    public String getSourceId(){return sourceId;} public void setSourceId(String v){sourceId=v;} public String getLotNumber(){return lotNumber;} public void setLotNumber(String v){lotNumber=v;}
    public LocalDate getExpiryDate(){return expiryDate;} public void setExpiryDate(LocalDate v){expiryDate=v;} public BigDecimal getReceivedKg(){return receivedKg;} public void setReceivedKg(BigDecimal v){receivedKg=v;}
    public BigDecimal getRemainingKg(){return remainingKg;} public void setRemainingKg(BigDecimal v){remainingKg=v;} public BigDecimal getUnitCost(){return unitCost;} public void setUnitCost(BigDecimal v){unitCost=v;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;} public Integer getVersion(){return version;}
}
