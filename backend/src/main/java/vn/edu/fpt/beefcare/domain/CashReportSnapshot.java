package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A CashReportSnapshot.
 */
@Entity
@Table(name = "cash_report_snapshot")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class CashReportSnapshot implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "as_of", nullable = false)
    private Instant asOf;

    /**
     * ERD: date_range - tách 2 cột
     */
    @Schema(description = "ERD: date_range - tách 2 cột", required = true)
    @NotNull
    @Column(name = "date_from", nullable = false)
    private LocalDate dateFrom;

    @NotNull
    @Column(name = "date_to", nullable = false)
    private LocalDate dateTo;

    @NotNull
    @Column(name = "totals", precision = 21, scale = 2, nullable = false)
    private BigDecimal totals;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "platformStaffAccess" }, allowSetters = true)
    private AppUser pmUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public CashReportSnapshot id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getAsOf() {
        return this.asOf;
    }

    public CashReportSnapshot asOf(Instant asOf) {
        this.setAsOf(asOf);
        return this;
    }

    public void setAsOf(Instant asOf) {
        this.asOf = asOf;
    }

    public LocalDate getDateFrom() {
        return this.dateFrom;
    }

    public CashReportSnapshot dateFrom(LocalDate dateFrom) {
        this.setDateFrom(dateFrom);
        return this;
    }

    public void setDateFrom(LocalDate dateFrom) {
        this.dateFrom = dateFrom;
    }

    public LocalDate getDateTo() {
        return this.dateTo;
    }

    public CashReportSnapshot dateTo(LocalDate dateTo) {
        this.setDateTo(dateTo);
        return this;
    }

    public void setDateTo(LocalDate dateTo) {
        this.dateTo = dateTo;
    }

    public BigDecimal getTotals() {
        return this.totals;
    }

    public CashReportSnapshot totals(BigDecimal totals) {
        this.setTotals(totals);
        return this;
    }

    public void setTotals(BigDecimal totals) {
        this.totals = totals;
    }

    public AppUser getPmUser() {
        return this.pmUser;
    }

    public void setPmUser(AppUser appUser) {
        this.pmUser = appUser;
    }

    public CashReportSnapshot pmUser(AppUser appUser) {
        this.setPmUser(appUser);
        return this;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public CashReportSnapshot farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CashReportSnapshot)) {
            return false;
        }
        return getId() != null && getId().equals(((CashReportSnapshot) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "CashReportSnapshot{" +
            "id=" + getId() +
            ", asOf='" + getAsOf() + "'" +
            ", dateFrom='" + getDateFrom() + "'" +
            ", dateTo='" + getDateTo() + "'" +
            ", totals=" + getTotals() +
            "}";
    }
}
