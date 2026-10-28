package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.repository.EntryReminderRepository;

/**
 * Reminders raised or closed by herd entry: REM-03 (pregnancy check, entry date + 7 days for a pregnancy declared at
 * entry, GBR-30) and REM-09 (draft calf awaiting registration). Statuses: OPEN, RESOLVED, CANCELLED.
 */
@Service
public class EntryReminderService {

    public static final String REM_03 = "REM-03";
    public static final String REM_09 = "REM-09";
    public static final String OPEN = "OPEN";
    public static final String RESOLVED = "RESOLVED";
    public static final String CANCELLED = "CANCELLED";
    /** The reconciliation job (JOB-01) writes ACTIVE; both spellings are an applicable reminder. */
    private static final java.util.List<String> ACTIVE_STATES = java.util.List.of(OPEN, "ACTIVE");

    private final EntryReminderRepository repository;
    private final FarmClock clock;

    public EntryReminderService(EntryReminderRepository repository, FarmClock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public static String entrySource(HerdEntry entry) {
        return "HERD_ENTRY:" + entry.getId();
    }

    public static String calfSource(CalfOutcome calf) {
        return "CALF_OUTCOME:" + calf.getId();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Reminder pregnancyCheckAtEntry(HerdEntry entry, Cattle cattle) {
        List<Reminder> open = repository.findAllByRuleTypeAndSourceRecordAndStatusIn(REM_03, entrySource(entry), ACTIVE_STATES);
        if (!open.isEmpty()) {
            return open.get(0);
        }
        Reminder closed = repository.findFirstByRuleKey(entry.getFarm().getId() + ":" + REM_03 + ":" + entrySource(entry).substring(0, entrySource(entry).indexOf(':')) + ":" + entrySource(entry)).orElse(null);
        if (closed != null) { // the rule key is unique: reopen instead of inserting a duplicate
            closed.setStatus(OPEN);
            closed.setDueTime(dueAt(entry.getEntryDate().plusDays(7)));
            return repository.save(closed);
        }
        Reminder r = new Reminder();
        r.setFarm(entry.getFarm());
        r.setCattle(cattle);
        r.setRuleType(REM_03);
        r.setSourceRecord(entrySource(entry));
        r.setDueTime(dueAt(entry.getEntryDate().plusDays(7)));
        r.setStatus(OPEN);
        return repository.save(r);
    }

    /** Moves the open REM-03 of the entry to its new due date (entry date corrected). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void rescheduleEntryReminder(HerdEntry entry) {
        for (Reminder r : repository.findAllByRuleTypeAndSourceRecordAndStatusIn(REM_03, entrySource(entry), ACTIVE_STATES)) {
            r.setDueTime(dueAt(entry.getEntryDate().plusDays(7)));
            repository.save(r);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelEntryReminders(HerdEntry entry) {
        for (Reminder r : repository.findAllByRuleTypeAndSourceRecordAndStatusIn(REM_03, entrySource(entry), ACTIVE_STATES)) {
            r.setStatus(CANCELLED);
            repository.save(r);
        }
    }

    /** REM-09 for a draft calf; attached to the dam. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Reminder raiseCalfReminder(CalfOutcome calf, Cattle dam) {
        List<Reminder> open = repository.findAllByRuleTypeAndSourceRecordAndStatusIn(REM_09, calfSource(calf), ACTIVE_STATES);
        if (!open.isEmpty()) {
            return open.get(0);
        }
        Reminder closed = repository.findFirstByRuleKey(dam.getFarm().getId() + ":" + REM_09 + ":" + calfSource(calf).substring(0, calfSource(calf).indexOf(':')) + ":" + calfSource(calf)).orElse(null);
        if (closed != null) { // the rule key is unique: reopen instead of inserting a duplicate
            closed.setStatus(OPEN);
            closed.setDueTime(clock.now());
            return repository.save(closed);
        }
        Reminder r = new Reminder();
        r.setFarm(dam.getFarm());
        r.setCattle(dam);
        r.setRuleType(REM_09);
        r.setSourceRecord(calfSource(calf));
        r.setDueTime(clock.now());
        r.setStatus(OPEN);
        return repository.save(r);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void resolveCalfReminder(CalfOutcome calf) {
        for (Reminder r : repository.findAllByRuleTypeAndSourceRecordAndStatusIn(REM_09, calfSource(calf), ACTIVE_STATES)) {
            r.setStatus(RESOLVED);
            repository.save(r);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelCalfReminder(CalfOutcome calf) {
        for (Reminder r : repository.findAllByRuleTypeAndSourceRecordAndStatusIn(REM_09, calfSource(calf), ACTIVE_STATES)) {
            r.setStatus(CANCELLED);
            repository.save(r);
        }
    }

    private Instant dueAt(LocalDate date) {
        return date.atStartOfDay(clock.zone()).toInstant();
    }
}
