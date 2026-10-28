package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** Excel import into a draft purchase voucher (GBR-96, UC-FE06-01 AF3). */
@ServiceIntegrationTest
@Transactional
class HerdEntryImportServiceTest extends HerdEntryTestBase {

    @Autowired
    HerdEntryImportService imports;

    private static DomainException thrown(Runnable r) {
        try {
            r.run();
        } catch (DomainException e) {
            return e;
        }
        throw new AssertionError("expected a DomainException");
    }

    private static List<Object> row(Object... cells) {
        return new ArrayList<>(Arrays.asList(cells));
    }

    private byte[] workbook(List<List<Object>> dataRows) {
        List<List<Object>> all = new ArrayList<>();
        all.add(new ArrayList<>(HerdEntryImportService.COLUMNS));
        all.addAll(dataRows);
        return XlsxSupport.write(all);
    }

    private EntryDtos.Voucher emptyDraft() {
        return vouchers.create(farm.getId(), purchase(List.of(), 0L, 0L));
    }

    @Test
    void validWarningAndErrorRows() {
        EntryDtos.Voucher draft = emptyDraft();
        byte[] file = workbook(
            List.of(
                row("IMP-1", breed.getName(), "Male", 18, "Estimated", "white face", 300, "Measured", penA.getCode(), fattening.getCode(), 50000, null),
                row("IMP-2", breed.getName(), "Female", null, null, null, 250, null, penA.getCode(), breeding.getCode(), 50000, null),
                row("IMP-3", "No such breed", "Male", 20, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null),
                row("IMP-1", breed.getName(), "Male", 20, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null),
                row("IMP-5", breed.getName(), "Female", 20, null, null, 300, "Measured", penA.getCode(), sire.getCode(), 1, null),
                row("IMP-6", breed.getName(), "Male", 20, null, null, 300, "Measured", "NOPE", fattening.getCode(), 1, null)
            )
        );
        EntryDtos.ImportResult result = imports.importLines(farm.getId(), draft.id(), file, true);

        assertThat(result.total()).isEqualTo(6);
        assertThat(result.valid()).isEqualTo(2);
        assertThat(result.warnings()).isEqualTo(1);
        assertThat(result.errors()).isEqualTo(4);
        assertThat(result.added()).isEqualTo(2);
        assertThat(result.summary().code()).isEqualTo("MSG-FE06-18");
        assertThat(result.summary().params()).containsEntry("total", 6).containsEntry("valid", 2).containsEntry("warnings", 1).containsEntry("errors", 4);
        assertThat(result.addedNotice().code()).isEqualTo("MSG-FE06-19");
        assertThat(result.rows()).extracting(EntryDtos.ImportRow::result).containsExactly("VALID", "WARNING", "ERROR", "ERROR", "ERROR", "ERROR");
        assertThat(result.rows()).extracting(EntryDtos.ImportRow::added).containsExactly(true, true, false, false, false, false);
        assertThat(result.rows().get(1).issues()).extracting(EntryDtos.Issue::code).contains(HerdEntryCodes.CHK_BIRTH_UNKNOWN, HerdEntryCodes.CHK_WEIGHT_BASIS_DEFAULTED);
        assertThat(result.rows().get(2).issues()).extracting(EntryDtos.Issue::code).contains(MessageCodes.COM_08);
        assertThat(result.rows().get(3).issues()).extracting(EntryDtos.Issue::code).contains(HerdEntryCodes.FE05_02);
        assertThat(result.rows().get(4).issues()).extracting(EntryDtos.Issue::code).contains(HerdEntryCodes.FE05_12);

        EntryDtos.Voucher saved = vouchers.get(farm.getId(), draft.id());
        assertThat(saved.status()).isEqualTo(EntryVoucherStatus.DRAFT);
        assertThat(saved.lines()).hasSize(2);
        assertThat(saved.lines().get(1).data().birthDateAccuracy()).isEqualTo(BirthDateAccuracy.UNKNOWN);
        assertThat(count("Cattle")).isZero();

        // the imported lines can be posted; the unknown birth date is stored as UNKNOWN
        EntryDtos.PostResult posted = posting.post(farm.getId(), draft.id(), null);
        Cattle second = em.find(Cattle.class, posted.voucher().lines().get(1).cattleId());
        assertThat(second.getBirthDateAccuracy()).isEqualTo(BirthDateAccuracy.UNKNOWN);
        assertThat(second.getBirthDate()).isNull();
        assertThat(second.getLifeStage()).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.LifeStage.ADULT);
        assertThat(posted.voucher().lines().get(1).estimatedWeight()).isTrue();
    }

    @Test
    void dryRunChangesNothing() {
        EntryDtos.Voucher draft = emptyDraft();
        byte[] file = workbook(List.of(row("DRY-1", breed.getName(), "Male", 18, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null)));
        EntryDtos.ImportResult result = imports.importLines(farm.getId(), draft.id(), file, false);
        assertThat(result.committed()).isFalse();
        assertThat(result.valid()).isEqualTo(1);
        assertThat(result.added()).isZero();
        assertThat(result.addedNotice()).isNull();
        assertThat(vouchers.get(farm.getId(), draft.id()).lines()).isEmpty();
    }

    @Test
    void rowsAreAddedAfterTheExistingLines_andPenCapacityIsCumulative() {
        var tiny = pen(farm, "Z" + next(), 1);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("EX-1", penA, "100", 1)), 0L, 0L));
        byte[] file = workbook(
            List.of(
                row("N-1", breed.getName(), "Male", 12, null, null, 300, "Measured", tiny.getCode(), fattening.getCode(), 1, null),
                row("N-2", breed.getName(), "Male", 12, null, null, 300, "Measured", tiny.getCode(), fattening.getCode(), 1, null),
                row("EX-1", breed.getName(), "Male", 12, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null)
            )
        );
        EntryDtos.ImportResult result = imports.importLines(farm.getId(), draft.id(), file, true);
        assertThat(result.rows()).extracting(EntryDtos.ImportRow::result).containsExactly("VALID", "ERROR", "ERROR");
        assertThat(result.rows().get(1).issues()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE04_05);
        assertThat(result.rows().get(2).issues()).extracting(EntryDtos.Issue::code).contains(HerdEntryCodes.FE05_02);
        assertThat(result.voucher().lines()).hasSize(2);
        assertThat(result.voucher().lines().get(0).data().earTagNumber()).isEqualTo("EX-1");
        assertThat(result.voucher().lines().get(1).data().earTagNumber()).isEqualTo("N-1");
    }

    @Test
    void pensThatDoNotAcceptTheCattleMakeTheRowAnError() {
        var fatteningOnly = pen(farm, "Y" + next(), 5);
        criteria(fatteningOnly, 1, Set.of(PurposeType.FATTENING), null, null, null, null, owner);
        EntryDtos.Voucher draft = emptyDraft();
        byte[] file = workbook(List.of(row("CR-1", breed.getName(), "Female", 30, null, null, 400, "Measured", fatteningOnly.getCode(), breeding.getCode(), 1, null)));
        EntryDtos.ImportResult result = imports.importLines(farm.getId(), draft.id(), file, true);
        assertThat(result.errors()).isEqualTo(1);
        assertThat(result.rows().get(0).issues()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE04_06);
        assertThat(result.voucher().lines()).isEmpty();
    }

    @Test
    void textCellsAndDatesAreAccepted() {
        EntryDtos.Voucher draft = emptyDraft();
        byte[] file = workbook(
            List.of(
                row("TX-1", breed.getCode(), "Đực", "2025-03-15", "Exact", null, "310.5", "UT", penA.getCode(), null, "45,000", "2026-11-30"),
                row("TX-2", breed.getName(), "cái", "03/2025", null, null, 280, "Measured", penA.getCode(), breeding.getCode(), null, null)
            )
        );
        EntryDtos.ImportResult result = imports.importLines(farm.getId(), draft.id(), file, true);
        assertThat(result.errors()).isZero();
        assertThat(result.valid()).isEqualTo(2);
        var l1 = result.voucher().lines().get(0);
        assertThat(l1.data().birthDate()).isEqualTo(java.time.LocalDate.of(2025, 3, 15));
        assertThat(l1.data().purposeId()).isEqualTo(undecided.getId());
        assertThat(l1.unitPrice()).isEqualTo(45_000L);
        assertThat(l1.quarantineUntil()).isEqualTo(java.time.LocalDate.of(2026, 11, 30));
        assertThat(l1.estimatedWeight()).isTrue();
        var l2 = result.voucher().lines().get(1);
        assertThat(l2.data().birthDateAccuracy()).isEqualTo(BirthDateAccuracy.ESTIMATED);
        assertThat(l2.data().sex()).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.Sex.FEMALE);
    }

    @Test
    void limitsAndFileProblems() {
        EntryDtos.Voucher draft = emptyDraft();
        List<List<Object>> many = new ArrayList<>();
        for (int i = 0; i < 201; i++) {
            many.add(row("M-" + i, breed.getName(), "Male", 12, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null));
        }
        assertThat(thrown(() -> imports.importLines(farm.getId(), draft.id(), workbook(many), true)).getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(thrown(() -> imports.importLines(farm.getId(), draft.id(), "not an xlsx".getBytes(), true)).getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(thrown(() -> imports.importLines(farm.getId(), draft.id(), new byte[0], true)).getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(thrown(() -> imports.importLines(farm.getId(), draft.id(), new byte[HerdEntryImportService.MAX_BYTES + 1], true)).getCode()).isEqualTo(MessageCodes.COM_10);
        byte[] wrongHeader = XlsxSupport.write(List.of(List.of("Tag", "Breed")));
        assertThat(thrown(() -> imports.importLines(farm.getId(), draft.id(), wrongHeader, true)).getCode()).isEqualTo(MessageCodes.COM_10);
        // exactly 200 rows is accepted
        assertThat(imports.importLines(farm.getId(), draft.id(), workbook(many.subList(0, 200)), false).total()).isEqualTo(200);
    }

    @Test
    void onlyDraftPurchaseVouchersAcceptImports_andOnlyOwnerOrManager() {
        EntryDtos.PostResult posted = createAndPost(List.of(line("PP-1", penA, "300", 1)), 0L, 0L);
        byte[] file = workbook(List.of(row("PP-2", breed.getName(), "Male", 12, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null)));
        assertThat(thrown(() -> imports.importLines(farm.getId(), posted.voucher().id(), file, true)).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        EntryDtos.Voucher draft = emptyDraft();
        actAs(technician);
        assertThat(thrown(() -> imports.importLines(farm.getId(), draft.id(), file, true)).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> imports.template(farm.getId())).getCode()).isEqualTo(MessageCodes.COM_01);
        actAs(manager);
        assertThat(imports.importLines(farm.getId(), draft.id(), file, true).added()).isEqualTo(1);
    }

    @Test
    void templateHasTheDocumentedColumns() {
        List<List<XlsxSupport.Cell>> sheet = XlsxSupport.read(imports.template(farm.getId()));
        assertThat(sheet).hasSize(1);
        assertThat(sheet.get(0).stream().map(XlsxSupport.Cell::value).toList())
            .containsExactly("Ear tag", "Breed", "Sex", "Birth date or Age (months)", "Accuracy", "Colour and markings", "Weight", "Weight basis", "Pen", "Purpose", "Unit price", "Quarantine until");
    }

    @Test
    void xlsxRoundTripKeepsNumbersAndText() {
        byte[] data = XlsxSupport.write(List.of(row("a & b <c>", 12, 3.5), row(null, "x")));
        List<List<XlsxSupport.Cell>> rows = XlsxSupport.read(data);
        assertThat(rows.get(0).get(0).value()).isEqualTo("a & b <c>");
        assertThat(rows.get(0).get(0).numeric()).isFalse();
        assertThat(rows.get(0).get(1)).isEqualTo(new XlsxSupport.Cell("12", true));
        assertThat(rows.get(0).get(2).value()).isEqualTo("3.5");
        assertThat(rows.get(1).get(0)).isNull();
        assertThat(rows.get(1).get(1).value()).isEqualTo("x");
    }
}
