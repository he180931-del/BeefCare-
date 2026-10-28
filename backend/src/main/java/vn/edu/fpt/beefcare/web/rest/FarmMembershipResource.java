package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.FarmMembershipService;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.*;

/** Farm roster and invitation endpoints. Every operation is scoped and authorized in the service layer. */
@RestController
@RequestMapping("/api")
public class FarmMembershipResource {

    private final FarmMembershipService service;

    public FarmMembershipResource(FarmMembershipService service) {
        this.service = service;
    }

    @GetMapping("/farms/{farmId}/members")
    public List<MemberView> members(@PathVariable Long farmId) {
        return service.listMembers(farmId);
    }

    @GetMapping("/farms/{farmId}/invitations")
    public List<InvitationView> invitations(@PathVariable Long farmId, @RequestParam(required = false) String status) {
        return service.listInvitations(farmId, status);
    }

    @PostMapping("/farms/{farmId}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationView invite(@PathVariable Long farmId, @Valid @RequestBody InviteRequest request) {
        return service.invite(farmId, request);
    }

    @PostMapping("/farms/{farmId}/invitations/{invitationId}/resend")
    public InvitationView resend(@PathVariable Long farmId, @PathVariable Long invitationId, @Valid @RequestBody InvitationAction request) {
        return service.resend(farmId, invitationId, request.expectedVersion());
    }

    @PostMapping("/farms/{farmId}/invitations/{invitationId}/cancel")
    public InvitationView cancel(@PathVariable Long farmId, @PathVariable Long invitationId, @Valid @RequestBody InvitationAction request) {
        return service.cancel(farmId, invitationId, request.expectedVersion());
    }

    @PutMapping("/farms/{farmId}/members/{membershipId}")
    public MemberView changeMember(@PathVariable Long farmId, @PathVariable Long membershipId, @Valid @RequestBody MemberChange request) {
        return service.changeMember(farmId, membershipId, request);
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
