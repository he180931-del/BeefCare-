package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.CashReportSnapshot;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.ManualFinanceBankClaim;
import vn.edu.fpt.beefcare.domain.ManualFinanceHistory;
import vn.edu.fpt.beefcare.domain.ManualFinanceRecord;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceBankClaimRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceHistoryRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.EvidenceDTO;

/** PM-only finance records and cash snapshots; all state changes are audited and version checked. */
@Service
public class PlatformFinanceService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    /** SRS scheduled cleanup (daily 02:00, step 2): cash report snapshots are available for 30 days. */
    private static final long SNAPSHOT_RETENTION_SECONDS = 30L * 24 * 3600;
    private static final String MSG_FE21_09 = "MSG-FE21-09";
    private static final String MSG_FE21_10 = "MSG-FE21-10";
    private final PlatformAccessService access;
    private final ManualFinanceRecordRepository records;
    private final ManualFinanceHistoryRepository history;
    private final ManualFinanceBankClaimRepository claims;
    private final CashReportSnapshotRepository snapshots;
    private final BankTransferEvidenceRepository evidence;
    private final PaymentRepository payments;
    private final FarmRepository farms;
    private final AuditLogRepository auditLogs;
    private final JdbcTemplate jdbc;
    private final FarmClock clock;
    private final ObjectMapper mapper;
    private final List<String> incomeCategories;
    private final List<String> expenseCategories;

    public PlatformFinanceService(
        PlatformAccessService access,
        ManualFinanceRecordRepository records,
        ManualFinanceHistoryRepository history,
        ManualFinanceBankClaimRepository claims,
        CashReportSnapshotRepository snapshots,
        BankTransferEvidenceRepository evidence,
        PaymentRepository payments,
        FarmRepository farms,
        AuditLogRepository auditLogs,
        JdbcTemplate jdbc,
        FarmClock clock,
        ObjectMapper mapper,
        @Value("${beefcare.finance.income-categories:OTHER_INCOME,REFUND,INTEREST}") List<String> incomeCategories,
        @Value("${beefcare.finance.expense-categories:OPERATIONS,MARKETING,SOFTWARE,BANK_FEE,OTHER_EXPENSE}") List<String> expenseCategories
    ) {
        this.access = access;
        this.records = records;
        this.history = history;
        this.claims = claims;
        this.snapshots = snapshots;
        this.evidence = evidence;
        this.payments = payments;
        this.farms = farms;
        this.auditLogs = auditLogs;
        this.jdbc = jdbc;
        this.clock = clock;
        this.mapper = mapper;
        this.incomeCategories = normalize(incomeCategories);
        this.expenseCategories = normalize(expenseCategories);
    }

    @Transactional(readOnly = true)
    public Page<RecordDTO> search(String type, String state, String category, String scope, Long farmId, LocalDate from, LocalDate to, int page, int size) {
        access.requireRole(PlatformRole.PM);
        validateDateRange(from, to, false);
        Specification<ManualFinanceRecord> filter = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> p = new ArrayList<>();
            if (StringUtils.hasText(type)) p.add(cb.equal(cb.upper(root.get("type")), type.trim().toUpperCase(Locale.ROOT)));
            if (StringUtils.hasText(state)) p.add(cb.equal(cb.upper(root.get("state")), state.trim().toUpperCase(Locale.ROOT)));
            if (StringUtils.hasText(category)) p.add(cb.equal(cb.upper(root.get("category")), category.trim().toUpperCase(Locale.ROOT)));
            if (StringUtils.hasText(scope)) p.add(cb.equal(cb.upper(root.get("scope")), scope.trim().toUpperCase(Locale.ROOT)));
            if (farmId != null) p.add(cb.equal(root.get("farm").get("id"), farmId));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("occurredOn"), from));
            if (to != null) p.add(cb.lessThanOrEqualTo(root.get("occurredOn"), to));
            return cb.and(p.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return records.findAll(filter, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)), Sort.by(Sort.Direction.DESC, "occurredOn", "id"))).map(RecordDTO::from);
    }

    @Transactional(readOnly = true)
    public RecordDetail detail(Long id) {
        access.requireRole(PlatformRole.PM);
        ManualFinanceRecord record = records.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return new RecordDetail(RecordDTO.from(record), history.findAllByRecord_IdOrderByChangedAtAscIdAsc(id).stream().map(HistoryDTO::from).toList());
    }

    @Transactional(readOnly = true)
    public List<BankTransactionChoice> bankTransactions() {
        access.requireRole(PlatformRole.PM);
        return evidence.findAllByPaymentIsNullOrderByBankPaidAtDescIdDesc().stream()
            .filter(e -> StringUtils.hasText(e.getAuthOutcome()) && "VERIFIED".equalsIgnoreCase(e.getAuthOutcome()))
            .filter(e -> !claims.existsById(sourceReference(e)))
            .map(e -> new BankTransactionChoice(sourceReference(e), e.getProviderTxnId(), e.getAmount(), e.getBankPaidAt(), e.getTransferDirection(), e.getGateway(), e.getQuoteRef()))
            .toList();
    }

    @Transactional(readOnly = true)
    public FinanceCategories categories() {
        access.requireRole(PlatformRole.PM);
        return new FinanceCategories(incomeCategories, expenseCategories);
    }

    @Transactional
    public RecordDTO create(CreateRecord request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        validate(request == null ? null : request.fields(), request == null ? null : request.sourceEvidenceId());
        ManualFinanceRecord record = new ManualFinanceRecord();
        record.setRecordCode(nextCode());
        record.setState("DRAFT");
        record.setCreatedAt(clock.now());
        record.setCreatedBy(actor);
        applyFields(record, request.fields());
        resolveSource(record, request.sourceEvidenceId()); // reject a conflicting bank source before anything is persisted
        records.saveAndFlush(record);
        claimSource(record);
        record.setUpdatedAt(clock.now());
        records.saveAndFlush(record);
        writeHistory(record, actor, "CREATE", null, RecordDTO.from(record), null);
        audit(actor, "FINANCE_DRAFT_CREATE", record, null, "DRAFT");
        return RecordDTO.from(record);
    }

    @Transactional
    public RecordDTO update(Long id, VersionedRecord request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        if (request == null || request.fields() == null) throw DomainException.required("record");
        ManualFinanceRecord record = lock(id);
        requireVersion(record, request.version());
        if (!"DRAFT".equalsIgnoreCase(record.getState())) throw DomainException.conflict(MessageCodes.COM_05);
        validate(request.fields(), request.sourceEvidenceId());
        RecordDTO before = RecordDTO.from(record);
        String oldReference = record.getSourceReference();
        applyFields(record, request.fields());
        resolveSource(record, request.sourceEvidenceId());
        claimSource(record);
        if (oldReference != null && !oldReference.equals(record.getSourceReference())) claims.findById(oldReference).ifPresent(claims::delete);
        record.setUpdatedAt(clock.now());
        records.saveAndFlush(record);
        writeHistory(record, actor, "EDIT", before, RecordDTO.from(record), null);
        audit(actor, "FINANCE_DRAFT_EDIT", record, before.state(), record.getState());
        return RecordDTO.from(record);
    }

    @Transactional
    public RecordDTO discard(Long id, VersionedAction request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        ManualFinanceRecord record = lock(id);
        requireVersion(record, request == null ? null : request.version());
        if (!"DRAFT".equalsIgnoreCase(record.getState())) throw DomainException.conflict(MessageCodes.COM_05);
        RecordDTO before = RecordDTO.from(record);
        record.setState("DISCARDED");
        record.setDiscardedAt(clock.now());
        record.setDiscardedBy(actor);
        records.saveAndFlush(record);
        claims.findFirstByRecord_Id(id).ifPresent(claims::delete);
        writeHistory(record, actor, "DISCARD", before, RecordDTO.from(record), request.reason());
        audit(actor, "FINANCE_DRAFT_DISCARD", record, before.state(), record.getState());
        return RecordDTO.from(record);
    }

    @Transactional
    public RecordDTO post(Long id, VersionedAction request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        ManualFinanceRecord record = lock(id);
        requireVersion(record, request == null ? null : request.version());
        if (!"DRAFT".equalsIgnoreCase(record.getState())) throw DomainException.conflict(MessageCodes.COM_05);
        validateFields(record);
        validateSource(record, null);
        if ("BANK_TRANSACTION".equalsIgnoreCase(record.getSourceType())) {
            ManualFinanceBankClaim claim = claims.findById(record.getSourceReference()).orElseThrow(() -> DomainException.conflict("MSG-FE21-08"));
            if (!claim.getRecord().getId().equals(record.getId())) throw DomainException.conflict("MSG-FE21-08");
        }
        RecordDTO before = RecordDTO.from(record);
        record.setState("POSTED");
        record.setPostedAt(clock.now());
        record.setPostedBy(actor);
        record.setUpdatedAt(clock.now());
        records.saveAndFlush(record);
        writeHistory(record, actor, "POST", before, RecordDTO.from(record), null);
        audit(actor, "FINANCE_RECORD_POST", record, before.state(), record.getState());
        return RecordDTO.from(record);
    }

    @Transactional
    public RecordDTO voidPosted(Long id, VersionedAction request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        if (request == null || !StringUtils.hasText(request.reason())) throw DomainException.required("reason");
        if (request.reason().trim().length() > 500) throw DomainException.invalid("reason");
        ManualFinanceRecord record = lock(id);
        requireVersion(record, request.version());
        if (!"POSTED".equalsIgnoreCase(record.getState())) throw DomainException.conflict(MessageCodes.COM_05);
        RecordDTO before = RecordDTO.from(record);
        record.setState("VOID");
        record.setVoidedAt(clock.now());
        record.setVoidedBy(actor);
        record.setVoidReason(request.reason().trim());
        record.setUpdatedAt(clock.now());
        records.saveAndFlush(record);
        claims.findFirstByRecord_Id(id).ifPresent(claims::delete);
        writeHistory(record, actor, "VOID", before, RecordDTO.from(record), request.reason().trim());
        audit(actor, "FINANCE_RECORD_VOID", record, before.state(), record.getState());
        return RecordDTO.from(record);
    }

    @Transactional
    public RecordDTO createReplacement(Long voidedId, VersionedAction request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        ManualFinanceRecord old = records.findById(voidedId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!"VOID".equalsIgnoreCase(old.getState())) throw DomainException.conflict(MessageCodes.COM_05);
        ManualFinanceRecord replacement = new ManualFinanceRecord();
        replacement.setRecordCode(nextCode());
        replacement.setType(old.getType());
        replacement.setCategory(old.getCategory());
        replacement.setAmountVnd(old.getAmountVnd());
        replacement.setOccurredOn(old.getOccurredOn());
        replacement.setState("DRAFT");
        replacement.setFarm(old.getFarm());
        replacement.setScope(old.getScope());
        replacement.setDocumentNumber(old.getDocumentNumber());
        replacement.setDescription(old.getDescription());
        replacement.setSourceType("MANUAL");
        replacement.setCreatedAt(clock.now());
        replacement.setCreatedBy(actor);
        replacement.setReplacementRecord(old);
        records.saveAndFlush(replacement);
        writeHistory(replacement, actor, "REPLACEMENT_CREATE", null, RecordDTO.from(replacement), null);
        audit(actor, "FINANCE_REPLACEMENT_CREATE", replacement, null, "DRAFT");
        return RecordDTO.from(replacement);
    }

    @Transactional
    public CashReport runReport(ReportRequest request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        if (request == null) throw DomainException.required("criteria");
        validateDateRange(request.dateFrom(), request.dateTo(), true);
        String sourceFilter = StringUtils.hasText(request.sourceFilter()) ? request.sourceFilter().trim().toUpperCase(Locale.ROOT) : "ALL";
        if (!List.of("ALL", "RECEIPTS_ONLY", "MANUAL_ONLY").contains(sourceFilter)) throw DomainException.invalid("sourceFilter");
        Farm selectedFarm = request.farmId() == null ? null : farms.findById(request.farmId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<ReportLine> lines = new ArrayList<>();
        if (!"MANUAL_ONLY".equals(sourceFilter)) addReceipts(lines, request.dateFrom(), request.dateTo(), selectedFarm);
        if (!"RECEIPTS_ONLY".equals(sourceFilter)) addManual(lines, request.dateFrom(), request.dateTo(), selectedFarm);
        ReportSummary summary = summarize(lines);
        CashReportSnapshot snapshot = new CashReportSnapshot();
        snapshot.setAsOf(clock.now());
        snapshot.setDateFrom(request.dateFrom());
        snapshot.setDateTo(request.dateTo());
        snapshot.setTotals(summary.netCashFlow());
        snapshot.setPmUser(actor);
        snapshot.setFarm(selectedFarm);
        snapshot.setSourceFilter(sourceFilter);
        snapshot.setCriteriaJson(json(new ReportCriteria(request.dateFrom(), request.dateTo(), selectedFarm == null ? null : selectedFarm.getId(), sourceFilter)));
        snapshot.setSummaryJson(json(summary));
        snapshot.setDetailsJson(json(lines));
        snapshot.setExpiresAt(clock.now().plusSeconds(SNAPSHOT_RETENTION_SECONDS));
        CashReportSnapshot saved = snapshots.saveAndFlush(snapshot);
        audit(actor, "CASH_REPORT_RUN", "CashReportSnapshot", saved.getId(), selectedFarm, Map.of("dateFrom", request.dateFrom(), "dateTo", request.dateTo(), "sourceFilter", sourceFilter));
        return report(saved);
    }

    @Transactional(readOnly = true)
    public CashReport report(Long id) {
        access.requireRole(PlatformRole.PM);
        return snapshots.findById(id).filter(s -> s.getExpiresAt().isAfter(clock.now())).map(this::report)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.GONE, "Cash report snapshot expired or not found"));
    }

    @Transactional(readOnly = true)
    public List<ReportLine> exportRows(Long id) {
        access.requireRole(PlatformRole.PM);
        CashReportSnapshot snapshot = snapshots.findById(id).filter(s -> s.getExpiresAt().isAfter(clock.now()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.GONE, "Cash report snapshot expired or not found"));
        try { return mapper.readValue(snapshot.getDetailsJson(), new TypeReference<>() {}); }
        catch (Exception malformed) { throw new IllegalStateException("Stored cash report snapshot is invalid", malformed); }
    }

    @Transactional(readOnly = true)
    public List<RecordDTO> recordsForExport(Long id) {
        access.requireRole(PlatformRole.PM);
        CashReportSnapshot snapshot = snapshots.findById(id).filter(s -> s.getExpiresAt().isAfter(clock.now()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.GONE, "Cash report snapshot expired or not found"));
        try { return mapper.readValue(snapshot.getDetailsJson(), new TypeReference<>() {}); }
        catch (Exception malformed) { throw new IllegalStateException("Stored cash report snapshot is invalid", malformed); }
    }

    @Transactional(readOnly = true)
    public ExportSnapshot exportSnapshot(Long id) {
        access.requireRole(PlatformRole.PM);
        CashReportSnapshot snapshot = snapshots.findById(id).filter(s -> s.getExpiresAt().isAfter(clock.now()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.GONE, "Cash report snapshot expired or not found"));
        try {
            return new ExportSnapshot(snapshot.getId(), snapshot.getDateFrom(), snapshot.getDateTo(), snapshot.getAsOf(),
                mapper.readValue(snapshot.getCriteriaJson(), ReportCriteria.class),
                mapper.readValue(snapshot.getSummaryJson(), ReportSummary.class),
                mapper.readValue(snapshot.getDetailsJson(), new TypeReference<List<ReportLine>>() {}));
        } catch (Exception malformed) { throw new IllegalStateException("Stored cash report snapshot is invalid", malformed); }
    }

    @Transactional(readOnly = true)
    public boolean hasPostedManualIncome(String reference) {
        return records.existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase(reference, "INCOME", "POSTED");
    }

    private void addReceipts(List<ReportLine> lines, LocalDate from, LocalDate to, Farm selectedFarm) {
        evidence.findAllByReviewStatusIgnoreCaseOrderByBankPaidAtAscIdAsc("ACCEPTED").stream()
            .filter(e -> e.getPayment() != null && "PAID".equalsIgnoreCase(e.getPayment().getState()))
            .filter(e -> inRange(e.getBankPaidAt().atZone(BUSINESS_ZONE).toLocalDate(), from, to))
            .filter(e -> selectedFarm == null || selectedFarm.getId().equals(e.getPayment().getSubscription().getFarm().getId()))
            .forEach(e -> {
                Payment p = e.getPayment(); Farm farm = p.getSubscription().getFarm();
                lines.add(new ReportLine("SUBSCRIPTION_RECEIPT", p.getReceiptCode(), "FARM", farm.getId(), farm.getName(), "INCOME", "SUBSCRIPTION", "Gói " + p.getDurationYears() + " năm", p.getAmountVnd(), e.getBankPaidAt().atZone(BUSINESS_ZONE).toLocalDate(), "PAID", sourceReference(e)));
            });
    }

    private void addManual(List<ReportLine> lines, LocalDate from, LocalDate to, Farm selectedFarm) {
        records.findAll().stream()
            .filter(r -> "POSTED".equalsIgnoreCase(r.getState()) && inRange(r.getOccurredOn(), from, to))
            .filter(r -> selectedFarm == null ? true : r.getFarm() != null && selectedFarm.getId().equals(r.getFarm().getId()))
            .forEach(r -> lines.add(new ReportLine("MANUAL_FINANCE", r.getRecordCode(), r.getScope(), r.getFarm() == null ? null : r.getFarm().getId(), r.getFarm() == null ? "General platform" : r.getFarm().getName(), r.getType(), r.getCategory(), r.getDescription(), r.getAmountVnd(), r.getOccurredOn(), r.getState(), r.getSourceReference())));
    }

    private ReportSummary summarize(List<ReportLine> rows) {
        BigDecimal receiptIncome = ZERO, otherIncome = ZERO, expense = ZERO;
        Map<String, ScopeTotals> scopes = new LinkedHashMap<>();
        for (ReportLine row : rows) {
            ScopeTotals current = scopes.computeIfAbsent(row.scope() + ":" + row.farmId(), ignored -> new ScopeTotals(row.scope(), row.farmId(), row.farmName(), ZERO, ZERO, ZERO));
            if ("INCOME".equals(row.direction())) {
                if ("SUBSCRIPTION_RECEIPT".equals(row.sourceType())) receiptIncome = receiptIncome.add(row.amount()); else otherIncome = otherIncome.add(row.amount());
                scopes.put(row.scope() + ":" + row.farmId(), new ScopeTotals(current.scope(), current.farmId(), current.farmName(),
                    current.subscriptionReceipts().add("SUBSCRIPTION_RECEIPT".equals(row.sourceType()) ? row.amount() : ZERO),
                    current.otherIncome().add("SUBSCRIPTION_RECEIPT".equals(row.sourceType()) ? ZERO : row.amount()), current.expense()));
            } else {
                expense = expense.add(row.amount());
                scopes.put(row.scope() + ":" + row.farmId(), new ScopeTotals(current.scope(), current.farmId(), current.farmName(), current.subscriptionReceipts(), current.otherIncome(), current.expense().add(row.amount())));
            }
        }
        BigDecimal income = receiptIncome.add(otherIncome);
        ScopeTotals platform = new ScopeTotals("PLATFORM", null, "Platform total", receiptIncome, otherIncome, expense);
        scopes.put("PLATFORM", platform);
        Map<LocalDate, BigDecimal> daily = new java.util.TreeMap<>();
        rows.stream().filter(row -> "INCOME".equals(row.direction())).forEach(row -> daily.merge(row.cashDate(), row.amount(), BigDecimal::add));
        List<DailyTotals> dailyIncome = daily.entrySet().stream().map(e -> new DailyTotals(e.getKey(), e.getValue())).toList();
        return new ReportSummary(receiptIncome, otherIncome, income, expense, income.subtract(expense), List.copyOf(scopes.values()), dailyIncome, "Cash flow only; not statutory profit.");
    }

    private void validate(RecordFields f, Long sourceEvidenceId) {
        if (f == null) throw DomainException.required("record");
        ManualFinanceRecord probe = new ManualFinanceRecord();
        probe.setType(f.type()); probe.setCategory(f.category()); probe.setAmountVnd(f.amountVnd()); probe.setOccurredOn(f.occurredOn());
        probe.setScope(f.scope()); probe.setFarm(f.farmId() == null ? null : farms.findById(f.farmId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
        probe.setDocumentNumber(f.documentNumber()); probe.setDescription(f.description()); probe.setSourceType(f.sourceType());
        validateFields(probe);
        if ("BANK_TRANSACTION".equalsIgnoreCase(f.sourceType()) && sourceEvidenceId == null) throw DomainException.required("sourceEvidenceId");
        if (sourceEvidenceId != null && !"BANK_TRANSACTION".equalsIgnoreCase(f.sourceType())) throw DomainException.invalid("sourceEvidenceId");
    }

    private void validateFields(ManualFinanceRecord r) {
        if (!StringUtils.hasText(r.getType())) throw DomainException.required("type");
        String type = r.getType().trim().toUpperCase(Locale.ROOT);
        if (!List.of("INCOME", "EXPENSE").contains(type)) throw DomainException.invalid("type");
        if (!StringUtils.hasText(r.getCategory())) throw DomainException.required("category");
        List<String> allowed = "INCOME".equals(type) ? incomeCategories : expenseCategories;
        if (!allowed.contains(r.getCategory().trim().toUpperCase(Locale.ROOT))) throw DomainException.badRequest(MSG_FE21_10, "field", "category", "category", r.getCategory().trim(), "type", type);
        BigDecimal amount = r.getAmountVnd();
        if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 0) throw DomainException.badRequest(MSG_FE21_09, "field", "amountVnd");
        if (r.getOccurredOn() == null || r.getOccurredOn().isAfter(clock.today())) throw DomainException.invalid("occurredOn");
        if (!StringUtils.hasText(r.getScope())) throw DomainException.required("scope");
        String scope = r.getScope().trim().toUpperCase(Locale.ROOT);
        if (!List.of("GENERAL", "FARM").contains(scope)) throw DomainException.invalid("scope");
        if ("FARM".equals(scope) != (r.getFarm() != null)) throw DomainException.invalid("farmId");
        if (r.getDocumentNumber() != null && r.getDocumentNumber().length() > 100) throw DomainException.invalid("documentNumber");
        if (r.getDescription() != null && r.getDescription().length() > 500) throw DomainException.invalid("description");
        String source = r.getSourceType() == null ? "MANUAL" : r.getSourceType().trim().toUpperCase(Locale.ROOT);
        if (!List.of("MANUAL", "BANK_TRANSACTION").contains(source)) throw DomainException.invalid("sourceType");
        if ("MANUAL".equals(source) && StringUtils.hasText(r.getSourceReference())) throw DomainException.invalid("sourceReference");
    }

    private void validateSource(ManualFinanceRecord record, Long selectedEvidenceId) {
        if (!"BANK_TRANSACTION".equalsIgnoreCase(record.getSourceType())) return;
        BankTransferEvidence item = selectedEvidenceId == null
            ? evidence.findAllByPaymentIsNullOrderByBankPaidAtDescIdDesc().stream().filter(e -> sourceReference(e).equals(record.getSourceReference())).findFirst().orElse(null)
            : evidence.findById(selectedEvidenceId).orElse(null);
        if (item == null) throw DomainException.conflict("MSG-FE21-08");
        String reference = sourceReference(item);
        ManualFinanceBankClaim claim = claims.findById(reference).orElse(null);
        if (claim != null && !claim.getRecord().getId().equals(record.getId())) throw DomainException.conflict("MSG-FE21-08");
        if ("INCOME".equalsIgnoreCase(record.getType()) && hasPostedManualIncome(reference) &&
            (record.getId() == null || !records.existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase(record.getSourceReference(), "INCOME", "DRAFT"))) {
            throw DomainException.conflict("MSG-FE21-08");
        }
        if (item.getPayment() != null || !"VERIFIED".equalsIgnoreCase(item.getAuthOutcome())) throw DomainException.conflict("MSG-FE21-08");
        if ("INCOME".equalsIgnoreCase(record.getType()) && (!"IN".equalsIgnoreCase(item.getTransferDirection()) || StringUtils.hasText(item.getQuoteRef()))) {
            throw DomainException.conflict("MSG-FE21-08");
        }
        if ("EXPENSE".equalsIgnoreCase(record.getType()) && !"OUT".equalsIgnoreCase(item.getTransferDirection())) throw DomainException.conflict("MSG-FE21-08");
    }

    /** Copies amount and date from the selected bank transaction and rejects an unusable or already recognized one (GBR-84). */
    private void resolveSource(ManualFinanceRecord record, Long evidenceId) {
        if (!"BANK_TRANSACTION".equalsIgnoreCase(record.getSourceType())) return;
        BankTransferEvidence item = evidence.findById(evidenceId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        record.setSourceReference(sourceReference(item));
        record.setAmountVnd(item.getAmount());
        record.setOccurredOn(item.getBankPaidAt().atZone(BUSINESS_ZONE).toLocalDate());
        validateSource(record, evidenceId);
    }

    private void claimSource(ManualFinanceRecord record) {
        if (!"BANK_TRANSACTION".equalsIgnoreCase(record.getSourceType())) return;
        String reference = record.getSourceReference();
        ManualFinanceBankClaim existing = claims.findById(reference).orElse(null);
        if (existing != null) {
            if (!record.getId().equals(existing.getRecord().getId())) throw DomainException.conflict("MSG-FE21-08");
        } else {
            ManualFinanceBankClaim claim = new ManualFinanceBankClaim();
            claim.setSourceReference(reference); claim.setRecord(record); claim.setClaimedAt(clock.now());
            try { claims.saveAndFlush(claim); }
            catch (DataIntegrityViolationException concurrentClaim) { throw DomainException.conflict("MSG-FE21-08"); }
        }
    }

    private void applyFields(ManualFinanceRecord r, RecordFields f) {
        r.setType(f.type().trim().toUpperCase(Locale.ROOT));
        r.setCategory(f.category().trim().toUpperCase(Locale.ROOT));
        r.setAmountVnd(f.amountVnd());
        r.setOccurredOn(f.occurredOn());
        r.setScope(f.scope().trim().toUpperCase(Locale.ROOT));
        r.setFarm(f.farmId() == null ? null : farms.findById(f.farmId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
        r.setDocumentNumber(blankToNull(f.documentNumber()));
        r.setDescription(blankToNull(f.description()));
        r.setSourceType(f.sourceType() == null ? "MANUAL" : f.sourceType().trim().toUpperCase(Locale.ROOT));
        if (!"BANK_TRANSACTION".equals(r.getSourceType())) r.setSourceReference(null);
    }

    private ManualFinanceRecord lock(Long id) { return records.lockById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }
    private void requireVersion(ManualFinanceRecord r, Long expected) {
        if (expected == null || !expected.equals(r.getVersion())) throw DomainException.conflict(MessageCodes.COM_05);
    }

    private void writeHistory(ManualFinanceRecord record, vn.edu.fpt.beefcare.domain.AppUser actor, String action, RecordDTO before, RecordDTO after, String reason) {
        ManualFinanceHistory row = new ManualFinanceHistory(); row.setRecord(record); row.setActor(actor); row.setAction(action); row.setChangedAt(clock.now());
        row.setReason(reason); row.setBeforeJson(before == null ? null : json(before)); row.setAfterJson(json(after)); history.save(row);
    }

    private void audit(vn.edu.fpt.beefcare.domain.AppUser actor, String action, ManualFinanceRecord record, String before, String after) {
        audit(actor, action, "ManualFinanceRecord", record.getId(), record.getFarm(), Map.of("recordCode", record.getRecordCode(), "statusBefore", before == null ? "" : before, "statusAfter", after == null ? "" : after));
    }

    private void audit(vn.edu.fpt.beefcare.domain.AppUser actor, String action, String targetType, Long targetId, Farm farm, Object details) {
        AuditLog entry = new AuditLog(); entry.setActor(actor); entry.setAction(action); entry.setTargetType(targetType); entry.setTargetId(targetId); entry.setFarm(farm); entry.setLoggedAt(clock.now()); entry.setDetails(json(details)); auditLogs.save(entry);
    }

    private String nextCode() {
        jdbc.update("UPDATE manual_finance_code_counter SET last_value=last_value+1 WHERE id=1");
        Long value = jdbc.queryForObject("SELECT last_value FROM manual_finance_code_counter WHERE id=1", Long.class);
        return String.format(Locale.ROOT, "FR-%04d", value);
    }

    private CashReport report(CashReportSnapshot snapshot) {
        try { return new CashReport(snapshot.getId(), mapper.readValue(snapshot.getCriteriaJson(), ReportCriteria.class),
            mapper.readValue(snapshot.getSummaryJson(), ReportSummary.class), snapshot.getAsOf(), snapshot.getExpiresAt()); }
        catch (Exception malformed) { throw new IllegalStateException("Stored cash report snapshot is invalid", malformed); }
    }

    private String json(Object value) { try { return mapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException("Could not serialize finance snapshot", e); } }
    public static String sourceReference(BankTransferEvidence e) { return e.getProvider() + ":" + e.getEnvironment() + ":" + e.getAccountNamespace() + ":" + e.getProviderTxnId(); }
    private static boolean inRange(LocalDate date, LocalDate from, LocalDate to) { return !date.isBefore(from) && !date.isAfter(to); }
    private void validateDateRange(LocalDate from, LocalDate to, boolean required) {
        if (from == null || to == null) { if (required) throw DomainException.required("dateFrom and dateTo"); return; }
        if (to.isBefore(from) || to.isAfter(clock.today()) || from.isBefore(to.minusMonths(24))) throw DomainException.invalid("dateRange");
    }
    private static List<String> normalize(List<String> values) { return values.stream().filter(StringUtils::hasText).map(v -> v.trim().toUpperCase(Locale.ROOT)).distinct().toList(); }
    private static String blankToNull(String value) { return StringUtils.hasText(value) ? value.trim() : null; }

    public record CreateRecord(RecordFields fields, Long sourceEvidenceId) {}
    public record VersionedRecord(RecordFields fields, Long sourceEvidenceId, Long version) {}
    public record VersionedAction(Long version, String reason) {}
    public record RecordFields(String type, String category, BigDecimal amountVnd, LocalDate occurredOn, String scope, Long farmId,
        String documentNumber, String description, String sourceType) {}
    public record RecordDTO(Long id, String recordCode, String type, String category, BigDecimal amountVnd, LocalDate occurredOn,
        String scope, Long farmId, String farmName, String documentNumber, String description, String sourceType,
        String sourceReference, String state, Long version, Instant createdAt, String createdBy, Instant postedAt,
        String postedBy, Instant voidedAt, String voidedBy, String voidReason, Long replacementRecordId) {
        static RecordDTO from(ManualFinanceRecord r) { return new RecordDTO(r.getId(), r.getRecordCode(), r.getType(), r.getCategory(), r.getAmountVnd(),
            r.getOccurredOn(), r.getScope(), r.getFarm() == null ? null : r.getFarm().getId(), r.getFarm() == null ? null : r.getFarm().getName(),
            r.getDocumentNumber(), r.getDescription(), r.getSourceType(), r.getSourceReference(), r.getState(), r.getVersion(), r.getCreatedAt(),
            r.getCreatedBy() == null ? null : r.getCreatedBy().getFullName(), r.getPostedAt(), r.getPostedBy() == null ? null : r.getPostedBy().getFullName(),
            r.getVoidedAt(), r.getVoidedBy() == null ? null : r.getVoidedBy().getFullName(), r.getVoidReason(), r.getReplacementRecord() == null ? null : r.getReplacementRecord().getId()); }
    }
    public record HistoryDTO(Long id, String action, Instant changedAt, String actor, String reason, String beforeJson, String afterJson) {
        static HistoryDTO from(ManualFinanceHistory h) { return new HistoryDTO(h.getId(), h.getAction(), h.getChangedAt(), h.getActor().getFullName(), h.getReason(), h.getBeforeJson(), h.getAfterJson()); }
    }
    public record RecordDetail(RecordDTO record, List<HistoryDTO> history) {}
    public record BankTransactionChoice(String sourceReference, Long transactionId, BigDecimal amount, Instant bankPaidAt, String direction, String bank, String paymentReference) {}
    public record ReportRequest(LocalDate dateFrom, LocalDate dateTo, Long farmId, String sourceFilter) {}
    public record ReportCriteria(LocalDate dateFrom, LocalDate dateTo, Long farmId, String sourceFilter) {}
    public record ScopeTotals(String scope, Long farmId, String farmName, BigDecimal subscriptionReceipts, BigDecimal otherIncome, BigDecimal expense) {}
    public record DailyTotals(LocalDate date, BigDecimal income) {}
    public record ReportSummary(BigDecimal subscriptionReceipts, BigDecimal otherIncome, BigDecimal totalIncome, BigDecimal totalExpense, BigDecimal netCashFlow, List<ScopeTotals> scopes, List<DailyTotals> dailyIncome, String note) {}
    public record FinanceCategories(List<String> income, List<String> expense) {}
    public record ReportLine(String sourceType, String code, String scope, Long farmId, String farmName, String direction, String category, String description, BigDecimal amount, LocalDate cashDate, String status, String sourceReference) {}
    public record CashReport(Long id, ReportCriteria criteria, ReportSummary summary, Instant generatedAt, Instant expiresAt) {}
    public record ExportSnapshot(Long id, LocalDate dateFrom, LocalDate dateTo, Instant asOf, ReportCriteria criteria, ReportSummary summary, List<ReportLine> lines) {}
}
