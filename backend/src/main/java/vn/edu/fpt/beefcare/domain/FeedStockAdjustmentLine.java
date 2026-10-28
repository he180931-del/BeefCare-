package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

/** One feed's count on a stock adjustment; a non-zero posted line produces one ADJUSTMENT movement. */
@Entity
@Table(name="feed_stock_adjustment_line", uniqueConstraints=@UniqueConstraint(name="uq_feed_adjustment_line_feed", columnNames={"adjustment_id","feed_item_id"}))
public class FeedStockAdjustmentLine implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="adjustment_id",nullable=false) private FeedStockAdjustment adjustment;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feed_item_id",nullable=false) private FeedItem feedItem;
    @Column(name="feed_code_snapshot",length=50) private String feedCodeSnapshot;
    @Column(name="feed_name_snapshot",length=150) private String feedNameSnapshot;
    @Column(name="system_kg",precision=14,scale=3,nullable=false) private BigDecimal systemKg;
    @Column(name="counted_kg",precision=14,scale=3,nullable=false) private BigDecimal countedKg;
    @Column(name="difference_kg",precision=14,scale=3,nullable=false) private BigDecimal differenceKg;
    @Column(name="reason",length=500) private String reason;
    @Column(name="unit_cost",precision=14,scale=2,nullable=false) private BigDecimal unitCost=BigDecimal.ZERO;
    @Column(name="difference_value",nullable=false) private Long differenceValue=0L;
    public Long getId(){return id;} public FeedStockAdjustment getAdjustment(){return adjustment;} public void setAdjustment(FeedStockAdjustment v){adjustment=v;}
    public FeedItem getFeedItem(){return feedItem;} public void setFeedItem(FeedItem v){feedItem=v;}
    public String getFeedCodeSnapshot(){return feedCodeSnapshot;} public void setFeedCodeSnapshot(String v){feedCodeSnapshot=v;} public String getFeedNameSnapshot(){return feedNameSnapshot;} public void setFeedNameSnapshot(String v){feedNameSnapshot=v;}
    public BigDecimal getSystemKg(){return systemKg;} public void setSystemKg(BigDecimal v){systemKg=v;} public BigDecimal getCountedKg(){return countedKg;} public void setCountedKg(BigDecimal v){countedKg=v;}
    public BigDecimal getDifferenceKg(){return differenceKg;} public void setDifferenceKg(BigDecimal v){differenceKg=v;} public String getReason(){return reason;} public void setReason(String v){reason=v;}
    public BigDecimal getUnitCost(){return unitCost;} public void setUnitCost(BigDecimal v){unitCost=v;} public Long getDifferenceValue(){return differenceValue;} public void setDifferenceValue(Long v){differenceValue=v;}
}
