package vn.edu.fpt.beefcare.support;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherRequests;

/** Fixtures of the herd exit tests: a farm with Owner / Manager / Technician, two pens, a buyer and placed cattle. */
public abstract class ExitTestSupport extends DomainTestSupport {

    protected Farm farm;
    protected AppUser owner;
    protected AppUser manager;
    protected AppUser technician;
    protected TradingPartner buyer;
    protected Pen penA;
    protected Pen penB;
    protected Breed breed;
    protected ProductionPurpose fattening;

    protected void setUpExitFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        buyer = partner(farm, owner, false, true);
        penA = pen(farm, "A", 10);
        penB = pen(farm, "B", 10);
        breed = breed(farm);
        fattening = purpose(farm, PurposeType.FATTENING);
    }

    /** An ACTIVE cattle placed in the pen since 20 days ago with a measured weight 10 days ago. */
    protected Cattle placed(Pen pen, String weightKg) {
        Cattle c = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        PenAssignment a = new PenAssignment();
        a.setFarm(farm);
        a.setCattle(c);
        a.setPen(pen);
        a.setFromDate(TODAY.minusDays(20));
        a.setSource(AssignmentSource.HERD_ENTRY);
        a.setMovedBy(owner);
        a.setRecordedAt(Instant.now());
        save(a);
        if (weightKg != null) {
            weight(c, TODAY.minusDays(10), weightKg);
        }
        return c;
    }

    protected Vaccine vaccine() {
        Vaccine v = new Vaccine();
        v.setFarm(farm);
        v.setCode("V" + next());
        v.setName("Vaccine");
        v.setDiseasePrevented("FMD");
        v.setManufacturer("Maker");
        v.setDose("2ml");
        v.setRoute("SC");
        v.setBoosterInterval(180);
        v.setWithdrawalInfo("21 days");
        v.setAvailable(true);
        return save(v);
    }

    /** An ON_FARM vaccination with a meat withdrawal ending on {@code end}. */
    protected Vaccination withdrawal(Cattle c, LocalDate end) {
        Vaccination v = new Vaccination();
        v.setCattle(c);
        v.setVaccine(vaccine());
        v.setVaccinationDate(TODAY.minusDays(12));
        v.setEntryTime(Instant.now());
        v.setDose("2ml");
        v.setSource("ON_FARM");
        v.setVaccinator("Vet");
        v.setWithdrawalEndDate(end);
        return save(v);
    }

    protected ScheduledDose dose(Cattle c, LocalDate due) {
        VaccinationSchedule s = new VaccinationSchedule();
        s.setFarm(farm);
        s.setVaccine(vaccine());
        s.setTargetGroup("all");
        s.setFirstDueDate(due);
        s.setDoseCount(2);
        s.setIntervalDays(30);
        s.setStatus("ACTIVE");
        save(s);
        ScheduledDose d = new ScheduledDose();
        d.setCattle(c);
        d.setSchedule(s);
        d.setDoseNo(1);
        d.setDueDate(due);
        d.setStatus("PLANNED");
        return save(d);
    }

    protected Reminder reminder(Cattle c, String rule, LocalDate dueDay) {
        Reminder r = new Reminder();
        r.setFarm(farm);
        r.setCattle(c);
        r.setRuleType(rule);
        r.setSourceRecord("test");
        r.setDueTime(dueDay.atTime(9, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        r.setStatus("ACTIVE");
        return save(r);
    }

    protected HealthCase healthCase(Cattle c, String status, String outcome, LocalDate opened, LocalDate closed) {
        HealthCase h = new HealthCase();
        h.setCattle(c);
        h.setOpenedDate(opened);
        h.setStatus(status);
        h.setOutcome(outcome);
        h.setClosedDate(closed);
        return save(h);
    }

    protected PregnancyEpisode pregnancy(Cattle c) {
        ReproductionEvent e = new ReproductionEvent();
        e.setCattle(c);
        e.setType("PREGNANCY_CHECK");
        e.setEventTime(TODAY.minusDays(9).atTime(9, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        e.setResult("PREGNANT");
        save(e);
        PregnancyEpisode p = new PregnancyEpisode();
        p.setCattle(c);
        p.setConfirmingCheck(e);
        p.setExpectedCalvingDate(TODAY.plusDays(150));
        p.setParity(1);
        p.setStatus("OPEN");
        return save(p);
    }

    protected CalfOutcome draftCalf(Cattle dam) {
        CalvingEvent b = new CalvingEvent();
        b.setDam(dam);
        b.setBirthTime(TODAY.minusDays(9).atTime(8, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        b.setCourse("NORMAL");
        b.setDamCondition("GOOD");
        save(b);
        CalfOutcome o = new CalfOutcome();
        o.setCalving(b);
        o.setOutcome("LIVE");
        o.setRegistrationState("PENDING_CONFIRMATION");
        return save(o);
    }

    protected ExitVoucherRequests.Line line(Cattle c, String kg, Long price) {
        return new ExitVoucherRequests.Line(c.getId(), kg == null ? null : new BigDecimal(kg), kg == null ? null : WeightBasis.MEASURED, price);
    }

    /** SALE / CULL / OTHER request. */
    protected ExitVoucherRequests.Save saveReq(
        ExitType type,
        LocalDate date,
        Long buyerId,
        String destination,
        long deductions,
        long deposit,
        PaymentMethod method,
        List<ExitVoucherRequests.Line> lines
    ) {
        return new ExitVoucherRequests.Save(
            type,
            date,
            buyerId,
            destination,
            null,
            null,
            null,
            null,
            null,
            null,
            PricingBasis.PER_KG,
            deductions,
            deposit,
            method,
            null,
            lines,
            null
        );
    }

    protected ExitVoucherRequests.Save sale(LocalDate date, ExitVoucherRequests.Line... lines) {
        return saveReq(ExitType.SALE, date, buyer.getId(), null, 0, 0, null, List.of(lines));
    }

    protected ExitVoucherRequests.Save death(LocalDate date, LossKind kind, String cause, String disposal, ExitVoucherRequests.Line... lines) {
        return new ExitVoucherRequests.Save(
            ExitType.DEATH,
            date,
            null,
            null,
            null,
            null,
            null,
            kind,
            cause,
            disposal,
            PricingBasis.PER_KG,
            5000L,
            1000L,
            PaymentMethod.CASH,
            null,
            List.of(lines),
            null
        );
    }
}
