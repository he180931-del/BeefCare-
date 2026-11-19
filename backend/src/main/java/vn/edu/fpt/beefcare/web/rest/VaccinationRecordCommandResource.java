package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.VaccinationCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Correction and void commands for vaccination records. */
@RestController
@RequestMapping("/api/farms/{farmId}/vaccinations/{vaccinationId}")
public class VaccinationRecordCommandResource {
    private final VaccinationCommandService commands;
    public VaccinationRecordCommandResource(VaccinationCommandService commands) { this.commands = commands; }

    @PostMapping("/correction")
    public CareDtos.VaccinationResult correct(@PathVariable Long farmId, @PathVariable Long vaccinationId,
                                              @RequestHeader("Idempotency-Key") String key,
                                              @Valid @RequestBody CareDtos.CorrectVaccination request) {
        return commands.correct(farmId, vaccinationId, key, request);
    }

    @PostMapping("/void")
    public CareDtos.VaccinationResult voidRecord(@PathVariable Long farmId, @PathVariable Long vaccinationId,
                                                 @RequestHeader("Idempotency-Key") String key,
                                                 @Valid @RequestBody CareDtos.VoidRecord request) {
        return commands.voidRecord(farmId, vaccinationId, key, request);
    }
}
