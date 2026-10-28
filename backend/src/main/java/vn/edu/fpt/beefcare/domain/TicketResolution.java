package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Immutable PUBLIC resolution version; a later resolution creates a new row. */
@Entity @Table(name="ticket_resolution",uniqueConstraints=@UniqueConstraint(name="uq_ticket_resolution_version",columnNames={"ticket_id","version_no"}))
@org.hibernate.annotations.Immutable
public class TicketResolution {
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") public Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="ticket_id",nullable=false) public SupportTicket ticket;
    @Column(name="version_no",nullable=false) public Integer versionNo;
    @Column(name="content",length=3000,nullable=false) public String content;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="resolved_by_id",nullable=false) public AppUser resolvedBy;
    @Column(name="resolved_at",nullable=false) public Instant resolvedAt;
}
