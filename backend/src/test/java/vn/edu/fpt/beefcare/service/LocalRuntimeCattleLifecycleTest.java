package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class LocalRuntimeCattleLifecycleTest extends DomainTestSupport {
    @Autowired DataSource dataSource;
    @Autowired PlatformTransactionManager transactions;
    @Autowired CodeSequenceService codes;
    @Autowired CattleProfileService profiles;
    @Autowired FarmClock farmClock;

    protected Farm farm;
    private AppUser owner;
    private Breed breed;
    private ProductionPurpose fattening;
    private final List<LocalRuntimeCattleLifecycle> running = new ArrayList<>();

    @BeforeEach
    void localFarm() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) initializeFarm();
        else new TransactionTemplate(transactions).executeWithoutResult(status -> initializeFarm());
        actAs(owner);
    }

    private void initializeFarm() {
        farm = farm();
        farm.setName(LocalRuntimeCattleStore.FARM_NAME);
        owner = memberWithRole(farm, FarmRole.OWNER);
        breed = breed(farm);
        fattening = purpose(farm, PurposeType.FATTENING);
        purpose(farm, PurposeType.BREEDING);
        em.flush();
    }

    @AfterEach
    void stopInstances() throws Exception {
        for (LocalRuntimeCattleLifecycle instance : running) instance.destroy();
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            new TransactionTemplate(transactions).executeWithoutResult(status -> em.createQuery("update Farm f set f.name=:name where f.id=:id")
                .setParameter("name", "Completed runtime test " + farm.getId()).setParameter("id", farm.getId()).executeUpdate());
        }
    }

    protected LocalRuntimeCattleLifecycle instance() {
        return new LocalRuntimeCattleLifecycle(em, dataSource, transactions, farmClock, codes);
    }

    protected LocalRuntimeCattleLifecycle start() throws Exception {
        LocalRuntimeCattleLifecycle instance = instance();
        instance.run(new DefaultApplicationArguments());
        running.add(instance);
        em.flush();
        em.clear();
        return instance;
    }

    protected List<Cattle> cattle() {
        return em.createQuery("select c from Cattle c where c.farm.id=:farm order by c.id", Cattle.class)
            .setParameter("farm", farm.getId()).getResultList();
    }

    protected String femaleQr() {
        return new JdbcTemplate(dataSource).queryForObject(
            "select tag_code from local_runtime_cattle_qr where farm_id=?", String.class, farm.getId());
    }

    private CattleQrTag tag(Cattle cattle, String code) {
        CattleQrTag tag = new CattleQrTag();
        tag.setFarm(farm); tag.setCattle(cattle); tag.setTagCode(code);
        tag.setStatus(QrTagStatus.ACTIVE); tag.setIssuedBy(owner); tag.setIssuedAt(farmClock.now());
        return save(tag);
    }

    @Test
    void startupCreatesTwoPersistedCattleAndTheOriginalQrResolvesToTheMale() throws Exception {
        start();
        assertThat(cattle()).hasSize(2);
        var resolved = profiles.resolve(farm.getId(), "QR-1151-000001");
        Cattle male = em.find(Cattle.class, resolved.cattleId());
        assertThat(male.getDisplayCode()).isEqualTo("BC-000001");
        assertThat(male.getSex()).isEqualTo(Sex.MALE);
        assertThat(male.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        Cattle female = em.find(Cattle.class, profiles.resolve(farm.getId(), femaleQr()).cattleId());
        assertThat(female.getSex()).isEqualTo(Sex.FEMALE);
        assertThat(female.getLifeStage()).isEqualTo(LifeStage.ADULT);
        assertThat(female.getPurpose().getPurposeType()).isEqualTo(PurposeType.BREEDING);
        assertThat(female.getFarm().getId()).isEqualTo(farm.getId());
    }

    @Test
    void closingTheSpringContextDeletesBothCattleAndTheirQrWhileKeepingOtherCattle() throws Exception {
        Cattle ordinary = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        weight(ordinary, TODAY, "450");
        tag(ordinary, "OTHER-CATTLE-QR");
        Long ordinaryId = ordinary.getId();
        try (GenericApplicationContext context = new GenericApplicationContext()) {
            context.registerBean(LocalRuntimeCattleLifecycle.class, this::instance);
            context.refresh();
            context.getBean(LocalRuntimeCattleLifecycle.class).run(new DefaultApplicationArguments());
            assertThat(cattle()).hasSize(3);
        }
        em.clear();
        assertThat(cattle()).extracting(Cattle::getId).containsExactly(ordinaryId);
        assertThat(profiles.resolve(farm.getId(), "OTHER-CATTLE-QR").cattleId()).isEqualTo(ordinaryId);
        assertThatThrownBy(() -> profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR)).isInstanceOf(DomainException.class);
    }

    @Test
    void aRepeatedRunnerCallDoesNotCreateDuplicates() throws Exception {
        LocalRuntimeCattleLifecycle instance = start();
        List<Long> ids = cattle().stream().map(Cattle::getId).toList();
        instance.run(new DefaultApplicationArguments());
        assertThat(cattle()).extracting(Cattle::getId).containsExactlyElementsOf(ids);
    }

    @Test
    void theFemaleUsesTheSharedQrGeneratorAndKeepsItsQrAfterRestart() throws Exception {
        LocalRuntimeCattleLifecycle first = start();
        String reserved = femaleQr();
        assertThat(reserved).isEqualTo("QR-" + farm.getId() + "-000002");
        assertThat(codes.nextQrTagCode(farm.getId())).isEqualTo("QR-" + farm.getId() + "-000003");
        first.destroy();
        assertThat(cattle()).isEmpty();
        start();
        assertThat(femaleQr()).isEqualTo(reserved);
        assertThat(profiles.resolve(farm.getId(), reserved).cattleId()).isNotNull();
        assertThat(codes.nextQrTagCode(farm.getId())).isEqualTo("QR-" + farm.getId() + "-000004");
    }

    @Test
    void aLegacyDemoFemaleIsRecreatedWithAStandardQr() throws Exception {
        Cattle previous = cattle(farm, breed, fattening, Sex.FEMALE, LifeStage.ADULT);
        previous.setEarTagNumber("QR-DEMO-FEMALE");
        tag(previous, LocalRuntimeCattleStore.LEGACY_FEMALE_QR).setNote(LocalRuntimeCattleStore.MARKER);
        Long previousId = previous.getId();
        start();
        assertThat(em.find(Cattle.class, previousId)).isNull();
        assertThat(cattle()).hasSize(2);
        assertThat(femaleQr()).isEqualTo("QR-" + farm.getId() + "-000002");
        assertThatThrownBy(() -> profiles.resolve(farm.getId(), LocalRuntimeCattleStore.LEGACY_FEMALE_QR))
            .isInstanceOf(DomainException.class);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void anUnrelatedCattleUsingTheReservedFemaleQrIsNotDeleted() throws Exception {
        LocalRuntimeCattleLifecycle first = instance();
        String reserved;
        try {
            first.run(new DefaultApplicationArguments());
            reserved = femaleQr();
        } finally {
            first.destroy();
        }
        Long ordinaryId = new TransactionTemplate(transactions).execute(status -> {
            Cattle ordinary = cattle(farm, breed, fattening, Sex.FEMALE, LifeStage.ADULT);
            tag(ordinary, reserved);
            em.flush();
            return ordinary.getId();
        });
        LocalRuntimeCattleLifecycle rejected = instance();
        assertThatThrownBy(() -> rejected.run(new DefaultApplicationArguments())).isInstanceOf(IllegalStateException.class);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForList("select id from cattle where farm_id=?", Long.class, farm.getId())).containsExactly(ordinaryId);
        assertThat(jdbc.queryForObject("select cattle_id from cattle_qr_tag where tag_code=?", Long.class, reserved)).isEqualTo(ordinaryId);
    }

    @Test
    void allocationSkipsAnExistingTagWithoutReplacingItsCattle() throws Exception {
        Cattle ordinary = cattle(farm, breed, fattening, Sex.FEMALE, LifeStage.ADULT);
        String occupied = "QR-" + farm.getId() + "-000002";
        tag(ordinary, occupied);
        start();
        assertThat(femaleQr()).isEqualTo("QR-" + farm.getId() + "-000003");
        assertThat(profiles.resolve(farm.getId(), occupied).cattleId()).isEqualTo(ordinary.getId());
        assertThat(cattle()).hasSize(3);
    }

    @Test
    void restartRecoversStaleFixturesEvenAfterTheirNamesAndEarTagsWereChanged() throws Exception {
        new LocalRuntimeCattleStore(em, dataSource, farmClock, codes).create();
        List<Long> oldIds = cattle().stream().map(Cattle::getId).toList();
        for (Cattle cattle : cattle()) { cattle.setName("Đã chỉnh tên"); cattle.setEarTagNumber("EDITED-" + cattle.getId()); }
        em.flush();
        start(); // Stored fixtures remain after the previous process died before its shutdown hook ran.
        assertThat(cattle()).hasSize(2).extracting(Cattle::getId).doesNotContainAnyElementsOf(oldIds);
        assertThat(profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR).cattleId()).isNotNull();
    }

    @Test
    void thePreviouslyCreatedQrTestCattleIsAdoptedAndRemovedOnShutdown() throws Exception {
        Cattle legacy = cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK);
        legacy.setDisplayCode("BC-000001"); legacy.setEarTagNumber("QR-CAMERA-TEST");
        legacy.setName("Bò kiểm thử camera QR");
        tag(legacy, LocalRuntimeCattleStore.MALE_QR);
        Long legacyId = legacy.getId();
        LocalRuntimeCattleLifecycle instance = start();
        assertThat(profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR).cattleId()).isEqualTo(legacyId);
        assertThat(cattle()).hasSize(2);
        instance.destroy();
        em.clear();
        assertThat(cattle()).isEmpty();
    }

    @Test
    void anUnrelatedCattleUsingTheSampleQrIsNeverOverwrittenOrDeleted() {
        Cattle ordinary = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        tag(ordinary, LocalRuntimeCattleStore.MALE_QR);
        assertThatThrownBy(this::start).isInstanceOf(IllegalStateException.class);
        assertThat(cattle()).extracting(Cattle::getId).containsExactly(ordinary.getId());
    }

    @Test
    void cleanupRemovesDependentHealthAndGrowthRowsButPreservesOtherCattleParentage() throws Exception {
        LocalRuntimeCattleLifecycle instance = start();
        Cattle female = em.find(Cattle.class, profiles.resolve(farm.getId(), femaleQr()).cattleId());
        Cattle ordinary = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        ordinary.setDam(female);
        HealthCase healthCase = save(new HealthCase().cattle(female).openedDate(TODAY).status("OPEN"));
        HealthObservation observation = new HealthObservation().healthCase(healthCase);
        observation.setObservedTime(farmClock.now()); observation.setEntryTime(farmClock.now()); observation.setSignsProgress("Thử dữ liệu tạm");
        observation.setRecorder(owner); save(observation);
        Growth growth = weight(female, TODAY, "330");
        Long ordinaryId = ordinary.getId();
        Long growthId = growth.getId();
        em.flush();
        instance.destroy();
        em.clear();
        assertThat(em.find(Growth.class, growthId)).isNull();
        assertThat(em.find(HealthCase.class, healthCase.getId())).isNull();
        assertThat(em.find(HealthObservation.class, observation.getId())).isNull();
        assertThat(em.find(Cattle.class, ordinaryId)).isNotNull().extracting(Cattle::getDam).isNull();
    }

    @Test
    void aSimilarLookingNoteDoesNotClaimAnUnrelatedCattle() {
        Cattle ordinary = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        tag(ordinary, LocalRuntimeCattleStore.MALE_QR).setNote(LocalRuntimeCattleStore.MARKER + " Ghi chú khác.");
        em.flush();
        assertThatThrownBy(this::start).isInstanceOf(IllegalStateException.class);
        assertThat(cattle()).extracting(Cattle::getId).containsExactly(ordinary.getId());
    }

    @Test
    void replacingTheOriginalQrDoesNotLoseTheCleanupMarker() throws Exception {
        LocalRuntimeCattleLifecycle instance = start();
        Long id = profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR).cattleId();
        Cattle male = em.find(Cattle.class, id);
        profiles.issueTag(farm.getId(), id, new vn.edu.fpt.beefcare.service.dto.CattleDtos.TagRequest(
            ReplacementReason.LOST, null, "Thử thay thẻ demo", male.getVersion()));
        assertThat(profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR).replacedTag()).isTrue();
        instance.destroy();
        assertThat(cattle()).isEmpty();
        assertThat(em.createQuery("select count(t) from CattleQrTag t where t.cattle.id=:id", Long.class)
            .setParameter("id", id).getSingleResult()).isZero();
    }

    @Test
    void aRegisteredOffspringAndItsEntrySurviveTheDemoDamsCleanup() throws Exception {
        LocalRuntimeCattleLifecycle instance = start();
        Cattle female = em.find(Cattle.class, profiles.resolve(farm.getId(), femaleQr()).cattleId());
        Cattle offspring = cattle(farm, breed, fattening, Sex.FEMALE, LifeStage.UNWEANED_CALF);
        offspring.setBirthDate(TODAY); offspring.setDam(female);
        tag(offspring, "REGISTERED-CHILD-QR");
        CalvingEvent birth = new CalvingEvent();
        birth.setDam(female); birth.setBirthTime(farmClock.now()); birth.setCourse("NORMAL"); birth.setDamCondition("GOOD");
        birth.setSource("DIRECT_OBSERVATION"); birth.setRecordedAt(farmClock.now()); birth.setRecordedBy(owner); save(birth);
        CalfOutcome outcome = new CalfOutcome();
        outcome.setCalving(birth); outcome.setOutcome("LIVE"); outcome.setSex("FEMALE");
        outcome.setBirthWeight(new java.math.BigDecimal("32.5")); outcome.setWeightBasis("MEASURED");
        outcome.setWeightUnit("KG"); outcome.setCalfNo(1);
        outcome.setRegistrationState("REGISTERED"); outcome.setRegisteredCattle(offspring); save(outcome);
        HerdEntryVoucher voucher = new HerdEntryVoucher();
        voucher.setFarm(farm); voucher.setCode("PN-CHILD-" + next()); voucher.setCreatedBy(owner);
        voucher.setEntryType(EntryType.FARM_BORN); voucher.setEntryDate(TODAY); voucher.setStatus(EntryVoucherStatus.POSTED);
        voucher.setPostedBy(owner); voucher.setPostedAt(farmClock.now()); save(voucher);
        HerdEntry entry = new HerdEntry();
        entry.setFarm(farm); entry.setVoucher(voucher); entry.setLineNo(1); entry.setCattle(offspring); entry.setCalfOutcome(outcome);
        entry.setSource(EntrySource.FARM_BORN); entry.setEntryDate(TODAY); entry.setStatus(EntryLineStatus.VALID);
        entry.setEntryWeightKg(new java.math.BigDecimal("32.5")); entry.setWeightBasis(WeightBasis.MEASURED);
        entry.setInitialPen(pen(farm, "CHILD-" + next(), 3)); save(entry);
        Long childId = offspring.getId();
        Long entryId = entry.getId();
        instance.destroy();
        em.clear();
        assertThat(cattle()).extracting(Cattle::getId).containsExactly(childId);
        assertThat(profiles.resolve(farm.getId(), "REGISTERED-CHILD-QR").cattleId()).isEqualTo(childId);
        assertThat(em.find(Cattle.class, childId).getDam()).isNull();
        assertThat(em.find(HerdEntry.class, entryId)).isNotNull().extracting(HerdEntry::getCalfOutcome).isNull();
        assertThat(em.find(HerdEntryVoucher.class, voucher.getId())).isNotNull();
        assertThat(em.find(CalvingEvent.class, birth.getId())).isNull();
        assertThat(em.find(CalfOutcome.class, outcome.getId())).isNull();
    }

    @Test
    void aPostedEntryAndItsPaymentAreDeletedWithoutBreakingTheirCheckConstraints() throws Exception {
        LocalRuntimeCattleLifecycle instance = start();
        Cattle male = em.find(Cattle.class, profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR).cattleId());
        HerdEntryVoucher voucher = entryVoucher(farm, owner, partner(farm, owner, true, false), 200, 0, EntryVoucherStatus.POSTED);
        voucher.setPostedBy(owner); voucher.setPostedAt(farmClock.now()); voucher.setAmountPaid(100L);
        HerdEntry entry = new HerdEntry();
        entry.setFarm(farm); entry.setVoucher(voucher); entry.setLineNo(1); entry.setCattle(male);
        entry.setSource(EntrySource.EXTERNAL); entry.setEntryDate(voucher.getEntryDate()); entry.setStatus(EntryLineStatus.VALID);
        entry.setEntryWeightKg(new java.math.BigDecimal("200")); entry.setWeightBasis(WeightBasis.MEASURED);
        entry.setUnitPrice(1L); entry.setLineAmount(200L); entry.setInitialPen(pen(farm, "PAID-" + next(), 2)); save(entry);
        VoucherPayment payment = new VoucherPayment();
        payment.setFarm(farm); payment.setEntryVoucher(voucher); payment.setDirection(PaymentDirection.PAY);
        payment.setPaymentDate(TODAY); payment.setAmount(100L); payment.setMethod(PaymentMethod.CASH);
        payment.setRecordedBy(owner); payment.setRecordedAt(farmClock.now()); save(payment);
        instance.destroy();
        em.clear();
        assertThat(cattle()).isEmpty();
        assertThat(em.find(HerdEntry.class, entry.getId())).isNull();
        assertThat(em.find(HerdEntryVoucher.class, voucher.getId())).isNull();
        assertThat(em.find(VoucherPayment.class, payment.getId())).isNull();
    }

    @Test
    void aMixedExitVoucherKeepsItsOtherCattleAndRecalculatesItsAmount() throws Exception {
        LocalRuntimeCattleLifecycle instance = start();
        Cattle male = em.find(Cattle.class, profiles.resolve(farm.getId(), LocalRuntimeCattleStore.MALE_QR).cattleId());
        Cattle ordinary = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        HerdExitVoucher voucher = exitVoucher(farm, owner, partner(farm, owner, false, true), 300, 0, ExitVoucherStatus.DRAFT);
        HerdExit demoLine = exitLine(voucher, male, 1, ExitLineStatus.DRAFT);
        demoLine.setUnitPrice(100L); demoLine.setExitWeightKg(java.math.BigDecimal.ONE); demoLine.setLineAmount(100L);
        HerdExit kept = exitLine(voucher, ordinary, 2, ExitLineStatus.DRAFT);
        kept.setUnitPrice(200L); kept.setExitWeightKg(java.math.BigDecimal.ONE); kept.setLineAmount(200L);
        Long keptId = kept.getId();
        em.flush();
        instance.destroy();
        em.clear();
        assertThat(em.find(HerdExit.class, keptId)).isNotNull();
        assertThat(em.find(HerdExitVoucher.class, voucher.getId()).getCattleAmount()).isEqualTo(200L);
        assertThat(cattle()).extracting(Cattle::getId).containsExactly(ordinary.getId());
    }
}
