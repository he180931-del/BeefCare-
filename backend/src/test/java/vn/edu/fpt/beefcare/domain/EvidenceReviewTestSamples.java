package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class EvidenceReviewTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static EvidenceReview getEvidenceReviewSample1() {
        return new EvidenceReview().id(1L).decision("decision1");
    }

    public static EvidenceReview getEvidenceReviewSample2() {
        return new EvidenceReview().id(2L).decision("decision2");
    }

    public static EvidenceReview getEvidenceReviewRandomSampleGenerator() {
        return new EvidenceReview().id(longCount.incrementAndGet()).decision(UUID.randomUUID().toString());
    }
}
