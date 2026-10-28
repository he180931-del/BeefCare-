package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.HealthCareCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Correction/void commands for individual care records. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class HealthRecordCommandResource {
    private final HealthCareCommandService commands;
    public HealthRecordCommandResource(HealthCareCommandService commands) { this.commands = commands; }

    @PostMapping("/health-observations/{observationId}/correction")
    public CareDtos.RecordStatus correctObservation(@PathVariable Long farmId,@PathVariable Long observationId,
                                                     @RequestHeader("Idempotency-Key") String key,
                                                     @Valid @RequestBody CareDtos.CorrectObservation request) {
        return commands.correctObservation(farmId,observationId,key,request);
    }

    @PostMapping("/treatments/{treatmentId}/correction")
    public CareDtos.RecordStatus correctTreatment(@PathVariable Long farmId,@PathVariable Long treatmentId,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  @Valid @RequestBody CareDtos.CorrectTreatment request) {
        return commands.correctTreatment(farmId,treatmentId,key,request);
    }

    @PostMapping("/health-observations/{observationId}/void")
    public CareDtos.RecordStatus voidObservation(@PathVariable Long farmId, @PathVariable Long observationId,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  @Valid @RequestBody CareDtos.VoidRecord request) {
        return commands.voidObservation(farmId, observationId, key, request);
    }

    @PostMapping("/treatments/{treatmentId}/void")
    public CareDtos.RecordStatus voidTreatment(@PathVariable Long farmId, @PathVariable Long treatmentId,
                                               @RequestHeader("Idempotency-Key") String key,
                                               @Valid @RequestBody CareDtos.VoidRecord request) {
        return commands.voidTreatment(farmId, treatmentId, key, request);
    }
}
