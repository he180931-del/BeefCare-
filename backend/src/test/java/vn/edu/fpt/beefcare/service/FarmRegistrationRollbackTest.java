package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.Details;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.Registration;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * TC-02-10 (R-02-03, UC-FE02-01 E3). Not wrapped in a test transaction: the registration runs in its own transaction,
 * as a request does. The request key record is flushed before the farm is created, so finding none afterwards shows
 * the whole transaction was rolled back, not just that nothing reached the database.
 */
@ServiceIntegrationTest
class FarmRegistrationRollbackTest extends DomainTestSupport {

    @Autowired
    TransactionTemplate tx;

    @Autowired
    FarmWorkspaceService workspaces;

    @Autowired
    IdempotencyCommandService commands;

    @Test
    void tc0210FailureWhileCreatingTheStarterCatalogueLeavesNothingBehind() {
        AppUser owner = tx.execute(status -> {
            AppUser u = user();
            u.setOwnerRegistrationCompleted(true);
            u.setOwnerRegistrationCompletedAt(clock.instant());
            return save(u);
        });
        actAs(owner);
        String key = UUID.randomUUID().toString();
        String name = "Trại rollback " + next();
        // "NO-SUCH-BREED" is not a starter breed (Table III-6): the starter catalogue step fails after the farm and the
        // OWNER membership have been persisted in the same transaction.
        Registration failing = new Registration(name, "Hà Nội", "Xã demo", null, null, null, null, null, Set.of("NO-SUCH-BREED"));

        assertThatThrownBy(() -> commands.execute(null, null, "FARM_REGISTER", key, failing, Details.class, () -> workspaces.register(failing)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));

        tx.executeWithoutResult(status -> {
            assertThat(countWhere("select count(f) from Farm f where f.name = :v", name)).isZero();
            assertThat(countWhere("select count(m) from FarmMembership m where m.user.id = :v", owner.getId())).isZero();
            assertThat(countWhere("select count(p) from FarmParameterVersion p where p.farm.name = :v", name)).isZero();
            assertThat(countWhere("select count(b) from Breed b where b.farm.name = :v", name)).isZero();
            assertThat(countWhere("select count(a) from AuditLog a where a.farm.name = :v", name)).isZero();
            assertThat(countWhere("select count(r) from IdempotencyRecord r where r.idempotencyKey = :v", key)).isZero();
        });

        // Nothing of the failed attempt blocks a corrected retry with the same key.
        Registration corrected = new Registration(name, "Hà Nội", "Xã demo", null, null, null, null, null, Set.of("ZEBU-D"));
        Details farm = commands.execute(null, null, "FARM_REGISTER", key, corrected, Details.class, () -> workspaces.register(corrected));
        tx.executeWithoutResult(status -> {
            assertThat(countWhere("select count(f) from Farm f where f.name = :v", name)).isEqualTo(1);
            assertThat(countWhere("select count(m) from FarmMembership m where m.farm.id = :v", farm.id())).isEqualTo(1);
        });
    }

    private long countWhere(String jpql, Object value) {
        return em.createQuery(jpql, Long.class).setParameter("v", value).getSingleResult();
    }
}
