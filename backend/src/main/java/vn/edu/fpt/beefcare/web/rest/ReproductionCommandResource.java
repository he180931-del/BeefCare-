package vn.edu.fpt.beefcare.web.rest;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.ReproductionCommandService;
import vn.edu.fpt.beefcare.service.ReproductionReadService;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/** FE-11 A1–A6 and FE-12 A1–A8 (specs §7); every mutation carries an Idempotency-Key and the record version. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class ReproductionCommandResource {
    private final ReproductionCommandService commands;
    private final ReproductionReadService reads;

    public ReproductionCommandResource(ReproductionCommandService commands, ReproductionReadService reads) {
        this.commands = commands; this.reads = reads;
    }

    /** FE-11 A1 (SCR-38). {@code tab}: AWAITING_BREEDING | IN_ESTRUS | BRED | PREGNANT | DUE_SOON | POST_CALVING | ALL. */
    @GetMapping("/reproduction-worklist")
    public ReproductionDtos.Worklist worklist(@PathVariable Long farmId, @RequestParam(required = false) String tab, @RequestParam(required = false) String q,
                                              @RequestParam(required = false) Long penId, @RequestParam(required = false) Long breedId,
                                              @RequestParam(required = false) String eligibility) {
        return reads.worklist(farmId, tab, q, penId, breedId, eligibility);
    }

    /** FE-11 A2 / FE-12 A1 (SCR-39). {@code type} filters the timeline (ESTRUS, BREEDING, PREGNANCY_CHECK, PREGNANCY_UPDATE, CALVING). */
    @GetMapping("/cattle/{cattleId}/reproduction-history")
    public ReproductionDtos.Profile history(@PathVariable Long farmId, @PathVariable Long cattleId, @RequestParam(required = false) String type,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reads.profile(farmId, cattleId, type, from, to);
    }

    @PostMapping("/cattle/{cattleId}/estrus-events")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.EventResult estrus(@PathVariable Long farmId, @PathVariable Long cattleId, @RequestHeader("Idempotency-Key") String key,
                                               @RequestBody ReproductionDtos.EstrusCommand request) {
        return commands.recordEstrus(farmId, cattleId, key, request);
    }

    @PostMapping("/cattle/{cattleId}/breeding-events")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.EventResult breeding(@PathVariable Long farmId, @PathVariable Long cattleId, @RequestHeader("Idempotency-Key") String key,
                                                 @RequestBody ReproductionDtos.BreedingCommand request) {
        return commands.recordBreeding(farmId, cattleId, key, request);
    }

    @PostMapping("/cattle/{cattleId}/pregnancy-checks")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.EventResult pregnancyCheck(@PathVariable Long farmId, @PathVariable Long cattleId, @RequestHeader("Idempotency-Key") String key,
                                                       @RequestBody ReproductionDtos.PregnancyCheckCommand request) {
        return commands.recordPregnancyCheck(farmId, cattleId, key, request);
    }

    @PostMapping("/pregnancy-episodes/{episodeId}/updates")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.PregnancyUpdateResult update(@PathVariable Long farmId, @PathVariable Long episodeId, @RequestHeader("Idempotency-Key") String key,
                                                         @RequestBody ReproductionDtos.PregnancyUpdateCommand request) {
        return commands.updatePregnancy(farmId, episodeId, key, request);
    }

    @PostMapping("/calvings")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.CalvingResult calving(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key,
                                                  @RequestBody ReproductionDtos.CalvingCommand request) {
        return commands.recordCalving(farmId, key, request);
    }

    @PostMapping("/reproduction-events/{eventId}/correction")
    public ReproductionDtos.EventResult correct(@PathVariable Long farmId, @PathVariable Long eventId, @RequestHeader("Idempotency-Key") String key,
                                                @RequestBody ReproductionDtos.CorrectEvent request) {
        return commands.correctEvent(farmId, eventId, key, request);
    }

    @PostMapping("/reproduction-events/{eventId}/void")
    public ReproductionDtos.EventResult voidEvent(@PathVariable Long farmId, @PathVariable Long eventId, @RequestHeader("Idempotency-Key") String key,
                                                  @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidEvent(farmId, eventId, key, request);
    }

    @PostMapping("/pregnancy-updates/{updateId}/correction")
    public ReproductionDtos.PregnancyUpdateResult correctUpdate(@PathVariable Long farmId, @PathVariable Long updateId, @RequestHeader("Idempotency-Key") String key,
                                                                @RequestBody ReproductionDtos.CorrectPregnancyUpdate request) {
        return commands.correctPregnancyUpdate(farmId, updateId, key, request);
    }

    @PostMapping("/pregnancy-updates/{updateId}/void")
    public ReproductionDtos.PregnancyUpdateResult voidUpdate(@PathVariable Long farmId, @PathVariable Long updateId, @RequestHeader("Idempotency-Key") String key,
                                                             @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidPregnancyUpdate(farmId, updateId, key, request);
    }

    @PostMapping("/calvings/{calvingId}/correction")
    public ReproductionDtos.CalvingResult correctCalving(@PathVariable Long farmId, @PathVariable Long calvingId, @RequestHeader("Idempotency-Key") String key,
                                                         @RequestBody ReproductionDtos.CorrectCalving request) {
        return commands.correctCalving(farmId, calvingId, key, request);
    }

    @PostMapping("/calvings/{calvingId}/void")
    public ReproductionDtos.CalvingResult voidCalving(@PathVariable Long farmId, @PathVariable Long calvingId, @RequestHeader("Idempotency-Key") String key,
                                                      @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidCalving(farmId, calvingId, key, request);
    }

    @PostMapping("/calf-outcomes/{calfId}/correction")
    public ReproductionDtos.CalfResult correctCalf(@PathVariable Long farmId, @PathVariable Long calfId, @RequestHeader("Idempotency-Key") String key,
                                                   @RequestBody ReproductionDtos.CorrectCalf request) {
        return commands.correctCalf(farmId, calfId, key, request);
    }

    @PostMapping("/calf-outcomes/{calfId}/void")
    public ReproductionDtos.CalfResult voidCalf(@PathVariable Long farmId, @PathVariable Long calfId, @RequestHeader("Idempotency-Key") String key,
                                                @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidCalf(farmId, calfId, key, request);
    }
}
