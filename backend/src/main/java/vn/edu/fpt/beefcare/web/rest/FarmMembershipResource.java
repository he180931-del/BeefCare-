package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
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

    public FarmMembershipResource(FarmMembershipService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    @GetMapping("/farms/{farmId}/members")
    public List<MemberView> members(@PathVariable Long farmId) {
        return service.listMembers(farmId);
    }

    @GetMapping("/farms/{farmId}/invitations")
    public List<InvitationView> invitations(@PathVariable Long farmId, @RequestParam(required = false) String status) {
        return service.listInvitations(farmId, status);
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
