package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

@Entity
@Table(name = "cattle")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Cattle implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 50)
    @Column(name = "display_code", length = 50, nullable = false)
    private String displayCode;

    @Size(max = 50)
    @Column(name = "ear_tag_number", length = 50)
    private String earTagNumber;

    @Size(max = 50)
    @Column(name = "name", length = 50)
    private String name;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "sex", length = 30)
    private Sex sex;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "birth_date_accuracy", length = 30, nullable = false)
    private BirthDateAccuracy birthDateAccuracy = BirthDateAccuracy.UNKNOWN;

    @Size(max = 255)
    @Column(name = "colour_markings", length = 255)
    private String colourMarkings;

    @Size(max = 500)
    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "life_stage", length = 30, nullable = false)
    private LifeStage lifeStage;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "herd_status", length = 30, nullable = false)
    private HerdStatus herdStatus = HerdStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "exit_type", length = 30)
    private ExitType exitType;

    @Column(name = "exit_date")
    private LocalDate exitDate;

    @Size(max = 500)
    @Column(name = "void_reason", length = 500)
    private String voidReason;

    @Size(max = 50)
    @Column(name = "external_sire_code", length = 50)
    private String externalSireCode;

    @NotNull
    @Column(name = "declared_parity")
    private Integer declaredParity = 0;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id")
    private Farm farm;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "breed_id")
    private Breed breed;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purpose_id")
    private ProductionPurpose purpose;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dam_id")
    private Cattle dam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sire_id")
    private Cattle sire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private AppUser createdBy;

    @NotNull
    @Column(name = "created_at")
    private Instant createdAt;

    @NotNull
    @Column(name = "updated_at")
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

    public String getDisplayCode() {
        return displayCode;
    }

    public void setDisplayCode(String displayCode) {
        this.displayCode = displayCode;
    }

    public String getEarTagNumber() {
        return earTagNumber;
    }

    public void setEarTagNumber(String earTagNumber) {
        this.earTagNumber = earTagNumber;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Sex getSex() {
        return sex;
    }

    public void setSex(Sex sex) {
        this.sex = sex;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public BirthDateAccuracy getBirthDateAccuracy() {
        return birthDateAccuracy;
    }

    public void setBirthDateAccuracy(BirthDateAccuracy birthDateAccuracy) {
        this.birthDateAccuracy = birthDateAccuracy;
    }

    public String getColourMarkings() {
        return colourMarkings;
    }

    public void setColourMarkings(String colourMarkings) {
        this.colourMarkings = colourMarkings;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public LifeStage getLifeStage() {
        return lifeStage;
    }

    public void setLifeStage(LifeStage lifeStage) {
        this.lifeStage = lifeStage;
    }

    public HerdStatus getHerdStatus() {
        return herdStatus;
    }

    public void setHerdStatus(HerdStatus herdStatus) {
        this.herdStatus = herdStatus;
    }

    public ExitType getExitType() {
        return exitType;
    }

    public void setExitType(ExitType exitType) {
        this.exitType = exitType;
    }

    public LocalDate getExitDate() {
        return exitDate;
    }

    public void setExitDate(LocalDate exitDate) {
        this.exitDate = exitDate;
    }

    public String getVoidReason() {
        return voidReason;
    }

    public void setVoidReason(String voidReason) {
        this.voidReason = voidReason;
    }

    public String getExternalSireCode() {
        return externalSireCode;
    }

    public void setExternalSireCode(String externalSireCode) {
        this.externalSireCode = externalSireCode;
    }

    public Integer getDeclaredParity() {
        return declaredParity;
    }

    public void setDeclaredParity(Integer declaredParity) {
        this.declaredParity = declaredParity;
    }

    public Farm getFarm() {
        return farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Breed getBreed() {
        return breed;
    }

    public void setBreed(Breed breed) {
        this.breed = breed;
    }

    public ProductionPurpose getPurpose() {
        return purpose;
    }

    public void setPurpose(ProductionPurpose purpose) {
        this.purpose = purpose;
    }

    public Cattle getDam() {
        return dam;
    }

    public void setDam(Cattle dam) {
        this.dam = dam;
    }

    public Cattle getSire() {
        return sire;
    }

    public void setSire(Cattle sire) {
        this.sire = sire;
    }

    public AppUser getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(AppUser createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
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
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Cattle)) {
            return false;
        }
        return getId() != null && getId().equals(((Cattle) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "Cattle{id=" + getId() + "}";
    }
}
