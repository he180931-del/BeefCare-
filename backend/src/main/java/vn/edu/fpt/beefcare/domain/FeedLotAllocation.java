package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/** Immutable FEFO allocation; a reversal timestamp preserves the audit trail. */
@Entity
@Table(name="feed_lot_allocation")
public class FeedLotAllocation implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feeding_record_line_id",nullable=false) private FeedingRecordLine feedingRecordLine;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="inventory_lot_id",nullable=false) private FeedInventoryLot lot;
    @Column(name="quantity_kg",precision=14,scale=3,nullable=false) private BigDecimal quantityKg;
    @Column(name="unit_cost",precision=14,scale=2,nullable=false) private BigDecimal unitCost;
    @Column(name="reversed_at") private Instant reversedAt;
    public Long getId(){return id;} public FeedingRecordLine getFeedingRecordLine(){return feedingRecordLine;} public void setFeedingRecordLine(FeedingRecordLine v){feedingRecordLine=v;}
    public FeedInventoryLot getLot(){return lot;} public void setLot(FeedInventoryLot v){lot=v;} public BigDecimal getQuantityKg(){return quantityKg;} public void setQuantityKg(BigDecimal v){quantityKg=v;}
    public BigDecimal getUnitCost(){return unitCost;} public void setUnitCost(BigDecimal v){unitCost=v;} public Instant getReversedAt(){return reversedAt;} public void setReversedAt(Instant v){reversedAt=v;}
}
