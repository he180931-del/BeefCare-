package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Header;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Issue;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Result;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Severity;
import vn.edu.fpt.beefcare.service.XlsxSupport.Cell;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Excel import of cattle lines into a DRAFT purchase voucher (GBR-96, UC-FE06-01 AF3): max 200 data rows, 5 MB; each row is
 * validated like a hand-entered line; rows with errors are not added, rows with warnings are added with the defaults shown.
 */
@Service
public class HerdEntryImportService {

    public static final int MAX_ROWS = 200;
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    public static final List<String> COLUMNS = List.of(
        "Ear tag",
        "Breed",
        "Sex",
        "Birth date or Age (months)",
        "Accuracy",
        "Colour and markings",
        "Weight",
        "Weight basis",
        "Pen",
        "Purpose",
        "Unit price",
        "Quarantine until"
    );

    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);

    @PersistenceContext
    private EntityManager em;

    private final FarmAccessService access;
    private final HerdEntryVoucherService vouchers;
    private final HerdEntryRepository entryRepository;
    private final EntryLineValidator lineValidator;
    private final EntryCatalogLookup catalog;
    private final PenOccupancyService occupancy;
    private final AuditService audit;
    private final EntryVoucherMapper mapper;

    public HerdEntryImportService(
        FarmAccessService access,
        HerdEntryVoucherService vouchers,
        HerdEntryRepository entryRepository,
        EntryLineValidator lineValidator,
        EntryCatalogLookup catalog,
        PenOccupancyService occupancy,
        AuditService audit,
        EntryVoucherMapper mapper
    ) {
        this.access = access;
        this.vouchers = vouchers;
        this.entryRepository = entryRepository;
        this.lineValidator = lineValidator;
        this.catalog = catalog;
        this.occupancy = occupancy;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** The BeefCare template: the header row only. */
    public byte[] template(Long farmId) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        return XlsxSupport.write(List.of(COLUMNS));
    }

    /**
     * @param commit false only checks the file (nothing is saved); true adds the rows without errors to the draft
     */
    @Transactional
    public EntryDtos.ImportResult importLines(Long farmId, Long voucherId, byte[] file, boolean commit) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntryVoucher v = vouchers.lockDraftVoucher(farmId, voucherId);
        if (v.getEntryType() != EntryType.PURCHASE) {
            throw DomainException.unprocessable(MessageCodes.COM_10, "field", "entryType");
        }
        if (file == null || file.length == 0 || file.length > MAX_BYTES) {
            throw DomainException.badRequest(MessageCodes.COM_10, "field", "file");
        }
        List<List<Cell>> sheet;
        try {
            sheet = XlsxSupport.read(file);
        } catch (IllegalArgumentException e) {
            throw DomainException.badRequest(MessageCodes.COM_10, "field", "file");
        }
        if (sheet.isEmpty() || !headerMatches(sheet.get(0))) {
            throw DomainException.badRequest(MessageCodes.COM_10, "field", "template");
        }
        List<Integer> dataRows = new ArrayList<>();
        for (int i = 1; i < sheet.size(); i++) {
            if (sheet.get(i).stream().anyMatch(c -> c != null && c.value() != null && !c.value().isBlank())) {
                dataRows.add(i);
            }
        }
        if (dataRows.size() > MAX_ROWS) {
            throw DomainException.badRequest(MessageCodes.COM_10, "field", "rows");
        }

        Lookups lookups = lookups(farmId);
        PricingBasis pricing = v.getPricingBasis() == null ? PricingBasis.PER_KG : v.getPricingBasis();
        Header header = new Header(farmId, EntryType.PURCHASE, v.getEntryDate(), pricing);

        Set<String> tags = new HashSet<>();
        Map<Long, Integer> incoming = new HashMap<>();
        for (HerdEntry l : entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId())) {
            EntryLineRequest d = EntryVoucherRules.dataOf(l);
            if (d.earTagNumber() != null) {
                tags.add(d.earTagNumber().toLowerCase(Locale.ROOT));
            }
            incoming.merge(l.getInitialPen().getId(), 1, Integer::sum);
        }
        int existing = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()).size();

        List<EntryDtos.ImportRow> out = new ArrayList<>();
        List<EntryLineRequest> accepted = new ArrayList<>();
        int valid = 0;
        int warnings = 0;
        int errors = 0;
        int lineNo = existing;
        for (int idx : dataRows) {
            List<Cell> row = sheet.get(idx);
            List<Issue> issues = new ArrayList<>();
            lineNo++;
            EntryLineRequest line = parse(row, idx + 1, v.getEntryDate(), lookups, issues);
            Result r = null;
            if (line != null && issues.stream().noneMatch(i -> i.severity() == Severity.ERROR)) {
                Set<String> rowTags = new HashSet<>(tags);
                r = lineValidator.validate(header, lineNo, line, rowTags, true);
                issues.addAll(r.issues());
                if (!r.hasErrors() && r.resolved().pen() != null) {
                    Pen pen = r.resolved().pen();
                    int used = occupancy.headcount(pen.getId());
                    int already = incoming.getOrDefault(pen.getId(), 0);
                    if (used + already + 1 > pen.getCapacity()) {
                        issues.add(EntryLineValidator.error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_05, "penId", "pen_code", pen.getCode(), "count", already + 1, "free", Math.max(0, pen.getCapacity() - used - already)));
                    } else {
                        incoming.put(pen.getId(), already + 1);
                    }
                }
            }
            boolean hasError = issues.stream().anyMatch(i -> i.severity() == Severity.ERROR);
            boolean hasWarning = issues.stream().anyMatch(i -> i.severity() == Severity.WARNING);
            if (hasError) {
                errors++;
                lineNo--;
            } else {
                if (r.resolved().earTag() != null) {
                    tags.add(r.resolved().earTag().toLowerCase(Locale.ROOT));
                }
                valid++;
                if (hasWarning) {
                    warnings++;
                }
                accepted.add(r.resolved().data());
            }
            out.add(
                new EntryDtos.ImportRow(
                    idx + 1,
                    text(row, 0),
                    text(row, 1),
                    text(row, 2),
                    text(row, 6),
                    text(row, 8),
                    hasError ? "ERROR" : hasWarning ? "WARNING" : "VALID",
                    commit && !hasError,
                    issues.stream().map(mapper::issue).toList()
                )
            );
        }

        EntryDtos.Notice summary = mapper.notice(MessageCodes.FE06_18, "total", dataRows.size(), "valid", valid, "warnings", warnings, "errors", errors);
        EntryDtos.Voucher voucherDto;
        EntryDtos.Notice addedNotice = null;
        if (commit && !accepted.isEmpty()) {
            HerdEntryVoucher updated = vouchers.appendLines(ctx, v, accepted);
            audit.log(ctx, "ENTRY_IMPORT", "HerdEntryVoucher", v.getId(), Map.of("code", v.getCode(), "rows", dataRows.size(), "added", accepted.size(), "errors", errors));
            addedNotice = mapper.notice(MessageCodes.FE06_19, "count", accepted.size(), "voucher_code", v.getCode());
            voucherDto = mapper.voucher(updated, true);
        } else {
            voucherDto = mapper.voucher(v, true);
        }
        return new EntryDtos.ImportResult(dataRows.size(), valid, warnings, errors, commit ? accepted.size() : 0, commit, summary, addedNotice, out, voucherDto);
    }

    // ------------------------------------------------------------------ parsing

    private record Lookups(Map<String, Breed> breeds, Map<String, ProductionPurpose> purposes, Map<String, Pen> pens, ProductionPurpose defaultPurpose) {}

    private Lookups lookups(Long farmId) {
        Map<String, Breed> breeds = new HashMap<>();
        for (Breed b : em.createQuery("select b from Breed b where b.farm.id = :f", Breed.class).setParameter("f", farmId).getResultList()) {
            breeds.putIfAbsent(key(b.getCode()), b);
            breeds.putIfAbsent(key(b.getName()), b);
        }
        Map<String, ProductionPurpose> purposes = new HashMap<>();
        for (ProductionPurpose p : em.createQuery("select p from ProductionPurpose p where p.farm.id = :f", ProductionPurpose.class).setParameter("f", farmId).getResultList()) {
            purposes.putIfAbsent(key(p.getCode()), p);
            purposes.putIfAbsent(key(p.getName()), p);
        }
        Map<String, Pen> pens = new HashMap<>();
        for (Pen p : em.createQuery("select p from Pen p where p.farm.id = :f", Pen.class).setParameter("f", farmId).getResultList()) {
            pens.putIfAbsent(key(p.getCode()), p);
        }
        return new Lookups(breeds, purposes, pens, catalog.defaultUndecidedPurpose(farmId).orElse(null));
    }

    private static String key(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean headerMatches(List<Cell> header) {
        for (int i = 0; i < COLUMNS.size(); i++) {
            String actual = i < header.size() && header.get(i) != null && header.get(i).value() != null ? header.get(i).value().trim() : "";
            if (!actual.equalsIgnoreCase(COLUMNS.get(i))) {
                return false;
            }
        }
        return true;
    }

    private static String text(List<Cell> row, int col) {
        if (col >= row.size() || row.get(col) == null || row.get(col).value() == null) {
            return null;
        }
        String v = row.get(col).value().trim();
        if (row.get(col).numeric() && v.endsWith(".0")) {
            v = v.substring(0, v.length() - 2);
        }
        return v.isEmpty() ? null : v;
    }

    private EntryLineRequest parse(List<Cell> row, int sheetRow, LocalDate entryDate, Lookups lk, List<Issue> issues) {
        String tag = text(row, 0);
        Breed breed = null;
        String breedText = text(row, 1);
        if (breedText == null) {
            issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "breed", "field", "breed"));
        } else if ((breed = lk.breeds().get(key(breedText))) == null) {
            issues.add(rowError(sheetRow, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "breed", "field", "breed"));
        }
        Sex sex = parseSex(text(row, 2));
        if (sex == null) {
            issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, text(row, 2) == null ? MessageCodes.COM_06 : MessageCodes.COM_10, "sex", "field", "sex"));
        }

        LocalDate birth = null;
        Integer age = null;
        BirthDateAccuracy accuracy = parseAccuracy(text(row, 4), issues, sheetRow);
        Cell birthCell = row.size() > 3 ? row.get(3) : null;
        String birthText = text(row, 3);
        if (birthText != null) {
            if (birthCell.numeric()) {
                try {
                    BigDecimal n = new BigDecimal(birthText);
                    if (n.compareTo(BigDecimal.valueOf(240)) <= 0 && n.stripTrailingZeros().scale() <= 0 && n.signum() > 0) {
                        age = n.intValue();
                    } else {
                        birth = EXCEL_EPOCH.plusDays(n.longValue());
                    }
                } catch (RuntimeException e) {
                    issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "birthDate", "field", "birthDate"));
                }
            } else if (birthText.matches("[0-9]{1,3}") && Integer.parseInt(birthText) >= 1 && Integer.parseInt(birthText) <= 240) {
                age = Integer.parseInt(birthText);
            } else {
                LocalDate parsed = parseDate(birthText);
                if (parsed == null) {
                    issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "birthDate", "field", "birthDate"));
                } else {
                    birth = parsed;
                    if (accuracy == null && birthText.length() <= 7) {
                        accuracy = BirthDateAccuracy.ESTIMATED;
                    }
                }
            }
        }

        BigDecimal weight = null;
        String weightText = text(row, 6);
        if (weightText != null) {
            try {
                weight = new BigDecimal(weightText.replace(",", "."));
            } catch (NumberFormatException e) {
                issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "entryWeightKg", "field", "weight"));
            }
        }
        WeightBasis basis = null;
        String basisText = text(row, 7);
        if (basisText != null) {
            String b = key(basisText);
            if (b.equals("measured") || b.equals("m") || b.equals("can")) {
                basis = WeightBasis.MEASURED;
            } else if (b.equals("estimated") || b.equals("ut") || b.equals("e")) {
                basis = WeightBasis.ESTIMATED;
            } else {
                issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "weightBasis", "field", "weightBasis"));
            }
        } else if (weight != null) {
            basis = WeightBasis.ESTIMATED;
            issues.add(EntryLineValidator.warning(sheetRow, HerdEntryCodes.CHK_WEIGHT_BASIS_DEFAULTED, "weightBasis"));
        }

        Pen pen = null;
        String penText = text(row, 8);
        if (penText == null) {
            issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "penId", "field", "receivingPen"));
        } else if ((pen = lk.pens().get(key(penText))) == null) {
            issues.add(rowError(sheetRow, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "penId", "field", "receivingPen"));
        }

        ProductionPurpose purpose = null;
        String purposeText = text(row, 9);
        if (purposeText == null) {
            purpose = lk.defaultPurpose();
            if (purpose == null) {
                issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "purposeId", "field", "productionPurpose"));
            } else {
                issues.add(EntryLineValidator.warning(sheetRow, HerdEntryCodes.CHK_PURPOSE_DEFAULTED, "purposeId"));
            }
        } else if ((purpose = lk.purposes().get(key(purposeText))) == null) {
            issues.add(rowError(sheetRow, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "purposeId", "field", "productionPurpose"));
        }

        Long price = null;
        String priceText = text(row, 10);
        if (priceText != null) {
            try {
                price = new BigDecimal(priceText.replace(",", "")).longValueExact();
            } catch (RuntimeException e) {
                issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "unitPrice", "field", "unitPrice"));
            }
        }
        LocalDate quarantine = null;
        Cell qCell = row.size() > 11 ? row.get(11) : null;
        String qText = text(row, 11);
        if (qText != null) {
            if (qCell.numeric()) {
                try {
                    quarantine = EXCEL_EPOCH.plusDays(new BigDecimal(qText).longValue());
                } catch (RuntimeException e) {
                    issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "quarantineUntil", "field", "quarantineUntil"));
                }
            } else if ((quarantine = parseDate(qText)) == null) {
                issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "quarantineUntil", "field", "quarantineUntil"));
            }
        }
        if (issues.stream().anyMatch(i -> i.severity() == Severity.ERROR)) {
            return null;
        }

        // life stage is not a template column: proposed from the age, ADULT when the age is unknown (shown as a warning)
        LocalDate birthForStage = birth != null ? birth : age != null ? entryDate.minusMonths(age).withDayOfMonth(1) : null;
        LifeStage stage = EntryLineValidator.proposeLifeStage(birthForStage, entryDate);
        if (stage == null) {
            stage = LifeStage.ADULT;
            issues.add(EntryLineValidator.warning(sheetRow, HerdEntryCodes.CHK_LIFE_STAGE_DEFAULTED, "lifeStage"));
        }
        return new EntryLineRequest(
            tag,
            null,
            null,
            text(row, 5),
            breed.getId(),
            sex,
            birth,
            birth == null && age == null ? BirthDateAccuracy.UNKNOWN : accuracy,
            age,
            stage,
            purpose.getId(),
            weight,
            basis,
            pen.getId(),
            price,
            quarantine,
            null,
            null,
            null,
            null,
            null
        );
    }

    private static Issue rowError(int sheetRow, HttpStatus status, String code, String field, Object... kv) {
        return EntryLineValidator.error(sheetRow, status, code, field, kv);
    }

    private static Sex parseSex(String s) {
        if (s == null) {
            return null;
        }
        return switch (key(s)) {
            case "male", "m", "đực", "duc", "bull" -> Sex.MALE;
            case "female", "f", "cái", "cai", "cow" -> Sex.FEMALE;
            default -> null;
        };
    }

    private static BirthDateAccuracy parseAccuracy(String s, List<Issue> issues, int sheetRow) {
        if (s == null) {
            return null;
        }
        try {
            return BirthDateAccuracy.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            issues.add(rowError(sheetRow, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "birthDateAccuracy", "field", "accuracy"));
            return null;
        }
    }

    static LocalDate parseDate(String s) {
        String t = s.trim();
        for (String pattern : List.of("yyyy-MM-dd", "d/M/yyyy", "dd-MM-yyyy", "d.M.yyyy")) {
            try {
                return LocalDate.parse(t, DateTimeFormatter.ofPattern(pattern));
            } catch (DateTimeParseException ignored) {
                // try the next format
            }
        }
        for (String pattern : List.of("yyyy-MM", "M/yyyy", "MM/yyyy")) {
            try {
                return java.time.YearMonth.parse(t, DateTimeFormatter.ofPattern(pattern)).atDay(1);
            } catch (DateTimeParseException ignored) {
                // try the next format
            }
        }
        return null;
    }
}
