package vn.edu.fpt.beefcare.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.repository.HerdExitQueryRepository;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.CaseRef;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.CattleCheck;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Counted;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Message;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.PregnancyRef;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Withdrawal;

/**
 * The pre-confirmation checks of a herd exit (GBR-35, GBR-94): meat withdrawal, OPEN / CHRONIC health cases, future
 * doses and reminders, open pregnancy and draft calves of the dam. They only warn and never block. Also the earliest
 * allowed exit date (GBR-34).
 */
@Service
public class HerdExitCheckService {

    public static final String REM_12 = "REM-12";

    /** The records behind a cattle's check; the confirmation closes / cancels exactly these. */
    public record Collected(
        Cattle cattle,
        Pen pen,
        LocalDate withdrawalEnd,
        List<HealthCase> openCases,
        List<ScheduledDose> doses,
        List<Reminder> reminders,
        PregnancyEpisode pregnancy,
        List<CalfOutcome> draftCalves
    ) {}

    private final HerdExitQueryRepository queries;
    private final PenAssignmentService penAssignments;
    private final FarmClock clock;
    private final DomainMessages messages;

    public HerdExitCheckService(HerdExitQueryRepository queries, PenAssignmentService penAssignments, FarmClock clock, DomainMessages messages) {
        this.queries = queries;
        this.penAssignments = penAssignments;
        this.clock = clock;
        this.messages = messages;
    }

    @Transactional(readOnly = true)
    public Collected collect(Cattle cattle, LocalDate exitDate) {
        Pen pen = penAssignments.findOpen(cattle.getId()).map(a -> a.getPen()).orElse(null);
        LocalDate withdrawal = queries.withdrawalEnd(cattle.getId()).filter(end -> !end.isBefore(exitDate)).orElse(null);
        List<Reminder> reminders = queries
            .futureReminders(cattle.getId(), exitDate, clock.zone())
            .stream()
            .filter(r -> !REM_12.equals(r.getRuleType()))
            .toList();
        return new Collected(
            cattle,
            pen,
            withdrawal,
            queries.openCases(cattle.getId()),
            queries.futureDoses(cattle.getId(), exitDate),
            reminders,
            queries.openPregnancy(cattle.getId()).orElse(null),
            queries.draftCalves(cattle.getId())
        );
    }

    public CattleCheck toCheck(Collected c, ExitType type, LocalDate exitDate) {
        String code = c.cattle().getDisplayCode();
        boolean sellsForMeat = type == ExitType.SALE || type == ExitType.CULL;
        Withdrawal withdrawal = c.withdrawalEnd() == null ? null : new Withdrawal(c.withdrawalEnd(), sellsForMeat && exitDate.isBefore(c.withdrawalEnd()));
        List<CaseRef> cases = c.openCases().stream().map(h -> new CaseRef(h.getId(), h.getStatus(), h.getOpenedDate())).toList();
        Counted doses = new Counted(c.doses().size(), c.doses().stream().map(ScheduledDose::getId).toList());
        Counted reminders = new Counted(c.reminders().size(), c.reminders().stream().map(Reminder::getId).toList());
        PregnancyRef pregnancy = c.pregnancy() == null ? null : new PregnancyRef(c.pregnancy().getId(), c.pregnancy().getExpectedCalvingDate());
        List<Long> calves = c.draftCalves().stream().map(CalfOutcome::getId).toList();

        List<String> warnings = new ArrayList<>();
        List<Message> msgs = new ArrayList<>();
        if (withdrawal != null) {
            warnings.add("meat withdrawal until " + withdrawal.endDate());
            if (withdrawal.breach()) {
                msgs.add(message(MessageCodes.FE13_07, "cattle_code", code, "date", withdrawal.endDate()));
            }
        }
        if (!cases.isEmpty()) {
            warnings.add(cases.size() + " open or chronic health case(s) will be closed by the exit");
        }
        if (doses.count() > 0 || reminders.count() > 0) {
            warnings.add(doses.count() + " scheduled dose(s) and " + reminders.count() + " reminder(s) will be cancelled");
        }
        if (pregnancy != null) {
            warnings.add("open pregnancy will be closed (dam exited)");
        }
        if (!calves.isEmpty()) {
            warnings.add(calves.size() + " draft calf/calves of this dam stay pending");
        }
        if (!warnings.isEmpty()) {
            msgs.add(message(MessageCodes.FE13_01, "cattle_code", code, "warnings", String.join("; ", warnings)));
        }
        return new CattleCheck(
            c.cattle().getId(),
            code,
            c.pen() == null ? null : c.pen().getId(),
            c.pen() == null ? null : c.pen().getCode(),
            withdrawal,
            cases,
            doses,
            reminders,
            pregnancy,
            calves,
            !warnings.isEmpty(),
            msgs
        );
    }

    /** The earliest permitted exit date: the latest recorded event of any cattle on the voucher (GBR-34, MSG-FE13-03). */
    @Transactional(readOnly = true)
    public Optional<LocalDate> earliestExitDate(Collection<Cattle> cattle) {
        LocalDate earliest = null;
        for (Cattle c : cattle) {
            Optional<LocalDate> latest = queries.latestEventDate(c.getId(), clock.zone());
            if (latest.isPresent() && (earliest == null || latest.get().isAfter(earliest))) {
                earliest = latest.get();
            }
        }
        return Optional.ofNullable(earliest);
    }

    public Message message(String code, Object... kv) {
        Map<String, Object> params = new LinkedHashMap<>(DomainException.params(kv));
        return new Message(code, params, messages.resolve(code, params));
    }
}
