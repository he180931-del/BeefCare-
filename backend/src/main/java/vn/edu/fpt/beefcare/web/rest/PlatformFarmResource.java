package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.PlatformFarmService;
import vn.edu.fpt.beefcare.service.PlatformFarmService.FarmOverview;

@RestController
@RequestMapping("/api/platform/farms")
public class PlatformFarmResource {
    private final PlatformFarmService service;
    public PlatformFarmResource(PlatformFarmService service) { this.service = service; }

    @GetMapping
    public Page<FarmOverview> overview(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return service.overview(q, status, page, size);
    }

    @PostMapping("/{farmId}/suspend")
    public FarmOverview suspend(@PathVariable Long farmId, @Valid @RequestBody ChangeRequest request) {
        return service.suspend(farmId, new PlatformFarmService.ServiceChange(request.reason(), request.version()));
    }

    @PostMapping("/{farmId}/restore")
    public FarmOverview restore(@PathVariable Long farmId, @Valid @RequestBody ChangeRequest request) {
        return service.restore(farmId, new PlatformFarmService.ServiceChange(request.reason(), request.version()));
    }

    public record ChangeRequest(@NotBlank @Size(max = 500) String reason, @NotNull Integer version) {}
}
