package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationCategory;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;

@Entity
@Table(name = "pre_entry_history_declaration", uniqueConstraints = {@UniqueConstraint(name = "uq_declaration", columnNames = {"herd_entry_id", "category"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PreEntryHistoryDeclaration implements Serializable {

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
    @JoinColumn(name = "herd_entry_id")
    private HerdEntry herdEntry;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 30, nullable = false)
    private DeclarationCategory category;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private DeclarationStatus status = DeclarationStatus.UNKNOWN;

    @Column(name = "items")
    private String items;

    @Size(max = 255)
    @Column(name = "information_source", length = 255)
    private String informationSource;

    @Column(name = "earlier_calvings")
    private Integer earlierCalvings;

    @Enumerated(EnumType.STRING)
    @Column(name = "pregnant_at_entry", length = 30)
    private YesNoUnknown pregnantAtEntry;

    @Column(name = "est_months_pregnant")
    private Integer estMonthsPregnant;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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

    public HerdEntry getHerdEntry() {
        return herdEntry;
    }

    public void setHerdEntry(HerdEntry herdEntry) {
        this.herdEntry = herdEntry;
    }

    public DeclarationCategory getCategory() {
        return category;
    }

    public void setCategory(DeclarationCategory category) {
        this.category = category;
    }

    public DeclarationStatus getStatus() {
        return status;
    }

    public void setStatus(DeclarationStatus status) {
        this.status = status;
    }

    public String getItems() {
        return items;
    }

    public void setItems(String items) {
        this.items = items;
    }

    public String getInformationSource() {
        return informationSource;
    }

    public void setInformationSource(String informationSource) {
        this.informationSource = informationSource;
    }

    public Integer getEarlierCalvings() {
        return earlierCalvings;
    }

    public void setEarlierCalvings(Integer earlierCalvings) {
        this.earlierCalvings = earlierCalvings;
    }

    public YesNoUnknown getPregnantAtEntry() {
        return pregnantAtEntry;
    }

    public void setPregnantAtEntry(YesNoUnknown pregnantAtEntry) {
        this.pregnantAtEntry = pregnantAtEntry;
    }

    public Integer getEstMonthsPregnant() {
        return estMonthsPregnant;
    }

    public void setEstMonthsPregnant(Integer estMonthsPregnant) {
        this.estMonthsPregnant = estMonthsPregnant;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PreEntryHistoryDeclaration)) {
            return false;
        }
        return getId() != null && getId().equals(((PreEntryHistoryDeclaration) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "PreEntryHistoryDeclaration{id=" + getId() + "}";
    }
}
