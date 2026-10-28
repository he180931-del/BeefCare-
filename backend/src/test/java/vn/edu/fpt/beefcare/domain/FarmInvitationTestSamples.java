package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class FarmInvitationTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static FarmInvitation getFarmInvitationSample1() {
        return new FarmInvitation()
            .id(1L)
            .invitedEmail("invitedEmail1")
            .proposedRole("proposedRole1")
            .proposedPermissions("proposedPermissions1")
            .status("status1");
    }

    public static FarmInvitation getFarmInvitationSample2() {
        return new FarmInvitation()
            .id(2L)
            .invitedEmail("invitedEmail2")
            .proposedRole("proposedRole2")
            .proposedPermissions("proposedPermissions2")
            .status("status2");
    }

    public static FarmInvitation getFarmInvitationRandomSampleGenerator() {
        return new FarmInvitation()
            .id(longCount.incrementAndGet())
            .invitedEmail(UUID.randomUUID().toString())
            .proposedRole(UUID.randomUUID().toString())
            .proposedPermissions(UUID.randomUUID().toString())
            .status(UUID.randomUUID().toString());
    }
}
