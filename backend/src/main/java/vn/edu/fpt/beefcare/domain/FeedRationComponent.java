package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

@Entity
@Table(name="feed_ration_component",uniqueConstraints=@UniqueConstraint(name="uq_feed_ration_component",columnNames={"ration_version_id","feed_item_id"}))
public class FeedRationComponent implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="ration_version_id",nullable=false) private FeedRationVersion rationVersion;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="feed_item_id",nullable=false) private FeedItem feedItem;
    @Column(name="feed_code_snapshot",length=50,nullable=false) private String feedCodeSnapshot;
    @Column(name="feed_name_snapshot",length=150,nullable=false) private String feedNameSnapshot;
    @Column(name="session_1_kg_per_head",precision=12,scale=3,nullable=false) private BigDecimal session1=BigDecimal.ZERO;
    @Column(name="session_2_kg_per_head",precision=12,scale=3,nullable=false) private BigDecimal session2=BigDecimal.ZERO;
    @Column(name="session_3_kg_per_head",precision=12,scale=3,nullable=false) private BigDecimal session3=BigDecimal.ZERO;
    public Long getId(){return id;} public FeedRationVersion getRationVersion(){return rationVersion;} public void setRationVersion(FeedRationVersion v){rationVersion=v;} public FeedItem getFeedItem(){return feedItem;} public void setFeedItem(FeedItem v){feedItem=v;}
    public String getFeedCodeSnapshot(){return feedCodeSnapshot;} public void setFeedCodeSnapshot(String v){feedCodeSnapshot=v;} public String getFeedNameSnapshot(){return feedNameSnapshot;} public void setFeedNameSnapshot(String v){feedNameSnapshot=v;}
    public BigDecimal getSession1(){return session1;} public void setSession1(BigDecimal v){session1=v;} public BigDecimal getSession2(){return session2;} public void setSession2(BigDecimal v){session2=v;} public BigDecimal getSession3(){return session3;} public void setSession3(BigDecimal v){session3=v;}
    public BigDecimal sessionAmount(int session){return switch(session){case 1->session1;case 2->session2;case 3->session3;default->BigDecimal.ZERO;};}
}
