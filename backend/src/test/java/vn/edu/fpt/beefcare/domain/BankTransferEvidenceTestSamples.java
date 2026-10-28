package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class BankTransferEvidenceTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static BankTransferEvidence getBankTransferEvidenceSample1() {
        return new BankTransferEvidence()
            .id(1L)
            .providerTxnId(1L)
            .quoteRef("quoteRef1")
            .deliveryOutcome("deliveryOutcome1")
            .authOutcome("authOutcome1");
    }

    public static BankTransferEvidence getBankTransferEvidenceSample2() {
        return new BankTransferEvidence()
            .id(2L)
            .providerTxnId(2L)
            .quoteRef("quoteRef2")
            .deliveryOutcome("deliveryOutcome2")
            .authOutcome("authOutcome2");
    }

    public static BankTransferEvidence getBankTransferEvidenceRandomSampleGenerator() {
        return new BankTransferEvidence()
            .id(longCount.incrementAndGet())
            .providerTxnId(longCount.incrementAndGet())
            .quoteRef(UUID.randomUUID().toString())
            .deliveryOutcome(UUID.randomUUID().toString())
            .authOutcome(UUID.randomUUID().toString());
    }
}
