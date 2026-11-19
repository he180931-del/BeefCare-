package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name="feeding_record",uniqueConstraints=@UniqueConstraint(name="uq_feeding_session",columnNames={"farm_id","pen_id","feeding_date","session_no"}))
public class FeedingRecord implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="farm_id",nullable=false) private Farm farm;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="pen_id",nullable=false) private Pen pen;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="ration_version_id") private FeedRationVersion rationVersion;
    @Column(name="feeding_date",nullable=false) private LocalDate feedingDate;
    @Column(name="session_no",nullable=false) private Integer sessionNo;
    @Column(name="head_count",nullable=false) private Integer headCount;
    @Column(name="fed_by",length=100) private String fedBy;
    @Column(name="status",length=20,nullable=false) private String status="VALID";
    @Column(name="void_reason",length=500) private String voidReason;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="recorded_by_id") private AppUser recordedBy;
    @Column(name="recorded_at",nullable=false) private Instant recordedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="voided_by_id") private AppUser voidedBy;
    @Column(name="voided_at") private Instant voidedAt;
    @Version @Column(name="version",nullable=false) private Integer version=0;
    public Long getId(){return id;} public Farm getFarm(){return farm;} public void setFarm(Farm v){farm=v;} public Pen getPen(){return pen;} public void setPen(Pen v){pen=v;}
    public FeedRationVersion getRationVersion(){return rationVersion;} public void setRationVersion(FeedRationVersion v){rationVersion=v;} public LocalDate getFeedingDate(){return feedingDate;} public void setFeedingDate(LocalDate v){feedingDate=v;}
    public Integer getSessionNo(){return sessionNo;} public void setSessionNo(Integer v){sessionNo=v;} public Integer getHeadCount(){return headCount;} public void setHeadCount(Integer v){headCount=v;}
    public String getFedBy(){return fedBy;} public void setFedBy(String v){fedBy=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public String getVoidReason(){return voidReason;} public void setVoidReason(String v){voidReason=v;}
    public AppUser getRecordedBy(){return recordedBy;} public void setRecordedBy(AppUser v){recordedBy=v;} public Instant getRecordedAt(){return recordedAt;} public void setRecordedAt(Instant v){recordedAt=v;}
    public AppUser getVoidedBy(){return voidedBy;} public void setVoidedBy(AppUser v){voidedBy=v;} public Instant getVoidedAt(){return voidedAt;} public void setVoidedAt(Instant v){voidedAt=v;} public Integer getVersion(){return version;}
}
