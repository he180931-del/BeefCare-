package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** PR-H: correcting entry declarations must never erase independently managed care history. */
@ServiceIntegrationTest
@Transactional
class HerdEntryCorrectionHistoryTest extends HerdEntryTestBase {
    private Vaccine vaccine() {
        Vaccine v = new Vaccine(); v.setFarm(farm); v.setCode("VH" + next()); v.setName("History vaccine " + next());
        v.setDiseasePrevented("LMLM"); v.setWithdrawalInfo("0"); v.setAvailable(true); return save(v);
    }

    private EntryLineRequest.VaccinationItem item(Vaccine vaccine, LocalDate date) {
        return new EntryLineRequest.VaccinationItem(vaccine.getId(), vaccine.getName(), date, "Sổ cũ");
    }

    private EntryLineRequest.VaccinationDeclaration declaration(EntryLineRequest.VaccinationItem... items) {
        return new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, "Khai báo người bán", List.of(items));
    }

    private HerdEntry posted(EntryLineRequest.VaccinationDeclaration vaccination, EntryLineRequest.ReproductionDeclaration reproduction) {
        var input = withReproduction(withVaccination(line("H" + next(), Sex.FEMALE, fattening, penA, "300", 1), vaccination), reproduction);
        var result = createAndPost(List.of(input), 0L, 0L);
        return em.find(HerdEntry.class, result.voucher().lines().get(0).id());
    }

    private EntryActionRequests.Changes changes(EntryLineRequest.VaccinationDeclaration vaccination,
        EntryLineRequest.DiseaseDeclaration disease, EntryLineRequest.ReproductionDeclaration reproduction, Sex sex, LocalDate date) {
        return new EntryActionRequests.Changes(date, null, null, null, null, null, null, null, sex, null, null, null, vaccination, disease, reproduction);
    }

    private void correct(HerdEntry entry, EntryActionRequests.Changes changes) {
        correct(entry.getId(), new EntryActionRequests.CorrectEntryRequest("Sửa khai báo nhập sai", null, null, changes));
    }

    private List<Vaccination> vaccinations(HerdEntry entry) {
        return em.createQuery("select v from Vaccination v where v.cattle.id=:c order by v.id", Vaccination.class)
            .setParameter("c", entry.getCattle().getId()).getResultList();
    }

    private Vaccination other(HerdEntry entry, Vaccine vaccine, String recorder, boolean corrected, String status, LocalDate day) {
        Vaccination v = new Vaccination(); v.setCattle(entry.getCattle()); v.setVaccine(vaccine); v.setVaccinationDate(day);
        v.setEntryTime(clock.instant()); v.setSource("HISTORICAL"); v.setVaccinator(recorder); v.setCorrected(corrected); v.setStatus(status);
        return save(v);
    }

    @Test
    void diseaseOnlyEditPreservesEveryVaccinationIdStatusAndRevision() {
        Vaccine a = vaccine(); HerdEntry entry = posted(declaration(item(a, TODAY.minusMonths(1))), null);
        other(entry, a, "FE09 recorder", false, "VALID", TODAY.minusMonths(1));
        other(entry, a, "Pre-entry declaration", true, "VALID", TODAY.minusMonths(1));
        other(entry, a, "Pre-entry declaration", false, "VOIDED", TODAY.minusMonths(1));
        var ids = vaccinations(entry).stream().map(Vaccination::getId).toList();
        var statuses = vaccinations(entry).stream().map(Vaccination::getStatus).toList();
        correct(entry, changes(null, new EntryLineRequest.DiseaseDeclaration(DeclarationStatus.KNOWN, "Đã khỏi bệnh cũ"), null, null, null));
        assertThat(vaccinations(entry)).extracting(Vaccination::getId).containsExactlyElementsOf(ids);
        assertThat(vaccinations(entry)).extracting(Vaccination::getStatus).containsExactlyElementsOf(statuses);
        assertThat(em.createQuery("select r from RecordRevision r where r.sourceType='Vaccination'", RecordRevision.class).getResultList()).isEmpty();
    }

    @Test
    void changedVaccinationVoidsOnlyMatchedUncorrectedDeclarationsAndKeepsBeforeSnapshot() {
        Vaccine a = vaccine(), b = vaccine(); HerdEntry entry = posted(declaration(item(a, TODAY.minusMonths(2))), null);
        Vaccination owned = vaccinations(entry).get(0);
        Vaccination fe09 = other(entry, a, "FE09 recorder", false, "VALID", owned.getVaccinationDate());
        Vaccination corrected = other(entry, a, "Pre-entry declaration", true, "VALID", owned.getVaccinationDate());
        Vaccination voided = other(entry, a, "Pre-entry declaration", false, "VOIDED", owned.getVaccinationDate());
        Vaccination unmatched = other(entry, a, "Pre-entry declaration", false, "VALID", TODAY.minusDays(1));
        correct(entry, changes(declaration(item(a, TODAY.minusMonths(2)), item(b, TODAY.minusMonths(1))), null, null, null, null));
        assertThat(em.find(Vaccination.class, owned.getId())).isNotNull();
        assertThat(owned.getStatus()).isEqualTo("VOIDED");
        assertThat(owned.getStatusReason()).isEqualTo("Sửa khai báo nhập sai");
        assertThat(fe09.getStatus()).isEqualTo("VALID"); assertThat(corrected.getStatus()).isEqualTo("VALID");
        assertThat(voided.getStatus()).isEqualTo("VOIDED"); assertThat(unmatched.getStatus()).isEqualTo("VALID");
        assertThat(vaccinations(entry)).hasSize(7);
        var revision = em.createQuery("select r from RecordRevision r where r.sourceType='Vaccination' and r.sourceId=:id", RecordRevision.class)
            .setParameter("id", owned.getId()).getSingleResult();
        assertThat(revision.getAction()).isEqualTo("VOID");
        assertThat(revision.getBeforeSnapshot()).contains("\"status\":\"VALID\"", "vaccineName", "vaccinationDate");
        assertThat(revision.getAfterSnapshot()).contains("VOIDED");
        assertThat(em.createQuery("select count(d) from ScheduledDose d where d.cattle.id=:c", Long.class).setParameter("c", entry.getCattle().getId()).getSingleResult()).isZero();
        var lineRevision = em.createQuery("select r from RecordRevision r where r.sourceType='HerdEntry' and r.sourceId=:id", RecordRevision.class).setParameter("id", entry.getId()).getSingleResult();
        assertThat(lineRevision.getBeforeSnapshot()).contains("history", "vaccination");
        assertThat(lineRevision.getAfterSnapshot()).contains("history", b.getName());
    }

    @Test
    void duplicateUndatedItemsRemainMatchedAfterAnEarlierEntryDateCorrection() {
        Vaccine a = vaccine(); var old = declaration(item(a, null), item(a, null)); HerdEntry entry = posted(old, null);
        var owned = vaccinations(entry);
        // These undated rows retain the original entry date after the date-only correction.
        correct(entry, changes(null, null, null, null, TODAY.minusDays(1)));
        assertThat(vaccinations(entry)).extracting(Vaccination::getId).containsExactlyElementsOf(owned.stream().map(Vaccination::getId).toList());
        Vaccination unmatched = other(entry, a, "Pre-entry declaration", false, "VALID", TODAY);
        correct(entry, changes(new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.NONE, null, null), null, null, null, null));
        assertThat(vaccinations(entry)).hasSize(3);
        assertThat(owned).extracting(Vaccination::getStatus).containsExactly("VOIDED", "VOIDED");
        assertThat(unmatched.getStatus()).isEqualTo("VALID");
    }

    @Test
    void aCorrectedDeclaredVaccinationRemainsValidAndOnlyNewDeclarationRowsAreAdded() {
        Vaccine a = vaccine(), b = vaccine(); HerdEntry entry = posted(declaration(item(a, TODAY.minusMonths(2))), null);
        Vaccination managed = vaccinations(entry).get(0); managed.setCorrected(true); em.flush();
        correct(entry, changes(declaration(item(a, TODAY.minusMonths(2)), item(b, TODAY.minusMonths(1))), null, null, null, null));
        assertThat(managed.getStatus()).isEqualTo("VALID"); assertThat(managed.getCorrected()).isTrue();
        assertThat(vaccinations(entry)).hasSize(3);
    }

    @Test
    void parityAndPregnancyChangesReuseOneReminderAndDoNotTouchVaccinations() {
        Vaccine a = vaccine(); HerdEntry entry = posted(declaration(item(a, TODAY.minusMonths(1))),
            new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 2, YesNoUnknown.YES, 4, null));
        Long id = vaccinations(entry).get(0).getId();
        for (var reproduction : List.of(
            new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 3, YesNoUnknown.YES, 5, null),
            new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 3, YesNoUnknown.NO, null, null),
            new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 3, YesNoUnknown.YES, 3, null))) {
            correct(entry, changes(null, null, reproduction, null, null));
            assertThat(entry.getCattle().getDeclaredParity()).isEqualTo(3);
            assertThat(vaccinations(entry)).extracting(Vaccination::getId).containsExactly(id);
        }
        var reminders = em.createQuery("select r from Reminder r where r.cattle.id=:c and r.ruleType='REM-03'", Reminder.class)
            .setParameter("c", entry.getCattle().getId()).getResultList();
        assertThat(reminders).singleElement().satisfies(r -> assertThat(r.getStatus()).isEqualTo("OPEN"));
    }

    @Test
    void changingToMaleClearsDeclaredReproductionAndParityButKeepsVaccinations() {
        Vaccine a = vaccine(); HerdEntry entry = posted(declaration(item(a, TODAY.minusMonths(1))),
            new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 2, YesNoUnknown.YES, 4, null));
        Long id = vaccinations(entry).get(0).getId();
        correct(entry, changes(null, null, null, Sex.MALE, null));
        assertThat(entry.getCattle().getSex()).isEqualTo(Sex.MALE);
        assertThat(entry.getCattle().getDeclaredParity()).isZero();
        assertThat(vaccinations(entry)).extracting(Vaccination::getId).containsExactly(id);
        assertThat(em.createQuery("select count(d) from PreEntryHistoryDeclaration d where d.herdEntry.id=:e and d.category=:category", Long.class)
            .setParameter("e", entry.getId()).setParameter("category", DeclarationCategory.REPRODUCTION).getSingleResult()).isZero();
        correct(entry, changes(null, null, null, Sex.FEMALE, null));
        assertThat(EntryVoucherRules.dataOf(entry).reproduction().status()).isEqualTo(DeclarationStatus.UNKNOWN);
    }

    @Test
    void invalidHistoryIsRejectedWithoutChangingCareRecords() {
        Vaccine a = vaccine(); HerdEntry entry = posted(declaration(item(a, TODAY.minusMonths(1))), null);
        var invalids = List.of(
            changes(declaration(), null, null, null, null),
            changes(null, new EntryLineRequest.DiseaseDeclaration(DeclarationStatus.KNOWN, "  "), null, null, null),
            changes(null, null, new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 0, YesNoUnknown.NO, 3, null), null, null));
        for (var invalid : invalids) assertThatThrownBy(() -> correct(entry, invalid)).isInstanceOf(DomainException.class);
        correct(entry, changes(null, null, null, Sex.MALE, null));
        assertThatThrownBy(() -> correct(entry, changes(null, null, new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.UNKNOWN, null, null, null, null), null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));
        assertThat(vaccinations(entry)).singleElement().satisfies(v -> assertThat(v.getStatus()).isEqualTo("VALID"));
    }

    @Test
    void matchesDuplicateDatedItemsOneToOneAndExcludesOtherSourcesAndStates() {
        Vaccine a = vaccine(); var old = declaration(item(a, TODAY.minusMonths(1)), item(a, TODAY.minusMonths(1)), item(a, null));
        HerdEntry entry = posted(old, null);
        var owned = vaccinations(entry).stream().map(Vaccination::getId).toList();
        other(entry, a, "Pre-entry declaration", true, "VALID", TODAY.minusMonths(1));
        other(entry, a, "Pre-entry declaration", false, "VOIDED", TODAY.minusMonths(1));
        other(entry, a, "FE09", false, "VALID", TODAY.minusMonths(1));
        other(entry, a, "Pre-entry declaration", false, "VALID", TODAY.minusDays(1));
        Vaccination onFarm = other(entry, a, "Pre-entry declaration", false, "VALID", TODAY.minusMonths(1)); onFarm.setSource("ON_FARM");
        assertThat(corrections.declaredVaccinations(entry.getCattle(), old, entry.getEntryDate())).extracting(Vaccination::getId).containsExactlyElementsOf(owned);
        assertThat(corrections.declaredVaccinations(entry.getCattle(), new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.UNKNOWN, null, null), entry.getEntryDate())).isEmpty();
    }

    @Test
    void farmBornGuardRejectsEveryHistoryBlock() {
        HerdEntry entry = posted(null, null);
        entry.getVoucher().setEntryType(EntryType.FARM_BORN);
        em.flush();
        for (var history : List.of(
            changes(new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.UNKNOWN, null, null), null, null, null, null),
            changes(null, new EntryLineRequest.DiseaseDeclaration(DeclarationStatus.NONE, null), null, null, null),
            changes(null, null, new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.UNKNOWN, null, null, null, null), null, null))) {
            assertThatThrownBy(() -> correct(entry, history)).isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_07);
                assertThat(e.getStatus().value()).isEqualTo(422);
            });
        }
    }
}
