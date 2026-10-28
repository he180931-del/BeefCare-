package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.HerdEntryCorrectionService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.PendingCalfService;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;

/** Correct / void one herd entry (popup "Correct / Void Herd Entry") and the pending farm-born calves. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class HerdEntryResource {

    private final HerdEntryCorrectionService corrections;
    private final PendingCalfService calves;
    private final IdempotencyCommandService commands;

    public HerdEntryResource(HerdEntryCorrectionService corrections, PendingCalfService calves, IdempotencyCommandService commands) {
        this.corrections = corrections;
        this.calves = calves;
        this.commands = commands;
    }

    @PatchMapping("/herd-entries/{entryId}")
    public EntryDtos.CorrectionResult correct(
        @PathVariable Long farmId,
        @PathVariable Long entryId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody EntryActionRequests.CorrectEntryRequest request
    ) {
        return commands.execute(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS, "HERD_ENTRY_CORRECT:" + entryId, key, request, EntryDtos.CorrectionResult.class, () -> corrections.correct(farmId, entryId, request));
    }

    @GetMapping("/herd-entries/{entryId}/void-check")
    public EntryDtos.VoidCheckRow voidCheck(@PathVariable Long farmId, @PathVariable Long entryId) {
        return corrections.entryVoidCheck(farmId, entryId);
    }

    @PostMapping("/herd-entries/{entryId}/void")
    public EntryDtos.EntryVoidResult voidEntry(
        @PathVariable Long farmId,
        @PathVariable Long entryId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody EntryActionRequests.VoidRequest request
    ) {
        return commands.execute(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS, "HERD_ENTRY_VOID:" + entryId, key, request, EntryDtos.EntryVoidResult.class, () -> corrections.voidEntry(farmId, entryId, request));
    }

    @GetMapping("/pending-calves")
    public List<EntryDtos.PendingCalf> pendingCalves(@PathVariable Long farmId) {
        return calves.pending(farmId);
    }

    @PostMapping("/pending-calves/{calfId}/died-before-registration")
    public EntryDtos.PendingCalf diedBeforeRegistration(
        @PathVariable Long farmId,
        @PathVariable Long calfId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody EntryActionRequests.DiedBeforeRegistrationRequest request
    ) {
        return commands.execute(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS, "PENDING_CALF_DIED:" + calfId, key, request, EntryDtos.PendingCalf.class, () -> calves.diedBeforeRegistration(farmId, calfId, request.reason()));
    }
}
