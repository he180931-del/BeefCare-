package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.PlatformFarmService;
import vn.edu.fpt.beefcare.service.PlatformFarmService.FarmOverview;
import vn.edu.fpt.beefcare.service.PlatformFarmService.FarmServicePage;
import vn.edu.fpt.beefcare.service.PlatformFarmService.FarmServicePreview;

/** SCR-12 Farm Service Overview (UC-FE02-04) and its popup "Suspend / Restore Farm Service" (UC-FE02-05); PM only. */
@RestController
@RequestMapping("/api/platform/farms")
public class PlatformFarmResource {
    private final PlatformFarmService service;
    private final IdempotencyCommandService commands;

    public PlatformFarmResource(PlatformFarmService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    @GetMapping
    public FarmServicePage overview(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String sort,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return service.overview(q, status, sort, page, size);
    }

    @GetMapping("/{farmId}")
    public FarmServicePreview preview(@PathVariable Long farmId) {
        return service.preview(farmId);
    }

    @PostMapping("/{farmId}/suspend")
    public FarmOverview suspend(@PathVariable Long farmId, @Valid @RequestBody ChangeRequest request, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatform(PlatformRole.PM, "FARM_SERVICE_SUSPEND", key, new KeyedChange(farmId, request), FarmOverview.class, () ->
            service.suspend(farmId, new PlatformFarmService.ServiceChange(request.reason(), request.version()))
        );
    }

    @PostMapping("/{farmId}/restore")
    public FarmOverview restore(@PathVariable Long farmId, @Valid @RequestBody ChangeRequest request, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatform(PlatformRole.PM, "FARM_SERVICE_RESTORE", key, new KeyedChange(farmId, request), FarmOverview.class, () ->
            service.restore(farmId, new PlatformFarmService.ServiceChange(request.reason(), request.version()))
        );
    }

    public record ChangeRequest(@NotBlank @Size(max = 500) String reason, @NotNull Integer version) {}

    /** The request fingerprint names the farm, so one key can never replay a change of another farm. */
    public record KeyedChange(Long farmId, ChangeRequest change) {}
}
