package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import jakarta.persistence.Lob;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

/** Immutable snapshot of farm-level biological and reminder parameters. */
@Entity
@Table(name = "farm_parameter_version", uniqueConstraints = @UniqueConstraint(name = "uq_farm_parameter_version", columnNames = { "farm_id", "version_no" }))
public class FarmParameterVersion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id", nullable = false)
    @JsonIgnoreProperties(value = { "subscription", "mainBreeds" }, allowSetters = true)
    private Farm farm;

    @NotNull
    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @NotNull
    @Column(name = "gestation_length_days", nullable = false)
    private Integer gestationLengthDays = 283;

    /** JSON object of the remaining named SRS parameters, kept as text for PostgreSQL/H2 parity. */
    @NotNull
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.LONGVARCHAR)
    @Column(name = "parameter_values", nullable = false)
    private String parameterValues = "{}";

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Size(max = 500)
    @Column(name = "source_note", length = 500)
    private String sourceNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_id")
    private AppUser changedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Farm getFarm() { return farm; }
    public void setFarm(Farm farm) { this.farm = farm; }
    public Integer getVersionNo() { return versionNo; }
    public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
    public Integer getGestationLengthDays() { return gestationLengthDays; }
    public void setGestationLengthDays(Integer gestationLengthDays) { this.gestationLengthDays = gestationLengthDays; }
    public String getParameterValues() { return parameterValues; }
    public void setParameterValues(String parameterValues) { this.parameterValues = parameterValues; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public String getSourceNote() { return sourceNote; }
    public void setSourceNote(String sourceNote) { this.sourceNote = sourceNote; }
    public AppUser getChangedBy() { return changedBy; }
    public void setChangedBy(AppUser changedBy) { this.changedBy = changedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @PrePersist
    void onCreate() { if (createdAt == null) createdAt = Instant.now(); }
}
