package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

/**
 * FE-08 – Cân nặng &amp; thể trạng (GBR-38..40, GBR-107).
 *
 * <p>Service này lo ba việc:
 * <ol>
 *   <li>Ghi nhận một lần cân / chấm BCS cho một con bò ({@link #record}).</li>
 *   <li>Sửa hoặc loại trừ một bản ghi đã có, kèm lý do và lịch sử sửa ({@link #correct}).</li>
 *   <li>Tính các chỉ số tăng trưởng từ chính các bản ghi đó ({@link #summary}): cân hiện tại, ADG,
 *       BCS gần nhất, lần cân tới và dự kiến xuất bán.</li>
 * </ol>
 *
 * <p>Mọi chỉ số đều tính lại từ bản ghi gốc mỗi lần đọc, không lưu sẵn, nên sửa / loại trừ một bản ghi
 * là các chỉ số tự đúng theo.
 */
@Service
public class GrowthAssessmentService {

    // ---- Trạng thái bản ghi cân ----
    private static final String STATUS_VALID = "VALID";
    private static final String STATUS_CORRECTED = "CORRECTED";
    private static final String STATUS_EXCLUDED = "EXCLUDED";
    /** Chỉ bản ghi hợp lệ (gồm bản đã sửa) mới được dùng để tính chỉ số; bản loại trừ / hủy bị bỏ qua (GBR-39, GBR-40). */
    private static final Set<String> USABLE_STATUSES = Set.of(STATUS_VALID, STATUS_CORRECTED);

    // ---- Thao tác sửa bản ghi ----
    private static final String ACTION_CORRECT = "CORRECT";
    private static final String ACTION_EXCLUDE = "EXCLUDE";

    // ---- Phương pháp đo và cơ sở số liệu (GBR-38) ----
    private static final String METHOD_SCALE = "SCALE";
    private static final String METHOD_TAPE = "TAPE";
    private static final String METHOD_OTHER = "OTHER";
    private static final Set<String> METHODS = Set.of(METHOD_SCALE, METHOD_TAPE, METHOD_OTHER);
    /** Cân điện tử là số đo thực tế. */
    private static final String WEIGHT_MEASURED = "MEASURED";
    /** Thước dây và phương pháp khác là số ước tính. */
    private static final String WEIGHT_ESTIMATED = "ESTIMATED";

    // ---- Giới hạn nhập liệu ----
    private static final int WEIGHT_MIN_KG = 1;
    private static final int WEIGHT_MAX_KG = 1500;
    private static final int GIRTH_MIN_CM = 50;
    private static final int GIRTH_MAX_CM = 300;
    private static final int LENGTH_MIN_CM = 30;
    private static final int LENGTH_MAX_CM = 250;

    // ---- Quy tắc tính toán ----
    /** Các kỳ tính ADG được phép (ngày). */
    private static final Set<Integer> ADG_WINDOWS = Set.of(30, 60, 90, 180);
    /** Hai lần cân phải cách nhau ít nhất số ngày này thì mới tính ADG (GBR-39). */
    private static final int MIN_ADG_GAP_DAYS = 14;
    /** Dự kiến xuất bán dùng ADG của 60 ngày gần nhất (GBR-107). */
    private static final int PROJECTION_ADG_WINDOW_DAYS = 60;
    /** Hệ số công thức thước dây: cân = 88,4 × vòng ngực (m)² × dài thân chéo (m). */
    private static final BigDecimal TAPE_FORMULA_FACTOR = new BigDecimal("88.4");
    /** MSG-FE08-04: cảnh báo khi cân mới lệch quá 20% so với lần cân hợp lệ gần nhất ... */
    private static final BigDecimal LARGE_CHANGE_RATIO = new BigDecimal("0.2");
    /** ... trong vòng 30 ngày trước thời điểm đo. */
    private static final int LARGE_CHANGE_LOOKBACK_DAYS = 30;

    // ---- Tham số trại ----
    private static final String PARAM_WEIGHING_INTERVAL = "WEIGHING_INTERVAL_DAYS";
    private static final int DEFAULT_WEIGHING_INTERVAL_DAYS = 30;
    private static final String PARAM_TARGET_FINISHING_WEIGHT = "TARGET_FINISHING_WEIGHT_KG";
    private static final String PARAM_BCS_SCALE = "BCS_SCALE";
    /** Thang BCS mặc định khi trại chưa có phiên bản tham số: 1–5, bước 0,5. */
    private static final String DEFAULT_BCS_SCALE = "1-5:0.5";

    // ---- Trạng thái dự kiến xuất bán trả về cho frontend ----
    private static final String FINISHING_NOT_APPLICABLE = "NOT_APPLICABLE";
    private static final String FINISHING_INSUFFICIENT_WEIGHTS = "INSUFFICIENT_WEIGHTS";
    private static final String FINISHING_TARGET_REACHED = "TARGET_REACHED";
    private static final String FINISHING_PROJECTED = "PROJECTED";

    private static final String REVISION_SOURCE_TYPE = "GROWTH_ASSESSMENT";

    private final EntityManager em;
    private final FarmAccessService access;
    private final CattleGuardService guard;
    private final FarmClock clock;
    private final AuditService audit;
    private final RecordRevisionService revisions;
    private final OutboxService outbox;

    public GrowthAssessmentService(
        EntityManager em,
        FarmAccessService access,
        CattleGuardService guard,
        FarmClock clock,
        AuditService audit,
        RecordRevisionService revisions,
        OutboxService outbox
    ) {
        this.em = em;
        this.access = access;
        this.guard = guard;
        this.clock = clock;
        this.audit = audit;
        this.revisions = revisions;
        this.outbox = outbox;
    }

    // =====================================================================================
    // Ghi nhận và sửa bản ghi
    // =====================================================================================

    /**
     * Ghi nhận một lần cân và/hoặc chấm BCS cho một con bò đang trong đàn.
     *
     * @param farmId   trại đang thao tác
     * @param cattleId con bò được đo
     * @param request  số đo người dùng nhập
     * @return bản ghi vừa lưu
     */
    @Transactional
    public GrowthDtos.Record record(Long farmId, Long cattleId, GrowthDtos.Measurement request) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_GROWTH);
        Cattle cattle = guard.lockWritable(farmId, cattleId);

        Growth growth = new Growth();
        growth.setCattle(cattle);
        growth.setEntryTime(clock.now());
        growth.setStatus(STATUS_VALID);
        applyMeasurement(ctx, growth, request);
        em.persist(growth);
        em.flush();

        audit.log(ctx, "GROWTH_RECORD", "Growth", growth.getId(), Map.of("cattleId", cattleId));
        outbox.enqueue(farmId, "GROWTH_RECORDED", "Growth", growth.getId(), Map.of("cattleId", cattleId));
        return toDto(growth);
    }

    /**
     * Sửa ({@code CORRECT}) hoặc loại trừ ({@code EXCLUDE}) một bản ghi cân đã có.
     *
     * <p>Bản ghi không bị xóa: giá trị trước khi đổi được lưu vào lịch sử sửa (BR-D15) cùng lý do, và
     * phiên bản ({@code expectedVersion}) phải khớp để tránh hai người sửa đè lên nhau.
     *
     * @return bản ghi sau khi đổi, kèm toàn bộ lịch sử sửa của nó
     */
    @Transactional
    public GrowthDtos.Record correct(Long farmId, Long cattleId, Long id, GrowthDtos.Correction request) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_GROWTH);
        Cattle cattle = guard.lockCattle(farmId, cattleId);
        guard.assertActive(cattle);

        Growth growth = em.find(Growth.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (growth == null || !cattleId.equals(growth.getCattle().getId())) {
            throw DomainException.notFound(MessageCodes.COM_08);
        }
        VersionGuard.requireExpected(growth.getVersion(), request.expectedVersion());

        GrowthDtos.Record before = toDto(growth);
        if (ACTION_EXCLUDE.equals(request.action())) {
            growth.setStatus(STATUS_EXCLUDED);
        } else if (ACTION_CORRECT.equals(request.action())) {
            if (request.values() == null) {
                throw DomainException.required("values");
            }
            applyMeasurement(ctx, growth, request.values());
            growth.setStatus(STATUS_VALID);
            growth.setCorrected(true);
        } else {
            throw DomainException.invalid("action");
        }
        growth.setCorrectionReason(request.reason());

        revisions.record(ctx, REVISION_SOURCE_TYPE, id, request.action(), request.reason(), before, toDto(growth));
        audit.log(ctx, "GROWTH_CORRECT", "Growth", id, Map.of("action", request.action()));
        outbox.enqueue(farmId, "GROWTH_CORRECTED", "Growth", id, Map.of("cattleId", cattleId));
        em.flush();

        List<GrowthDtos.Revision> history = revisionsOf(farmId, List.of(id)).getOrDefault(id, List.of());
        return toDto(growth).withRevisions(history);
    }

    // =====================================================================================
    // Đọc hồ sơ tăng trưởng và tính chỉ số
    // =====================================================================================

    /**
     * Hồ sơ tăng trưởng của một con bò (tab Tăng trưởng &amp; BCS), kèm lịch sử sửa của từng bản ghi.
     *
     * @param window số ngày của kỳ tính ADG (30, 60, 90 hoặc 180)
     */
    @Transactional(readOnly = true)
    public GrowthDtos.Summary history(Long farmId, Long cattleId, int window) {
        access.require(farmId, FarmAction.VIEW_CATTLE);
        Cattle cattle = em.find(Cattle.class, cattleId);
        if (cattle == null || !farmId.equals(cattle.getFarm().getId())) {
            throw DomainException.notFound(MessageCodes.COM_08);
        }
        return summary(cattle, window, true);
    }

    /** Chỉ số tăng trưởng không kèm lịch sử sửa — dùng cho danh sách cả đàn và hồ sơ bò. */
    public GrowthDtos.Summary summary(Cattle cattle, int window) {
        return summary(cattle, window, false);
    }

    /**
     * Tính toàn bộ chỉ số tăng trưởng của một con bò từ các bản ghi cân.
     *
     * @param window        số ngày của kỳ tính ADG (30, 60, 90 hoặc 180)
     * @param withRevisions {@code true} thì nạp thêm lịch sử sửa của mọi bản ghi (chỉ màn một con, một truy vấn)
     */
    public GrowthDtos.Summary summary(Cattle cattle, int window, boolean withRevisions) {
        if (!ADG_WINDOWS.contains(window)) {
            throw DomainException.invalid("windowDays");
        }
        LocalDate today = clock.today();

        List<Growth> all = loadRecords(cattle);
        List<Growth> usable = all.stream().filter(this::isUsable).toList();
        // Các lần có cân nặng (bỏ lần chỉ chấm BCS), cũ trước mới sau.
        List<Growth> weighings = usable.stream().filter(g -> g.getWeightKg() != null).toList();

        Growth currentWeight = currentWeight(weighings);
        BigDecimal latestBcs = latestBcs(usable);
        BigDecimal periodAdg = adg(withinDays(weighings, today, window));
        LocalDate nextWeighing = nextWeighingDate(cattle, weighings);
        FinishingProjection projection = finishingProjection(cattle, weighings, today);

        return new GrowthDtos.Summary(
            currentWeight == null ? null : toDto(currentWeight),
            latestBcs,
            periodAdg,
            window,
            nextWeighing,
            projection.projectedDate(),
            projection.status(),
            all.size(),
            recordsNewestFirst(cattle, all, withRevisions),
            projection.targetKg(),
            projection.missingKg(),
            projection.adg60(),
            projection.finishingDays()
        );
    }

    /** Mọi bản ghi cân của con bò (kể cả bản đã loại trừ), cũ trước mới sau. */
    private List<Growth> loadRecords(Cattle cattle) {
        return em
            .createQuery("select g from Growth g where g.cattle.id=:c order by g.checkDate,g.entryTime,g.id", Growth.class)
            .setParameter("c", cattle.getId())
            .getResultList();
    }

    /**
     * Cân hiện tại hiển thị cho người dùng: ưu tiên lần <b>cân điện tử</b> (số thực tế) mới nhất; nếu con bò chưa
     * từng cân điện tử thì lấy lần cân mới nhất bất kỳ (thước dây / ước tính).
     *
     * <p>Lưu ý: dự kiến xuất bán lại dùng lần cân mới nhất bất kỳ (xem {@link #finishingProjection}), nên hai số
     * này có thể khác nhau khi lần đo mới nhất là thước dây.
     */
    private Growth currentWeight(List<Growth> weighings) {
        Growth latestMeasured = last(weighings.stream().filter(g -> WEIGHT_MEASURED.equals(g.getWeightType())).toList());
        return latestMeasured != null ? latestMeasured : last(weighings);
    }

    /** Điểm BCS của lần chấm hợp lệ mới nhất (có thể là lần không cân). */
    private BigDecimal latestBcs(List<Growth> usable) {
        Growth latest = last(usable.stream().filter(g -> g.getBcsScore() != null).toList());
        return latest == null ? null : latest.getBcsScore();
    }

    /** Các lần cân có ngày cân nằm trong {@code days} ngày gần nhất, tính đến hết hôm nay. */
    private static List<Growth> withinDays(List<Growth> weighings, LocalDate today, int days) {
        LocalDate from = today.minusDays(days);
        return weighings
            .stream()
            .filter(g -> !g.getCheckDate().isBefore(from) && !g.getCheckDate().isAfter(today))
            .toList();
    }

    /**
     * Lần cân tới = ngày cân gần nhất + chu kỳ cân của trại ({@code WEIGHING_INTERVAL_DAYS}, mặc định 30 ngày).
     * Bò chưa cân lần nào thì tính từ ngày nhập đàn; không có cả ngày nhập đàn thì trả {@code null}.
     */
    private LocalDate nextWeighingDate(Cattle cattle, List<Growth> weighings) {
        LocalDate lastWeighed = weighings
            .stream()
            .map(Growth::getCheckDate)
            .max(Comparator.naturalOrder())
            .orElseGet(() -> entryDate(cattle.getId()));
        int interval = parameterNumber(cattle.getFarm(), PARAM_WEIGHING_INTERVAL, DEFAULT_WEIGHING_INTERVAL_DAYS);
        return lastWeighed == null ? null : lastWeighed.plusDays(interval);
    }

    /**
     * Dự kiến ngày xuất bán (GBR-107). Chỉ áp dụng cho bò <b>Vỗ béo</b> khi trại đã đặt cân xuất mục tiêu
     * ({@code TARGET_FINISHING_WEIGHT_KG}); ngược lại trả {@code NOT_APPLICABLE}.
     *
     * <pre>
     * còn thiếu (kg) = mục tiêu − lần cân hợp lệ mới nhất   (không âm)
     * số ngày        = làm tròn lên (còn thiếu ÷ ADG 60 ngày)
     * ngày dự kiến   = ngày của lần cân mới nhất + số ngày
     * </pre>
     *
     * Kết quả:
     * <ul>
     *   <li>{@code TARGET_REACHED}: lần cân mới nhất đã ≥ mục tiêu.</li>
     *   <li>{@code PROJECTED}: có ADG 60 ngày dương nên tính được ngày dự kiến.</li>
     *   <li>{@code INSUFFICIENT_WEIGHTS}: chưa có lần cân, hoặc chưa có ADG 60 ngày dương.</li>
     * </ul>
     */
    private FinishingProjection finishingProjection(Cattle cattle, List<Growth> weighings, LocalDate today) {
        BigDecimal target = targetFinishingWeight(cattle.getFarm(), today);
        if (cattle.getPurpose().getPurposeType() != PurposeType.FATTENING || target == null) {
            return FinishingProjection.NOT_APPLICABLE;
        }

        // ADG 60 ngày: chỉ chặn mốc đầu kỳ; lần cân không thể ở tương lai vì record() đã chặn.
        LocalDate from = today.minusDays(PROJECTION_ADG_WINDOW_DAYS);
        BigDecimal adg60 = adg(weighings.stream().filter(g -> !g.getCheckDate().isBefore(from)).toList());

        Growth latest = last(weighings);
        if (latest == null || target.signum() <= 0) {
            return new FinishingProjection(FINISHING_INSUFFICIENT_WEIGHTS, target, target, adg60, null, null);
        }

        BigDecimal missingKg = target.subtract(latest.getWeightKg()).max(BigDecimal.ZERO);
        if (latest.getWeightKg().compareTo(target) >= 0) {
            return new FinishingProjection(FINISHING_TARGET_REACHED, target, missingKg, adg60, null, null);
        }
        if (adg60 == null || adg60.signum() <= 0) {
            return new FinishingProjection(FINISHING_INSUFFICIENT_WEIGHTS, target, missingKg, adg60, null, null);
        }

        long days = missingKg.divide(adg60, 0, RoundingMode.CEILING).longValue();
        LocalDate projectedDate = latest.getCheckDate().plusDays(days);
        return new FinishingProjection(FINISHING_PROJECTED, target, missingKg, adg60, projectedDate, (int) days);
    }

    /** Cân xuất mục tiêu đang có hiệu lực của trại; {@code null} nghĩa là trại chưa đặt (tính năng tắt). */
    private BigDecimal targetFinishingWeight(Farm farm, LocalDate date) {
        Object value = parameters(farm, date).get(PARAM_TARGET_FINISHING_WEIGHT);
        return value == null ? null : new BigDecimal(value.toString());
    }

    /** Danh sách bản ghi mới nhất trước; màn một con thì gắn thêm lịch sử sửa của từng bản ghi. */
    private List<GrowthDtos.Record> recordsNewestFirst(Cattle cattle, List<Growth> all, boolean withRevisions) {
        Map<Long, List<GrowthDtos.Revision>> history = withRevisions
            ? revisionsOf(cattle.getFarm().getId(), all.stream().map(Growth::getId).toList())
            : Map.of();
        List<GrowthDtos.Record> records = new ArrayList<>();
        for (Growth growth : all) {
            GrowthDtos.Record dto = toDto(growth);
            records.add(withRevisions ? dto.withRevisions(history.getOrDefault(growth.getId(), List.of())) : dto);
        }
        Collections.reverse(records);
        return records;
    }

    /**
     * GAP-FE08-01: lịch sử sửa / loại trừ của các bản ghi cân, gom trong một truy vấn, cũ trước mới sau.
     *
     * @return map từ id bản ghi cân tới danh sách lần sửa của nó
     */
    @SuppressWarnings("unchecked")
    private Map<Long, List<GrowthDtos.Revision>> revisionsOf(Long farmId, List<Long> ids) {
        Map<Long, List<GrowthDtos.Revision>> result = new HashMap<>();
        if (ids.isEmpty()) {
            return result;
        }
        List<RecordRevision> rows = em
            .createQuery(
                "select r from RecordRevision r left join fetch r.actor " +
                "where r.farm.id=:farm and r.sourceType='" + REVISION_SOURCE_TYPE + "' and r.sourceId in :ids " +
                "order by r.changedAt,r.id",
                RecordRevision.class
            )
            .setParameter("farm", farmId)
            .setParameter("ids", ids)
            .getResultList();
        for (RecordRevision r : rows) {
            GrowthDtos.Revision revision = new GrowthDtos.Revision(
                r.getId(),
                r.getChangedAt(),
                r.getActor() == null ? null : r.getActor().getFullName(),
                r.getAction(),
                r.getReason(),
                r.getBeforeSnapshot() == null ? null : JsonSupport.fromJson(r.getBeforeSnapshot(), Map.class),
                r.getAfterSnapshot() == null ? null : JsonSupport.fromJson(r.getAfterSnapshot(), Map.class)
            );
            result.computeIfAbsent(r.getSourceId(), k -> new ArrayList<>()).add(revision);
        }
        return result;
    }

    // =====================================================================================
    // Tham số trại
    // =====================================================================================

    /**
     * Đọc một tham số số nguyên của trại đang có hiệu lực hôm nay.
     *
     * @param fallback giá trị dùng khi tham số chưa đặt hoặc không phải số nguyên
     */
    public int parameterNumber(Farm farm, String key, int fallback) {
        Object value = parameters(farm, clock.today()).get(key);
        if (value == null) {
            return fallback;
        }
        try {
            return new BigDecimal(value.toString()).intValueExact();
        } catch (NumberFormatException | ArithmeticException ex) {
            return fallback;
        }
    }

    /** Bộ tham số trại có hiệu lực tại {@code date}; trại chưa có phiên bản nào thì dùng bộ mặc định khởi tạo. */
    private Map<String, Object> parameters(Farm farm, LocalDate date) {
        return parameterVersionAt(farm.getId(), date)
            .map(this::parameterValues)
            .orElseGet(StarterCatalogueService::defaultParameters);
    }

    /** Phiên bản tham số mới nhất của trại đã có hiệu lực tại {@code date}. */
    private Optional<FarmParameterVersion> parameterVersionAt(Long farmId, LocalDate date) {
        return em
            .createQuery(
                "select p from FarmParameterVersion p where p.farm.id=:f and p.effectiveFrom<=:d " +
                "order by p.effectiveFrom desc,p.versionNo desc",
                FarmParameterVersion.class
            )
            .setParameter("f", farmId)
            .setParameter("d", date)
            .setMaxResults(1)
            .getResultList()
            .stream()
            .findFirst();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parameterValues(FarmParameterVersion version) {
        return JsonSupport.fromJson(version.getParameterValues(), Map.class);
    }

    // =====================================================================================
    // Công thức tính
    // =====================================================================================

    /**
     * ADG (kg/ngày) = (cân lần cuối − cân lần đầu) ÷ số ngày giữa hai lần (GBR-39).
     *
     * <p>Chỉ dùng hai đầu của danh sách, các lần cân ở giữa không ảnh hưởng. Trả {@code null} khi có dưới 2 lần cân
     * hoặc hai lần cách nhau dưới {@value #MIN_ADG_GAP_DAYS} ngày. Làm tròn 3 chữ số thập phân.
     *
     * @param ordered các lần cân hợp lệ, cũ trước mới sau
     */
    public static BigDecimal adg(List<Growth> ordered) {
        if (ordered.size() < 2) {
            return null;
        }
        Growth first = ordered.get(0);
        Growth last = ordered.get(ordered.size() - 1);
        long days = ChronoUnit.DAYS.between(first.getCheckDate(), last.getCheckDate());
        if (days < MIN_ADG_GAP_DAYS) {
            return null;
        }
        return last.getWeightKg().subtract(first.getWeightKg()).divide(BigDecimal.valueOf(days), 3, RoundingMode.HALF_UP);
    }

    /**
     * Cân nặng ước tính từ thước dây = 88,4 × vòng ngực (m)² × dài thân chéo (m), làm tròn 1 chữ số thập phân.
     *
     * @param girth  vòng ngực (cm)
     * @param length dài thân chéo (cm)
     */
    public static BigDecimal tapeWeight(BigDecimal girth, BigDecimal length) {
        BigDecimal girthM = girth.movePointLeft(2);
        BigDecimal lengthM = length.movePointLeft(2);
        return TAPE_FORMULA_FACTOR.multiply(girthM.pow(2)).multiply(lengthM).setScale(1, RoundingMode.HALF_UP);
    }

    // =====================================================================================
    // Kiểm tra và áp số đo vào bản ghi
    // =====================================================================================

    /**
     * Kiểm tra số đo người dùng nhập rồi ghi vào bản ghi {@code growth} (dùng chung cho ghi mới và sửa).
     *
     * <p>Thứ tự kiểm tra giữ cố định để lỗi trả về luôn nhất quán:
     * thời điểm đo → phương pháp &amp; số đo thước dây → có ít nhất cân hoặc BCS → khoảng cân nặng →
     * thang BCS → chênh lệch lớn → người đo.
     */
    private void applyMeasurement(FarmContext ctx, Growth growth, GrowthDtos.Measurement r) {
        LocalDate date = measurementDate(growth, r);

        if (r.weightKg() != null && r.method() == null) {
            throw DomainException.required("method");
        }
        // Chỉ chấm BCS (không cân) thì không có phương pháp; lưu là OTHER.
        String method = r.method() == null ? METHOD_OTHER : r.method();
        if (!METHODS.contains(method)) {
            throw DomainException.invalid("method");
        }
        BigDecimal weight = resolveWeight(method, r);

        if (weight == null && r.bcs() == null) {
            throw DomainException.unprocessable("MSG-FE08-02");
        }
        if (weight != null) {
            requireRange(weight, WEIGHT_MIN_KG, WEIGHT_MAX_KG, "weightKg");
            if (weight.stripTrailingZeros().scale() > 1) {
                throw DomainException.invalid("weightKg"); // tối đa 1 chữ số thập phân
            }
        }
        if (r.bcs() != null) {
            validateBcs(ctx.farmId(), date, r.bcs());
        }
        if (weight != null && !r.acknowledgedLargeChange()) {
            rejectLargeChange(growth, date, weight);
        }
        AppUser measuredBy = resolveMeasuredBy(ctx, r.measuredBy());

        growth.setObservedAt(r.measuredAt());
        growth.setCheckDate(date);
        growth.setWeightKg(weight);
        growth.setWeightType(weight == null ? null : (METHOD_SCALE.equals(method) ? WEIGHT_MEASURED : WEIGHT_ESTIMATED));
        growth.setMethod(method);
        growth.setHeartGirthCm(r.heartGirthCm());
        growth.setBodyLengthCm(r.bodyLengthCm());
        growth.setBcs(null);
        growth.setBcsScore(r.bcs());
        growth.setMeasuredBy(measuredBy);
        growth.setNote(r.note());
    }

    /** Thời điểm đo bắt buộc, không ở tương lai và không trước ngày nhập đàn (MSG-COM-15). Trả về ngày đo theo giờ trại. */
    private LocalDate measurementDate(Growth growth, GrowthDtos.Measurement r) {
        if (r == null || r.measuredAt() == null) {
            throw DomainException.required("measuredAt");
        }
        clock.assertNotFuture(r.measuredAt());
        LocalDate date = clock.toFarmDate(r.measuredAt());
        LocalDate entry = entryDate(growth.getCattle().getId());
        if (entry != null && date.isBefore(entry)) {
            throw DomainException.unprocessable(MessageCodes.COM_15, "date", entry);
        }
        return date;
    }

    /**
     * Cân nặng sẽ lưu. Đo thước dây thì bắt buộc vòng ngực / dài thân chéo hợp lệ và tự tính cân nếu người dùng
     * không nhập; phương pháp khác thì không được gửi số đo thước dây.
     */
    private BigDecimal resolveWeight(String method, GrowthDtos.Measurement r) {
        if (METHOD_TAPE.equals(method)) {
            requireRange(r.heartGirthCm(), GIRTH_MIN_CM, GIRTH_MAX_CM, "heartGirthCm");
            requireRange(r.bodyLengthCm(), LENGTH_MIN_CM, LENGTH_MAX_CM, "bodyLengthCm");
            return r.weightKg() != null ? r.weightKg() : tapeWeight(r.heartGirthCm(), r.bodyLengthCm());
        }
        if (r.heartGirthCm() != null || r.bodyLengthCm() != null) {
            throw DomainException.invalid("tapeDimensions");
        }
        return r.weightKg();
    }

    /**
     * BCS phải nằm trong thang của trại có hiệu lực tại ngày đo: thang 1–9 bước 1, hoặc thang 1–5 bước 0,5 (mặc định).
     */
    private void validateBcs(Long farmId, LocalDate date, BigDecimal bcs) {
        String scale = parameterVersionAt(farmId, date)
            .map(version -> Objects.toString(parameterValues(version).get(PARAM_BCS_SCALE), DEFAULT_BCS_SCALE))
            .orElse(DEFAULT_BCS_SCALE);
        boolean ninePointScale = scale.startsWith("1-9");
        requireRange(bcs, 1, ninePointScale ? 9 : 5, "bcs");
        // Thang 1–9 chỉ nhận số nguyên; thang 1–5 nhận bước 0,5 (nhân 2 phải ra số nguyên).
        BigDecimal steps = bcs.multiply(BigDecimal.valueOf(ninePointScale ? 1 : 2));
        if (steps.stripTrailingZeros().scale() > 0) {
            throw DomainException.invalid("bcs");
        }
    }

    /**
     * MSG-FE08-04: chặn (để người dùng xác nhận lại) khi cân mới lệch hơn 20% so với lần cân hợp lệ gần nhất
     * trong 30 ngày trước ngày đo. Khi sửa bản ghi thì không so với chính nó.
     */
    private void rejectLargeChange(Growth growth, LocalDate date, BigDecimal weight) {
        Long selfId = growth.getId() == null ? -1L : growth.getId();
        List<Growth> recent = em
            .createQuery(
                "select g from Growth g where g.cattle.id=:c and g.id<>:id and g.status in ('VALID','CORRECTED') " +
                "and g.weightKg is not null and g.checkDate between :start and :end order by g.checkDate desc,g.id desc",
                Growth.class
            )
            .setParameter("c", growth.getCattle().getId())
            .setParameter("id", selfId)
            .setParameter("start", date.minusDays(LARGE_CHANGE_LOOKBACK_DAYS))
            .setParameter("end", date)
            .setMaxResults(1)
            .getResultList();
        if (recent.isEmpty()) {
            return;
        }
        Growth previous = recent.get(0);
        BigDecimal allowed = previous.getWeightKg().multiply(LARGE_CHANGE_RATIO);
        if (weight.subtract(previous.getWeightKg()).abs().compareTo(allowed) > 0) {
            throw DomainException.unprocessable(
                "MSG-FE08-04", "new", weight, "last", previous.getWeightKg(), "date", previous.getCheckDate());
        }
    }

    /** Người đo: mặc định là người đang thao tác; nếu chọn người khác thì phải là thành viên đang hoạt động của trại. */
    private AppUser resolveMeasuredBy(FarmContext ctx, Long measuredById) {
        if (measuredById == null) {
            return ctx.user();
        }
        List<FarmMembership> members = em
            .createQuery("select m from FarmMembership m where m.farm.id=:f and m.user.id=:u and m.status='ACTIVE'", FarmMembership.class)
            .setParameter("f", ctx.farmId())
            .setParameter("u", measuredById)
            .getResultList();
        if (members.isEmpty()) {
            throw DomainException.invalid("measuredBy");
        }
        return members.get(0).getUser();
    }

    // =====================================================================================
    // Tiện ích
    // =====================================================================================

    private static void requireRange(BigDecimal value, int min, int max, String field) {
        if (value == null || value.compareTo(BigDecimal.valueOf(min)) < 0 || value.compareTo(BigDecimal.valueOf(max)) > 0) {
            throw DomainException.invalid(field);
        }
    }

    /** Ngày nhập đàn của con bò (phiếu nhập đầu tiên); {@code null} nếu không có. */
    private LocalDate entryDate(Long cattleId) {
        return em
            .createQuery("select h.entryDate from HerdEntry h where h.cattle.id=:c order by h.id", LocalDate.class)
            .setParameter("c", cattleId)
            .setMaxResults(1)
            .getResultStream()
            .findFirst()
            .orElse(null);
    }

    private boolean isUsable(Growth growth) {
        return USABLE_STATUSES.contains(growth.getStatus());
    }

    private static Growth last(List<Growth> list) {
        return list.isEmpty() ? null : list.get(list.size() - 1);
    }

    private GrowthDtos.Record toDto(Growth g) {
        AppUser measuredBy = g.getMeasuredBy();
        Instant measuredAt = g.getObservedAt() != null
            ? g.getObservedAt()
            : g.getCheckDate().atStartOfDay(clock.zone()).toInstant(); // bản ghi cũ chỉ có ngày cân
        return new GrowthDtos.Record(
            g.getId(),
            g.getCattle().getId(),
            measuredAt,
            g.getEntryTime(),
            measuredBy == null ? null : measuredBy.getId(),
            measuredBy == null ? null : measuredBy.getFullName(),
            g.getMethod(),
            g.getWeightKg(),
            g.getWeightType(),
            g.getHeartGirthCm(),
            g.getBodyLengthCm(),
            g.getBcsScore(),
            g.getNote(),
            g.getStatus(),
            g.isCorrected(),
            g.getVersion()
        );
    }

    /** Kết quả dự kiến xuất bán; các trường {@code null} khi không áp dụng hoặc chưa tính được. */
    private record FinishingProjection(
        String status,
        BigDecimal targetKg,
        BigDecimal missingKg,
        BigDecimal adg60,
        LocalDate projectedDate,
        Integer finishingDays
    ) {
        static final FinishingProjection NOT_APPLICABLE = new FinishingProjection(FINISHING_NOT_APPLICABLE, null, null, null, null, null);
    }
}
