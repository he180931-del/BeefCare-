package vn.edu.fpt.beefcare.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * A PlanVersion.
 */
@Entity
@Table(name = "plan_version")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PlanVersion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * ERD: price_1y / 2y / 3y - tách thành 3 cột
     */
    @Schema(description = "ERD: price_1y / 2y / 3y - tách thành 3 cột", required = true)
    @NotNull
    @Column(name = "price_1_y", precision = 21, scale = 2, nullable = false)
    private BigDecimal price1y;

    @NotNull
    @Column(name = "price_2_y", precision = 21, scale = 2, nullable = false)
    private BigDecimal price2y;

    @NotNull
    @Column(name = "price_3_y", precision = 21, scale = 2, nullable = false)
    private BigDecimal price3y;

    @Size(max = 500)
    @Column(name = "terms", length = 500)
    private String terms;

    @NotNull
    @Column(name = "effective_at", nullable = false)
    private Instant effectiveAt;

    @Version
    @Column(name = "revision", nullable = false)
    private Long revision;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_by_id")
    private AppUser publishedBy;
    @Column(name = "published_at")
    private Instant publishedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "withdrawn_by_id")
    private AppUser withdrawnBy;
    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;
    @Size(max = 1000)
    @Column(name = "withdraw_reason", length = 1000)
    private String withdrawReason;

    public Long getRevision() { return revision; }
    public void setRevision(Long value) { revision = value; }
    public AppUser getPublishedBy() { return publishedBy; }
    public void setPublishedBy(AppUser value) { publishedBy = value; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant value) { publishedAt = value; }
    public AppUser getWithdrawnBy() { return withdrawnBy; }
    public void setWithdrawnBy(AppUser value) { withdrawnBy = value; }
    public Instant getWithdrawnAt() { return withdrawnAt; }
    public void setWithdrawnAt(Instant value) { withdrawnAt = value; }
    public String getWithdrawReason() { return withdrawReason; }
    public void setWithdrawReason(String value) { withdrawReason = value; }

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public PlanVersion id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public BigDecimal getPrice1y() {
        return this.price1y;
    }

    public PlanVersion price1y(BigDecimal price1y) {
        this.setPrice1y(price1y);
        return this;
    }

    public void setPrice1y(BigDecimal price1y) {
        this.price1y = price1y;
    }

    public BigDecimal getPrice2y() {
        return this.price2y;
    }

    public PlanVersion price2y(BigDecimal price2y) {
        this.setPrice2y(price2y);
        return this;
    }

    public void setPrice2y(BigDecimal price2y) {
        this.price2y = price2y;
    }

    public BigDecimal getPrice3y() {
        return this.price3y;
    }

    public PlanVersion price3y(BigDecimal price3y) {
        this.setPrice3y(price3y);
        return this;
    }

    public void setPrice3y(BigDecimal price3y) {
        this.price3y = price3y;
    }

    public String getTerms() {
        return this.terms;
    }

    public PlanVersion terms(String terms) {
        this.setTerms(terms);
        return this;
    }

    public void setTerms(String terms) {
        this.terms = terms;
    }

    public Instant getEffectiveAt() {
        return this.effectiveAt;
    }

    public PlanVersion effectiveAt(Instant effectiveAt) {
        this.setEffectiveAt(effectiveAt);
        return this;
    }

    public void setEffectiveAt(Instant effectiveAt) {
        this.effectiveAt = effectiveAt;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PlanVersion)) {
            return false;
        }
        return getId() != null && getId().equals(((PlanVersion) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PlanVersion{" +
            "id=" + getId() +
            ", price1y=" + getPrice1y() +
            ", price2y=" + getPrice2y() +
            ", price3y=" + getPrice3y() +
            ", terms='" + getTerms() + "'" +
            ", effectiveAt='" + getEffectiveAt() + "'" +
            "}";
    }
}
