package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;

@Entity
@Table(name="feed_ration_pen",uniqueConstraints=@UniqueConstraint(name="uq_feed_ration_pen",columnNames={"ration_version_id","pen_id"}))
public class FeedRationPen implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="ration_version_id",nullable=false) private FeedRationVersion rationVersion;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="pen_id",nullable=false) private Pen pen;
    public Long getId(){return id;} public FeedRationVersion getRationVersion(){return rationVersion;} public void setRationVersion(FeedRationVersion v){rationVersion=v;} public Pen getPen(){return pen;} public void setPen(Pen v){pen=v;}
}
