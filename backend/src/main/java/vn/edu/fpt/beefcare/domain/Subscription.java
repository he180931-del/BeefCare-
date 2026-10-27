package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;

/**
 * A Subscription.
 */
@Entity
@Table(name = "subscription")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Subscription implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 30)
    @Column(name = "entitlement_status", length = 30, nullable = false)
    private String entitlementStatus;

    /**
     * ERD: varchar(255) NOT NULL; đổi sang thời điểm và để trống được vì farm mới chưa có kỳ đã trả
     */
    @Schema(description = "ERD: varchar(255) NOT NULL; đổi sang thời điểm và để trống được vì farm mới chưa có kỳ đã trả")
    @Column(name = "latest_end")
    private Instant latestEnd;

    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @NotNull
    @JoinColumn(unique = true)
    private Farm farm;

    @ManyToOne(optional = false)
    @NotNull
    private PlanVersion planVersion;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Subscription id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEntitlementStatus() {
        return this.entitlementStatus;
    }

    public Subscription entitlementStatus(String entitlementStatus) {
        this.setEntitlementStatus(entitlementStatus);
        return this;
    }

    public void setEntitlementStatus(String entitlementStatus) {
        this.entitlementStatus = entitlementStatus;
    }

    public Instant getLatestEnd() {
        return this.latestEnd;
    }

    public Subscription latestEnd(Instant latestEnd) {
        this.setLatestEnd(latestEnd);
        return this;
    }

    public void setLatestEnd(Instant latestEnd) {
        this.latestEnd = latestEnd;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Subscription farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    public PlanVersion getPlanVersion() {
        return this.planVersion;
    }

    public void setPlanVersion(PlanVersion planVersion) {
        this.planVersion = planVersion;
    }

    public Subscription planVersion(PlanVersion planVersion) {
        this.setPlanVersion(planVersion);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Subscription)) {
            return false;
        }
        return getId() != null && getId().equals(((Subscription) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Subscription{" +
            "id=" + getId() +
            ", entitlementStatus='" + getEntitlementStatus() + "'" +
            ", latestEnd='" + getLatestEnd() + "'" +
            "}";
    }
}
