package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.persistence.OptimisticLockException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class VersionGuardTest extends DomainTestSupport {

    @Test
    void matchingOrAbsentExpectedVersionPasses() {
        assertThatCode(() -> VersionGuard.check(3, 3)).doesNotThrowAnyException();
        assertThatCode(() -> VersionGuard.check(3, null)).doesNotThrowAnyException();
    }

    @Test
    void outdatedVersionIsMsgCom05Conflict() {
        assertThatThrownBy(() -> VersionGuard.check(4, 3))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(e.getParams()).containsEntry("expected", 3).containsEntry("actual", 4);
            });
    }

    @Test
    void entityVersionIsBumpedOnEveryUpdateSoJpaDetectsLostUpdates() {
        Farm farm = farm();
        Pen pen = pen(farm, "A1", 5);
        assertThat(pen.getVersion()).isZero();
        pen.setCapacity(6);
        em.flush();
        assertThat(pen.getVersion()).isEqualTo(1);
        // a concurrent writer bumps the version behind our back; our stale copy must not overwrite it
        em.createNativeQuery("update pen set version = version + 1 where id = :id").setParameter("id", pen.getId()).executeUpdate();
        pen.setCapacity(7);
        assertThatThrownBy(() -> em.flush()).isInstanceOf(OptimisticLockException.class);
    }
}
