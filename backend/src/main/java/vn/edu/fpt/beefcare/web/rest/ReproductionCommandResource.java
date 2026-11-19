package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.ReproductionCommandService;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/** FE-11/12 manager commands; every mutation carries an idempotency key. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class ReproductionCommandResource {
    private final ReproductionCommandService commands;
    public ReproductionCommandResource(ReproductionCommandService commands) { this.commands = commands; }

    @GetMapping("/reproduction-worklist")
    public java.util.List<ReproductionDtos.ReproductionAnimal> worklist(@PathVariable Long farmId) {
        return commands.worklist(farmId);
    }

    @GetMapping("/cattle/{cattleId}/reproduction-history")
    public ReproductionDtos.ReproductionHistory history(@PathVariable Long farmId, @PathVariable Long cattleId) {
        return commands.history(farmId, cattleId);
    }

    @PostMapping("/cattle/{cattleId}/estrus-events")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.EventResult estrus(@PathVariable Long farmId, @PathVariable Long cattleId,
                                               @RequestHeader("Idempotency-Key") String key,
                                               @Valid @RequestBody ReproductionDtos.EventCommand request) {
        return commands.recordEstrus(farmId, key, forPathCattle(cattleId, request));
    }

    @PostMapping("/cattle/{cattleId}/breeding-events")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.EventResult breeding(@PathVariable Long farmId, @PathVariable Long cattleId,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  @Valid @RequestBody ReproductionDtos.EventCommand request) {
        return commands.recordBreeding(farmId, key, forPathCattle(cattleId, request));
    }

    @PostMapping("/cattle/{cattleId}/pregnancy-checks")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.EventResult pregnancyCheck(@PathVariable Long farmId, @PathVariable Long cattleId,
                                                        @RequestHeader("Idempotency-Key") String key,
                                                        @Valid @RequestBody ReproductionDtos.EventCommand request) {
        return commands.recordPregnancyCheck(farmId, key, forPathCattle(cattleId, request));
    }

    @PostMapping("/pregnancy-episodes/{episodeId}/updates")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.PregnancyUpdateResult update(@PathVariable Long farmId, @PathVariable Long episodeId,
                                                         @RequestHeader("Idempotency-Key") String key,
                                                         @Valid @RequestBody ReproductionDtos.PregnancyUpdateCommand request) {
        return commands.updatePregnancy(farmId, episodeId, key, request);
    }

    @PostMapping("/calvings")
    @ResponseStatus(HttpStatus.CREATED)
    public ReproductionDtos.CalvingResult calving(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key,
                                                   @Valid @RequestBody ReproductionDtos.CalvingCommand request) {
        return commands.recordCalving(farmId, key, request);
    }

    @PostMapping("/reproduction-events/{eventId}/correction")
    public ReproductionDtos.EventResult correct(@PathVariable Long farmId, @PathVariable Long eventId,
                                                 @RequestHeader("Idempotency-Key") String key,
                                                 @Valid @RequestBody ReproductionDtos.CorrectEvent request) {
        return commands.correctEvent(farmId, eventId, key, request);
    }

    @PostMapping("/reproduction-events/{eventId}/void")
    public ReproductionDtos.EventResult voidEvent(@PathVariable Long farmId, @PathVariable Long eventId,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  @Valid @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidEvent(farmId, eventId, key, request);
    }

    @PostMapping("/pregnancy-updates/{updateId}/correction")
    public ReproductionDtos.PregnancyUpdateResult correctUpdate(@PathVariable Long farmId, @PathVariable Long updateId,
                                                                 @RequestHeader("Idempotency-Key") String key,
                                                                 @Valid @RequestBody ReproductionDtos.CorrectPregnancyUpdate request) {
        return commands.correctPregnancyUpdate(farmId, updateId, key, request);
    }

    @PostMapping("/pregnancy-updates/{updateId}/void")
    public ReproductionDtos.PregnancyUpdateResult voidUpdate(@PathVariable Long farmId, @PathVariable Long updateId,
                                                              @RequestHeader("Idempotency-Key") String key,
                                                              @Valid @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidPregnancyUpdate(farmId, updateId, key, request);
    }

    @PostMapping("/calvings/{calvingId}/correction")
    public ReproductionDtos.CalvingResult correctCalving(@PathVariable Long farmId, @PathVariable Long calvingId,
                                                          @RequestHeader("Idempotency-Key") String key,
                                                          @Valid @RequestBody ReproductionDtos.CorrectCalving request) {
        return commands.correctCalving(farmId, calvingId, key, request);
    }

    @PostMapping("/calvings/{calvingId}/void")
    public ReproductionDtos.CalvingResult voidCalving(@PathVariable Long farmId, @PathVariable Long calvingId,
                                                       @RequestHeader("Idempotency-Key") String key,
                                                       @Valid @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidCalving(farmId, calvingId, key, request);
    }

    @PostMapping("/calf-outcomes/{calfId}/correction")
    public ReproductionDtos.CalfOutcomeResult correctCalf(@PathVariable Long farmId, @PathVariable Long calfId,
                                                           @RequestHeader("Idempotency-Key") String key,
                                                           @Valid @RequestBody ReproductionDtos.CorrectCalf request) {
        return commands.correctCalf(farmId, calfId, key, request);
    }

    @PostMapping("/calf-outcomes/{calfId}/void")
    public ReproductionDtos.CalfOutcomeResult voidCalf(@PathVariable Long farmId, @PathVariable Long calfId,
                                                        @RequestHeader("Idempotency-Key") String key,
                                                        @Valid @RequestBody ReproductionDtos.VoidRecord request) {
        return commands.voidCalf(farmId, calfId, key, request);
    }

    private ReproductionDtos.EventCommand forPathCattle(Long cattleId, ReproductionDtos.EventCommand request) {
        if (request == null) return null;
        if (request.cattleId() != null && !request.cattleId().equals(cattleId)) throw new IllegalArgumentException("cattleId path and body differ");
        return new ReproductionDtos.EventCommand(cattleId, request.expectedCattleVersion(), request.occurredAt(), request.source(), request.method(),
            request.result(), request.signs(), request.description(), request.performedBy(), request.examiner(), request.linkedEventId(),
            request.sireId(), request.sireSource(), request.externalSireName(), request.sireBreedId(), request.semenBatch(), request.supplier(),
            request.estimatedMonthsPregnant(), request.observer());
    }
}
