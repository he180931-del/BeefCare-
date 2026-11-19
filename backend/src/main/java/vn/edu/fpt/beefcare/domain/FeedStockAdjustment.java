package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** SRS Stock Adjustment (phiếu điều chỉnh kho): DRAFT → POSTED; a posted adjustment is immutable (GBR-100). */
@Entity
@Table(name = "feed_stock_adjustment", uniqueConstraints = @UniqueConstraint(name="uq_feed_adjustment_farm_code", columnNames={"farm_id","code"}))
public class FeedStockAdjustment implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="farm_id",nullable=false) private Farm farm;
    @Column(name="code",length=40,nullable=false) private String code;
    @Column(name="count_date",nullable=false) private LocalDate countDate;
    @Column(name="adjustment_type",length=30,nullable=false) private String adjustmentType;
    @Column(name="counted_by",length=200) private String countedBy;
    @Column(name="status",length=20,nullable=false) private String status="DRAFT";
    @Column(name="total_difference_kg",precision=14,scale=3,nullable=false) private BigDecimal totalDifferenceKg=BigDecimal.ZERO;
    @Column(name="total_value",nullable=false) private Long totalValue=0L;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="created_by_id") private AppUser createdBy;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="posted_by_id") private AppUser postedBy;
    @Column(name="posted_at") private Instant postedAt;
    @Version @Column(name="version",nullable=false) private Integer version=0;
    public Long getId(){return id;} public Farm getFarm(){return farm;} public void setFarm(Farm v){farm=v;}
    public String getCode(){return code;} public void setCode(String v){code=v;} public LocalDate getCountDate(){return countDate;} public void setCountDate(LocalDate v){countDate=v;}
    public String getAdjustmentType(){return adjustmentType;} public void setAdjustmentType(String v){adjustmentType=v;} public String getCountedBy(){return countedBy;} public void setCountedBy(String v){countedBy=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public BigDecimal getTotalDifferenceKg(){return totalDifferenceKg;} public void setTotalDifferenceKg(BigDecimal v){totalDifferenceKg=v;} public Long getTotalValue(){return totalValue;} public void setTotalValue(Long v){totalValue=v;}
    public AppUser getCreatedBy(){return createdBy;} public void setCreatedBy(AppUser v){createdBy=v;} public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
    public AppUser getPostedBy(){return postedBy;} public void setPostedBy(AppUser v){postedBy=v;} public Instant getPostedAt(){return postedAt;} public void setPostedAt(Instant v){postedAt=v;}
    public Integer getVersion(){return version;}
}
