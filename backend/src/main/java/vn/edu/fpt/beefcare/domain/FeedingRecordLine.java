package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

@Entity
@Table(name="feeding_record_line",uniqueConstraints=@UniqueConstraint(name="uq_feeding_record_feed",columnNames={"feeding_record_id","feed_item_id"}))
public class FeedingRecordLine implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feeding_record_id",nullable=false) private FeedingRecord feedingRecord;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feed_item_id",nullable=false) private FeedItem feedItem;
    @Column(name="feed_code_snapshot",length=50,nullable=false) private String feedCodeSnapshot;
    @Column(name="feed_name_snapshot",length=150,nullable=false) private String feedNameSnapshot;
    @Column(name="planned_kg",precision=14,scale=3,nullable=false) private BigDecimal plannedKg;
    @Column(name="actual_kg",precision=14,scale=3,nullable=false) private BigDecimal actualKg;
    @Column(name="cost_per_kg",precision=14,scale=2,nullable=false) private BigDecimal costPerKg;
    @Column(name="total_cost",nullable=false) private Long totalCost;
    public Long getId(){return id;} public FeedingRecord getFeedingRecord(){return feedingRecord;} public void setFeedingRecord(FeedingRecord v){feedingRecord=v;} public FeedItem getFeedItem(){return feedItem;} public void setFeedItem(FeedItem v){feedItem=v;}
    public String getFeedCodeSnapshot(){return feedCodeSnapshot;} public void setFeedCodeSnapshot(String v){feedCodeSnapshot=v;}
    public String getFeedNameSnapshot(){return feedNameSnapshot;} public void setFeedNameSnapshot(String v){feedNameSnapshot=v;}
    public BigDecimal getPlannedKg(){return plannedKg;} public void setPlannedKg(BigDecimal v){plannedKg=v;} public BigDecimal getActualKg(){return actualKg;} public void setActualKg(BigDecimal v){actualKg=v;} public BigDecimal getCostPerKg(){return costPerKg;} public void setCostPerKg(BigDecimal v){costPerKg=v;} public Long getTotalCost(){return totalCost;} public void setTotalCost(Long v){totalCost=v;}
}
