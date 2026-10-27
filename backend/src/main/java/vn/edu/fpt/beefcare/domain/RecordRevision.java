package vn.edu.fpt.beefcare.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A RecordRevision.
 */
@Entity
@Table(name = "record_revision")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class RecordRevision implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * ERD: source_type + source_id - tách 2 cột
     */
    @Schema(description = "ERD: source_type + source_id - tách 2 cột", required = true)
    @NotNull
    @Size(max = 50)
    @Column(name = "source_type", length = 50, nullable = false)
    private String sourceType;

    @NotNull
    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    /**
     * CORRECT | VOID
     */
    @Schema(description = "CORRECT | VOID", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "action", length = 30, nullable = false)
    private String action;

    @Lob
    @Column(name = "reason")
    private String reason;

    /**
     * ERD: before / after - tách 2 cột
     */
    @Schema(description = "ERD: before / after - tách 2 cột", required = true)
    @Lob
    @Column(name = "before_snapshot", nullable = false)
    private String beforeSnapshot;

    @Lob
    @Column(name = "after_snapshot", nullable = false)
    private String afterSnapshot;

    /**
     * ERD: time
     */
    @Schema(description = "ERD: time", required = true)
    @NotNull
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public RecordRevision id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSourceType() {
        return this.sourceType;
    }

    public RecordRevision sourceType(String sourceType) {
        this.setSourceType(sourceType);
        return this;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public Long getSourceId() {
        return this.sourceId;
    }

    public RecordRevision sourceId(Long sourceId) {
        this.setSourceId(sourceId);
        return this;
    }

    public void setSourceId(Long sourceId) {
        this.sourceId = sourceId;
    }

    public String getAction() {
        return this.action;
    }

    public RecordRevision action(String action) {
        this.setAction(action);
        return this;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getReason() {
        return this.reason;
    }

    public RecordRevision reason(String reason) {
        this.setReason(reason);
        return this;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getBeforeSnapshot() {
        return this.beforeSnapshot;
    }

    public RecordRevision beforeSnapshot(String beforeSnapshot) {
        this.setBeforeSnapshot(beforeSnapshot);
        return this;
    }

    public void setBeforeSnapshot(String beforeSnapshot) {
        this.beforeSnapshot = beforeSnapshot;
    }

    public String getAfterSnapshot() {
        return this.afterSnapshot;
    }

    public RecordRevision afterSnapshot(String afterSnapshot) {
        this.setAfterSnapshot(afterSnapshot);
        return this;
    }

    public void setAfterSnapshot(String afterSnapshot) {
        this.afterSnapshot = afterSnapshot;
    }

    public Instant getChangedAt() {
        return this.changedAt;
    }

    public RecordRevision changedAt(Instant changedAt) {
        this.setChangedAt(changedAt);
        return this;
    }

    public void setChangedAt(Instant changedAt) {
        this.changedAt = changedAt;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof RecordRevision)) {
            return false;
        }
        return getId() != null && getId().equals(((RecordRevision) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "RecordRevision{" +
            "id=" + getId() +
            ", sourceType='" + getSourceType() + "'" +
            ", sourceId=" + getSourceId() +
            ", action='" + getAction() + "'" +
            ", reason='" + getReason() + "'" +
            ", beforeSnapshot='" + getBeforeSnapshot() + "'" +
            ", afterSnapshot='" + getAfterSnapshot() + "'" +
            ", changedAt='" + getChangedAt() + "'" +
            "}";
    }
}
