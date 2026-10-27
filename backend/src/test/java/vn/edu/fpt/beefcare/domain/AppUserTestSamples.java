package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class AppUserTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static AppUser getAppUserSample1() {
        return new AppUser()
            .id(1L)
            .email("email1")
            .fullName("fullName1")
            .phone("phone1")
            .accountStatus("accountStatus1")
            .googleSubject("googleSubject1")
            .passwordHash("passwordHash1");
    }

    public static AppUser getAppUserSample2() {
        return new AppUser()
            .id(2L)
            .email("email2")
            .fullName("fullName2")
            .phone("phone2")
            .accountStatus("accountStatus2")
            .googleSubject("googleSubject2")
            .passwordHash("passwordHash2");
    }

    public static AppUser getAppUserRandomSampleGenerator() {
        return new AppUser()
            .id(longCount.incrementAndGet())
            .email(UUID.randomUUID().toString())
            .fullName(UUID.randomUUID().toString())
            .phone(UUID.randomUUID().toString())
            .accountStatus(UUID.randomUUID().toString())
            .googleSubject(UUID.randomUUID().toString())
            .passwordHash(UUID.randomUUID().toString());
    }
}
