package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * Herd Entry (gộp Entry History Declaration vào cột history_declarations)
 */
@Schema(description = "Herd Entry (gộp Entry History Declaration vào cột history_declarations)")
@Entity
@Table(name = "herd_entry")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class HerdEntry implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    /**
     * EXTERNAL | FARM_BORN
     */
    @Schema(description = "EXTERNAL | FARM_BORN")
    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source;

    @NotNull
    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Size(max = 255)
    @Column(name = "history_declarations", length = 255)
    private String historyDeclarations;

    @JsonIgnoreProperties(value = { "farm", "breed", "purpose", "dam", "sire", "herdEntry", "herdExit" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @NotNull
    @JoinColumn(unique = true)
    private Cattle cattle;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Pen initialPen;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public HerdEntry id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSource() {
        return this.source;
    }

    public HerdEntry source(String source) {
        this.setSource(source);
        return this;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public LocalDate getEntryDate() {
        return this.entryDate;
    }

    public HerdEntry entryDate(LocalDate entryDate) {
        this.setEntryDate(entryDate);
        return this;
    }

    public void setEntryDate(LocalDate entryDate) {
        this.entryDate = entryDate;
    }

    public String getHistoryDeclarations() {
        return this.historyDeclarations;
    }

    public HerdEntry historyDeclarations(String historyDeclarations) {
        this.setHistoryDeclarations(historyDeclarations);
        return this;
    }

    public void setHistoryDeclarations(String historyDeclarations) {
        this.historyDeclarations = historyDeclarations;
    }

    public Cattle getCattle() {
        return this.cattle;
    }

    public void setCattle(Cattle cattle) {
        this.cattle = cattle;
    }

    public HerdEntry cattle(Cattle cattle) {
        this.setCattle(cattle);
        return this;
    }

    public Pen getInitialPen() {
        return this.initialPen;
    }

    public void setInitialPen(Pen pen) {
        this.initialPen = pen;
    }

    public HerdEntry initialPen(Pen pen) {
        this.setInitialPen(pen);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof HerdEntry)) {
            return false;
        }
        return getId() != null && getId().equals(((HerdEntry) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "HerdEntry{" +
            "id=" + getId() +
            ", source='" + getSource() + "'" +
            ", entryDate='" + getEntryDate() + "'" +
            ", historyDeclarations='" + getHistoryDeclarations() + "'" +
            "}";
    }
}
