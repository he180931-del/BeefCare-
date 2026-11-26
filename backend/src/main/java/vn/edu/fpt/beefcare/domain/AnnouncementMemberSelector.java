package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.io.Serial;
import java.io.Serializable;

/** A named FarmMembership selected on an announcement draft; publication snapshots actual deliveries separately. */
@Entity
@Table(
    name = "announcement_member_selector",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_announcement_member_selector",
        columnNames = { "announcement_id", "membership_id" }
    )
)
public class AnnouncementMemberSelector implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @ManyToOne(optional = false)
    @NotNull
    @JoinColumn(name = "announcement_id", nullable = false)
    @JsonIgnoreProperties(value = { "farm", "author" }, allowSetters = true)
    private FarmAnnouncement announcement;

    @ManyToOne(optional = false)
    @NotNull
    @JoinColumn(name = "membership_id", nullable = false)
    @JsonIgnoreProperties(value = { "farm", "user" }, allowSetters = true)
    private FarmMembership membership;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public FarmAnnouncement getAnnouncement() { return announcement; }
    public void setAnnouncement(FarmAnnouncement announcement) { this.announcement = announcement; }
    public FarmMembership getMembership() { return membership; }
    public void setMembership(FarmMembership membership) { this.membership = membership; }
}
