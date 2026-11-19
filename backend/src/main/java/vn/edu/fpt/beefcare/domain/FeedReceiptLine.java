package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name="feed_receipt_line")
public class FeedReceiptLine implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="receipt_id",nullable=false) private FeedReceipt receipt;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feed_item_id",nullable=false) private FeedItem feedItem;
    @Column(name="feed_code_snapshot",length=50,nullable=false) private String feedCodeSnapshot;
    @Column(name="feed_name_snapshot",length=150,nullable=false) private String feedNameSnapshot;
    @Column(name="lot_number",length=30) private String lotNumber;
    @Column(name="expiry_date") private LocalDate expiryDate;
    @Column(name="quantity_purchase",precision=14,scale=3,nullable=false) private BigDecimal quantityPurchase;
    @Column(name="purchase_unit",length=30,nullable=false) private String purchaseUnit;
    @Column(name="kg_received",precision=14,scale=3,nullable=false) private BigDecimal kgReceived;
    @Column(name="unit_price",nullable=false) private Long unitPrice;
    @Column(name="line_amount",nullable=false) private Long lineAmount;
    @Column(name="unit_cost_kg",precision=14,scale=2) private java.math.BigDecimal unitCostKg;
    public Long getId(){return id;} public FeedReceipt getReceipt(){return receipt;} public void setReceipt(FeedReceipt v){receipt=v;}
    public FeedItem getFeedItem(){return feedItem;} public void setFeedItem(FeedItem v){feedItem=v;} public String getLotNumber(){return lotNumber;} public void setLotNumber(String v){lotNumber=v;}
    public String getFeedCodeSnapshot(){return feedCodeSnapshot;} public void setFeedCodeSnapshot(String v){feedCodeSnapshot=v;} public String getFeedNameSnapshot(){return feedNameSnapshot;} public void setFeedNameSnapshot(String v){feedNameSnapshot=v;}
    public LocalDate getExpiryDate(){return expiryDate;} public void setExpiryDate(LocalDate v){expiryDate=v;} public BigDecimal getQuantityPurchase(){return quantityPurchase;} public void setQuantityPurchase(BigDecimal v){quantityPurchase=v;}
    public String getPurchaseUnit(){return purchaseUnit;} public void setPurchaseUnit(String v){purchaseUnit=v;} public BigDecimal getKgReceived(){return kgReceived;} public void setKgReceived(BigDecimal v){kgReceived=v;}
    public Long getUnitPrice(){return unitPrice;} public void setUnitPrice(Long v){unitPrice=v;} public Long getLineAmount(){return lineAmount;} public void setLineAmount(Long v){lineAmount=v;}
    public java.math.BigDecimal getUnitCostKg(){return unitCostKg;} public void setUnitCostKg(java.math.BigDecimal v){unitCostKg=v;}
}
