package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ReplacementReason;

@Entity
@Table(name = "cattle_qr_tag", uniqueConstraints = {@UniqueConstraint(name = "uq_cattle_qr_tag_code", columnNames = {"tag_code"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class CattleQrTag implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id")
    private Farm farm;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cattle_id")
    private Cattle cattle;

    @NotNull
    @Size(max = 50)
    @Column(name = "tag_code", length = 50, nullable = false)
    private String tagCode;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private QrTagStatus status = QrTagStatus.ACTIVE;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issued_by_id")
    private AppUser issuedBy;

    @NotNull
    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "replacement_reason", length = 30)
    private ReplacementReason replacementReason;

    @Size(max = 500)
    @Column(name = "note", length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replaced_by_tag_id")
    private CattleQrTag replacedByTag;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Farm getFarm() {
        return farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Cattle getCattle() {
        return cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public String getTagCode() {
        return tagCode;
    }

    public void setTagCode(String tagCode) {
        this.tagCode = tagCode;
    }

    public QrTagStatus getStatus() {
        return status;
    }

    public void setStatus(QrTagStatus status) {
        this.status = status;
    }

    public AppUser getIssuedBy() {
        return issuedBy;
    }

    public void setIssuedBy(AppUser issuedBy) {
        this.issuedBy = issuedBy;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(Instant issuedAt) {
        this.issuedAt = issuedAt;
    }

    public ReplacementReason getReplacementReason() {
        return replacementReason;
    }

    public void setReplacementReason(ReplacementReason replacementReason) {
        this.replacementReason = replacementReason;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public CattleQrTag getReplacedByTag() {
        return replacedByTag;
    }

    public void setReplacedByTag(CattleQrTag replacedByTag) {
        this.replacedByTag = replacedByTag;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CattleQrTag)) {
            return false;
        }
        return getId() != null && getId().equals(((CattleQrTag) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "CattleQrTag{id=" + getId() + "}";
    }
}
