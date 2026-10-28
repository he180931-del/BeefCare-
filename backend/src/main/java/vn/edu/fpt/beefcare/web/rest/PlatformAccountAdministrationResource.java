package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccountSummary;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AuditItem;

/** Safe, use-case-specific System Administrator account API; generated entity CRUD stays closed. */
@RestController
@RequestMapping("/api/platform/accounts")
public class PlatformAccountAdministrationResource {
    private final PlatformAccountAdministrationService service;

    public PlatformAccountAdministrationResource(PlatformAccountAdministrationService service) {
        this.service = service;
    }

    @GetMapping
    public Page<AccountSummary> search(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return service.search(q, status, page, size);
    }

    @GetMapping("/{id}")
    public AccountSummary get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/history")
    public List<AuditItem> history(@PathVariable Long id) {
        return service.history(id);
    }

    @PostMapping("/{id}/suspend")
    public AccountSummary suspend(@PathVariable Long id, @Valid @RequestBody AccountChange request) {
        return service.suspend(id, new PlatformAccountAdministrationService.ChangeRequest(request.reason(), request.version()));
    }

    @PostMapping("/{id}/restore")
    public AccountSummary restore(@PathVariable Long id, @Valid @RequestBody AccountChange request) {
        return service.restore(id, new PlatformAccountAdministrationService.ChangeRequest(request.reason(), request.version()));
    }

    @PostMapping("/{id}/platform-access")
    public AccountSummary changeAccess(@PathVariable Long id, @Valid @RequestBody PlatformAccessRequest request) {
        return service.changePlatformAccess(
            id,
            new PlatformAccountAdministrationService.PlatformAccessChange(request.operation(), request.role(), request.reason(), request.version())
        );
    }

    public record AccountChange(@NotBlank @Size(max = 500) String reason, @NotNull Long version) {}

    public record PlatformAccessRequest(
        @NotBlank @Size(max = 20) String operation,
        @Size(max = 30) String role,
        @NotBlank @Size(max = 500) String reason,
        Long version
    ) {}
}
