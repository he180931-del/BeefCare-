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
import vn.edu.fpt.beefcare.service.VaccinationCommandService;
import vn.edu.fpt.beefcare.service.CareReadService;
import java.time.LocalDate;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** FE-09 schedule and deferral commands. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class VaccinationCommandResource {
    private final VaccinationCommandService commands;
    private final CareReadService reads;
    public VaccinationCommandResource(VaccinationCommandService commands,CareReadService reads) { this.commands = commands;this.reads=reads; }

    @org.springframework.web.bind.annotation.GetMapping("/vaccination-schedules")
    public java.util.List<CareDtos.VaccinationScheduleView> schedules(@PathVariable Long farmId) {
        return commands.schedules(farmId);
    }

    @org.springframework.web.bind.annotation.GetMapping("/vaccinations/history")
    public java.util.List<CareDtos.VaccinationHistoryRow> history(@PathVariable Long farmId,
        @org.springframework.web.bind.annotation.RequestParam(required=false) String search,
        @org.springframework.web.bind.annotation.RequestParam(required=false) Long vaccineId,
        @org.springframework.web.bind.annotation.RequestParam(required=false) String source,
        @org.springframework.web.bind.annotation.RequestParam(required=false) LocalDate from,
        @org.springframework.web.bind.annotation.RequestParam(required=false) LocalDate to,
        @org.springframework.web.bind.annotation.RequestParam(required=false) Long cattleId) {
        return reads.vaccinationHistory(farmId,search,vaccineId,source,from,to,cattleId);
    }

    @PostMapping("/vaccination-schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.VaccinationScheduleResult createSchedule(@PathVariable Long farmId,
                                                              @RequestHeader("Idempotency-Key") String key,
                                                              @Valid @RequestBody CareDtos.CreateVaccinationSchedule request) {
        return commands.createSchedule(farmId, key, request);
    }

    @org.springframework.web.bind.annotation.PutMapping("/vaccination-schedules/{scheduleId}")
    public CareDtos.VaccinationScheduleResult editSchedule(@PathVariable Long farmId,@PathVariable Long scheduleId,
                                                            @RequestHeader("Idempotency-Key") String key,
                                                            @Valid @RequestBody CareDtos.EditVaccinationSchedule request) {
        return commands.editSchedule(farmId,scheduleId,key,request);
    }

    @org.springframework.web.bind.annotation.PostMapping("/vaccination-schedules/{scheduleId}/stop")
    public CareDtos.VaccinationScheduleResult stopSchedule(@PathVariable Long farmId,@PathVariable Long scheduleId,
                                                            @RequestHeader("Idempotency-Key") String key,
                                                            @RequestHeader("If-Match") Integer expectedVersion) {
        return commands.stopSchedule(farmId,scheduleId,key,expectedVersion);
    }

    @PostMapping("/scheduled-doses/{doseId}/defer")
    public CareDtos.DoseResult deferDose(@PathVariable Long farmId, @PathVariable Long doseId,
                                         @RequestHeader("Idempotency-Key") String key,
                                         @Valid @RequestBody CareDtos.DeferDose request) {
        return commands.deferDose(farmId, doseId, key, request);
    }

    @PostMapping("/vaccinations")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.VaccinationBatchResult record(@PathVariable Long farmId,
                                                   @RequestHeader("Idempotency-Key") String key,
                                                   @Valid @RequestBody CareDtos.RecordVaccinations request) {
        return commands.record(farmId, key, request);
    }
}
