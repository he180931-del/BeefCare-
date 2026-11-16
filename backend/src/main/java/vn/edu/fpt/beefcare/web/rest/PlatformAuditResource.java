package vn.edu.fpt.beefcare.web.rest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import vn.edu.fpt.beefcare.service.DomainMessages;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService.AuditActionOption;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService.AuditDetail;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService.AuditPage;

/** UC-FE17-01 / SCR-51 (D34): read-only; there is no route to change or delete an audit entry (NFR-S11). SA only. */
@RestController
@RequestMapping("/api/platform/audit")
public class PlatformAuditResource {

    private final PlatformAuditQueryService service;
    private final DomainMessages messages;

    public PlatformAuditResource(PlatformAuditQueryService service, DomainMessages messages) {
        this.service = service;
        this.messages = messages;
    }

    /** A query value of the wrong type (e.g. {@code from=14/11/2026}, {@code page=abc}) is MSG-COM-10 with the parameter name. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail invalidQuery(MethodArgumentTypeMismatchException failure) {
        Map<String, Object> params = Map.of("field", failure.getName());
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setProperty("code", MessageCodes.COM_10);
        problem.setProperty("params", params);
        problem.setProperty("message", messages.resolve(MessageCodes.COM_10, params));
        return problem;
    }

    @Operation(summary = "A1 – Search the central audit (SCR-51)", description = """
        SA only (403 MSG-COM-01). `from` and `to` are calendar days (yyyy-MM-dd, farm time zone), both included and required \
        (MSG-COM-06); `from` after `to` is MSG-COM-11; more than 12 months is MSG-COM-10 (field dateRange). `actor` matches part \
        of the name or email (case-insensitive); `system=true` keeps the actions done by the system and cannot be combined with \
        `actor`. `action` is a code of A3, `targetType` one of ACCOUNT, PLATFORM_ACCESS, MEMBERSHIP, FARM, PAYMENT, \
        FINANCE_RECORD, TICKET, INTERNAL_REQUEST (other values: MSG-COM-10). Newest first unless `dir=asc`; 20 per page, \
        at most 100. Only the GBR-86 platform actions are listed; farm data (cattle, care, vouchers…) never is. \
        `actor` is null for "System"; `actor.role` is empty for entries written before D34.""")
    @GetMapping
    public AuditPage search(
        @Parameter(description = "First day, yyyy-MM-dd") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @Parameter(description = "Last day, yyyy-MM-dd (included)") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @Parameter(description = "Part of the actor's name or email") @RequestParam(required = false) String actor,
        @Parameter(description = "Only actions done by the system") @RequestParam(defaultValue = "false") boolean system,
        @Parameter(description = "Public action code (A3)") @RequestParam(required = false) String action,
        @Parameter(description = "SCR-51 target type") @RequestParam(required = false) String targetType,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "" + PlatformAuditQueryService.DEFAULT_SIZE) int size,
        @Parameter(description = "desc (default, newest first) or asc") @RequestParam(defaultValue = "desc") String dir
    ) {
        return service.search(from, to, actor, system, action, targetType, page, size, dir);
    }

    @Operation(summary = "A3 – Action codes of the SCR-51 Action filter", description = "SA only. Code and target type of every central audit action.")
    @GetMapping("/actions")
    public List<AuditActionOption> actions() {
        return service.actions();
    }

    @Operation(summary = "A2 – One audit entry (SCR-51 detail)", description = """
        SA only. Allowlisted before / after values only (no reason, ticket body, bank evidence or secret); a value missing \
        on one side is shown as "—". An entry outside the central audit, or a missing one, is 404 MSG-COM-08. \
        `correlationId` is empty for entries written before D34.""")
    @GetMapping("/{id}")
    public AuditDetail get(@PathVariable Long id) {
        return service.get(id);
    }
}
