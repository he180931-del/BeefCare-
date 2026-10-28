package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.HerdEntryCorrectionService;
import vn.edu.fpt.beefcare.service.HerdEntryImportService;
import vn.edu.fpt.beefcare.service.HerdEntryPostingService;
import vn.edu.fpt.beefcare.service.HerdEntryVoucherService;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;

/** Herd entry vouchers (phiếu nhập): drafts, Excel import, checks, post, void. Spec section 7. */
@RestController
@RequestMapping("/api/farms/{farmId}/entry-vouchers")
public class HerdEntryVoucherResource {

    private static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final HerdEntryVoucherService vouchers;
    private final HerdEntryPostingService posting;
    private final HerdEntryCorrectionService corrections;
    private final HerdEntryImportService imports;

    public HerdEntryVoucherResource(
        HerdEntryVoucherService vouchers,
        HerdEntryPostingService posting,
        HerdEntryCorrectionService corrections,
        HerdEntryImportService imports
    ) {
        this.vouchers = vouchers;
        this.posting = posting;
        this.corrections = corrections;
        this.imports = imports;
    }

    @GetMapping
    public EntryDtos.VoucherList list(
        @PathVariable Long farmId,
        @RequestParam(required = false) EntryVoucherStatus status,
        @RequestParam(required = false) EntryType type,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to,
        @RequestParam(required = false) Long sellerId
    ) {
        return vouchers.list(farmId, status, type, from, to, sellerId);
    }

    @PostMapping
    public ResponseEntity<EntryDtos.Voucher> create(@PathVariable Long farmId, @Valid @RequestBody EntryVoucherRequest request) {
        EntryDtos.Voucher created = vouchers.create(farmId, request);
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/entry-vouchers/" + created.id())).body(created);
    }

    @GetMapping("/life-stage-proposal")
    public Map<String, Object> lifeStageProposal(
        @PathVariable Long farmId,
        @RequestParam(required = false) LocalDate birthDate,
        @RequestParam(required = false) Integer ageMonths,
        @RequestParam(required = false) LocalDate entryDate
    ) {
        return vouchers.proposeLifeStage(birthDate, ageMonths, entryDate);
    }

    @GetMapping("/import-template")
    public ResponseEntity<byte[]> importTemplate(@PathVariable Long farmId) {
        return ResponseEntity
            .ok()
            .contentType(XLSX)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("beefcare-entry-template.xlsx").build().toString())
            .body(imports.template(farmId));
    }

    @GetMapping("/{id}")
    public EntryDtos.Voucher get(@PathVariable Long farmId, @PathVariable Long id) {
        return vouchers.get(farmId, id);
    }

    @PutMapping("/{id}")
    public EntryDtos.Voucher update(@PathVariable Long farmId, @PathVariable Long id, @Valid @RequestBody EntryVoucherRequest request) {
        return vouchers.update(farmId, id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> discard(@PathVariable Long farmId, @PathVariable Long id, @RequestParam(required = false) Integer expectedVersion) {
        vouchers.discard(farmId, id, expectedVersion);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{id}/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public EntryDtos.ImportResult importLines(
        @PathVariable Long farmId,
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        @RequestParam(defaultValue = "true") boolean commit
    ) {
        try {
            return imports.importLines(farmId, id, file.getBytes(), commit);
        } catch (IOException e) {
            throw DomainException.badRequest(MessageCodes.COM_10, "field", "file");
        }
    }

    @GetMapping("/{id}/checks")
    public EntryDtos.Checks checks(@PathVariable Long farmId, @PathVariable Long id) {
        return vouchers.checks(farmId, id);
    }

    /** Idempotent: posting an already POSTED voucher returns the first result. The Idempotency-Key header is optional. */
    @PostMapping("/{id}/post")
    public EntryDtos.PostResult post(
        @PathVariable Long farmId,
        @PathVariable Long id,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        @RequestBody(required = false) EntryActionRequests.PostRequest request
    ) {
        return posting.post(farmId, id, request);
    }

    @GetMapping("/{id}/void-check")
    public EntryDtos.VoidCheck voidCheck(@PathVariable Long farmId, @PathVariable Long id) {
        return corrections.voidCheck(farmId, id);
    }

    @PostMapping("/{id}/void")
    public EntryDtos.VoidResult voidVoucher(@PathVariable Long farmId, @PathVariable Long id, @Valid @RequestBody EntryActionRequests.VoidRequest request) {
        return corrections.voidVoucher(farmId, id, request);
    }
}
