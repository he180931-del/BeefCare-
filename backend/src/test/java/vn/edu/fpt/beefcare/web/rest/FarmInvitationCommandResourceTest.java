package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** Secured HTTP contract; committed transactions/email are exercised separately. */
@ServiceIntegrationTest
@Transactional
class FarmInvitationCommandResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ActionLinkSigner signer;

    protected ResultActions invite(AppUser actor, Farm farm, Map<String, Object> body, String key) throws Exception {
        return mvc.perform(post("/api/farms/{id}/invitations", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content(mapper.writeValueAsBytes(body)));
    }

    protected Map<String, Object> body(String email, String role, Integer days) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email); body.put("role", role);
        if (days != null) body.put("validityDays", days);
        return body;
    }

    protected JsonNode created(AppUser actor, Farm farm, String email, String role, Integer days, String key) throws Exception {
        return mapper.readTree(invite(actor, farm, body(email, role, days), key).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString());
    }

    @ParameterizedTest
    @ValueSource(ints = {3, 7, 14})
    void savesTheChosenFieldsAndReturnsTheSameInvitationOnRead(int days) throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode result = created(owner, farm, invitee.getEmail().toUpperCase(java.util.Locale.ROOT), "TECHNICIAN", days, "send-" + days);
        assertThat(result.path("email").asText()).isEqualTo(invitee.getEmail());
        assertThat(result.path("role").asText()).isEqualTo("TECHNICIAN");
        assertThat(result.path("status").asText()).isEqualTo("PENDING");
        assertThat(result.path("validityDays").asInt()).isEqualTo(days);
        assertThat(result.path("hasAccount").asBoolean()).isTrue();
        assertThat(result.toString()).doesNotContain("token", "nonce", "password");
        em.flush(); em.clear();
        FarmInvitation stored = em.find(FarmInvitation.class, result.path("id").asLong());
        assertThat(stored.getInvitedBy().getId()).isEqualTo(owner.getId());
        assertThat(stored.getFarm().getId()).isEqualTo(farm.getId());
        assertThat(Duration.between(stored.getLastSentAt(), stored.getExpiresAt())).isEqualTo(Duration.ofDays(days));
        assertThat(stored.getTokenHash()).isEqualTo(signer.hash(signer.bearer("FARM_INVITATION", stored.getId(), stored.getTokenNonce())));
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
        String read = mvc.perform(get("/api/farms/{id}/invitations", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(read).path("items").get(0)).isEqualTo(result);
    }

    @Test
    void defaultsToSevenDaysAndAllowsAnAddressWithoutAnAccount() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode result = created(owner, farm, "new@example.test", "MANAGER", null, "default");
        assertThat(result.path("validityDays").asInt()).isEqualTo(7);
        assertThat(result.has("hasAccount")).isTrue();
        assertThat(result.path("hasAccount").asBoolean()).isFalse();
    }

    @Test
    void validatesRequiredFieldsAndAllowedValuesWithoutCreatingAnything() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        invite(owner, farm, body("", "MANAGER", 7), "empty").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        invite(owner, farm, body("abc", "MANAGER", 7), "invalid").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        invite(owner, farm, body("a@" + "x".repeat(248) + ".test", "MANAGER", 7), "long").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        invite(owner, farm, body("new@example.test", null, 7), "role").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        invite(owner, farm, body("new@example.test", "OWNER", 7), "owner").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        invite(owner, farm, body("new@example.test", "MANAGER", 4), "days").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        assertThat(count("FarmInvitation", farm)).isZero();
    }

    @Test
    void distinguishesActiveAndInactiveMembershipWithoutCreatingAnInvitation() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser target = memberWithRole(farm, FarmRole.MANAGER);
        invite(owner, farm, body(target.getEmail(), "TECHNICIAN", 7), "active").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE03-02"));
        FarmMembership member = em.createQuery("select m from FarmMembership m where m.user.id=:u", FarmMembership.class).setParameter("u", target.getId()).getSingleResult();
        member.setStatus("INACTIVE"); em.flush();
        invite(owner, farm, body(target.getEmail(), "TECHNICIAN", 7), "inactive").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-21")).andExpect(jsonPath("$.params.membershipId").value(member.getId()))
            .andExpect(jsonPath("$.params.email").value(target.getEmail()));
        assertThat(count("FarmInvitation", farm)).isZero();
        assertThat(member.getRole()).isEqualTo("MANAGER"); assertThat(member.getStatus()).isEqualTo("INACTIVE");
    }

    @Test
    void duplicateEmailIsCaseInsensitiveAndOffersTheExistingInvitation() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode first = created(owner, farm, "pending@example.test", "MANAGER", 7, "one");
        invite(owner, farm, body("PENDING@EXAMPLE.TEST", "TECHNICIAN", 14), "two").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-03")).andExpect(jsonPath("$.params.invitationId").value(first.path("id").asLong()));
        assertThat(count("FarmInvitation", farm)).isEqualTo(1);
    }

    @Test
    void aNewInvitationReplacesAnExpiredPendingRowBeforeTheExpiryJobRuns() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode first = created(owner, farm, "expired@example.test", "MANAGER", 3, "old");
        clock.set(clock.instant().plus(Duration.ofDays(3)));
        JsonNode second = created(owner, farm, "EXPIRED@EXAMPLE.TEST", "TECHNICIAN", 7, "new");
        assertThat(second.path("id")).isNotEqualTo(first.path("id"));
        em.flush(); em.clear();
        assertThat(em.find(FarmInvitation.class, first.path("id").asLong()).getStatus()).isEqualTo("EXPIRED");
        assertThat(em.createQuery("select count(a) from AuditLog a where a.action='INVITE_EXPIRED' and a.targetId=:id", Long.class)
            .setParameter("id", first.path("id").asLong()).getSingleResult()).isEqualTo(1);
        assertThat(em.createQuery("select count(i) from FarmInvitation i where i.farm.id=:f and i.status='PENDING'", Long.class)
            .setParameter("f", farm.getId()).getSingleResult()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING_PAYMENT", "EXPIRED", "SUSPENDED"})
    void rejectsInvitingWhileTheFarmIsNotActive(String farmStatus) throws Exception {
        Farm farm = farm(farmStatus); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        invite(owner, farm, body("new@example.test", "MANAGER", 7), "inactive-farm").andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-FE03-04"));
        assertThat(count("FarmInvitation", farm)).isZero();
    }

    @Test
    void managersTechniciansAndAnotherOwnerCannotInviteForThisFarm() throws Exception {
        Farm farm = farm(); memberWithRole(farm, FarmRole.OWNER);
        for (AppUser actor : java.util.List.of(memberWithRole(farm, FarmRole.MANAGER), memberWithRole(farm, FarmRole.TECHNICIAN), memberWithRole(farm(), FarmRole.OWNER))) {
            invite(actor, farm, body("new@example.test", "MANAGER", 7), "denied-" + actor.getId()).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        assertThat(count("FarmInvitation", farm)).isZero();
    }

    @Test
    void suspendedRecipientCanReceiveAnInvitationWithoutRevealingTheirAccountState() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser target = user("SUSPENDED");
        JsonNode result = created(owner, farm, target.getEmail(), "MANAGER", 3, "suspended-recipient");
        assertThat(result.path("status").asText()).isEqualTo("PENDING");
        assertThat(result.toString()).doesNotContain("SUSPENDED", "accountStatus");
        FarmInvitation stored = em.find(FarmInvitation.class, result.path("id").asLong());
        String token = signer.bearer("FARM_INVITATION", stored.getId(), stored.getTokenNonce());
        mvc.perform(get("/api/invitations/accept").with(SecurityMockMvcRequestPostProcessors.user(target.getEmail())).param("token", token)).andExpect(status().isForbidden());
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
    }

    @Test
    void resendKeepsRoleEmailAndIdAndRejectsAnOutdatedVersion() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode first = created(owner, farm, "resend@example.test", "MANAGER", 14, "send");
        String hash = em.find(FarmInvitation.class, first.path("id").asLong()).getTokenHash();
        clock.set(clock.instant().plus(Duration.ofDays(1)));
        String url = "/api/farms/" + farm.getId() + "/invitations/" + first.path("id").asLong() + "/resend";
        JsonNode resent = mapper.readTree(mvc.perform(post(url).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf()).header("Idempotency-Key", "resend")
            .contentType("application/json").content("{\"expectedVersion\":" + first.path("version").asInt() + "}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(resent.path("id")).isEqualTo(first.path("id")); assertThat(resent.path("role")).isEqualTo(first.path("role"));
        assertThat(resent.path("email")).isEqualTo(first.path("email"));
        FarmInvitation stored = em.find(FarmInvitation.class, first.path("id").asLong());
        assertThat(stored.getTokenHash()).isNotEqualTo(hash);
        assertThat(Duration.between(stored.getLastSentAt(), stored.getExpiresAt())).isEqualTo(Duration.ofDays(14));
        mvc.perform(post(url).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf()).header("Idempotency-Key", "stale")
            .contentType("application/json").content("{\"expectedVersion\":" + first.path("version").asInt() + "}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    @Test
    void reactivateRequiresDateAndReasonAndPreservesTheCurrentRole() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser target = user();
        FarmMembership member = member(farm, target, "MANAGER", "INACTIVE");
        String url = "/api/farms/" + farm.getId() + "/members/" + member.getId();
        Map<String, Object> body = new LinkedHashMap<>(Map.of("action", "REACTIVATE", "effectiveDate", TODAY.toString(), "reason", "", "expectedVersion", member.getVersion()));
        mvc.perform(put(url).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf()).header("Idempotency-Key", "blank").contentType("application/json").content(mapper.writeValueAsBytes(body)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        body.put("reason", "Tiếp tục công việc"); body.put("effectiveDate", TODAY.plusDays(1).toString());
        mvc.perform(put(url).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf()).header("Idempotency-Key", "future").contentType("application/json").content(mapper.writeValueAsBytes(body)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-07"));
        body.put("effectiveDate", TODAY.toString());
        mvc.perform(put(url).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf()).header("Idempotency-Key", "restore").contentType("application/json").content(mapper.writeValueAsBytes(body)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MANAGER")).andExpect(jsonPath("$.status").value("ACTIVE"));
        assertThat(count("FarmInvitation", farm)).isZero();
    }

    @Test
    void aSingleCommandReadsTheAccountHintWithoutLoadingTheAccount() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode withAccount = created(owner, farm, invitee.getEmail(), "MANAGER", 7, "hint-account");
        JsonNode withoutAccount = created(owner, farm, "no-account@example.test", "MANAGER", 7, "hint-none");
        // Entity loads, not statement counts: the shared pooled sequence adds a nextval to whichever request crosses a block.
        java.util.function.ToLongFunction<org.hibernate.stat.Statistics> accountLoads = stats -> stats.getEntityStatistics(AppUser.class.getName()).getLoadCount();
        em.flush(); em.clear();
        long account = measure(() -> resend(owner, farm, withAccount, "resend-account").andExpect(status().isOk()).andExpect(jsonPath("$.hasAccount").value(true)), accountLoads);
        em.flush(); em.clear();
        long none = measure(() -> resend(owner, farm, withoutAccount, "resend-none").andExpect(status().isOk()).andExpect(jsonPath("$.hasAccount").value(false)), accountLoads);
        assertThat(none).as("statistics must observe the caller's own account").isPositive();
        assertThat(account).as("hasAccount is an existence check, not an AppUser load: with account %d, without %d", account, none).isEqualTo(none);
    }

    @Test
    void aDeactivatedMemberReopeningTheAcceptedLinkGetsNoOwnerPromptOrMembershipId() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode sent = created(owner, farm, invitee.getEmail(), "TECHNICIAN", 7, "accept-once");
        FarmInvitation stored = em.find(FarmInvitation.class, sent.path("id").asLong());
        String token = signer.bearer("FARM_INVITATION", stored.getId(), stored.getTokenNonce());
        accept(invitee, token).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        FarmMembership membership = em.createQuery("select m from FarmMembership m where m.user.id=:u and m.farm.id=:f", FarmMembership.class)
            .setParameter("u", invitee.getId()).setParameter("f", farm.getId()).getSingleResult();
        membership.setStatus("INACTIVE"); em.flush();
        String body = accept(invitee, token).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value("ACCEPTED"))
            .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("MSG-FE03-21", "membershipId");
        // AF2 only shows an ACTIVE membership again (D28); a deactivated member sees a used link
        preview(invitee, token).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08"))
            .andExpect(jsonPath("$.params.status").value("ACCEPTED"));
        em.flush(); em.clear();
        assertThat(em.find(FarmMembership.class, membership.getId()).getStatus()).isEqualTo("INACTIVE");
        assertThat(count("FarmMembership", farm)).isEqualTo(2);
    }

    // ------------------------------------------------------------------ UC-FE03-04 (D28)

    @Test
    void previewShowsTheLastSendAndInviterOnlyToTheInvitedEmail() throws Exception {
        Farm farm = farm(); farm.setTimeZone("Asia/Bangkok"); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode sent = created(owner, farm, invitee.getEmail(), "MANAGER", 7, "send");
        clock.set(clock.instant().plus(Duration.ofDays(1)));
        JsonNode resent = mapper.readTree(resend(owner, farm, sent, "resend").andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String token = tokenOf(sent.path("id").asLong());
        // UC-FE03-04 step 4 / SCR-15: farm, role, inviter, last send and expiry, in the farm's time zone
        preview(invitee, token).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.farmId").value(farm.getId()))
            .andExpect(jsonPath("$.farmName").value(farm.getName())).andExpect(jsonPath("$.timeZone").value("Asia/Bangkok"))
            .andExpect(jsonPath("$.email").value(invitee.getEmail())).andExpect(jsonPath("$.role").value("MANAGER"))
            .andExpect(jsonPath("$.invitedBy").value(owner.getFullName()))
            .andExpect(jsonPath("$.sentAt").value(resent.path("lastSentAt").asText())).andExpect(jsonPath("$.expiresAt").value(resent.path("expiresAt").asText()))
            .andExpect(jsonPath("$.membershipId").doesNotExist());
        // TC-03-14 / E2: another account learns neither the farm nor the role, and nothing changes
        AppUser stranger = user();
        String denied = preview(stranger, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-09"))
            .andReturn().getResponse().getContentAsString();
        assertThat(denied).doesNotContain(farm.getName(), "MANAGER", "PENDING", invitee.getEmail());
        accept(stranger, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-09"));
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
    }

    @Test
    void cancelledExpiredAndUnknownLinksNameTheirStatusAndExpiryButGrantNothing() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode cancelled = created(owner, farm, invitee.getEmail(), "TECHNICIAN", 7, "to-cancel");
        cancel(owner, farm, cancelled.path("id").asLong(), cancelled.path("version").asInt(), "cancel").andExpect(status().isOk());
        String cancelledToken = tokenOf(cancelled.path("id").asLong());
        // D28 / Q6: SCR-15 shows MSG-FE03-08 with the status and expiry (SRS SCR-15), for the invited email only
        for (ResultActions call : java.util.List.of(preview(invitee, cancelledToken), accept(invitee, cancelledToken))) {
            call.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08"))
                .andExpect(jsonPath("$.params.status").value("CANCELLED")).andExpect(jsonPath("$.params.expiresAt").value(cancelled.path("expiresAt").asText()));
        }
        preview(user(), cancelledToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-09"))
            .andExpect(jsonPath("$.params.status").doesNotExist());

        JsonNode overdue = created(owner, farm, invitee.getEmail(), "MANAGER", 3, "overdue");
        String overdueToken = tokenOf(overdue.path("id").asLong());
        clock.set(clock.instant().plus(Duration.ofDays(3)));
        // TC-03-13: before JOB-02 the expired link is refused with EXPIRED and creates nothing
        accept(invitee, overdueToken).andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.status").value("EXPIRED"));
        memberships.expirePendingInvitations();
        em.flush(); em.clear();
        // after JOB-02 the hash is still there (until JOB-08), so the link keeps saying EXPIRED
        assertThat(em.find(FarmInvitation.class, overdue.path("id").asLong()).getTokenHash()).isEqualTo(signer.hash(overdueToken));
        preview(invitee, overdueToken).andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.status").value("EXPIRED"))
            .andExpect(jsonPath("$.params.expiresAt").value(overdue.path("expiresAt").asText()));
        preview(invitee, "not-a-real-token").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.status").value("INVALID"))
            .andExpect(jsonPath("$.params.expiresAt").doesNotExist());
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING_PAYMENT", "EXPIRED", "SUSPENDED"})
    void anInactiveFarmCannotBeJoinedAndTheInvitationStaysPending(String serviceStatus) throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        long id = created(owner, farm, invitee.getEmail(), "MANAGER", 7, "send").path("id").asLong();
        farm.setServiceStatus(serviceStatus); em.flush();
        // TC-03-17 / E3
        preview(invitee, tokenOf(id)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-04"));
        accept(invitee, tokenOf(id)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-04"));
        em.flush(); em.clear();
        assertThat(em.find(FarmInvitation.class, id).getStatus()).isEqualTo("PENDING");
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
    }

    @Test
    void acceptOpensTheFarmOnceAndReopeningTheLinkShowsTheSameMembership() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        long id = created(owner, farm, invitee.getEmail(), "TECHNICIAN", 7, "send").path("id").asLong();
        String token = tokenOf(id);
        // TC-03-15 / A8 (D28): farm, role and membership to open next
        JsonNode first = mapper.readTree(accept(invitee, token).andExpect(status().isOk())
            .andExpect(jsonPath("$.farmId").value(farm.getId())).andExpect(jsonPath("$.farmName").value(farm.getName()))
            .andExpect(jsonPath("$.role").value("TECHNICIAN")).andExpect(jsonPath("$.status").value("ACTIVE"))
            .andReturn().getResponse().getContentAsString());
        // TC-03-16: the same token again returns the same membership and creates nothing more (no Idempotency-Key, D28)
        assertThat(mapper.readTree(accept(invitee, token).andExpect(status().isOk()).andReturn().getResponse().getContentAsString())).isEqualTo(first);
        // AF2: reopening the link shows the existing membership
        preview(invitee, token).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACCEPTED"))
            .andExpect(jsonPath("$.membershipId").value(first.path("membershipId").asLong())).andExpect(jsonPath("$.role").value("TECHNICIAN"));
        em.flush(); em.clear();
        assertThat(em.find(FarmInvitation.class, id).getStatus()).isEqualTo("ACCEPTED");
        assertThat(count("FarmMembership", farm)).isEqualTo(2);
        assertThat(em.createQuery("select count(a) from AuditLog a where a.action='MEMBER_ACCEPT' and a.targetId=:m", Long.class)
            .setParameter("m", first.path("membershipId").asLong()).getSingleResult()).isEqualTo(1);
        // step 8 / GBR-64: one Owner e-mail intent per membership, saved with the acceptance
        assertThat(em.createQuery("select j.recipient from EmailDeliveryJob j where j.linkSource='MEMBERSHIP' and j.linkSourceId=:m", String.class)
            .setParameter("m", first.path("membershipId").asLong()).getResultList()).containsExactly(owner.getEmail());
    }

    @Test
    void anOwnerOfAnotherFarmJoinsAsTechnicianWithoutGainingOwnerOrPlatformAuthority() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Farm own = farm(); AppUser invitee = memberWithRole(own, FarmRole.OWNER);
        long id = created(owner, farm, invitee.getEmail(), "TECHNICIAN", 7, "send").path("id").asLong();
        accept(invitee, tokenOf(id)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("TECHNICIAN"));
        em.flush(); em.clear();
        // TC-03-18 / POST-3
        assertThat(em.createQuery("select m.role from FarmMembership m where m.user.id=:u order by m.farm.id", String.class)
            .setParameter("u", invitee.getId()).getResultList()).containsExactlyInAnyOrder("OWNER", "TECHNICIAN");
        assertThat(em.createQuery("select m.role from FarmMembership m where m.user.id=:u and m.farm.id=:f", String.class)
            .setParameter("u", invitee.getId()).setParameter("f", own.getId()).getSingleResult()).isEqualTo("OWNER");
        assertThat(em.createQuery("select count(p) from PlatformStaffAccess p where p.user.id=:u", Long.class)
            .setParameter("u", invitee.getId()).getSingleResult()).isZero();
    }

    protected ResultActions preview(AppUser actor, String token) throws Exception {
        return mvc.perform(get("/api/invitations/accept").with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).param("token", token));
    }

    protected String tokenOf(long invitationId) {
        return signer.bearer("FARM_INVITATION", invitationId, em.find(FarmInvitation.class, invitationId).getTokenNonce());
    }

    @Autowired vn.edu.fpt.beefcare.service.FarmMembershipService memberships;

    // ------------------------------------------------------------------ UC-FE03-03 (D27)

    @Test
    void resendOnDayFiveRestartsTheChosenPeriodOnTheSameInvitationAndOnlyTheNewLinkWorks() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode sent = created(owner, farm, invitee.getEmail(), "MANAGER", 7, "day-1");
        long id = sent.path("id").asLong();
        FarmInvitation first = em.find(FarmInvitation.class, id);
        String oldToken = signer.bearer("FARM_INVITATION", id, first.getTokenNonce());
        clock.set(clock.instant().plus(Duration.ofDays(4)));
        String body = resend(owner, farm, sent, "day-5").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode resent = mapper.readTree(body);
        for (String field : java.util.List.of("id", "email", "role", "validityDays", "createdAt", "hasAccount")) assertThat(resent.path(field)).as(field).isEqualTo(sent.path(field));
        assertThat(resent.path("status").asText()).isEqualTo("PENDING");
        assertThat(resent.path("version").asInt()).isGreaterThan(sent.path("version").asInt());
        java.time.Instant created = java.time.Instant.parse(resent.path("createdAt").asText());
        java.time.Instant lastSent = java.time.Instant.parse(resent.path("lastSentAt").asText());
        // TC-03-10: sent on day 1, resent on day 5, a 7-day invitation now expires on day 12
        assertThat(Duration.between(created, lastSent)).isEqualTo(Duration.ofDays(4));
        assertThat(Duration.between(created, java.time.Instant.parse(resent.path("expiresAt").asText()))).isEqualTo(Duration.ofDays(11));
        // the same key replays the first result without a second email intent (GBR-88)
        assertThat(mapper.readTree(resend(owner, farm, sent, "day-5").andExpect(status().isOk()).andReturn().getResponse().getContentAsString())).isEqualTo(resent);
        em.flush(); em.clear();
        FarmInvitation stored = em.find(FarmInvitation.class, id);
        assertThat(stored.getProposedRole()).isEqualTo("MANAGER"); assertThat(stored.getInvitedEmail()).isEqualTo(invitee.getEmail());
        assertThat(jobStatuses(id)).containsExactly("CANCELLED", "PENDING");
        assertThat(audits("INVITE_RESEND", id)).singleElement().satisfies(details -> assertThat(details)
            .contains("\"before\"", "\"after\"", stored.getExpiresAt().toString(), "\"role\":\"MANAGER\""));
        // D27: resending replaces the link; the earlier e-mail no longer opens the invitation
        accept(invitee, oldToken).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08"))
            .andExpect(jsonPath("$.params.status").value("INVALID"));
        mvc.perform(get("/api/invitations/accept").with(SecurityMockMvcRequestPostProcessors.user(invitee.getEmail()))
            .param("token", signer.bearer("FARM_INVITATION", id, stored.getTokenNonce()))).andExpect(status().isOk());
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING_PAYMENT", "EXPIRED", "SUSPENDED"})
    void inactiveServiceBlocksResendButTheOwnerCanStillCancel(String serviceStatus) throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode sent = created(owner, farm, "inactive-farm@example.test", "TECHNICIAN", 7, "send");
        long id = sent.path("id").asLong(); int version = sent.path("version").asInt();
        farm.setServiceStatus(serviceStatus); em.flush();
        // TC-03-07: MSG-FE03-04; nothing about the invitation changes
        resend(owner, farm, id, version, "resend").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-04"));
        em.flush(); em.clear();
        FarmInvitation unchanged = em.find(FarmInvitation.class, id);
        assertThat(unchanged.getVersion()).isEqualTo(version);
        assertThat(unchanged.getLastSentAt()).isEqualTo(java.time.Instant.parse(sent.path("lastSentAt").asText()));
        assertThat(audits("INVITE_RESEND", id)).isEmpty();
        // TC-03-08 / TC-03-38: cancellation stays available in every service status (GBR-14)
        cancel(owner, farm, id, version, "cancel").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"ACCEPTED", "CANCELLED", "EXPIRED"})
    void aFinishedInvitationReportsItsStatusBeforeAnyVersionConflict(String finalStatus) throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long id = created(owner, farm, "final@example.test", "MANAGER", 7, "send").path("id").asLong();
        FarmInvitation stored = em.find(FarmInvitation.class, id);
        stored.setStatus(finalStatus); em.flush();
        int current = stored.getVersion();
        // TC-03-11: MSG-FE03-08 with the current status, also for an outdated version (E2 before E4)
        for (int version : new int[] {current, current - 1}) {
            resend(owner, farm, id, version, "resend-" + version).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value(finalStatus));
            cancel(owner, farm, id, version, "cancel-" + version).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value(finalStatus));
        }
        em.flush(); em.clear();
        assertThat(em.find(FarmInvitation.class, id).getVersion()).isEqualTo(current);
        assertThat(audits("INVITE_RESEND", id)).isEmpty(); assertThat(audits("INVITE_CANCEL", id)).isEmpty();
    }

    @Test
    void anOverduePendingInvitationIsReportedExpiredWithoutWritingBeforeTheExpiryJob() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode sent = created(owner, farm, "overdue@example.test", "MANAGER", 3, "send");
        long id = sent.path("id").asLong(); int version = sent.path("version").asInt();
        String hash = em.find(FarmInvitation.class, id).getTokenHash();
        clock.set(clock.instant().plus(Duration.ofDays(3))); // expiresAt == now: no longer valid (R-03-19)
        resend(owner, farm, id, version, "resend").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value("EXPIRED"));
        cancel(owner, farm, id, version, "cancel").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value("EXPIRED"));
        em.flush(); em.clear();
        // a rejected command does not take over JOB-02: the stored row, link and history stay as they were
        FarmInvitation stored = em.find(FarmInvitation.class, id);
        assertThat(stored.getStatus()).isEqualTo("PENDING"); assertThat(stored.getVersion()).isEqualTo(version);
        assertThat(stored.getTokenHash()).isEqualTo(hash);
        assertThat(audits("INVITE_EXPIRED", id)).isEmpty();
        assertThat(jobStatuses(id)).containsExactly("PENDING");
    }

    @Test
    void onlyThisFarmsOwnerCanResendOrCancelAndAnotherFarmsInvitationIsNotFound() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode sent = created(owner, farm, "scope@example.test", "MANAGER", 7, "send");
        long id = sent.path("id").asLong(); int version = sent.path("version").asInt();
        Farm other = farm(); AppUser otherOwner = memberWithRole(other, FarmRole.OWNER);
        for (AppUser actor : java.util.List.of(memberWithRole(farm, FarmRole.MANAGER), memberWithRole(farm, FarmRole.TECHNICIAN), otherOwner)) {
            resend(actor, farm, id, version, "resend-" + actor.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            cancel(actor, farm, id, version, "cancel-" + actor.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        // another Owner addressing this invitation through their own farm learns nothing about it
        resend(otherOwner, other, id, version, "cross-resend").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        cancel(otherOwner, other, id, version, "cross-cancel").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        em.flush(); em.clear();
        FarmInvitation stored = em.find(FarmInvitation.class, id);
        assertThat(stored.getStatus()).isEqualTo("PENDING"); assertThat(stored.getVersion()).isEqualTo(version);
    }

    @Test
    void cancelEndsTheLinkWithOneAuditCreatesNoMembershipAndReplaysTheFirstResult() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser invitee = user();
        JsonNode sent = created(owner, farm, invitee.getEmail(), "TECHNICIAN", 7, "send");
        long id = sent.path("id").asLong(); int version = sent.path("version").asInt();
        String token = signer.bearer("FARM_INVITATION", id, em.find(FarmInvitation.class, id).getTokenNonce());
        JsonNode cancelled = mapper.readTree(cancel(owner, farm, id, version, "cancel-once").andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED")).andReturn().getResponse().getContentAsString());
        assertThat(cancelled.path("version").asInt()).isGreaterThan(version);
        assertThat(mapper.readTree(cancel(owner, farm, id, version, "cancel-once").andExpect(status().isOk()).andReturn().getResponse().getContentAsString())).isEqualTo(cancelled);
        // POST-2: the link grants nothing; POST-3: no membership. D28: the link still names its status for SCR-15.
        accept(invitee, token).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08"))
            .andExpect(jsonPath("$.params.status").value("CANCELLED"));
        em.flush(); em.clear();
        FarmInvitation stored = em.find(FarmInvitation.class, id);
        assertThat(stored.getStatus()).isEqualTo("CANCELLED"); assertThat(stored.getCancelledAt()).isNotNull();
        assertThat(stored.getTokenHash()).isEqualTo(signer.hash(token)); // D28: kept until JOB-08
        assertThat(count("FarmMembership", farm)).isEqualTo(1);
        assertThat(jobStatuses(id)).containsExactly("CANCELLED"); // an unsent invitation e-mail is dropped
        assertThat(audits("INVITE_CANCEL", id)).singleElement().satisfies(details -> assertThat(details)
            .contains("\"statusBefore\":\"PENDING\"", "\"statusAfter\":\"CANCELLED\"", "\"role\":\"TECHNICIAN\""));
    }

    protected ResultActions resend(AppUser actor, Farm farm, JsonNode invitation, String key) throws Exception {
        return resend(actor, farm, invitation.path("id").asLong(), invitation.path("version").asInt(), key);
    }

    protected ResultActions resend(AppUser actor, Farm farm, long invitationId, int version, String key) throws Exception {
        return command(actor, farm, invitationId, "resend", version, key);
    }

    protected ResultActions cancel(AppUser actor, Farm farm, long invitationId, int version, String key) throws Exception {
        return command(actor, farm, invitationId, "cancel", version, key);
    }

    private ResultActions command(AppUser actor, Farm farm, long invitationId, String action, int version, String key) throws Exception {
        return mvc.perform(post("/api/farms/{f}/invitations/{i}/" + action, farm.getId(), invitationId)
            .with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf()).header("Idempotency-Key", key)
            .contentType("application/json").content("{\"expectedVersion\":" + version + "}"));
    }

    protected java.util.List<String> audits(String action, long invitationId) {
        return em.createQuery("select a.details from AuditLog a where a.action=:a and a.targetType='FarmInvitation' and a.targetId=:id order by a.id", String.class)
            .setParameter("a", action).setParameter("id", invitationId).getResultList();
    }

    protected java.util.List<String> jobStatuses(long invitationId) {
        return em.createQuery("select j.status from EmailDeliveryJob j where j.linkSource='INVITATION' and j.linkSourceId=:id order by j.id", String.class)
            .setParameter("id", invitationId).getResultList();
    }

    protected ResultActions accept(AppUser actor, String token) throws Exception {
        return mvc.perform(post("/api/invitations/accept").with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf())
            .contentType("application/json").content(mapper.writeValueAsBytes(Map.of("token", token))));
    }

    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;

    interface Call { void run() throws Exception; }

    protected long measure(Call call, java.util.function.ToLongFunction<org.hibernate.stat.Statistics> metric) throws Exception {
        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            call.run();
            return metric.applyAsLong(statistics);
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }

    protected long count(String entity, Farm farm) {
        return em.createQuery("select count(e) from " + entity + " e where e.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult();
    }
}
