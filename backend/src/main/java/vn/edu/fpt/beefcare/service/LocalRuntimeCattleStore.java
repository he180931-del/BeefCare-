package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;

/** Local fixtures only; all methods are called inside the lifecycle transaction. */
final class LocalRuntimeCattleStore {
    static final String FARM_NAME = "BeefCare Local Farm A";
    static final String MALE_QR = "QR-1151-000001";
    static final String LEGACY_FEMALE_QR = "QR-LOCAL-DEMO-FEMALE";
    static final String MARKER = "Bò demo theo phiên; tự xóa khi dừng ứng dụng.";
    private static final String PEN_NOTE = "Chuồng cấu hình cho bò demo theo phiên";

    record Session(Long farmId, Long maleId, Long femaleId, String femaleQr) {
        List<Long> cattleIds() { return List.of(maleId, femaleId); }
    }

    private final EntityManager em;
    private final FarmClock clock;
    private final CodeSequenceService codes;
    private final LocalRuntimeCattleCleanup cleanup;
    private final JdbcTemplate jdbc;

    LocalRuntimeCattleStore(EntityManager em, DataSource dataSource, FarmClock clock, CodeSequenceService codes) {
        this.em = em;
        this.clock = clock;
        this.codes = codes;
        this.cleanup = new LocalRuntimeCattleCleanup(dataSource);
        this.jdbc = new JdbcTemplate(dataSource);
    }

    Session create() {
        em.flush();
        List<Long> stale = em.createQuery("""
            select distinct t.cattle.id from CattleQrTag t
            where t.tagCode in :tags and t.note=:marker
            """, Long.class).setParameter("tags", fixtureTags())
            .setParameter("marker", MARKER).getResultList();
        cleanup.deleteCattle(stale);
        cleanup.prepare();
        em.clear();

        Farm farm = em.createQuery("select f from Farm f where f.name=:name", Farm.class)
            .setParameter("name", FARM_NAME).getResultStream().findFirst()
            .orElseThrow(() -> new IllegalStateException("Run LocalDevelopmentSeeder before the runtime cattle fixtures"));
        em.lock(farm, LockModeType.PESSIMISTIC_WRITE);
        AppUser owner = em.createQuery("""
            select m.user from FarmMembership m where m.farm.id=:farm and m.role='OWNER' and m.status='ACTIVE'
            """, AppUser.class).setParameter("farm", farm.getId()).getSingleResult();
        CattleQrTag legacyTag = findTag(MALE_QR);
        Cattle male;
        if (legacyTag != null) {
            male = legacyTag.getCattle();
            if (!farm.getId().equals(male.getFarm().getId()) || male.getSex() != Sex.MALE
                || !"BC-000001".equals(male.getDisplayCode()) || !"QR-CAMERA-TEST".equals(male.getEarTagNumber())) {
                throw collision(MALE_QR);
            }
            legacyTag.setNote(MARKER);
        } else {
            if (hasCode(farm.getId(), "BC-000001")) throw collision("BC-000001");
            male = animal(farm, owner, "BC-000001", "QR-CAMERA-TEST", "Bò kiểm thử camera QR", Sex.MALE,
                LifeStage.YOUNG_STOCK, PurposeType.FATTENING, 18);
            tag(farm, owner, male, MALE_QR);
        }
        Long duplicateEar = em.createQuery("select count(c) from Cattle c where c.farm.id=:farm and c.earTagNumber='QR-DEMO-FEMALE'", Long.class)
            .setParameter("farm", farm.getId()).getSingleResult();
        if (duplicateEar != 0) throw collision("QR-DEMO-FEMALE");
        reserve(farm.getId(), CodeType.CATTLE);
        reserve(farm.getId(), CodeType.QR_TAG);
        String femaleQr = femaleQr(farm.getId());
        if (findTag(femaleQr) != null) throw collision(femaleQr);
        String femaleCode;
        do { femaleCode = codes.nextCattleCode(farm.getId()); } while (hasCode(farm.getId(), femaleCode));
        Cattle female = animal(farm, owner, femaleCode, "QR-DEMO-FEMALE", "Bò cái demo QR", Sex.FEMALE,
            LifeStage.ADULT, PurposeType.BREEDING, 30);
        tag(farm, owner, female, femaleQr);
        Pen pen = demoPen(farm, owner);
        place(farm, owner, male, pen);
        place(farm, owner, female, pen);
        weigh(owner, male, "200");
        weigh(owner, female, "320");
        em.flush();
        return new Session(farm.getId(), male.getId(), female.getId(), femaleQr);
    }

    void delete(Session session) {
        em.flush();
        List<Long> owned = em.createQuery("""
            select distinct t.cattle.id from CattleQrTag t
            where t.tagCode in :tags and t.note=:marker and t.cattle.id in :ids
            """, Long.class).setParameter("tags", List.of(MALE_QR, session.femaleQr()))
            .setParameter("marker", MARKER).setParameter("ids", session.cattleIds()).getResultList();
        cleanup.deleteCattle(owned);
        em.clear();
    }

    private List<String> fixtureTags() {
        List<String> tags = new ArrayList<>(jdbc.queryForList("select tag_code from local_runtime_cattle_qr", String.class));
        tags.add(MALE_QR);
        tags.add(LEGACY_FEMALE_QR);
        return tags;
    }

    /** Allocate once with the ordinary QR counter, retaining only the reservation between demo sessions. */
    private String femaleQr(Long farmId) {
        List<String> reserved = jdbc.queryForList("select tag_code from local_runtime_cattle_qr where farm_id=?", String.class, farmId);
        if (!reserved.isEmpty()) return reserved.getFirst();
        String code;
        do { code = codes.nextQrTagCode(farmId); } while (findTag(code) != null);
        jdbc.update("insert into local_runtime_cattle_qr (farm_id,tag_code) values (?,?)", farmId, code);
        return code;
    }

    private Cattle animal(Farm farm, AppUser owner, String code, String ear, String name, Sex sex,
        LifeStage stage, PurposeType purpose, int ageMonths) {
        Cattle cattle = new Cattle();
        cattle.setFarm(farm); cattle.setCreatedBy(owner); cattle.setDisplayCode(code); cattle.setEarTagNumber(ear);
        cattle.setName(name); cattle.setSex(sex); cattle.setLifeStage(stage); cattle.setHerdStatus(HerdStatus.ACTIVE);
        cattle.setBirthDate(clock.today().minusMonths(ageMonths)); cattle.setBirthDateAccuracy(BirthDateAccuracy.ESTIMATED);
        cattle.setCreatedAt(clock.now()); cattle.setUpdatedAt(clock.now());
        cattle.setNotes("Dữ liệu dùng thử, được xóa khi kết thúc phiên demo.");
        cattle.setBreed(em.createQuery("select b from Breed b where b.farm.id=:farm and b.available=true order by b.id", Breed.class)
            .setParameter("farm", farm.getId()).getResultStream().findFirst()
            .orElseThrow(() -> new IllegalStateException("The local farm needs an active breed")));
        cattle.setPurpose(em.createQuery("select p from ProductionPurpose p where p.farm.id=:farm and p.purposeType=:type and p.available=true order by p.id", ProductionPurpose.class)
            .setParameter("farm", farm.getId()).setParameter("type", purpose).getResultStream().findFirst()
            .orElseThrow(() -> new IllegalStateException("The local farm needs an active " + purpose + " purpose")));
        em.persist(cattle);
        return cattle;
    }

    private void tag(Farm farm, AppUser owner, Cattle cattle, String code) {
        CattleQrTag tag = new CattleQrTag();
        tag.setFarm(farm); tag.setCattle(cattle); tag.setIssuedBy(owner); tag.setIssuedAt(clock.now());
        tag.setTagCode(code); tag.setStatus(QrTagStatus.ACTIVE); tag.setNote(MARKER); em.persist(tag);
    }

    private CattleQrTag findTag(String code) {
        return em.createQuery("select t from CattleQrTag t join fetch t.cattle where t.tagCode=:code", CattleQrTag.class)
            .setParameter("code", code).getResultStream().findFirst().orElse(null);
    }

    private boolean hasCode(Long farm, String code) {
        return em.createQuery("select count(c) from Cattle c where c.farm.id=:farm and c.displayCode=:code", Long.class)
            .setParameter("farm", farm).setParameter("code", code).getSingleResult() != 0;
    }

    private void reserve(Long farm, CodeType type) {
        CodeSequence sequence = em.createQuery("select s from CodeSequence s where s.farmId=:farm and s.codeType=:type and s.periodYear=0", CodeSequence.class)
            .setParameter("farm", farm).setParameter("type", type).getResultStream().findFirst().orElse(null);
        if (sequence == null) {
            sequence = new CodeSequence(); sequence.setFarmId(farm); sequence.setCodeType(type); sequence.setPeriodYear(0);
            sequence.setLastValue(1L); em.persist(sequence);
        } else if (sequence.getLastValue() < 1) sequence.setLastValue(1L);
        em.flush();
    }

    private Pen demoPen(Farm farm, AppUser owner) {
        Pen pen = em.createQuery("select p from Pen p where p.farm.id=:farm and p.code='LOCAL-QR-DEMO'", Pen.class)
            .setParameter("farm", farm.getId()).getResultStream().findFirst().orElse(null);
        if (pen == null) {
            pen = new Pen(); pen.setFarm(farm); pen.setCode("LOCAL-QR-DEMO"); pen.setName("Chuồng bò demo theo phiên");
            pen.setDescription(PEN_NOTE); pen.setCreatedBy(owner); pen.setCapacity(2);
            pen.setStatus(ActiveStatus.ACTIVE); em.persist(pen);
        } else if (!PEN_NOTE.equals(pen.getDescription())) throw collision("LOCAL-QR-DEMO");
        pen.setStatus(ActiveStatus.ACTIVE);
        long occupied = em.createQuery("select count(p) from PenAssignment p where p.pen.id=:pen and p.toDate is null", Long.class)
            .setParameter("pen", pen.getId()).getSingleResult();
        pen.setCapacity(Math.max(pen.getCapacity(), Math.toIntExact(occupied + 2)));
        return pen;
    }

    private void place(Farm farm, AppUser owner, Cattle cattle, Pen pen) {
        if (em.createQuery("select count(p) from PenAssignment p where p.cattle.id=:id and p.toDate is null", Long.class)
            .setParameter("id", cattle.getId()).getSingleResult() != 0) return;
        PenAssignment placement = new PenAssignment();
        placement.setFarm(farm); placement.setCattle(cattle); placement.setPen(pen); placement.setFromDate(clock.today());
        placement.setMovedBy(owner); placement.setRecordedAt(clock.now()); placement.setSource(AssignmentSource.HERD_ENTRY);
        placement.setReason("Dữ liệu demo tạm thời theo phiên backend"); em.persist(placement);
    }

    private void weigh(AppUser owner, Cattle cattle, String kg) {
        if (em.createQuery("select count(g) from Growth g where g.cattle.id=:id", Long.class).setParameter("id", cattle.getId()).getSingleResult() != 0) return;
        Growth growth = new Growth();
        growth.setCattle(cattle); growth.setCheckDate(clock.today()); growth.setObservedAt(clock.now()); growth.setEntryTime(clock.now());
        growth.setMeasuredBy(owner); growth.setWeightType("MEASURED"); growth.setMethod("SCALE");
        growth.setWeightKg(new BigDecimal(kg)); growth.setStatus("VALID"); em.persist(growth);
    }

    private IllegalStateException collision(String code) {
        return new IllegalStateException("Local demo code already belongs to unrelated data: " + code
            + ". Nothing was replaced. Disable BEEFCARE_LOCAL_RUNTIME_CATTLE_ENABLED to keep the existing data.");
    }
}
