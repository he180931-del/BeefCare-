package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "manual_finance_bank_claim")
public class ManualFinanceBankClaim implements Serializable {
    @Id
    @Column(name = "source_reference", length = 255)
    private String sourceReference;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "record_id", nullable = false, unique = true)
    private ManualFinanceRecord record;

    @Column(name = "claimed_at", nullable = false)
    private Instant claimedAt;

    public String getSourceReference() { return sourceReference; }
    public void setSourceReference(String sourceReference) { this.sourceReference = sourceReference; }
    public ManualFinanceRecord getRecord() { return record; }
    public void setRecord(ManualFinanceRecord record) { this.record = record; }
    public Instant getClaimedAt() { return claimedAt; }
    public void setClaimedAt(Instant claimedAt) { this.claimedAt = claimedAt; }
}
