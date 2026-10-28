package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Owner acknowledgment is explicitly bound to one immutable resolution version. */
@Entity @Table(name="resolution_acknowledgment",uniqueConstraints=@UniqueConstraint(name="uq_resolution_ack",columnNames={"resolution_id","requester_id"}))
public class ResolutionAcknowledgment {
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") public Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="resolution_id",nullable=false) public TicketResolution resolution;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="requester_id",nullable=false) public AppUser requester;
    @Column(name="confirmed_at",nullable=false) public Instant confirmedAt;
    @Column(name="comment",length=1000) public String comment;
    @Column(name="status",length=30,nullable=false) public String status="EFFECTIVE";
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reviewed_by_id") public AppUser reviewedBy;
    @Column(name="reviewed_at") public Instant reviewedAt;
}
