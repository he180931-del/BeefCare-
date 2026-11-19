package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;
import java.util.List;
import vn.edu.fpt.beefcare.service.CareReadService;
import vn.edu.fpt.beefcare.service.HealthCareCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** FE-10 business commands. Every write is Manager-authorized and replayable through Idempotency-Key. */
@RestController
@RequestMapping("/api/farms/{farmId}/health-cases")
public class HealthCareCommandResource {
    private final HealthCareCommandService commands;
    private final CareReadService reads;

    public HealthCareCommandResource(HealthCareCommandService commands,CareReadService reads) { this.commands = commands; this.reads=reads; }

    @org.springframework.web.bind.annotation.GetMapping
    public List<CareDtos.HealthCaseRow> cases(@PathVariable Long farmId,
        @org.springframework.web.bind.annotation.RequestParam(required=false) String tab,
        @org.springframework.web.bind.annotation.RequestParam(required=false) String search,
        @org.springframework.web.bind.annotation.RequestParam(required=false) String severity,
        @org.springframework.web.bind.annotation.RequestParam(required=false) Long penId,
        @org.springframework.web.bind.annotation.RequestParam(required=false) LocalDate from,
        @org.springframework.web.bind.annotation.RequestParam(required=false) LocalDate to) {
        return reads.healthCases(farmId,tab,search,severity,penId,from,to);
    }

    @org.springframework.web.bind.annotation.GetMapping("/cattle/{cattleId}")
    public CareDtos.HealthProfile cattleHealth(@PathVariable Long farmId,@PathVariable Long cattleId) {
        return reads.healthProfile(farmId,cattleId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.HealthCaseResult open(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key,
                                          @Valid @RequestBody CareDtos.OpenHealthCase request) {
        return commands.open(farmId, key, request);
    }

    @PostMapping("/{caseId}/observations")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.HealthCaseResult followUp(@PathVariable Long farmId, @PathVariable Long caseId,
                                              @RequestHeader("Idempotency-Key") String key,
                                              @Valid @RequestBody CareDtos.FollowUp request) {
        return commands.followUp(farmId, caseId, key, request);
    }

    @PostMapping("/{caseId}/status")
    public CareDtos.HealthCaseResult status(@PathVariable Long farmId, @PathVariable Long caseId,
                                            @RequestHeader("Idempotency-Key") String key,
                                            @Valid @RequestBody CareDtos.CaseStatus request) {
        return commands.updateStatus(farmId, caseId, key, request);
    }

    @PostMapping("/{caseId}/treatments")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.TreatmentResult treatment(@PathVariable Long farmId, @PathVariable Long caseId,
                                              @RequestHeader("Idempotency-Key") String key,
                                              @Valid @RequestBody CareDtos.TreatmentCommand request) {
        return commands.recordTreatment(farmId, caseId, key, request);
    }

    @PostMapping("/{caseId}/closure-correction")
    public CareDtos.HealthCaseResult correctClosure(@PathVariable Long farmId, @PathVariable Long caseId,
                                                     @RequestHeader("Idempotency-Key") String key,
                                                     @Valid @RequestBody CareDtos.CorrectClosure request) {
        return commands.correctClosure(farmId, caseId, key, request);
    }

}
