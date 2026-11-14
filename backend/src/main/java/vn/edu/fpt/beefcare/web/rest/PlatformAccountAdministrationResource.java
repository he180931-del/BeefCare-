package vn.edu.fpt.beefcare.web.rest;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import vn.edu.fpt.beefcare.service.DomainMessages;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccountDetail;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccountPage;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AuditItem;

/** Safe, use-case-specific System Administrator account API; generated entity CRUD stays closed. */
@RestController
@RequestMapping("/api/platform/accounts")
public class PlatformAccountAdministrationResource {
    private final PlatformAccountAdministrationService service;
    private final DomainMessages messages;

    public PlatformAccountAdministrationResource(PlatformAccountAdministrationService service, DomainMessages messages) {
        this.service = service;
        this.messages = messages;
    }

    /** A query or path value of the wrong type (e.g. {@code page=abc}) is MSG-COM-10 with the parameter name (D31). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail invalidQuery(MethodArgumentTypeMismatchException failure) {
        return problem(MessageCodes.COM_10, Map.of("field", failure.getName()), HttpStatus.BAD_REQUEST);
    }

    /** Table III-1: a list that cannot be loaded is MSG-COM-03; a command that cannot be saved is MSG-COM-02 / COM-05. */
    @ExceptionHandler({ DataAccessException.class, TransactionException.class })
    public ProblemDetail storageFailure(RuntimeException failure, jakarta.servlet.http.HttpServletRequest request) {
        if ("GET".equals(request.getMethod())) return problem(MessageCodes.COM_03, Map.of(), HttpStatus.INTERNAL_SERVER_ERROR);
        boolean concurrent = failure instanceof ConcurrencyFailureException || failure.getCause() instanceof ConcurrencyFailureException;
        return problem(concurrent ? MessageCodes.COM_05 : MessageCodes.COM_02, Map.of(), concurrent ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /** A9 / SCR-16 (D31): one page of accounts, Vietnamese name order. */
    @GetMapping
    public AccountPage search(
        @Parameter(description = "Matches the name or email; trimmed, case-insensitive, at most 100 characters")
        @RequestParam(required = false) String q,
        @Parameter(schema = @Schema(type = "string", allowableValues = { "ACTIVE", "SUSPENDED" }))
        @RequestParam(required = false) String status,
        @Parameter(description = "ACTIVE platform role; NONE = no ACTIVE role (a REVOKED one included)",
            schema = @Schema(type = "string", allowableValues = { "NONE", "CS", "PM", "SA" }))
        @RequestParam(required = false) String platformRole,
        // A schema annotation without a type is exported as a string; numeric query values keep their type and defaults.
        @Parameter(schema = @Schema(type = "integer", format = "int32", defaultValue = "0", minimum = "0", maximum = "21474836"))
        @RequestParam(defaultValue = "0") int page,
        @Parameter(schema = @Schema(type = "integer", format = "int32", defaultValue = "20", minimum = "1", maximum = "100"))
        @RequestParam(defaultValue = "20") int size,
        @Parameter(schema = @Schema(type = "string", allowableValues = { "name" }, defaultValue = "name"))
        @RequestParam(defaultValue = "name") String sort,
        @Parameter(schema = @Schema(type = "string", allowableValues = { "asc", "desc" }, defaultValue = "asc"))
        @RequestParam(defaultValue = "asc") String dir
    ) {
        return service.search(q, status, platformRole, page, size, sort, dir);
    }

    /** A10 / SCR-16 account detail (D31). */
    @GetMapping("/{id}")
    public AccountDetail get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/history")
    public List<AuditItem> history(@PathVariable Long id) {
        return service.history(id);
    }

    @PostMapping("/{id}/suspend")
    public AccountDetail suspend(@PathVariable Long id, @Valid @RequestBody AccountChange request) {
        return service.suspend(id, new PlatformAccountAdministrationService.ChangeRequest(request.reason(), request.version()));
    }

    @PostMapping("/{id}/restore")
    public AccountDetail restore(@PathVariable Long id, @Valid @RequestBody AccountChange request) {
        return service.restore(id, new PlatformAccountAdministrationService.ChangeRequest(request.reason(), request.version()));
    }

    @PostMapping("/{id}/platform-access")
    public AccountDetail changeAccess(@PathVariable Long id, @Valid @RequestBody PlatformAccessRequest request) {
        return service.changePlatformAccess(
            id,
            new PlatformAccountAdministrationService.PlatformAccessChange(request.operation(), request.role(), request.reason(), request.version())
        );
    }

    private ProblemDetail problem(String code, Map<String, Object> params, HttpStatus status) {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setProperty("code", code);
        problem.setProperty("params", params);
        problem.setProperty("message", messages.resolve(code, params));
        return problem;
    }

    public record AccountChange(@NotBlank @Size(max = 500) String reason, @NotNull Long version) {}

    public record PlatformAccessRequest(
        @NotBlank @Size(max = 20) String operation,
        @Size(max = 30) String role,
        @NotBlank @Size(max = 500) String reason,
        Long version
    ) {}
}
