package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.RecordRevisionService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** FE-09 – lệnh lịch tiêm phòng và ghi tiêm (UC-FE09-02 → 05, GBR-41/43). Không còn hoãn mũi (D46). */
@Service
public class VaccinationCommandService {
    /** Độ dài tối đa của số lô khi client cũ vẫn gửi lên (cột {@code batch_no} varchar(50)). */
    private static final int MAX_BATCH_NO_LENGTH = 50;
    /** Độ dài tối đa của liều, đường tiêm và tên người tiêm (cột varchar(255)). */
    private static final int MAX_TEXT_LENGTH = 255;
    /** Số ngày ngưng sử dụng thịt cho phép: số nguyên 0 – 365 (spec FE-09, D45). */
    private static final int MAX_WITHDRAWAL_DAYS = 365;
    /** Mã đường tiêm "Khác": phải kèm mô tả, không được lưu trơn (D45). */
    private static final String ROUTE_OTHER = "OTHER";
    /**
     * Liều = số dương (dấu chấm hoặc phẩy thập phân) + đơn vị tùy chọn bắt đầu bằng chữ cái,
     * ví dụ "2", "2,5 ml", "1 liều" (D45). Không nhận khoảng như "1-2 ml".
     */
    private static final Pattern DOSE_PATTERN = Pattern.compile("^(\\d+(?:[.,]\\d+)?)\\s*(\\p{L}.*)?$");

    // ---- Trạng thái lịch và mũi (D46: không còn trạng thái hoãn DEFERRED) ----
    private static final String SCHEDULE_ACTIVE = "ACTIVE";
    private static final String DOSE_PLANNED = "PLANNED";
    private static final String DOSE_DONE = "DONE";
    private static final String DOSE_CANCELLED = "CANCELLED";

    // ---- Giới hạn của lịch tiêm (spec FE-09 SCR-32) ----
    private static final int MAX_SCHEDULE_NAME_LENGTH = 100;
    private static final int MAX_DOSE_COUNT = 10;
    private static final int MAX_INTERVAL_DAYS = 365;
    private static final int MAX_BOOSTER_MONTHS = 60;

    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final CattleGuardService cattleGuard;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;
    private final FarmClock clock;
    private final RecordRevisionService revisions;
    private final CattleStateService cattleState;

    public VaccinationCommandService(FarmAccessService access, CattleGuardService cattleGuard, IdempotencyCommandService idempotency, AuditService audit, FarmClock clock, RecordRevisionService revisions, CattleStateService cattleState) {
        this.access = access; this.cattleGuard = cattleGuard; this.idempotency = idempotency; this.audit = audit; this.clock = clock; this.revisions = revisions; this.cattleState = cattleState;
    }

    public CareDtos.VaccinationScheduleResult createSchedule(Long farmId, String key, CareDtos.CreateVaccinationSchedule request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_SCHEDULE_CREATE", key, request,
            CareDtos.VaccinationScheduleResult.class, () -> createScheduleInCommand(farmId, request));
    }

    /**
     * A2 – danh sách lịch tiêm của trại kèm từng mũi. {@code completed} cho biết lịch đang chạy đã không còn mũi chờ
     * tiêm (D46).
     */
    @Transactional(readOnly = true)
    public List<CareDtos.VaccinationScheduleView> schedules(Long farmId) {
        access.require(farmId, FarmAction.VIEW_HEALTH);
        List<VaccinationSchedule> schedules = em
            .createQuery("select s from VaccinationSchedule s where s.farm.id=:farm order by s.id desc", VaccinationSchedule.class)
            .setParameter("farm", farmId)
            .getResultList();
        List<CareDtos.VaccinationScheduleView> views = new ArrayList<>();
        for (VaccinationSchedule s : schedules) {
            List<ScheduledDose> doses = em
                .createQuery("select d from ScheduledDose d where d.schedule.id=:id order by d.dueDate,d.cattle.displayCode,d.doseNo", ScheduledDose.class)
                .setParameter("id", s.getId())
                .getResultList();
            List<CareDtos.ScheduledDoseView> doseViews = doses
                .stream()
                .map(d -> new CareDtos.ScheduledDoseView(
                    d.getId(), d.getCattle().getId(), d.getCattle().getDisplayCode(), d.getDoseNo(), d.getDueDate(), d.getStatus(), d.getVersion()))
                .toList();
            boolean completed = SCHEDULE_ACTIVE.equalsIgnoreCase(s.getStatus()) && isCompleted(doses);
            views.add(new CareDtos.VaccinationScheduleView(
                s.getId(),
                s.getScheduleName(),
                s.getTargetGroup(),
                s.getVaccine().getId(),
                s.getVaccine().getName(),
                s.getFirstDueDate(),
                s.getDoseCount(),
                s.getIntervalDays(),
                s.getBoosterIntervalMonths(),
                s.getStatus(),
                completed,
                s.getVersion(),
                doseViews,
                s.getStopReason(),
                targetView(farmId, s.getTargetCriteria())
            ));
        }
        return views;
    }

    public CareDtos.VaccinationScheduleResult editSchedule(Long farmId, Long scheduleId, String key, CareDtos.EditVaccinationSchedule request) {
        return idempotency.execute(
            farmId,
            FarmAction.MANAGE_HEALTH,
            "VACCINATION_SCHEDULE_EDIT",
            key,
            Map.of("scheduleId", scheduleId, "request", request),
            CareDtos.VaccinationScheduleResult.class,
            () -> editScheduleInCommand(farmId, scheduleId, request)
        );
    }

    /**
     * A4 – sửa một lịch tiêm (UC-FE09-03, R-09-05). Trường để {@code null} giữ nguyên giá trị cũ.
     *
     * <p>Quy tắc khóa (D46):
     * <ul>
     *   <li>Lịch đã dừng hoặc đã hoàn thành (không còn mũi chờ tiêm): không sửa được gì.</li>
     *   <li>Lịch đã có mũi tiêm: không đổi vắc-xin, ngày bắt đầu, khoảng cách giữa mũi; số mũi không giảm dưới mũi đã
     *       tiêm; không đổi số mũi khi đã bắt đầu loạt nhắc lại.</li>
     *   <li>Bò thêm vào lịch: mũi 1 có hạn từ hôm nay nếu ngày bắt đầu của lịch đã qua.</li>
     *   <li>Bò bị bỏ khỏi lịch: mũi chờ tiêm bị hủy, mũi đã tiêm giữ nguyên (thay cho việc hoãn).</li>
     * </ul>
     * Mũi đã tiêm (DONE) không bao giờ thay đổi.
     */
    @Transactional
    CareDtos.VaccinationScheduleResult editScheduleInCommand(Long farmId, Long scheduleId, CareDtos.EditVaccinationSchedule req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        if (req == null) {
            throw DomainException.required("schedule");
        }
        VaccinationSchedule schedule = scheduleForFarm(farmId, scheduleId);
        VersionGuard.requireExpected(schedule.getVersion(), req.expectedVersion());
        if (!SCHEDULE_ACTIVE.equalsIgnoreCase(schedule.getStatus())) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        List<ScheduledDose> all = em
            .createQuery("select d from ScheduledDose d where d.schedule.id=:id order by d.cattle.id,d.doseNo,d.id", ScheduledDose.class)
            .setParameter("id", scheduleId)
            .getResultList();
        if (isCompleted(all)) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "schedule_completed");
        }
        boolean anyDone = all.stream().anyMatch(this::isDone);
        Map<String, Object> changes = new java.util.LinkedHashMap<>();

        applyName(farmId, schedule, req.name(), changes);
        applyVaccine(farmId, schedule, req.vaccineId(), anyDone, changes);
        boolean redate = applyDates(schedule, req, anyDone, changes);
        int oldCount = schedule.getDoseCount();
        applyBooster(schedule, req, all, oldCount, changes);
        int count = applyDoseCount(schedule, req.doseCount(), all, oldCount, changes);
        java.util.Set<Long> targets = applyTarget(farmId, schedule, req.target(), all, changes);
        int created = planMissingDoses(farmId, schedule, targets, all, count);

        // TC-09-08: đổi ngày bắt đầu / khoảng cách (chỉ được khi chưa ai tiêm) dời mọi mũi chờ tiêm; mũi nhắc lại giữ ngày riêng.
        if (redate) {
            for (ScheduledDose dose : all) {
                if (isOpen(dose) && dose.getDoseNo() <= count) {
                    dose.setDueDate(dueDateOf(schedule.getFirstDueDate(), dose.getDoseNo(), schedule.getIntervalDays()));
                }
            }
        }
        em.flush();

        // MSG-FE09-01 đếm số bò đang thuộc lịch (bò bị bỏ vẫn giữ mũi đã tiêm nhưng không còn là đối tượng).
        Long remaining = em
            .createQuery("select count(d) from ScheduledDose d where d.schedule.id=:id and d.status=:planned", Long.class)
            .setParameter("id", scheduleId)
            .setParameter("planned", DOSE_PLANNED)
            .getSingleResult();
        changes.put("createdDoses", created);
        changes.put("version", schedule.getVersion());
        audit.log(ctx, "VACCINATION_SCHEDULE_EDIT", "VaccinationSchedule", scheduleId, changes);
        return new CareDtos.VaccinationScheduleResult(
            schedule.getId(), schedule.getScheduleName(), schedule.getStatus(), schedule.getVersion(), targets.size(), remaining.intValue());
    }

    /** Đổi tên lịch: tối đa 100 ký tự, không trùng tên một lịch đang chạy khác (R-09-03, MSG-FE09-10). */
    private void applyName(Long farmId, VaccinationSchedule schedule, String requestedName, Map<String, Object> changes) {
        if (requestedName == null) {
            return;
        }
        String name = trim(requestedName);
        if (name == null || name.length() > MAX_SCHEDULE_NAME_LENGTH) {
            throw DomainException.invalid("name");
        }
        if (!name.equalsIgnoreCase(schedule.getScheduleName()) && activeNameTaken(farmId, schedule.getId(), name)) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "active_schedule_name_exists");
        }
        schedule.setScheduleName(name);
        changes.put("name", name);
    }

    private boolean activeNameTaken(Long farmId, Long scheduleId, String name) {
        Long count = em
            .createQuery(
                "select count(x) from VaccinationSchedule x where x.farm.id=:farm and x.id<>:id " +
                "and upper(x.status)='ACTIVE' and lower(x.scheduleName)=lower(:name)",
                Long.class
            )
            .setParameter("farm", farmId)
            .setParameter("id", scheduleId)
            .setParameter("name", name)
            .getSingleResult();
        return count > 0;
    }

    /** Đổi vắc-xin: chỉ khi chưa có mũi nào được tiêm (FE-09 Q3); vắc-xin phải còn dùng được (MSG-FE18-08). */
    private void applyVaccine(Long farmId, VaccinationSchedule schedule, Long vaccineId, boolean anyDone, Map<String, Object> changes) {
        if (vaccineId == null || vaccineId.equals(schedule.getVaccine().getId())) {
            return;
        }
        if (anyDone) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "vaccine_change_after_done");
        }
        Vaccine vaccine = em
            .createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
            .setParameter("id", vaccineId)
            .setParameter("farm", farmId)
            .setLockMode(LockModeType.PESSIMISTIC_READ)
            .getResultStream()
            .findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", vaccineId));
        if (!Boolean.TRUE.equals(vaccine.getAvailable())) {
            throw DomainException.unprocessable(MessageCodes.FE18_08, "field", "vaccineId");
        }
        schedule.setVaccine(vaccine);
        changes.put("vaccineId", vaccine.getId());
    }

    /**
     * Đổi khoảng cách giữa mũi và ngày bắt đầu. Khi đã có mũi tiêm thì cả hai bị khóa (D46), vì các mũi sau phải bám
     * theo mốc đã tiêm thật.
     *
     * @return {@code true} nếu cần dời ngày các mũi chờ tiêm
     */
    private boolean applyDates(VaccinationSchedule schedule, CareDtos.EditVaccinationSchedule req, boolean anyDone, Map<String, Object> changes) {
        boolean redate = false;
        if (req.intervalDays() != null && !req.intervalDays().equals(schedule.getIntervalDays())) {
            if (anyDone) {
                throw DomainException.conflict(MessageCodes.COM_05, "reason", "interval_locked_after_done");
            }
            if (req.intervalDays() < 1 || req.intervalDays() > MAX_INTERVAL_DAYS) {
                throw DomainException.invalid("intervalDays");
            }
            schedule.setIntervalDays(req.intervalDays());
            changes.put("intervalDays", req.intervalDays());
            redate = true;
        }
        if (req.firstDueDate() != null && !req.firstDueDate().equals(schedule.getFirstDueDate())) {
            if (anyDone) {
                throw DomainException.conflict(MessageCodes.COM_05, "reason", "start_date_locked_after_done");
            }
            if (req.firstDueDate().isBefore(clock.today())) {
                throw DomainException.invalid("firstDueDate");
            }
            schedule.setFirstDueDate(req.firstDueDate());
            changes.put("firstDueDate", req.firstDueDate());
            redate = true;
        }
        return redate;
    }

    /** Đặt / bỏ nhắc lại. Bỏ nhắc lại thì hủy các mũi nhắc lại chưa tiêm (số mũi lớn hơn số mũi của loạt). */
    private void applyBooster(VaccinationSchedule schedule, CareDtos.EditVaccinationSchedule req, List<ScheduledDose> all, int oldCount, Map<String, Object> changes) {
        if (Boolean.TRUE.equals(req.removeBooster())) {
            if (req.boosterIntervalMonths() != null) {
                throw DomainException.invalid("boosterIntervalMonths");
            }
            schedule.setBoosterIntervalMonths(null);
            changes.put("removeBooster", true);
            for (ScheduledDose dose : all) {
                if (dose.getDoseNo() > oldCount && isOpen(dose)) {
                    dose.setStatus(DOSE_CANCELLED);
                }
            }
        } else if (req.boosterIntervalMonths() != null) {
            if (req.boosterIntervalMonths() < 1 || req.boosterIntervalMonths() > MAX_BOOSTER_MONTHS) {
                throw DomainException.invalid("boosterIntervalMonths");
            }
            schedule.setBoosterIntervalMonths(req.boosterIntervalMonths());
            changes.put("boosterIntervalMonths", req.boosterIntervalMonths());
        }
    }

    /**
     * Đổi số mũi (1 – 10). Không đổi khi đã bắt đầu loạt nhắc lại; không giảm dưới mũi đã tiêm (R-09-05). Mũi chờ tiêm
     * vượt số mới bị hủy.
     *
     * @return số mũi sau khi sửa
     */
    private int applyDoseCount(VaccinationSchedule schedule, Integer requested, List<ScheduledDose> all, int oldCount, Map<String, Object> changes) {
        if (requested == null || requested == oldCount) {
            return oldCount;
        }
        if (requested < 1 || requested > MAX_DOSE_COUNT) {
            throw DomainException.invalid("doseCount");
        }
        // Loạt nhắc lại đã bắt đầu được đánh số sau mũi cuối; đánh số lại sẽ lẫn mũi nhắc với mũi thường.
        if (all.stream().anyMatch(d -> d.getDoseNo() > oldCount)) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "booster_started");
        }
        if (all.stream().anyMatch(d -> d.getDoseNo() > requested && isDone(d))) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "dose_count_below_done");
        }
        for (ScheduledDose dose : all) {
            if (dose.getDoseNo() > requested && isOpen(dose)) {
                dose.setStatus(DOSE_CANCELLED);
            }
        }
        schedule.setDoseCount(requested);
        changes.put("doseCount", requested);
        return requested;
    }

    /**
     * Đổi đối tượng lịch (GBR-41): bò bị bỏ mất các mũi chờ tiêm, mũi đã tiêm giữ nguyên (TC-09-09).
     *
     * @return danh sách bò thuộc lịch sau khi sửa
     */
    private java.util.Set<Long> applyTarget(Long farmId, VaccinationSchedule schedule, CareDtos.ScheduleTarget target, List<ScheduledDose> all, Map<String, Object> changes) {
        java.util.Set<Long> current = new java.util.LinkedHashSet<>();
        for (ScheduledDose dose : all) {
            if (!DOSE_CANCELLED.equalsIgnoreCase(dose.getStatus())) {
                current.add(dose.getCattle().getId());
            }
        }
        if (target == null) {
            return current;
        }
        List<Long> chosen = resolveTargets(farmId, clock.today(), target);
        if (chosen.isEmpty()) {
            throw DomainException.invalid("targetCattle");
        }
        for (ScheduledDose dose : all) {
            if (!chosen.contains(dose.getCattle().getId()) && isOpen(dose)) {
                dose.setStatus(DOSE_CANCELLED);
            }
        }
        schedule.setTargetCriteria(JsonSupport.toJson(target));
        schedule.setTargetGroup(targetDescription(target));
        changes.put("addedCattle", chosen.stream().filter(id -> !current.contains(id)).toList());
        changes.put("removedCattle", current.stream().filter(id -> !chosen.contains(id)).toList());
        return new java.util.LinkedHashSet<>(chosen);
    }

    /**
     * Mỗi bò thuộc lịch có đúng một mũi (chờ tiêm hoặc đã tiêm) cho mỗi số mũi (BR-D17): bò mới và số mũi mới được tạo mũi
     * chờ tiêm. Bò mới thêm vào lịch đã bắt đầu thì tính hạn từ hôm nay, để không bị quá hạn ngay khi thêm (D46).
     *
     * @return số mũi mới tạo
     */
    private int planMissingDoses(Long farmId, VaccinationSchedule schedule, java.util.Set<Long> targets, List<ScheduledDose> all, int count) {
        LocalDate today = clock.today();
        int created = 0;
        for (Long cattleId : targets) {
            boolean newToSchedule = all.stream()
                .noneMatch(d -> d.getCattle().getId().equals(cattleId) && !DOSE_CANCELLED.equalsIgnoreCase(d.getStatus()));
            LocalDate start = newToSchedule && schedule.getFirstDueDate().isBefore(today) ? today : schedule.getFirstDueDate();
            Cattle cattle = null;
            for (int doseNo = 1; doseNo <= count; doseNo++) {
                final int number = doseNo;
                boolean exists = all.stream()
                    .anyMatch(d -> d.getCattle().getId().equals(cattleId) && d.getDoseNo() == number && !DOSE_CANCELLED.equalsIgnoreCase(d.getStatus()));
                if (exists) {
                    continue;
                }
                if (cattle == null) {
                    cattle = cattleGuard.lockWritable(farmId, cattleId);
                }
                ScheduledDose dose = new ScheduledDose();
                dose.setSchedule(schedule);
                dose.setCattle(cattle);
                dose.setDoseNo(doseNo);
                dose.setDueDate(dueDateOf(start, doseNo, schedule.getIntervalDays()));
                dose.setStatus(DOSE_PLANNED);
                em.persist(dose);
                created++;
            }
        }
        return created;
    }

    /** Hạn của mũi thứ {@code doseNo}: ngày bắt đầu + (doseNo − 1) × khoảng cách giữa mũi. */
    private static LocalDate dueDateOf(LocalDate start, int doseNo, int intervalDays) {
        return start.plusDays((long) (doseNo - 1) * intervalDays);
    }

    private VaccinationSchedule scheduleForFarm(Long farmId, Long scheduleId) {
        return em
            .createQuery("select s from VaccinationSchedule s where s.id=:id and s.farm.id=:farm", VaccinationSchedule.class)
            .setParameter("id", scheduleId)
            .setParameter("farm", farmId)
            .getResultStream()
            .findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "scheduleId", scheduleId));
    }

    /** Mũi chờ tiêm (không còn trạng thái hoãn – D46). */
    private boolean isOpen(ScheduledDose dose) {
        return DOSE_PLANNED.equalsIgnoreCase(dose.getStatus());
    }

    private boolean isDone(ScheduledDose dose) {
        return DOSE_DONE.equalsIgnoreCase(dose.getStatus());
    }

    /**
     * Lịch "đã hoàn thành" khi không còn mũi chờ tiêm nào (D46). Lịch có nhắc lại thì sau mỗi lần tiêm mũi cuối lại sinh
     * mũi nhắc tiếp theo, nên chỉ hoàn thành khi bị dừng.
     */
    private boolean isCompleted(List<ScheduledDose> doses) {
        return doses.stream().noneMatch(this::isOpen);
    }

    public CareDtos.VaccinationScheduleResult stopSchedule(Long farmId,Long scheduleId,String key,Integer expectedVersion,String reason){
        Map<String,Object> fingerprint=new java.util.HashMap<>();fingerprint.put("scheduleId",scheduleId);fingerprint.put("expectedVersion",expectedVersion);fingerprint.put("reason",reason);
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"VACCINATION_SCHEDULE_STOP",key,fingerprint,
            CareDtos.VaccinationScheduleResult.class,()->stopScheduleInCommand(farmId,scheduleId,expectedVersion,reason));
    }
    @Transactional
    CareDtos.VaccinationScheduleResult stopScheduleInCommand(Long farmId,Long scheduleId,Integer expectedVersion,String reason){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        VaccinationSchedule s=em.createQuery("select s from VaccinationSchedule s where s.id=:id and s.farm.id=:farm",VaccinationSchedule.class).setParameter("id",scheduleId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"scheduleId",scheduleId));
        VersionGuard.requireExpected(s.getVersion(),expectedVersion);if("STOPPED".equalsIgnoreCase(s.getStatus()))return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),0,0);
        // R-09-06 / SCR-32 #11: a stop always records its reason (≤ 500, Q1).
        String why=trim(reason);if(why==null)throw DomainException.required("reason");if(why.length()>500)throw DomainException.invalid("reason");
        s.setStatus("STOPPED");
        s.setStopReason(why);
        // R-09-06: dừng lịch thì mọi mũi chờ tiêm bị hủy; mũi đã tiêm giữ nguyên.
        List<ScheduledDose> ds = em
            .createQuery("select d from ScheduledDose d where d.schedule.id=:id and d.status=:planned", ScheduledDose.class)
            .setParameter("id", scheduleId)
            .setParameter("planned", DOSE_PLANNED)
            .getResultList();
        for (ScheduledDose d : ds) {
            d.setStatus(DOSE_CANCELLED);
        }
        em.flush();
        Long targets=em.createQuery("select count(distinct d.cattle.id) from ScheduledDose d where d.schedule.id=:id",Long.class).setParameter("id",scheduleId).getSingleResult();audit.log(ctx,"VACCINATION_SCHEDULE_STOP","VaccinationSchedule",scheduleId,Map.of("cancelledDoses",ds.size(),"reason",why));
        return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),targets.intValue(),0);
    }

    @Transactional
    CareDtos.VaccinationScheduleResult createScheduleInCommand(Long farmId, CareDtos.CreateVaccinationSchedule req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        if (req == null) throw DomainException.required("schedule");
        String name = trim(req.name());
        if (name == null || name.length() > 100) throw DomainException.required("name");
        if (req.vaccineId() == null) throw DomainException.required("vaccineId");
        Vaccine vaccine = em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
            .setParameter("id", req.vaccineId()).setParameter("farm", farmId).setLockMode(LockModeType.PESSIMISTIC_READ).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", req.vaccineId()));
        if (!Boolean.TRUE.equals(vaccine.getAvailable())) throw DomainException.unprocessable(MessageCodes.FE18_08, "field", "vaccineId");
        Integer count = req.doseCount(); Integer interval = req.intervalDays();
        if (count == null || count < 1 || count > 10) throw DomainException.invalid("doseCount");
        if (interval == null || interval < 1 || interval > 365) throw DomainException.invalid("intervalDays");
        if (req.boosterIntervalMonths() != null && (req.boosterIntervalMonths() < 1 || req.boosterIntervalMonths() > 60)) throw DomainException.invalid("boosterIntervalMonths");
        LocalDate start = req.firstDueDate() == null ? clock.today() : req.firstDueDate();
        if (start.isBefore(clock.today())) throw DomainException.invalid("firstDueDate");
        if (em.createQuery("select count(s) from VaccinationSchedule s where s.farm.id=:farm and upper(s.status)='ACTIVE' and lower(s.scheduleName)=lower(:name)", Long.class)
            .setParameter("farm", farmId).setParameter("name", name).getSingleResult() > 0) throw DomainException.conflict(MessageCodes.COM_05, "reason", "active_schedule_name_exists");
        CareDtos.ScheduleTarget target = new CareDtos.ScheduleTarget(req.penIds(), req.herdGroups(), req.lifeStages(), req.cattleIds(), req.excludedCattleIds());
        List<Long> cattleIds = resolveTargets(farmId, start, target);
        if (cattleIds.isEmpty()) throw DomainException.invalid("targetCattle");
        List<Cattle> targets = new ArrayList<>();
        for (Long cattleId : cattleIds) targets.add(cattleGuard.lockWritable(farmId, cattleId));
        VaccinationSchedule schedule = new VaccinationSchedule();
        schedule.setScheduleName(name); schedule.setVaccine(vaccine); schedule.setFirstDueDate(start); schedule.setDoseCount(count);
        schedule.setIntervalDays(interval); schedule.setBoosterIntervalMonths(req.boosterIntervalMonths()); schedule.setTargetGroup(targetDescription(target)); schedule.setTargetCriteria(JsonSupport.toJson(target));
        schedule.setStatus("ACTIVE"); schedule.setFarm(ctx.farm()); em.persist(schedule); em.flush();
        int planned = 0;
        for (Cattle cattle : targets) {
            for (int doseNo = 1; doseNo <= count; doseNo++) {
                ScheduledDose dose = new ScheduledDose(); dose.setSchedule(schedule); dose.setCattle(cattle); dose.setDoseNo(doseNo);
                dose.setDueDate(start.plusDays((long) (doseNo - 1) * interval)); dose.setStatus("PLANNED"); em.persist(dose); planned++;
            }
        }
        audit.log(ctx, "VACCINATION_SCHEDULE_CREATE", "VaccinationSchedule", schedule.getId(), Map.of("name", name, "vaccineId", vaccine.getId(), "targetCount", targets.size(), "plannedDoseCount", planned));
        return new CareDtos.VaccinationScheduleResult(schedule.getId(), name, schedule.getStatus(), schedule.getVersion(), targets.size(), planned);
    }

    private List<Long> resolveTargets(Long farmId, LocalDate start, CareDtos.ScheduleTarget request) {
        List<Long> selectedIds = request.cattleIds() == null ? List.of() : request.cattleIds().stream().filter(java.util.Objects::nonNull).distinct().toList();
        List<Long> penIds = request.penIds() == null ? List.of() : request.penIds().stream().filter(java.util.Objects::nonNull).distinct().toList();
        List<String> groups = normalizeFilters(request.herdGroups(), java.util.Set.of("CALVES","FATTENING","BREEDING_BULLS","BREEDING_FEMALES","YOUNG_STOCK","OTHER"), "herdGroups");
        List<String> stages = normalizeFilters(request.lifeStages(), java.util.Arrays.stream(LifeStage.values()).map(Enum::name).collect(java.util.stream.Collectors.toSet()), "lifeStages");
        List<Long> excluded = request.excludedCattleIds() == null ? List.of() : request.excludedCattleIds().stream().filter(java.util.Objects::nonNull).distinct().toList();
        boolean hasSelector = !penIds.isEmpty() || !groups.isEmpty() || !stages.isEmpty();
        java.util.LinkedHashSet<Long> matches = new java.util.LinkedHashSet<>();
        if (hasSelector) {
            List<Cattle> active = em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=:status", Cattle.class)
                .setParameter("farm", farmId).setParameter("status", HerdStatus.ACTIVE).getResultList();
            Map<Long, Long> penByCattle = new java.util.HashMap<>();
            em.createQuery("select p from PenAssignment p where p.farm.id=:farm and p.fromDate<=:day and (p.toDate is null or p.toDate>=:day)", PenAssignment.class)
                .setParameter("farm", farmId).setParameter("day", start).getResultList().forEach(p -> penByCattle.put(p.getCattle().getId(), p.getPen().getId()));
            for (Cattle c : active) {
                if (!penIds.isEmpty() && !penIds.contains(penByCattle.get(c.getId()))) continue;
                if (!groups.isEmpty() && !groups.contains(herdGroup(c))) continue;
                if (!stages.isEmpty() && (c.getLifeStage() == null || !stages.contains(c.getLifeStage().name()))) continue;
                matches.add(c.getId());
            }
        }
        matches.addAll(selectedIds);
        matches.removeAll(excluded);
        for (Long id : matches) cattleGuard.lockWritable(farmId, id); // validates same-farm and ACTIVE before any schedule is persisted
        for (Long id : excluded) {
            Long belongs = em.createQuery("select count(c) from Cattle c where c.id=:id and c.farm.id=:farm", Long.class).setParameter("id", id).setParameter("farm", farmId).getSingleResult();
            if (belongs == 0) throw DomainException.notFound(MessageCodes.COM_08, "cattleId", id);
        }
        return matches.stream().sorted().toList();
    }

    /** GAP-FE09-01: the stored target with pen / cattle display codes; null for schedules saved before the target was kept. */
    @SuppressWarnings("unchecked")
    private CareDtos.ScheduleTargetView targetView(Long farmId, String json) {
        if (json == null || json.isBlank()) return null;
        Map<String, Object> raw = JsonSupport.fromJson(json, Map.class);
        List<Long> penIds = ids(raw.get("penIds")), cattleIds = ids(raw.get("cattleIds")), excluded = ids(raw.get("excludedCattleIds"));
        return new CareDtos.ScheduleTargetView(penIds, codes("select p.id, p.code from Pen p where p.farm.id=:farm and p.id in :ids", farmId, penIds),
            strings(raw.get("herdGroups")), strings(raw.get("lifeStages")),
            cattleIds, codes("select c.id, c.displayCode from Cattle c where c.farm.id=:farm and c.id in :ids", farmId, cattleIds),
            excluded, codes("select c.id, c.displayCode from Cattle c where c.farm.id=:farm and c.id in :ids", farmId, excluded));
    }
    private List<Long> ids(Object value) {
        return value instanceof List<?> list ? list.stream().filter(java.util.Objects::nonNull).map(v -> ((Number) v).longValue()).toList() : List.of();
    }
    private List<String> strings(Object value) {
        return value instanceof List<?> list ? list.stream().filter(java.util.Objects::nonNull).map(Object::toString).toList() : List.of();
    }
    /** Codes in the order of the ids; an id no longer in the farm is left out. */
    private List<String> codes(String query, Long farmId, List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        Map<Long, String> byId = new java.util.HashMap<>();
        em.createQuery(query, Object[].class).setParameter("farm", farmId).setParameter("ids", ids).getResultList().forEach(r -> byId.put((Long) r[0], (String) r[1]));
        return ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
    }

    private List<String> normalizeFilters(List<String> values, java.util.Set<String> allowed, String field) {
        if (values == null) return List.of();
        List<String> result = values.stream().filter(java.util.Objects::nonNull).map(this::upper).distinct().toList();
        if (result.stream().anyMatch(v -> !allowed.contains(v))) throw DomainException.invalid(field);
        return result;
    }

    private String targetDescription(CareDtos.ScheduleTarget request) {
        List<String> parts=new ArrayList<>();
        if(request.penIds()!=null&&!request.penIds().isEmpty())parts.add("PENS");
        if(request.herdGroups()!=null&&!request.herdGroups().isEmpty())parts.add("HERD_GROUPS");
        if(request.lifeStages()!=null&&!request.lifeStages().isEmpty())parts.add("LIFE_STAGES");
        if(request.cattleIds()!=null&&!request.cattleIds().isEmpty())parts.add("INDIVIDUALS");
        if(request.excludedCattleIds()!=null&&!request.excludedCattleIds().isEmpty())parts.add("EXCLUSIONS");
        return parts.isEmpty()?"EXPLICIT":String.join("+",parts);
    }

    private String herdGroup(Cattle c) {
        if(c.getLifeStage()==LifeStage.UNWEANED_CALF||c.getLifeStage()==LifeStage.WEANED_CALF)return "CALVES";
        PurposeType purpose=c.getPurpose()==null?null:c.getPurpose().getPurposeType();
        if(purpose==PurposeType.FATTENING)return "FATTENING";
        if(purpose==PurposeType.SIRE)return "BREEDING_BULLS";
        if(purpose==PurposeType.BREEDING&&c.getSex()==Sex.FEMALE&&c.getLifeStage()==LifeStage.ADULT)return "BREEDING_FEMALES";
        if(c.getLifeStage()==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";
        return "OTHER";
    }

    public CareDtos.VaccinationBatchResult record(Long farmId, String key, CareDtos.RecordVaccinations request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_RECORD_BATCH", key, request,
            CareDtos.VaccinationBatchResult.class, () -> recordInCommand(farmId, request));
    }

    public CareDtos.VaccinationResult correct(Long farmId, Long vaccinationId, String key, CareDtos.CorrectVaccination request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_CORRECT", key,
            Map.of("vaccinationId", vaccinationId, "request", request), CareDtos.VaccinationResult.class,
            () -> correctInCommand(farmId, vaccinationId, request));
    }

    @Transactional
    CareDtos.VaccinationResult correctInCommand(Long farmId, Long vaccinationId, CareDtos.CorrectVaccination req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Vaccination record = vaccinationForFarm(farmId, vaccinationId);
        Cattle cattle = cattleGuard.lockCattle(farmId, record.getCattle().getId()); cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(record.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null || !"VALID".equalsIgnoreCase(record.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        String note = optionalNote(req.reason());
        Map<String, Object> before = vaccinationSnapshot(record);
        if (req.vaccineId() != null && !req.vaccineId().equals(record.getVaccine().getId())) {
            Vaccine vaccine = em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
                .setParameter("id", req.vaccineId()).setParameter("farm", farmId).setLockMode(LockModeType.PESSIMISTIC_READ).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", req.vaccineId()));
            if (!Boolean.TRUE.equals(vaccine.getAvailable())) throw DomainException.unprocessable(MessageCodes.FE18_08, "field", "vaccineId");
            record.setVaccine(vaccine); record.setVaccineNameSnapshot(vaccine.getName());
        }
        if (req.dose() != null) {
            String dose = requireMax(req.dose(), "dose", MAX_TEXT_LENGTH);
            requireValidDose(dose);
            record.setDose(dose);
        }
        if (req.route() != null) {
            String route = requireMax(req.route(), "route", MAX_TEXT_LENGTH);
            requireRouteDescription(route);
            record.setRoute(route);
        }
        if (req.vaccinator() != null) {
            record.setVaccinator(requireMax(req.vaccinator(), "vaccinator", MAX_TEXT_LENGTH));
        }
        if (record.getSource() != null && "ON_FARM".equalsIgnoreCase(record.getSource())) {
            if (req.batchNo() != null) record.setBatchNo(requireMax(req.batchNo(), "batchNo", 50));
            if (req.administeredAt() != null) {
                clock.assertNotFuture(req.administeredAt()); record.setAdministeredAt(req.administeredAt());
                record.setVaccinationDate(clock.toFarmDate(req.administeredAt()));
            }
            // GAP-FE09-04 / TC-09-27: the withdrawal period can be corrected (0-365); the end date is always recalculated.
            if (req.withdrawalDays() != null) {
                requireWithdrawalDays(req.withdrawalDays());
                record.setWithdrawalDays(req.withdrawalDays());
            }
            int days = record.getWithdrawalDays() == null ? 0 : record.getWithdrawalDays();
            record.setWithdrawalEndDate(days > 0 ? record.getVaccinationDate().plusDays(days) : null);
        } else {
            // R-09-08: a HISTORICAL record never carries a withdrawal period.
            if (req.withdrawalDays() != null && req.withdrawalDays() != 0) throw DomainException.invalid("withdrawalDays");
            if (req.vaccinationDate() != null) { clock.assertNotFuture(req.vaccinationDate()); record.setVaccinationDate(req.vaccinationDate()); }
        }
        record.setCorrected(Boolean.TRUE); em.flush();
        revisions.recordWithOptionalNote(ctx, "Vaccination", vaccinationId, RecordRevisionService.CORRECT, note, before, vaccinationSnapshot(record));
        audit.log(ctx, "VACCINATION_CORRECT", "Vaccination", vaccinationId, Map.of("cattleId", cattle.getId()));
        return result(record, cattle);
    }

    /**
     * Ghi chú tùy chọn khi sửa / xóa bản ghi tiêm (D53, như FE-08 D43): để trống lưu {@code null}, tối đa 500 ký tự.
     *
     * @param text ghi chú người dùng nhập, có thể {@code null}
     * @return ghi chú đã bỏ khoảng trắng hai đầu, hoặc {@code null} khi trống
     */
    private static String optionalNote(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String note = text.trim();
        if (note.length() > 500) {
            throw DomainException.invalid("reason");
        }
        return note;
    }

    /**
     * Xóa một bản ghi tiêm (A9). Là xóa mềm: bản ghi chuyển {@code VOIDED}, không còn trong lịch sử tiêm (D53), mũi theo
     * lịch quay lại chờ tiêm; giá trị trước / sau vẫn lưu trong Record Revision.
     */
    public CareDtos.VaccinationResult voidRecord(Long farmId, Long vaccinationId, String key, CareDtos.VoidRecord request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_VOID", key,
            Map.of("vaccinationId", vaccinationId, "request", request), CareDtos.VaccinationResult.class,
            () -> voidInCommand(farmId, vaccinationId, request));
    }

    @Transactional
    CareDtos.VaccinationResult voidInCommand(Long farmId, Long vaccinationId, CareDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Vaccination record = vaccinationForFarm(farmId, vaccinationId);
        Cattle cattle = cattleGuard.lockCattle(farmId, record.getCattle().getId()); cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(record.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null || !"VALID".equalsIgnoreCase(record.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        String note = optionalNote(req.reason());
        Map<String, Object> before = vaccinationSnapshot(record);
        record.setStatus("VOIDED"); record.setStatusReason(note);
        ScheduledDose dose = record.getScheduledDose();
        if (dose != null) {
            // R-09-14: hủy bản ghi thì mũi quay về chờ tiêm (lịch còn chạy) hoặc bị hủy (lịch đã dừng). Không còn hoãn (D46).
            boolean scheduleActive = SCHEDULE_ACTIVE.equalsIgnoreCase(dose.getSchedule().getStatus());
            dose.setStatus(scheduleActive ? DOSE_PLANNED : DOSE_CANCELLED);
            dose.setVaccination(null);
            record.setScheduledDose(null);
        }
        em.flush();
        revisions.recordWithOptionalNote(ctx, "Vaccination", vaccinationId, RecordRevisionService.VOID, note, before, vaccinationSnapshot(record));
        audit.log(ctx, "VACCINATION_VOID", "Vaccination", vaccinationId, Map.of("cattleId", cattle.getId()));
        return result(record, cattle);
    }

    @Transactional
    CareDtos.VaccinationBatchResult recordInCommand(Long farmId, CareDtos.RecordVaccinations req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        if (req == null || req.vaccineId() == null) throw DomainException.required("vaccineId");
        Vaccine vaccine = em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
            .setParameter("id", req.vaccineId()).setParameter("farm", farmId).setLockMode(LockModeType.PESSIMISTIC_READ).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", req.vaccineId()));
        if (!Boolean.TRUE.equals(vaccine.getAvailable())) throw DomainException.unprocessable(MessageCodes.FE18_08, "field", "vaccineId");
        String source = upper(req.source());
        if (!java.util.Set.of("ON_FARM", "HISTORICAL").contains(source)) throw DomainException.invalid("source");
        List<CareDtos.VaccinationAnimal> animals = req.animals() == null ? List.of() : req.animals();
        if (animals.isEmpty()) throw DomainException.required("animals");
        if (animals.stream().anyMatch(java.util.Objects::isNull)) throw DomainException.invalid("animals");
        // D44: số lô không còn bắt buộc (trang trại không quản lý tồn kho vắc-xin theo lô).
        // API vẫn nhận số lô tùy chọn để tương thích; nếu gửi thì tối đa 50 ký tự.
        String batchNo = trim(req.batchNo());
        if (batchNo != null && batchNo.length() > MAX_BATCH_NO_LENGTH) {
            throw DomainException.invalid("batchNo");
        }
        Instant administeredAt = req.administeredAt();
        if (source.equals("ON_FARM")) {
            if (administeredAt == null) administeredAt = clock.now();
            clock.assertNotFuture(administeredAt);
        }
        LocalDate date = source.equals("ON_FARM") ? clock.toFarmDate(administeredAt) : req.vaccinationDate();
        if (date == null) throw DomainException.required("vaccinationDate");
        clock.assertNotFuture(date);
        // Nhập lịch sử không có ngưng thịt (R-09-08); tiêm tại trại không gửi số ngày thì lấy theo danh mục vắc-xin.
        int withdrawalDays;
        if (source.equals("HISTORICAL")) {
            withdrawalDays = 0;
        } else if (req.withdrawalDays() == null) {
            withdrawalDays = parseDays(vaccine.getWithdrawalInfo());
        } else {
            withdrawalDays = req.withdrawalDays();
        }
        requireWithdrawalDays(withdrawalDays);

        // Liều không bắt buộc (spec FE-09 §3.3): không gửi thì lấy liều tham chiếu của vắc-xin, vắc-xin không có thì để trống.
        String requestDose = trim(req.dose());
        if (requestDose != null) {
            if (requestDose.length() > MAX_TEXT_LENGTH) {
                throw DomainException.invalid("dose");
            }
            requireValidDose(requestDose);
        }
        String doseText = requestDose != null ? requestDose : trim(vaccine.getDose());

        String requestRoute = trim(req.route());
        if (requestRoute != null) {
            requireRouteDescription(requestRoute);
        }
        String route = requestRoute != null ? requestRoute : vaccine.getRoute();
        if (route == null || route.isBlank() || route.length() > MAX_TEXT_LENGTH) {
            throw DomainException.required("route");
        }

        String vaccinator = trim(req.vaccinator()) == null ? ctx.user().getFullName() : req.vaccinator().trim();
        if (vaccinator == null || vaccinator.isBlank() || vaccinator.length() > MAX_TEXT_LENGTH) {
            throw DomainException.required("vaccinator");
        }
        List<Long> ids = animals.stream().map(CareDtos.VaccinationAnimal::cattleId).distinct().sorted().toList();
        if (ids.size() != animals.size() || ids.stream().anyMatch(java.util.Objects::isNull)) throw DomainException.invalid("animals");
        var cattleById = new java.util.LinkedHashMap<Long, Cattle>();
        List<CareDtos.SkippedAnimal> skipped = new ArrayList<>();
        java.util.Set<Long> skippedIds = new java.util.HashSet<>();
        for (Long id : ids) {
            Cattle cattle = cattleGuard.lockCattle(farmId, id);
            // R-09-10 / TC-09-17: an animal that left the herd meanwhile is skipped (MSG-COM-13); the batch goes on.
            if (cattle.getHerdStatus() == HerdStatus.EXITED) { skipped.add(new CareDtos.SkippedAnimal(id, cattle.getDisplayCode(), MessageCodes.COM_13, null)); skippedIds.add(id); continue; }
            cattleGuard.assertWritable(cattle);
            cattleById.put(id, cattle);
        }
        int vaccinated = 0;
        List<Long> vaccinationIds = new ArrayList<>();
        for (CareDtos.VaccinationAnimal item : animals) {
            if (skippedIds.contains(item.cattleId())) {
                continue;
            }
            Cattle cattle = cattleById.get(item.cattleId());
            assertAfterHerdEntry(farmId, cattle, date);
            ScheduledDose scheduled = item.scheduledDoseId() == null || source.equals("HISTORICAL") ? null : doseForFarm(farmId, item.scheduledDoseId());
            if (scheduled != null) {
                if (!scheduled.getCattle().getId().equals(cattle.getId()) || !scheduled.getSchedule().getVaccine().getId().equals(vaccine.getId())) throw DomainException.invalid("scheduledDoseId");
                if (alreadyGiven(scheduled, cattle, skipped)) continue;
                VersionGuard.requireExpected(scheduled.getVersion(), item.expectedDoseVersion());
                if (!isOpen(scheduled)) {
                    throw DomainException.conflict(MessageCodes.COM_05);
                }
            }
            Vaccination record = new Vaccination(); record.setCattle(cattle); record.setVaccine(vaccine); record.setSource(source);
            record.setVaccinationDate(date); record.setAdministeredAt(administeredAt); record.setEntryTime(clock.now());
            record.setDose(doseText); record.setRoute(route); record.setBatchNo(batchNo);
            record.setVaccinator(vaccinator); record.setVaccineNameSnapshot(vaccine.getName());
            if (source.equals("ON_FARM")) record.setWithdrawalDays(withdrawalDays);
            if (source.equals("ON_FARM") && withdrawalDays > 0) record.setWithdrawalEndDate(date.plusDays(withdrawalDays));
            if (scheduled != null) { scheduled.setStatus("DONE"); scheduled.setVaccination(record); record.setScheduledDose(scheduled); }
            em.persist(record); em.flush();
            if (scheduled != null) planBooster(scheduled, date);
            vaccinationIds.add(record.getId()); vaccinated++;
        }
        // Lô mà mọi con đều bị bỏ qua thì không có bản ghi tiêm: dòng audit trỏ vào con đầu tiên.
        audit.log(
            ctx,
            "VACCINATION_RECORD_BATCH",
            vaccinationIds.isEmpty() ? "Cattle" : "Vaccination",
            vaccinationIds.isEmpty() ? ids.get(0) : vaccinationIds.get(0),
            Map.of("vaccinatedCount", vaccinated, "source", source, "skippedCount", skipped.size())
        );
        return new CareDtos.VaccinationBatchResult(vaccinated, List.copyOf(vaccinationIds), List.copyOf(skipped));
    }

    /** R-09-10 / TC-09-17: a dose already given (by another batch meanwhile) skips this animal with MSG-FE09-09. */
    private boolean alreadyGiven(ScheduledDose scheduled, Cattle cattle, List<CareDtos.SkippedAnimal> skipped) {
        if (!"DONE".equalsIgnoreCase(scheduled.getStatus())) return false;
        skipped.add(new CareDtos.SkippedAnimal(cattle.getId(), cattle.getDisplayCode(), MessageCodes.FE09_09, scheduled.getDoseNo()));
        return true;
    }

    private ScheduledDose doseForFarm(Long farmId, Long doseId) {
        return em.createQuery("select d from ScheduledDose d where d.id=:id and d.schedule.farm.id=:farm", ScheduledDose.class)
            .setParameter("id", doseId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "doseId", doseId));
    }
    private Vaccination vaccinationForFarm(Long farmId, Long vaccinationId) {
        return em.createQuery("select v from Vaccination v where v.id=:id and v.cattle.farm.id=:farm", Vaccination.class)
            .setParameter("id", vaccinationId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccinationId", vaccinationId));
    }
    static Map<String, Object> vaccinationSnapshot(Vaccination record) {
        Map<String, Object> snapshot = new java.util.LinkedHashMap<>();
        snapshot.put("status", record.getStatus()); snapshot.put("vaccineId", record.getVaccine().getId());
        snapshot.put("vaccineName", record.getVaccineNameSnapshot() == null ? "" : record.getVaccineNameSnapshot());
        snapshot.put("vaccinationDate", record.getVaccinationDate()); snapshot.put("administeredAt", record.getAdministeredAt());
        snapshot.put("batchNo", record.getBatchNo() == null ? "" : record.getBatchNo()); snapshot.put("dose", record.getDose());
        snapshot.put("route", record.getRoute() == null ? "" : record.getRoute()); snapshot.put("vaccinator", record.getVaccinator());
        // TC-09-27: the revision keeps the withdrawal period as well as its end date.
        snapshot.put("withdrawalDays", record.getWithdrawalDays());
        snapshot.put("withdrawalEndDate", record.getWithdrawalEndDate() == null ? "" : record.getWithdrawalEndDate());
        return snapshot;
    }
    private CareDtos.VaccinationResult result(Vaccination record, Cattle cattle) {
        em.flush();
        Object cattleWithdrawal = cattleState.state(cattle).get("withdrawalEndDate");
        return new CareDtos.VaccinationResult(record.getId(), record.getStatus(), record.getVersion(), record.getWithdrawalEndDate(), record.getCorrected(),
            record.getWithdrawalDays(), cattleWithdrawal instanceof LocalDate date ? date : null);
    }
    private void planBooster(ScheduledDose completed, LocalDate administeredDate) {
        VaccinationSchedule schedule = completed.getSchedule();
        Integer interval = schedule.getBoosterIntervalMonths();
        if (!"ACTIVE".equalsIgnoreCase(schedule.getStatus()) || interval == null || interval < 1 || completed.getDoseNo() < schedule.getDoseCount()) return;
        int nextNo = completed.getDoseNo() + 1;
        Long existing = em.createQuery("select count(d) from ScheduledDose d where d.schedule.id=:schedule and d.cattle.id=:cattle and d.doseNo=:no and upper(d.status)='PLANNED'", Long.class)
            .setParameter("schedule", schedule.getId()).setParameter("cattle", completed.getCattle().getId()).setParameter("no", nextNo).getSingleResult();
        if (existing > 0) return;
        ScheduledDose booster = new ScheduledDose(); booster.setSchedule(schedule); booster.setCattle(completed.getCattle()); booster.setDoseNo(nextNo);
        booster.setDueDate(administeredDate.plusMonths(interval)); booster.setStatus("PLANNED"); em.persist(booster);
    }
    private int parseDays(String value) {
        if (value == null || value.isBlank()) return 0;
        try { return Integer.parseInt(value.trim()); } catch (NumberFormatException ex) { throw DomainException.invalid("withdrawalDays"); }
    }

    /**
     * Liều phải là một <b>số dương</b>, có thể kèm đơn vị: "2", "2,5", "2 ml", "1 liều" (D45).
     * Từ chối 0, số âm, chữ hoặc khoảng ("1-2 ml").
     *
     * @param dose liều đã bỏ khoảng trắng hai đầu, không rỗng
     */
    private void requireValidDose(String dose) {
        Matcher matcher = DOSE_PATTERN.matcher(dose);
        if (!matcher.matches()) {
            throw DomainException.invalid("dose");
        }
        BigDecimal amount = new BigDecimal(matcher.group(1).replace(',', '.'));
        if (amount.signum() <= 0) {
            throw DomainException.invalid("dose");
        }
    }

    /**
     * Đường tiêm "Khác" phải gửi kèm mô tả cụ thể thay cho mã {@code OTHER} (D45), để bản ghi cho biết thực tế tiêm
     * đường nào. Mô tả được lưu thẳng vào cột {@code route}.
     */
    private void requireRouteDescription(String route) {
        if (ROUTE_OTHER.equalsIgnoreCase(route.trim())) {
            throw DomainException.required("routeOther");
        }
    }

    /** Số ngày ngưng sử dụng thịt: số nguyên từ 0 đến {@value #MAX_WITHDRAWAL_DAYS}. */
    private void requireWithdrawalDays(int days) {
        if (days < 0 || days > MAX_WITHDRAWAL_DAYS) {
            throw DomainException.invalid("withdrawalDays");
        }
    }

    private String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String requireMax(String value, String field, int max) {
        if (value == null || value.isBlank()) throw DomainException.required(field);
        if (value.trim().length() > max) throw DomainException.invalid(field);
        return value.trim();
    }
    private String upper(String value) { return value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT); }
    private void assertAfterHerdEntry(Long farmId,Cattle cattle,LocalDate date){
        // BR-D14: a posted herd-entry line is VALID (EntryLineStatus); there is no POSTED line status.
        LocalDate entry=em.createQuery("select e.entryDate from HerdEntry e where e.cattle.id=:cattle and e.voucher.farm.id=:farm and e.status=:valid order by e.id",LocalDate.class)
            .setParameter("cattle",cattle.getId()).setParameter("farm",farmId).setParameter("valid",vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus.VALID)
            .setMaxResults(1).getResultStream().findFirst().orElse(null);
        if(entry!=null&&date.isBefore(entry))throw DomainException.unprocessable(MessageCodes.COM_15,"date",entry); // {date} of the MSG-COM-15 text
    }
}
