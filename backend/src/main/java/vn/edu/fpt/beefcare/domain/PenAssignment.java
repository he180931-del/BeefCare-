package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * Mỗi con tối đa 1 dòng có effective_to = null
 */
@Schema(description = "Mỗi con tối đa 1 dòng có effective_to = null")
@Entity
@Table(name = "pen_assignment")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class PenAssignment implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    /**
     * HERD_ENTRY | MOVE
     */
    @Schema(description = "HERD_ENTRY | MOVE")
    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source;

    @Lob
    @Column(name = "reason")
    private String reason;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    private Cattle cattle;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Pen pen;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public PenAssignment id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getEffectiveFrom() {
        return this.effectiveFrom;
    }

    public PenAssignment effectiveFrom(LocalDate effectiveFrom) {
        this.setEffectiveFrom(effectiveFrom);
        return this;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public LocalDate getEffectiveTo() {
        return this.effectiveTo;
    }

    public PenAssignment effectiveTo(LocalDate effectiveTo) {
        this.setEffectiveTo(effectiveTo);
        return this;
    }

    public void setEffectiveTo(LocalDate effectiveTo) {
        this.effectiveTo = effectiveTo;
    }

    public String getSource() {
        return this.source;
    }

    public PenAssignment source(String source) {
        this.setSource(source);
        return this;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getReason() {
        return this.reason;
    }

    public PenAssignment reason(String reason) {
        this.setReason(reason);
        return this;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public PenAssignment cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    public Pen getPen() {
        return this.pen;
    }

    public void setPen(Pen pen) {
        this.pen = pen;
    }

    public PenAssignment pen(Pen pen) {
        this.setPen(pen);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PenAssignment)) {
            return false;
        }
        return getId() != null && getId().equals(((PenAssignment) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "PenAssignment{" +
            "id=" + getId() +
            ", effectiveFrom='" + getEffectiveFrom() + "'" +
            ", effectiveTo='" + getEffectiveTo() + "'" +
            ", source='" + getSource() + "'" +
            ", reason='" + getReason() + "'" +
            "}";
    }
}
