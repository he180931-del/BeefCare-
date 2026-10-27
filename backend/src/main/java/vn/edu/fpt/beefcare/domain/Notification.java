package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A Notification.
 */
@Entity
@Table(name = "notification")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Notification implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * ERD: target_type + target_id - tách 2 cột
     */
    @Schema(description = "ERD: target_type + target_id - tách 2 cột", required = true)
    @NotNull
    @Size(max = 50)
    @Column(name = "target_type", length = 50, nullable = false)
    private String targetType;

    @NotNull
    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @NotNull
    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    /**
     * ERD: NOT NULL; để trống được vì chưa đọc thì chưa có thời điểm đọc
     */
    @Schema(description = "ERD: NOT NULL; để trống được vì chưa đọc thì chưa có thời điểm đọc")
    @Column(name = "read_time")
    private Instant readTime;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser recipient;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Notification id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTargetType() {
        return this.targetType;
    }

    public Notification targetType(String targetType) {
        this.setTargetType(targetType);
        return this;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public Long getTargetId() {
        return this.targetId;
    }

    public Notification targetId(Long targetId) {
        this.setTargetId(targetId);
        return this;
    }

    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }

    public Instant getCreatedTime() {
        return this.createdTime;
    }

    public Notification createdTime(Instant createdTime) {
        this.setCreatedTime(createdTime);
        return this;
    }

    public void setCreatedTime(Instant createdTime) {
        this.createdTime = createdTime;
    }

    public Instant getReadTime() {
        return this.readTime;
    }

    public Notification readTime(Instant readTime) {
        this.setReadTime(readTime);
        return this;
    }

    public void setReadTime(Instant readTime) {
        this.readTime = readTime;
    }

    public AppUser getRecipient() {
        return this.recipient;
    }

    public void setRecipient(AppUser appUser) {
        this.recipient = appUser;
    }

    public Notification recipient(AppUser appUser) {
        this.setRecipient(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Notification)) {
            return false;
        }
        return getId() != null && getId().equals(((Notification) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Notification{" +
            "id=" + getId() +
            ", targetType='" + getTargetType() + "'" +
            ", targetId=" + getTargetId() +
            ", createdTime='" + getCreatedTime() + "'" +
            ", readTime='" + getReadTime() + "'" +
            "}";
    }
}
