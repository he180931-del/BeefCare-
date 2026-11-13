package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.CareReadService;
import vn.edu.fpt.beefcare.service.HealthCareCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** FE-10 A1–A6 (spec FE-10 §7). Reads need VIEW_HEALTH; every write is Manager-only and replayable through Idempotency-Key. */
@RestController
@RequestMapping("/api/farms/{farmId}/health-cases")
public class HealthCareCommandResource {
    private final HealthCareCommandService commands;
    private final CareReadService reads;

    public HealthCareCommandResource(HealthCareCommandService commands, CareReadService reads) { this.commands = commands; this.reads = reads; }

    /** A1: SCR-36 list with tab counts, paging and sorting. */
    @GetMapping
    public CareDtos.HealthCasePage cases(@PathVariable Long farmId,
                                         @RequestParam(required = false) String tab,
                                         @RequestParam(required = false) String search,
                                         @RequestParam(required = false) String severity,
                                         @RequestParam(required = false) Long penId,
                                         @RequestParam(required = false) LocalDate from,
                                         @RequestParam(required = false) LocalDate to,
                                         @RequestParam(required = false) Integer page,
                                         @RequestParam(required = false) Integer size,
                                         @RequestParam(required = false) String sort,
                                         @RequestParam(required = false) String dir) {
        return reads.healthCases(farmId, tab, search, severity, penId, from, to, page, size, sort, dir);
    }

    /** A2: SCR-37 health tab of one cattle. */
    @GetMapping("/cattle/{cattleId}")
    public CareDtos.HealthProfile cattleHealth(@PathVariable Long farmId, @PathVariable Long cattleId) {
        return reads.healthProfile(farmId, cattleId);
    }

    /** A3: open a case, or add an observation to an OPEN / CHRONIC case of the same cattle. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.HealthCaseResult open(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key,
                                          @Valid @RequestBody CareDtos.OpenHealthCase request) {
        return commands.open(farmId, key, request);
    }

    /** A4: follow-up. */
    @PostMapping("/{caseId}/observations")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.HealthCaseResult followUp(@PathVariable Long farmId, @PathVariable Long caseId,
                                              @RequestHeader("Idempotency-Key") String key,
                                              @Valid @RequestBody CareDtos.FollowUp request) {
        return commands.followUp(farmId, caseId, key, request);
    }

    /** A5: KEEP / TO_CHRONIC / TO_OPEN / CLOSE. */
    @PostMapping("/{caseId}/status")
    public CareDtos.HealthCaseResult status(@PathVariable Long farmId, @PathVariable Long caseId,
                                            @RequestHeader("Idempotency-Key") String key,
                                            @Valid @RequestBody CareDtos.CaseStatus request) {
        return commands.updateStatus(farmId, caseId, key, request);
    }

    /** A6: treatment. */
    @PostMapping("/{caseId}/treatments")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.TreatmentResult treatment(@PathVariable Long farmId, @PathVariable Long caseId,
                                              @RequestHeader("Idempotency-Key") String key,
                                              @Valid @RequestBody CareDtos.TreatmentCommand request) {
        return commands.recordTreatment(farmId, caseId, key, request);
    }
}
