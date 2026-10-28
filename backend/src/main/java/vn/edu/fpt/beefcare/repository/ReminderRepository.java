package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Reminder;

/**
 * Spring Data JPA repository for the Reminder entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ReminderRepository extends JpaRepository<Reminder, Long> {
    java.util.List<Reminder> findAllByFarmIdAndCattleIdInAndRuleTypeAndStatus(
        Long farmId,
        java.util.Collection<Long> cattleIds,
        String ruleType,
        String status
    );
}
