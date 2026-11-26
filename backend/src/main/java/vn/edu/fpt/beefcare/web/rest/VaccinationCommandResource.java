package vn.edu.fpt.beefcare.web.rest;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.CareReadService;
import vn.edu.fpt.beefcare.service.VaccinationCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * FE-09 – API lịch tiêm phòng và ghi tiêm. Logic nằm ở {@link VaccinationCommandService}.
 * Không còn API hoãn mũi tiêm (D46): bò chưa tiêm được thì sửa lịch để bỏ con đó ra.
 */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class VaccinationCommandResource {

    private final VaccinationCommandService commands;
    private final CareReadService reads;

    public VaccinationCommandResource(VaccinationCommandService commands, CareReadService reads) {
        this.commands = commands;
        this.reads = reads;
    }

    /** A2 – danh sách lịch tiêm kèm từng mũi và cờ đã hoàn thành. */
    @GetMapping("/vaccination-schedules")
    public List<CareDtos.VaccinationScheduleView> schedules(@PathVariable Long farmId) {
        return commands.schedules(farmId);
    }

    /** Lịch sử tiêm của trại, lọc theo từ khóa, vắc-xin, nguồn, khoảng ngày hoặc một con bò. */
    @GetMapping("/vaccinations/history")
    public List<CareDtos.VaccinationHistoryRow> history(
        @PathVariable Long farmId,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Long vaccineId,
        @RequestParam(required = false) String source,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to,
        @RequestParam(required = false) Long cattleId
    ) {
        return reads.vaccinationHistory(farmId, search, vaccineId, source, from, to, cattleId);
    }

    /** A3 – tạo lịch tiêm. */
    @PostMapping("/vaccination-schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.VaccinationScheduleResult createSchedule(
        @PathVariable Long farmId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody CareDtos.CreateVaccinationSchedule request
    ) {
        return commands.createSchedule(farmId, key, request);
    }

    /** A4 – sửa lịch tiêm; lịch đã hoàn thành hoặc đã dừng bị khóa (D46). */
    @PutMapping("/vaccination-schedules/{scheduleId}")
    public CareDtos.VaccinationScheduleResult editSchedule(
        @PathVariable Long farmId,
        @PathVariable Long scheduleId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody CareDtos.EditVaccinationSchedule request
    ) {
        return commands.editSchedule(farmId, scheduleId, key, request);
    }

    /** A5 – dừng lịch tiêm, bắt buộc lý do. */
    @PostMapping("/vaccination-schedules/{scheduleId}/stop")
    public CareDtos.VaccinationScheduleResult stopSchedule(
        @PathVariable Long farmId,
        @PathVariable Long scheduleId,
        @RequestHeader("Idempotency-Key") String key,
        @RequestHeader("If-Match") Integer expectedVersion,
        @RequestBody(required = false) CareDtos.StopVaccinationSchedule request
    ) {
        return commands.stopSchedule(farmId, scheduleId, key, expectedVersion, request == null ? null : request.reason());
    }

    /** A6 – ghi tiêm cho một hoặc nhiều con: 201 khi có ít nhất một con được ghi, 200 khi mọi con đều bị bỏ qua (R-09-10). */
    @ApiResponses({
        @ApiResponse(
            responseCode = "201",
            description = "At least one animal recorded; skipped lists the others",
            content = @Content(schema = @Schema(implementation = CareDtos.VaccinationBatchResult.class))
        ),
        @ApiResponse(
            responseCode = "200",
            description = "Every animal skipped (MSG-FE09-09 / MSG-COM-13); nothing saved",
            content = @Content(schema = @Schema(implementation = CareDtos.VaccinationBatchResult.class))
        ),
    })
    @PostMapping("/vaccinations")
    public ResponseEntity<CareDtos.VaccinationBatchResult> record(
        @PathVariable Long farmId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody CareDtos.RecordVaccinations request
    ) {
        CareDtos.VaccinationBatchResult result = commands.record(farmId, key, request);
        HttpStatus status = result.vaccinatedCount() == 0 ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(result);
    }
}
