package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Reminder;

/** Reminder lookups of the herd entry feature (REM-03 pregnancy check at entry, REM-09 draft calf). */
@Repository
public interface EntryReminderRepository extends JpaRepository<Reminder, Long> {
    List<Reminder> findAllByRuleTypeAndSourceRecordAndStatus(String ruleType, String sourceRecord, String status);
    List<Reminder> findAllByRuleTypeAndSourceRecordAndStatusIn(String ruleType, String sourceRecord, java.util.Collection<String> statuses);
    java.util.Optional<Reminder> findFirstByRuleKey(String ruleKey);

    List<Reminder> findAllByFarmIdAndRuleTypeAndStatus(Long farmId, String ruleType, String status);
}
