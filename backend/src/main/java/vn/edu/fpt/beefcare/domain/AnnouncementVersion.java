package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A AnnouncementVersion.
 */
@Entity
@Table(name = "announcement_version")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class AnnouncementVersion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @NotNull
    @Size(max = 255)
    @Column(name = "title", length = 255, nullable = false)
    private String title;

    @Lob
    @Column(name = "body", nullable = false)
    private String body;

    @NotNull
    @Column(name = "published_time", nullable = false)
    private Instant publishedTime;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "author" }, allowSetters = true)
    private FarmAnnouncement announcement;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public AnnouncementVersion id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getVersionNo() {
        return this.versionNo;
    }

    public AnnouncementVersion versionNo(Integer versionNo) {
        this.setVersionNo(versionNo);
        return this;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public String getTitle() {
        return this.title;
    }

    public AnnouncementVersion title(String title) {
        this.setTitle(title);
        return this;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return this.body;
    }

    public AnnouncementVersion body(String body) {
        this.setBody(body);
        return this;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public Instant getPublishedTime() {
        return this.publishedTime;
    }

    public AnnouncementVersion publishedTime(Instant publishedTime) {
        this.setPublishedTime(publishedTime);
        return this;
    }

    public void setPublishedTime(Instant publishedTime) {
        this.publishedTime = publishedTime;
    }

    public FarmAnnouncement getAnnouncement() {
        return this.announcement;
    }

    public void setAnnouncement(FarmAnnouncement farmAnnouncement) {
        this.announcement = farmAnnouncement;
    }

    public AnnouncementVersion announcement(FarmAnnouncement farmAnnouncement) {
        this.setAnnouncement(farmAnnouncement);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AnnouncementVersion)) {
            return false;
        }
        return getId() != null && getId().equals(((AnnouncementVersion) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "AnnouncementVersion{" +
            "id=" + getId() +
            ", versionNo=" + getVersionNo() +
            ", title='" + getTitle() + "'" +
            ", body='" + getBody() + "'" +
            ", publishedTime='" + getPublishedTime() + "'" +
            "}";
    }
}
