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
    /** Version whose coverage this link superseded when it was scheduled; used to undo a cancellation safely. */
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="predecessor_version_id") private FeedRationVersion predecessorVersion;
    /** The predecessor's exact end date before this version shortened it; null is a meaningful snapshot. */
    @Column(name="predecessor_effective_to") private java.time.LocalDate predecessorEffectiveTo;
    /** Whether the predecessor's saved end date came from an explicit stop command. */
    @Column(name="predecessor_effective_to_manually_set",nullable=false) private boolean predecessorEffectiveToManuallySet;
    /** False for links created before the snapshot migration; those links cannot safely restore an unknown predecessor. */
    @Column(name="predecessor_snapshot_captured",nullable=false) private boolean predecessorSnapshotCaptured;
    public Long getId(){return id;} public FeedRationVersion getRationVersion(){return rationVersion;} public void setRationVersion(FeedRationVersion v){rationVersion=v;} public Pen getPen(){return pen;} public void setPen(Pen v){pen=v;}
    public FeedRationVersion getPredecessorVersion(){return predecessorVersion;} public void setPredecessorVersion(FeedRationVersion v){predecessorVersion=v;}
    public java.time.LocalDate getPredecessorEffectiveTo(){return predecessorEffectiveTo;} public void setPredecessorEffectiveTo(java.time.LocalDate v){predecessorEffectiveTo=v;}
    public boolean isPredecessorEffectiveToManuallySet(){return predecessorEffectiveToManuallySet;} public void setPredecessorEffectiveToManuallySet(boolean v){predecessorEffectiveToManuallySet=v;}
    public boolean isPredecessorSnapshotCaptured(){return predecessorSnapshotCaptured;} public void setPredecessorSnapshotCaptured(boolean v){predecessorSnapshotCaptured=v;}
}
