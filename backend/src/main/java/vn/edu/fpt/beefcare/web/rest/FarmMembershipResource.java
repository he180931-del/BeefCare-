package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import vn.edu.fpt.beefcare.service.DomainMessages;
import vn.edu.fpt.beefcare.service.MessageCodes;
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
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FarmMembershipService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.*;

/** Farm roster and invitation endpoints. Every operation is scoped and authorized in the service layer. */
@RestController
@RequestMapping("/api")
public class FarmMembershipResource {

    private final FarmMembershipService service;
    private final IdempotencyCommandService commands;
    private final DomainMessages messages;

    public FarmMembershipResource(FarmMembershipService service, IdempotencyCommandService commands, DomainMessages messages) {
        this.service = service;
        this.commands = commands;
        this.messages = messages;
    }

    /** FE-03 field validation uses the spec codes; retain per-field details for the form. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail invalidFields(MethodArgumentNotValidException failure) {
        var errors = failure.getBindingResult().getFieldErrors();
        var required = errors.stream().filter(error -> "NotBlank".equals(error.getCode()) || "NotNull".equals(error.getCode())).findFirst();
        String code = required.isPresent() ? MessageCodes.COM_06 : MessageCodes.COM_10;
        String field = required.orElseGet(() -> errors.getFirst()).getField();
        var params = java.util.Map.<String, Object>of("field", field);
        ProblemDetail problem = commandProblem(code, params, HttpStatus.BAD_REQUEST);
        problem.setProperty("fieldErrors", errors.stream().map(error -> java.util.Map.of("field", error.getField(), "message", java.util.Objects.toString(error.getDefaultMessage(), "Invalid"))).toList());
        return problem;
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail missingHeader(MissingRequestHeaderException failure) {
        return commandProblem(MessageCodes.COM_06, java.util.Map.of("field", failure.getHeaderName()), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail invalidQuery(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException failure) {
        return commandProblem(MessageCodes.COM_10, java.util.Map.of("field", failure.getName()), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    public ProblemDetail storageFailure(RuntimeException failure, jakarta.servlet.http.HttpServletRequest request) {
        if ("GET".equals(request.getMethod())) return commandProblem(MessageCodes.COM_03, java.util.Map.of(), HttpStatus.INTERNAL_SERVER_ERROR);
        boolean concurrent = failure instanceof ConcurrencyFailureException || failure.getCause() instanceof ConcurrencyFailureException;
        return commandProblem(concurrent ? MessageCodes.COM_05 : MessageCodes.COM_02, java.util.Map.of(), concurrent ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ProblemDetail commandProblem(String code, java.util.Map<String, Object> params, HttpStatus status) {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setProperty("code", code); problem.setProperty("params", params);
        problem.setProperty("message", messages.resolve(code, params));
        return problem;
    }

    @GetMapping("/farms/{farmId}/members")
    public List<MemberView> members(@PathVariable Long farmId) {
        return service.listMembers(farmId);
    }

    @GetMapping("/farms/{farmId}/invitations")
    public InvitationPage invitations(@PathVariable Long farmId,
        @io.swagger.v3.oas.annotations.Parameter(schema = @io.swagger.v3.oas.annotations.media.Schema(allowableValues = {"PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"}))
        @RequestParam(required = false) String status,
        // A schema annotation without a type is exported as a string; numeric query values keep their type and defaults (D26).
        @io.swagger.v3.oas.annotations.Parameter(schema = @io.swagger.v3.oas.annotations.media.Schema(type = "integer", format = "int32", defaultValue = "0", minimum = "0", maximum = "21474836"))
        @RequestParam(defaultValue = "0") int page,
        @io.swagger.v3.oas.annotations.Parameter(schema = @io.swagger.v3.oas.annotations.media.Schema(type = "integer", format = "int32", defaultValue = "20", minimum = "1", maximum = "100"))
        @RequestParam(defaultValue = "20") int size,
        @io.swagger.v3.oas.annotations.Parameter(schema = @io.swagger.v3.oas.annotations.media.Schema(type = "string", allowableValues = {"lastSentAt"}, defaultValue = "lastSentAt"))
        @RequestParam(defaultValue = "lastSentAt") String sort,
        @io.swagger.v3.oas.annotations.Parameter(schema = @io.swagger.v3.oas.annotations.media.Schema(type = "string", allowableValues = {"asc", "desc"}, defaultValue = "desc"))
        @RequestParam(defaultValue = "desc") String dir,
        @io.swagger.v3.oas.annotations.Parameter(description = "Exact invitation lookup for UC1; still scoped to this Owner's farm", schema = @io.swagger.v3.oas.annotations.media.Schema(type = "integer", format = "int64", minimum = "1"))
        @RequestParam(required = false) Long invitationId) {
        return service.listInvitations(farmId, status, page, size, sort, dir, invitationId);
    }

    // Owner-only commands: VIEW_FARM_INFORMATION is the Owner-only permission that stays available in every service status
    // (the services still apply the ACTIVE-farm rules of GBR-09). A retry with the same key replays the first result.
    @PostMapping("/farms/{farmId}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationView invite(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody InviteRequest request) {
        return commands.execute(farmId, FarmAction.VIEW_FARM_INFORMATION, "INVITE_SEND", key, request, InvitationView.class, () -> service.invite(farmId, request));
    }

    @PostMapping("/farms/{farmId}/invitations/{invitationId}/resend")
    public InvitationView resend(@PathVariable Long farmId, @PathVariable Long invitationId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody InvitationAction request) {
        record Command(Long invitationId, Integer expectedVersion) {}
        return commands.execute(farmId, FarmAction.VIEW_FARM_INFORMATION, "INVITE_RESEND:" + invitationId, key, new Command(invitationId, request.expectedVersion()), InvitationView.class,
            () -> service.resend(farmId, invitationId, request.expectedVersion()));
    }

    @PostMapping("/farms/{farmId}/invitations/{invitationId}/cancel")
    public InvitationView cancel(@PathVariable Long farmId, @PathVariable Long invitationId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody InvitationAction request) {
        record Command(Long invitationId, Integer expectedVersion) {}
        return commands.execute(farmId, FarmAction.VIEW_FARM_INFORMATION, "INVITE_CANCEL:" + invitationId, key, new Command(invitationId, request.expectedVersion()), InvitationView.class,
            () -> service.cancel(farmId, invitationId, request.expectedVersion()));
    }

    @PutMapping("/farms/{farmId}/members/{membershipId}")
    public MemberView changeMember(@PathVariable Long farmId, @PathVariable Long membershipId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody MemberChange request) {
        record Command(Long membershipId, MemberChange body) {}
        return commands.execute(farmId, FarmAction.VIEW_FARM_INFORMATION, "MEMBER_CHANGE:" + membershipId, key, new Command(membershipId, request), MemberView.class,
            () -> service.changeMember(farmId, membershipId, request));
    }

    @GetMapping("/invitations/accept")
    public InvitationAcceptance preview(@RequestParam String token) {
        return service.preview(token);
    }

    @PostMapping("/invitations/accept")
    public MemberView accept(@Valid @RequestBody AcceptInvitation request) {
        return service.accept(request.token());
    }
}
