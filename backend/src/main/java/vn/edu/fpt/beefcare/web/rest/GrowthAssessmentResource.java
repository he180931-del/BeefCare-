package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.GrowthAssessmentService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

/** FE-08 – API cân nặng &amp; thể trạng của một con bò. Logic nằm ở {@link GrowthAssessmentService}. */
@RestController
@RequestMapping("/api/farms/{farmId}/cattle/{cattleId}/growth")
public class GrowthAssessmentResource {

    private final GrowthAssessmentService service;
    private final IdempotencyCommandService commands;

    public GrowthAssessmentResource(GrowthAssessmentService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    /** A2 – hồ sơ tăng trưởng (chỉ số + lịch sử đo kèm lịch sử sửa). */
    @GetMapping
    public GrowthDtos.Summary history(
        @PathVariable Long farmId,
        @PathVariable Long cattleId,
        @RequestParam(defaultValue = "90") int windowDays
    ) {
        return service.history(farmId, cattleId, windowDays);
    }

    /** A3 – ghi nhận một lần cân / chấm BCS. Gửi lại cùng {@code Idempotency-Key} không tạo bản ghi thứ hai. */
    @PostMapping
    public GrowthDtos.Record record(
        @PathVariable Long farmId,
        @PathVariable Long cattleId,
        @Valid @RequestBody GrowthDtos.Measurement request,
        @RequestHeader("Idempotency-Key") String key
    ) {
        return commands.execute(
            farmId,
            FarmAction.MANAGE_GROWTH,
            "GROWTH_CREATE:" + cattleId,
            key,
            request,
            GrowthDtos.Record.class,
            () -> service.record(farmId, cattleId, request)
        );
    }

    /** A4 – sửa hoặc xóa (loại trừ mềm) một bản ghi cân. */
    @PostMapping("/{id}/correction")
    public GrowthDtos.Record correct(
        @PathVariable Long farmId,
        @PathVariable Long cattleId,
        @PathVariable Long id,
        @Valid @RequestBody GrowthDtos.Correction request,
        @RequestHeader("Idempotency-Key") String key
    ) {
        return commands.execute(
            farmId,
            FarmAction.MANAGE_GROWTH,
            "GROWTH_CORRECT:" + id,
            key,
            request,
            GrowthDtos.Record.class,
            () -> service.correct(farmId, cattleId, id, request)
        );
    }
}
