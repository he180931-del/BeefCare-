package vn.edu.fpt.beefcare.web.rest;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.PlatformFinanceService;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.*;

/** Purpose-built PM finance workflow; generated entity CRUD endpoints remain denied. */
@RestController
@RequestMapping("/api/platform/finance")
public class PlatformFinanceResource {
    private final PlatformFinanceService service;
    private final IdempotencyCommandService commands;
    public PlatformFinanceResource(PlatformFinanceService service, IdempotencyCommandService commands) { this.service = service; this.commands = commands; }

    @GetMapping("/records")
    public Page<RecordDTO> records(
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) Long farmId,
        @RequestParam(required = false) java.time.LocalDate from,
        @RequestParam(required = false) java.time.LocalDate to,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) { return service.search(type, state, category, scope, farmId, from, to, page, size); }

    @GetMapping("/records/{id}")
    public RecordDetail detail(@PathVariable Long id) { return service.detail(id); }

    @GetMapping("/bank-transactions")
    public List<BankTransactionChoice> bankTransactions() { return service.bankTransactions(); }

    @GetMapping("/categories")
    public PlatformFinanceService.FinanceCategories categories() { return service.categories(); }

    // Every changing command is a durable, replayable platform command (GBR-88): same key + same body returns the first result.
    @PostMapping("/records")
    public ResponseEntity<RecordDTO> create(@RequestBody CreateRecord command, @RequestHeader("Idempotency-Key") String key) {
        return ResponseEntity.status(201).body(commands.executePlatform(PlatformRole.PM, "FINANCE_CREATE", key, command, RecordDTO.class, () -> service.create(command)));
    }

    @PutMapping("/records/{id}")
    public RecordDTO update(@PathVariable Long id, @RequestBody VersionedRecord command, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatform(PlatformRole.PM, "FINANCE_UPDATE:" + id, key, command, RecordDTO.class, () -> service.update(id, command));
    }

    @PostMapping("/records/{id}/discard")
    public RecordDTO discard(@PathVariable Long id, @RequestBody VersionedAction command, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatform(PlatformRole.PM, "FINANCE_DISCARD:" + id, key, command, RecordDTO.class, () -> service.discard(id, command));
    }

    @PostMapping("/records/{id}/post")
    public RecordDTO post(@PathVariable Long id, @RequestBody VersionedAction command, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatform(PlatformRole.PM, "FINANCE_POST:" + id, key, command, RecordDTO.class, () -> service.post(id, command));
    }

    @PostMapping("/records/{id}/void")
    public RecordDTO voidPosted(@PathVariable Long id, @RequestBody VersionedAction command, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatform(PlatformRole.PM, "FINANCE_VOID:" + id, key, command, RecordDTO.class, () -> service.voidPosted(id, command));
    }

    @PostMapping("/records/{id}/replacement")
    public ResponseEntity<RecordDTO> replacement(@PathVariable Long id, @RequestBody(required = false) VersionedAction command, @RequestHeader("Idempotency-Key") String key) {
        return ResponseEntity.status(201).body(commands.executePlatform(PlatformRole.PM, "FINANCE_REPLACE:" + id, key, command, RecordDTO.class, () -> service.createReplacement(id, command)));
    }

    @PostMapping("/reports")
    public ResponseEntity<CashReport> runReport(@RequestBody ReportRequest request, @RequestHeader("Idempotency-Key") String key) {
        return ResponseEntity.status(201).body(commands.executePlatform(PlatformRole.PM, "FINANCE_REPORT_RUN", key, request, CashReport.class, () -> service.runReport(request)));
    }

    @GetMapping("/reports/{id}")
    public CashReport report(@PathVariable Long id) { return service.report(id); }

    @GetMapping("/reports/latest")
    public CashReport latestReport() { return service.latestReport(); }

    @GetMapping(value = "/reports/{id}/xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> export(@PathVariable Long id) {
        ExportSnapshot snapshot = service.exportSnapshot(id);
        try {
            byte[] bytes = PlatformFinanceWorkbook.build(snapshot);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=beefcare-cash-report-" + id + ".xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
        } catch (Exception failure) {
            throw new IllegalStateException("Could not create cash report workbook", failure);
        }
    }
}
