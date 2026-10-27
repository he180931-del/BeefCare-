package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A EvidenceReview.
 */
@Entity
@Table(name = "evidence_review")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class EvidenceReview implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "decision", length = 30, nullable = false)
    private String decision;

    @Lob
    @Column(name = "reason")
    private String reason;

    /**
     * ERD: time
     */
    @Schema(description = "ERD: time", required = true)
    @NotNull
    @Column(name = "reviewed_at", nullable = false)
    private Instant reviewedAt;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "payment" }, allowSetters = true)
    private BankTransferEvidence evidence;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser pmUser;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public EvidenceReview id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDecision() {
        return this.decision;
    }

    public EvidenceReview decision(String decision) {
        this.setDecision(decision);
        return this;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getReason() {
        return this.reason;
    }

    public EvidenceReview reason(String reason) {
        this.setReason(reason);
        return this;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Instant getReviewedAt() {
        return this.reviewedAt;
    }

    public EvidenceReview reviewedAt(Instant reviewedAt) {
        this.setReviewedAt(reviewedAt);
        return this;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public BankTransferEvidence getEvidence() {
        return this.evidence;
    }

    public void setEvidence(BankTransferEvidence bankTransferEvidence) {
        this.evidence = bankTransferEvidence;
    }

    public EvidenceReview evidence(BankTransferEvidence bankTransferEvidence) {
        this.setEvidence(bankTransferEvidence);
        return this;
    }

    public AppUser getPmUser() {
        return this.pmUser;
    }

    public void setPmUser(AppUser appUser) {
        this.pmUser = appUser;
    }

    public EvidenceReview pmUser(AppUser appUser) {
        this.setPmUser(appUser);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof EvidenceReview)) {
            return false;
        }
        return getId() != null && getId().equals(((EvidenceReview) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "EvidenceReview{" +
            "id=" + getId() +
            ", decision='" + getDecision() + "'" +
            ", reason='" + getReason() + "'" +
            ", reviewedAt='" + getReviewedAt() + "'" +
            "}";
    }
}
