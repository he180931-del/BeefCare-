package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;

/**
 * SCR-48 "Getting started" panel (UC-FE15-01): shown to the Owner and Managers of a new farm until every step is done or
 * the panel is dismissed. Steps whose completion shows in the data are derived from it; the two review steps (catalogues,
 * parameters) are also done when edited or when a user marks them done.
 */
@Service
public class FarmOnboardingService {

    public enum Step {
        CREATE_PENS("SCR-17"),
        REVIEW_BREEDS_AND_PURPOSES("SCR-52"),
        COMPLETE_VACCINE_DOSES("SCR-53"),
        ADD_REFERENCE_MEDICINES("SCR-54"),
        CHECK_FARM_PARAMETERS("SCR-56"),
        INVITE_MEMBERS("SCR-13"),
        FIRST_HERD_ENTRY_VOUCHER("SCR-24");

        final String screen;

        Step(String screen) {
            this.screen = screen;
        }
    }

    /** Steps a user may mark done; the others complete only through the data. */
    private static final Set<Step> MARKABLE = Set.of(Step.REVIEW_BREEDS_AND_PURPOSES, Step.CHECK_FARM_PARAMETERS, Step.COMPLETE_VACCINE_DOSES);

    private final EntityManager em;
    private final FarmAccessService access;
    private final FarmClock clock;

    public FarmOnboardingService(EntityManager em, FarmAccessService access, FarmClock clock) {
        this.em = em;
        this.access = access;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GettingStarted view(Long farmId) {
        FarmContext ctx = access.require(farmId, FarmAction.VIEW_REPORTS);
        return build(ctx);
    }

    @Transactional
    public GettingStarted markDone(Long farmId, String stepCode) {
        FarmContext ctx = access.require(farmId, FarmAction.VIEW_REPORTS);
        Step step = parse(stepCode);
        if (!MARKABLE.contains(step)) throw DomainException.invalid("step");
        Farm farm = em.find(Farm.class, farmId, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        Set<String> done = new HashSet<>(farm.getOnboardingStepsDone() == null ? Set.of() : farm.getOnboardingStepsDone());
        if (done.add(step.name())) farm.setOnboardingStepsDone(done);
        em.flush();
        return build(ctx);
    }

    @Transactional
    public GettingStarted dismiss(Long farmId) {
        FarmContext ctx = access.require(farmId, FarmAction.VIEW_REPORTS);
        Farm farm = em.find(Farm.class, farmId, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (farm.getOnboardingDismissedAt() == null) farm.setOnboardingDismissedAt(clock.now());
        em.flush();
        return build(ctx);
    }

    private GettingStarted build(FarmContext ctx) {
        Farm farm = ctx.farm();
        Long id = farm.getId();
        Set<String> marked = farm.getOnboardingStepsDone() == null ? Set.of() : farm.getOnboardingStepsDone();
        boolean owner = ctx.role() == FarmRole.OWNER;
        List<StepView> steps = new ArrayList<>();
        for (Step step : Step.values()) {
            if (step == Step.INVITE_MEMBERS && !owner) continue; // the Owner invites members (GBR-16)
            boolean done = marked.contains(step.name()) || derived(step, id);
            steps.add(new StepView(step.name(), step.screen, done, !done && MARKABLE.contains(step)));
        }
        boolean allDone = steps.stream().allMatch(StepView::done);
        boolean visible = farm.getOnboardingDismissedAt() == null && !allDone;
        return new GettingStarted(visible, farm.getOnboardingDismissedAt() != null, allDone, steps);
    }

    private boolean derived(Step step, Long farmId) {
        return switch (step) {
            case CREATE_PENS -> exists("select count(p) from Pen p where p.farm.id = :f", farmId);
            case REVIEW_BREEDS_AND_PURPOSES -> exists("select count(b) from Breed b where b.farm.id = :f and b.version > 0", farmId) ||
                exists("select count(p) from ProductionPurpose p where p.farm.id = :f and p.version > 0", farmId);
            case COMPLETE_VACCINE_DOSES -> exists("select count(v) from Vaccine v where v.farm.id = :f and v.available = true", farmId) &&
                !exists("select count(v) from Vaccine v where v.farm.id = :f and v.available = true and (v.dose is null or trim(v.dose) = '')", farmId);
            case ADD_REFERENCE_MEDICINES -> exists("select count(m) from Medicine m where m.farm.id = :f", farmId);
            case CHECK_FARM_PARAMETERS -> exists("select count(v) from FarmParameterVersion v where v.farm.id = :f and v.versionNo > 1", farmId);
            case INVITE_MEMBERS -> exists("select count(i) from FarmInvitation i where i.farm.id = :f", farmId) ||
                em.createQuery("select count(m) from FarmMembership m where m.farm.id = :f", Long.class).setParameter("f", farmId).getSingleResult() > 1;
            case FIRST_HERD_ENTRY_VOUCHER -> em.createQuery("select count(v) from HerdEntryVoucher v where v.farm.id = :f and v.status = :s", Long.class)
                .setParameter("f", farmId).setParameter("s", EntryVoucherStatus.POSTED).getSingleResult() > 0;
        };
    }

    private boolean exists(String countQuery, Long farmId) {
        return em.createQuery(countQuery, Long.class).setParameter("f", farmId).getSingleResult() > 0;
    }

    private static Step parse(String code) {
        try {
            return Step.valueOf(code == null ? "" : code.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw DomainException.invalid("step");
        }
    }

    /** {@code markable}: the user may tick the step as reviewed. */
    public record StepView(String step, String screen, boolean done, boolean markable) {}

    public record GettingStarted(boolean visible, boolean dismissed, boolean allDone, List<StepView> steps) {}
}
