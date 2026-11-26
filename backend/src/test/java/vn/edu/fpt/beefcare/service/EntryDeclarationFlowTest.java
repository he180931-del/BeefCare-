package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.validation.ConstraintViolationException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.service.dto.CattleDtos;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** D82: khai báo lúc nhập đàn đi tiếp vào hồ sơ bò, lịch sử tiêm và tab Sinh sản. */
@ServiceIntegrationTest
@Transactional
class EntryDeclarationFlowTest extends HerdEntryTestBase {

    @Autowired
    CattleProfileService profiles;

    @Autowired
    ReproductionReadService reproduction;

    @Autowired
    EntryDeclarationReadService declarations;

    private static final String FREE_TEXT = "Vắc-xin tụ huyết trùng (trại cũ)";

    private Vaccine catalogueVaccine() {
        Vaccine v = new Vaccine();
        v.setFarm(farm);
        v.setCode("DV" + next());
        v.setName("LMLM " + next());
        v.setDiseasePrevented("LMLM");
        v.setDose("2 ml");
        v.setWithdrawalInfo("0");
        v.setAvailable(true);
        return save(v);
    }

    /** Bò cái trưởng thành, mục đích sinh sản – đối tượng theo dõi sinh sản. */
    private EntryLineRequest adultCow(String tag) {
        return new EntryLineRequest(tag, null, null, null, breed.getId(), Sex.FEMALE, null, null, 36, LifeStage.ADULT, breeding.getId(),
            new BigDecimal("380"), WeightBasis.MEASURED, penA.getId(), 1L, null, null, null, null, null, null);
    }

    private static EntryLineRequest withDisease(EntryLineRequest l, EntryLineRequest.DiseaseDeclaration disease) {
        return new EntryLineRequest(l.earTagNumber(), l.name(), l.photoUrl(), l.colourMarkings(), l.breedId(), l.sex(), l.birthDate(), l.birthDateAccuracy(),
            l.ageMonths(), l.lifeStage(), l.purposeId(), l.entryWeightKg(), l.weightBasis(), l.penId(), l.unitPrice(), l.quarantineUntil(), l.warningReason(),
            l.vaccination(), disease, l.reproduction(), l.calfOutcomeId());
    }

    private static EntryLineRequest.ReproductionDeclaration pregnant(int months) {
        return new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 1, YesNoUnknown.YES, months, "Người bán báo đã phối");
    }

    private HerdEntry post(EntryLineRequest line) {
        var result = createAndPost(List.of(line), 0L, 0L);
        return em.find(HerdEntry.class, result.voucher().lines().get(0).id());
    }

    private List<Vaccination> vaccinations(Long cattleId) {
        return em.createQuery("select v from Vaccination v where v.cattle.id=:c order by v.id", Vaccination.class).setParameter("c", cattleId).getResultList();
    }

    // ---------------------------------------------------------------- V2: mũi tên tự do

    @Test
    void freeTextDeclaredVaccineBecomesAHistoricalRecordWithItsName() {
        Vaccine lmlm = catalogueVaccine();
        var vacc = new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, "Sổ người bán", List.of(
            new EntryLineRequest.VaccinationItem(lmlm.getId(), null, TODAY.minusDays(40), null),
            new EntryLineRequest.VaccinationItem(null, "  " + FREE_TEXT + " ", null, null)));
        HerdEntry entry = post(withVaccination(line("F1", penA, "300", 1), vacc));

        List<Vaccination> records = vaccinations(entry.getCattle().getId());
        assertThat(records).hasSize(2).allSatisfy(v -> {
            assertThat(v.getSource()).isEqualTo("HISTORICAL");
            assertThat(v.getScheduledDose()).isNull();
            assertThat(v.getWithdrawalEndDate()).isNull();
        });
        assertThat(records.get(0).getVaccine()).isEqualTo(lmlm);
        assertThat(records.get(0).getVaccineNameSnapshot()).isEqualTo(lmlm.getName());
        assertThat(records.get(1).getVaccine()).isNull();
        assertThat(records.get(1).getVaccineNameSnapshot()).isEqualTo(FREE_TEXT);
        assertThat(records.get(1).getDose()).isNull();
        assertThat(records.get(1).getVaccinationDate()).isEqualTo(entry.getEntryDate());
    }

    @Test
    void onlyAHistoricalRecordWithANameMayLackACatalogueVaccine() {
        HerdEntry entry = post(line("F2", penA, "300", 1));
        Vaccination onFarm = new Vaccination();
        onFarm.setCattle(entry.getCattle());
        onFarm.setVaccinationDate(TODAY);
        onFarm.setEntryTime(clock.instant());
        onFarm.setSource("ON_FARM");
        onFarm.setVaccinator("Chủ trại");
        onFarm.setVaccineNameSnapshot(FREE_TEXT);
        assertThat(onFarm.isVaccineIdentified()).isFalse();
        assertThatThrownBy(() -> {
            em.persist(onFarm);
            em.flush();
        }).isInstanceOf(ConstraintViolationException.class);

        Vaccination nameless = new Vaccination();
        nameless.setSource("HISTORICAL");
        nameless.setVaccineNameSnapshot(" ");
        assertThat(nameless.isVaccineIdentified()).isFalse();
        nameless.setVaccineNameSnapshot(FREE_TEXT);
        assertThat(nameless.isVaccineIdentified()).isTrue();
    }

    @Test
    void correctingAFreeTextDeclarationReplacesItsHistoricalRecordOnce() {
        var old = new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, null,
            List.of(new EntryLineRequest.VaccinationItem(null, FREE_TEXT, TODAY.minusMonths(2), null)));
        HerdEntry entry = post(withVaccination(line("F3", penA, "300", 1), old));
        Vaccination first = vaccinations(entry.getCattle().getId()).get(0);
        assertThat(corrections.declaredVaccinations(entry.getCattle(), old, entry.getEntryDate())).containsExactly(first);

        var renamed = new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, null,
            List.of(new EntryLineRequest.VaccinationItem(null, "Vắc-xin khác", TODAY.minusMonths(2), null)));
        correct(entry.getId(), new EntryActionRequests.CorrectEntryRequest("Ghi nhầm tên vắc-xin", null, null,
            new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, null, null, null, null, renamed, null, null)));

        assertThat(first.getStatus()).isEqualTo("VOIDED");
        assertThat(vaccinations(entry.getCattle().getId())).filteredOn(v -> "VALID".equals(v.getStatus()))
            .singleElement().satisfies(v -> assertThat(v.getVaccineNameSnapshot()).isEqualTo("Vắc-xin khác"));
    }

    // ---------------------------------------------------------------- V1, V5: hồ sơ bò

    @Test
    void profileShowsEveryDeclarationCategoryInOrderForEveryRole() {
        var vacc = new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, "Sổ người bán",
            List.of(new EntryLineRequest.VaccinationItem(null, FREE_TEXT, null, null)));
        EntryLineRequest cow = withDisease(withVaccination(withReproduction(adultCow("P1"), pregnant(4)), vacc),
            new EntryLineRequest.DiseaseDeclaration(DeclarationStatus.KNOWN, "Viêm phổi tháng 3, đã khỏi"));
        HerdEntry entry = post(cow);

        actAs(technician);
        List<CattleDtos.Declaration> rows = profiles.get(farm.getId(), entry.getCattle().getId()).entry().declarations();
        assertThat(rows).extracting(CattleDtos.Declaration::category).containsExactly("VACCINATION", "DISEASE", "REPRODUCTION");
        assertThat(rows.get(0).status()).isEqualTo("KNOWN");
        assertThat(rows.get(0).informationSource()).isEqualTo("Sổ người bán");
        assertThat(rows.get(0).vaccines()).containsExactly(new CattleDtos.DeclaredVaccine(FREE_TEXT, null));
        assertThat(rows.get(1).description()).isEqualTo("Viêm phổi tháng 3, đã khỏi");
        assertThat(rows.get(2).earlierCalvings()).isEqualTo(1);
        assertThat(rows.get(2).pregnantAtEntry()).isEqualTo("YES");
        assertThat(rows.get(2).estMonthsPregnant()).isEqualTo(4);
    }

    @Test
    void unknownStaysUnknownAndMalesHaveNoReproductionDeclaration() {
        EntryLineRequest bull = withDisease(withVaccination(line("P2", penA, "300", 1),
            new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.UNKNOWN, null, null)), new EntryLineRequest.DiseaseDeclaration(DeclarationStatus.NONE, null));
        HerdEntry entry = post(bull);

        List<CattleDtos.Declaration> rows = profiles.get(farm.getId(), entry.getCattle().getId()).entry().declarations();
        assertThat(rows).extracting(CattleDtos.Declaration::category, CattleDtos.Declaration::status)
            .containsExactly(org.assertj.core.groups.Tuple.tuple("VACCINATION", "UNKNOWN"), org.assertj.core.groups.Tuple.tuple("DISEASE", "NONE"));
        assertThat(rows).allSatisfy(d -> {
            assertThat(d.vaccines()).isNull();
            assertThat(d.description()).isNull();
        });
    }

    // ---------------------------------------------------------------- V3, V4: tab Sinh sản

    @Test
    void declaredPregnancyGuidesTheReproductionTabUntilAPregnancyCheck() {
        HerdEntry entry = post(withReproduction(adultCow("R1"), pregnant(4)));
        Long cowId = entry.getCattle().getId();

        assertThat(declarations.pendingPregnancy(farm.getId(), cowId)).contains(new ReproductionDtos.DeclaredPregnancy(4, entry.getEntryDate()));
        ReproductionDtos.Profile profile = reproduction.profile(farm.getId(), cowId, null, null, null);
        assertThat(profile.declaredPregnancy()).isEqualTo(new ReproductionDtos.DeclaredPregnancy(4, entry.getEntryDate()));
        assertThat(profile.currentPregnancy()).isNull();
        ReproductionDtos.WorklistItem row = reproduction.worklist(farm.getId(), null, null, null, null, null).items().stream()
            .filter(i -> i.cattleId().equals(cowId)).findFirst().orElseThrow();
        assertThat(row.nextAction()).isEqualTo("PREGNANCY_CHECK");
        assertThat(row.declaredPregnancy()).isNotNull();
        assertThat(row.due().date()).isEqualTo(entry.getEntryDate().plusDays(7));

        recordCheck(entry.getCattle(), "NOT_PREGNANT");
        assertThat(declarations.pendingPregnancy(farm.getId(), cowId)).isEmpty();
        assertThat(reproduction.profile(farm.getId(), cowId, null, null, null).declaredPregnancy()).isNull();
    }

    @Test
    void declarationsWithoutAPregnancyAreNeverPending() {
        HerdEntry no = post(withReproduction(adultCow("R2"), new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 0, YesNoUnknown.NO, null, null)));
        HerdEntry unknown = post(withReproduction(adultCow("R3"), new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 0, YesNoUnknown.UNKNOWN, null, null)));
        assertThat(declarations.pendingPregnancy(farm.getId(), no.getCattle().getId())).isEmpty();
        assertThat(declarations.pendingPregnancy(farm.getId(), unknown.getCattle().getId())).isEmpty();
        assertThat(declarations.pendingPregnancies(farm.getId())).isEmpty();
    }

    private void recordCheck(Cattle cow, String result) {
        ReproductionEvent check = new ReproductionEvent();
        check.setCattle(cow);
        check.setType("PREGNANCY_CHECK");
        check.setResult(result);
        check.setEventTime(clock.instant());
        check.setUpdatedAt(clock.instant());
        save(check);
    }
}
