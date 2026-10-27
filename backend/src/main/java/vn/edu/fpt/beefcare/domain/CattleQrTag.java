package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * A CattleQrTag.
 */
@Entity
@Table(name = "cattle_qr_tag")
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
    @Size(max = 50)
    @Column(name = "tag_code", length = 50, nullable = false, unique = true)
    private String tagCode;

    /**
     * ACTIVE | REPLACED
     */
    @Schema(description = "ACTIVE | REPLACED", required = true)
    @NotNull
    @Size(max = 30)
    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public CattleQrTag id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTagCode() {
        return this.tagCode;
    }

    public CattleQrTag tagCode(String tagCode) {
        this.setTagCode(tagCode);
        return this;
    }

    public void setTagCode(String tagCode) {
        this.tagCode = tagCode;
    }

    public String getStatus() {
        return this.status;
    }

    public CattleQrTag status(String status) {
        this.setStatus(status);
        return this;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public CattleQrTag cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

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
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "CattleQrTag{" +
            "id=" + getId() +
            ", tagCode='" + getTagCode() + "'" +
            ", status='" + getStatus() + "'" +
            "}";
    }
}
