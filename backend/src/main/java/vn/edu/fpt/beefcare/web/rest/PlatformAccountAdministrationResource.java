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
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.DomainMessages;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccountDetail;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccountPage;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccessHistoryItem;

/** Safe, use-case-specific System Administrator account API; generated entity CRUD stays closed. */
@RestController
@RequestMapping("/api/platform/accounts")
public class PlatformAccountAdministrationResource {
    private final PlatformAccountAdministrationService service;
    private final IdempotencyCommandService commands;
    private final DomainMessages messages;

    public PlatformAccountAdministrationResource(
        PlatformAccountAdministrationService service,
        IdempotencyCommandService commands,
        DomainMessages messages
    ) {
        this.service = service;
        this.commands = commands;
        this.messages = messages;
    }

    /** A query or path value of the wrong type (e.g. {@code page=abc}) is MSG-COM-10 with the parameter name (D31). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail invalidQuery(MethodArgumentTypeMismatchException failure) {
        return problem(MessageCodes.COM_10, Map.of("field", failure.getName()), HttpStatus.BAD_REQUEST);
    }

    /** A12 body (D32): a missing reason / version is MSG-COM-06, a reason over 500 characters MSG-COM-10, with the field name. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail invalidFields(MethodArgumentNotValidException failure) {
        var errors = failure.getBindingResult().getFieldErrors();
        var required = errors.stream().filter(error -> "NotBlank".equals(error.getCode()) || "NotNull".equals(error.getCode())).findFirst();
        String code = required.isPresent() ? MessageCodes.COM_06 : MessageCodes.COM_10;
        String field = required.orElseGet(errors::getFirst).getField();
        return problem(code, Map.of("field", field), HttpStatus.BAD_REQUEST);
    }

    /** A12 without an Idempotency-Key header (D32): MSG-COM-06 naming the header. */
    @ExceptionHandler(MissingRequestHeaderException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail missingHeader(MissingRequestHeaderException failure) {
        return problem(MessageCodes.COM_06, Map.of("field", failure.getHeaderName()), HttpStatus.BAD_REQUEST);
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

    /** A11 / popup "Role history" (D33): platform access changes of the account, newest first (at most 100). */
    @GetMapping("/{id}/history")
    public List<AccessHistoryItem> history(@PathVariable Long id) {
        return service.history(id);
    }

    /**
     * A12 / UC-FE03-08 (D32): suspend an ACTIVE account. The same key and body replay the first result (GBR-88); the same
     * key with other data is MSG-COM-19. Errors: COM-01, COM-08 (404), COM-06 / COM-10 (`reason`), FE03-17, FE03-20,
     * COM-05, COM-02.
     */
    @PostMapping("/{id}/suspend")
    public AccountDetail suspend(@PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody AccountChange request) {
        return commands.executePlatform(PlatformRole.SA, "ACCOUNT_SUSPEND", key, new KeyedChange(id, request), AccountDetail.class, () ->
            service.suspend(id, new PlatformAccountAdministrationService.ChangeRequest(request.reason(), request.version()))
        );
    }

    /** A12 / UC-FE03-08 (D32): restore a SUSPENDED account; revoked roles and memberships stay revoked. Errors as suspend. */
    @PostMapping("/{id}/restore")
    public AccountDetail restore(@PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody AccountChange request) {
        return commands.executePlatform(PlatformRole.SA, "ACCOUNT_RESTORE", key, new KeyedChange(id, request), AccountDetail.class, () ->
            service.restore(id, new PlatformAccountAdministrationService.ChangeRequest(request.reason(), request.version()))
        );
    }

    /**
     * A13 / UC-FE03-09 (D33): grant, change, revoke or restore CS / PM / SA access. The same key and body replay the first
     * result (GBR-88); the same key with other data is MSG-COM-19. Errors: COM-01, COM-08 (404), COM-06 / COM-10
     * (`operation`, `role`, `reason`), FE03-22, FE03-18, FE03-20, COM-05, FE03-17, COM-02.
     */
    @PostMapping("/{id}/platform-access")
    public AccountDetail changeAccess(@PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PlatformAccessRequest request) {
        return commands.executePlatform(PlatformRole.SA, "PLATFORM_ACCESS", key, new KeyedAccessChange(id, request), AccountDetail.class, () ->
            service.changePlatformAccess(
                id,
                new PlatformAccountAdministrationService.AccessChangeRequest(request.operation(), request.role(), request.reason(), request.version())
            )
        );
    }

    private ProblemDetail problem(String code, Map<String, Object> params, HttpStatus status) {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setProperty("code", code);
        problem.setProperty("params", params);
        problem.setProperty("message", messages.resolve(code, params));
        return problem;
    }

    public record AccountChange(
        // The 5-character minimum is checked in the service, after the permission checks (D32), so it is not a bean constraint.
        @Schema(description = "Trimmed; 5–500 characters with at least 5 that are not spaces (Table III-1)") @NotBlank @Size(max = 500) String reason,
        @Schema(description = "The account version shown in A10") @NotNull Long version
    ) {}

    /** The request fingerprint names the account, so one key can never replay a change of another account. */
    public record KeyedChange(Long accountId, AccountChange change) {}

    public record PlatformAccessRequest(
        @Schema(allowableValues = { "GRANT", "CHANGE", "REVOKE", "RESTORE" }) @NotBlank @Size(max = 20) String operation,
        @Schema(description = "CS, PM or SA; required for GRANT and CHANGE, ignored otherwise") @Size(max = 30) String role,
        // The 5-character minimum is checked in the service, after the permission checks (D33), so it is not a bean constraint.
        @Schema(description = "Trimmed; 5–500 characters with at least 5 that are not spaces (Table III-1)") @NotBlank @Size(max = 500) String reason,
        @Schema(description = "platformAccessVersion shown in A10; null or 0 when the account has no access yet") Long version
    ) {}

    /** The request fingerprint names the account, so one key can never replay a change of another account. */
    public record KeyedAccessChange(Long accountId, PlatformAccessRequest change) {}
}
