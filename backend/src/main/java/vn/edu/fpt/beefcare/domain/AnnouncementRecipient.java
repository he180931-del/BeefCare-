package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * ERD: PK ghép version_id + membership_id; dùng id và cần thêm unique(version_id, membership_id)
 */
@Schema(description = "ERD: PK ghép version_id + membership_id; dùng id và cần thêm unique(version_id, membership_id)")
@Entity
@Table(name = "announcement_recipient")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class AnnouncementRecipient implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "delivered_time", nullable = false)
    private Instant deliveredTime;

    /**
     * ERD: NOT NULL; để trống được vì chưa đọc thì chưa có thời điểm đọc
     */
    @Schema(description = "ERD: NOT NULL; để trống được vì chưa đọc thì chưa có thời điểm đọc")
    @Column(name = "read_time")
    private Instant readTime;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "announcement" }, allowSetters = true)
    private AnnouncementVersion version;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "user" }, allowSetters = true)
    private FarmMembership membership;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public AnnouncementRecipient id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getDeliveredTime() {
        return this.deliveredTime;
    }

    public AnnouncementRecipient deliveredTime(Instant deliveredTime) {
        this.setDeliveredTime(deliveredTime);
        return this;
    }

    public void setDeliveredTime(Instant deliveredTime) {
        this.deliveredTime = deliveredTime;
    }

    public Instant getReadTime() {
        return this.readTime;
    }

    public AnnouncementRecipient readTime(Instant readTime) {
        this.setReadTime(readTime);
        return this;
    }

    public void setReadTime(Instant readTime) {
        this.readTime = readTime;
    }

    public AnnouncementVersion getVersion() {
        return this.version;
    }

    public void setVersion(AnnouncementVersion announcementVersion) {
        this.version = announcementVersion;
    }

    public AnnouncementRecipient version(AnnouncementVersion announcementVersion) {
        this.setVersion(announcementVersion);
        return this;
    }

    public FarmMembership getMembership() {
        return this.membership;
    }

    public void setMembership(FarmMembership farmMembership) {
        this.membership = farmMembership;
    }

    public AnnouncementRecipient membership(FarmMembership farmMembership) {
        this.setMembership(farmMembership);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AnnouncementRecipient)) {
            return false;
        }
        return getId() != null && getId().equals(((AnnouncementRecipient) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "AnnouncementRecipient{" +
            "id=" + getId() +
            ", deliveredTime='" + getDeliveredTime() + "'" +
            ", readTime='" + getReadTime() + "'" +
            "}";
    }
}
