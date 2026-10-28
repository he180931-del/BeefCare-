package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import vn.edu.fpt.beefcare.domain.enumeration.CodeType;

@Entity
@Table(name = "code_sequence", uniqueConstraints = {@UniqueConstraint(name = "uq_code_sequence", columnNames = {"farm_id", "code_type", "period_year"})})
@SuppressWarnings("common-java:DuplicatedBlocks")
public class CodeSequence implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Column(name = "farm_id", nullable = false)
    private Long farmId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "code_type", length = 30, nullable = false)
    private CodeType codeType;

    @NotNull
    @Column(name = "period_year", nullable = false)
    private Integer periodYear;

    @NotNull
    @Column(name = "last_value", nullable = false)
    private Long lastValue = 0L;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getFarmId() {
        return farmId;
    }

    public void setFarmId(Long farmId) {
        this.farmId = farmId;
    }

    public CodeType getCodeType() {
        return codeType;
    }

    public void setCodeType(CodeType codeType) {
        this.codeType = codeType;
    }

    public Integer getPeriodYear() {
        return periodYear;
    }

    public void setPeriodYear(Integer periodYear) {
        this.periodYear = periodYear;
    }

    public Long getLastValue() {
        return lastValue;
    }

    public void setLastValue(Long lastValue) {
        this.lastValue = lastValue;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CodeSequence)) {
            return false;
        }
        return getId() != null && getId().equals(((CodeSequence) o).getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "CodeSequence{id=" + getId() + "}";
    }
}
