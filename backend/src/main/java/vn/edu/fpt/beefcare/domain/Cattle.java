package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * A Cattle.
 */
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

    @NotNull
    @Size(max = 50)
    @Column(name = "ear_tag", length = 50, nullable = false)
    private String earTag;

    /**
     * MALE | FEMALE
     */
    @Schema(description = "MALE | FEMALE")
    @Size(max = 30)
    @Column(name = "sex", length = 30)
    private String sex;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @NotNull
    @Size(max = 30)
    @Column(name = "life_stage", length = 30, nullable = false)
    private String lifeStage;

    /**
     * ACTIVE | EXITED
     */
    @Schema(description = "ACTIVE | EXITED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "herd_status", length = 30, nullable = false)
    private String herdStatus;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "subscription" }, allowSetters = true)
    private Farm farm;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Breed breed;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private ProductionPurpose purpose;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle dam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle sire;

    @JsonIgnoreProperties(value = { "cattle", "initialPen" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "cattle")
    private HerdEntry herdEntry;

    @JsonIgnoreProperties(value = { "cattle", "confirmedBy" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "cattle")
    private HerdExit herdExit;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Cattle id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDisplayCode() {
        return this.displayCode;
    }

    public Cattle displayCode(String displayCode) {
        this.setDisplayCode(displayCode);
        return this;
    }

    public void setDisplayCode(String displayCode) {
        this.displayCode = displayCode;
    }

    public String getEarTag() {
        return this.earTag;
    }

    public Cattle earTag(String earTag) {
        this.setEarTag(earTag);
        return this;
    }

    public void setEarTag(String earTag) {
        this.earTag = earTag;
    }

    public String getSex() {
        return this.sex;
    }

    public Cattle sex(String sex) {
        this.setSex(sex);
        return this;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public LocalDate getBirthDate() {
        return this.birthDate;
    }

    public Cattle birthDate(LocalDate birthDate) {
        this.setBirthDate(birthDate);
        return this;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public String getLifeStage() {
        return this.lifeStage;
    }

    public Cattle lifeStage(String lifeStage) {
        this.setLifeStage(lifeStage);
        return this;
    }

    public void setLifeStage(String lifeStage) {
        this.lifeStage = lifeStage;
    }

    public String getHerdStatus() {
        return this.herdStatus;
    }

    public Cattle herdStatus(String herdStatus) {
        this.setHerdStatus(herdStatus);
        return this;
    }

    public void setHerdStatus(String herdStatus) {
        this.herdStatus = herdStatus;
    }

    public Farm getFarm() {
        return this.farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Cattle farm(Farm farm) {
        this.setFarm(farm);
        return this;
    }

    public Breed getBreed() {
        return this.breed;
    }

    public void setBreed(Breed breed) {
        this.breed = breed;
    }

    public Cattle breed(Breed breed) {
        this.setBreed(breed);
        return this;
    }

    public ProductionPurpose getPurpose() {
        return this.purpose;
    }

    public void setPurpose(ProductionPurpose productionPurpose) {
        this.purpose = productionPurpose;
    }

    public Cattle purpose(ProductionPurpose productionPurpose) {
        this.setPurpose(productionPurpose);
        return this;
    }

    public Cattle getDam() {
        return this.dam;
    }

    public void setDam(Cattle cattle) {
        this.dam = cattle;
    }

    public Cattle dam(Cattle cattle) {
        this.setDam(cattle);
        return this;
    }

    public Cattle getSire() {
        return this.sire;
    }

    public void setSire(Cattle cattle) {
        this.sire = cattle;
    }

    public Cattle sire(Cattle cattle) {
        this.setSire(cattle);
        return this;
    }

    public HerdEntry getHerdEntry() {
        return this.herdEntry;
    }

    public void setHerdEntry(HerdEntry herdEntry) {
        if (this.herdEntry != null) {
            this.herdEntry.setCattle(null);
        }
        if (herdEntry != null) {
            herdEntry.setCattle(this);
        }
        this.herdEntry = herdEntry;
    }

    public Cattle herdEntry(HerdEntry herdEntry) {
        this.setHerdEntry(herdEntry);
        return this;
    }

    public HerdExit getHerdExit() {
        return this.herdExit;
    }

    public void setHerdExit(HerdExit herdExit) {
        if (this.herdExit != null) {
            this.herdExit.setCattle(null);
        }
        if (herdExit != null) {
            herdExit.setCattle(this);
        }
        this.herdExit = herdExit;
    }

    public Cattle herdExit(HerdExit herdExit) {
        this.setHerdExit(herdExit);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

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
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Cattle{" +
            "id=" + getId() +
            ", displayCode='" + getDisplayCode() + "'" +
            ", earTag='" + getEarTag() + "'" +
            ", sex='" + getSex() + "'" +
            ", birthDate='" + getBirthDate() + "'" +
            ", lifeStage='" + getLifeStage() + "'" +
            ", herdStatus='" + getHerdStatus() + "'" +
            "}";
    }
}
