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
        em.flush(); em.clear();
        assertThat(em.find(FarmMembership.class, membership.getId()).getStatus()).isEqualTo("INACTIVE");
        assertThat(count("FarmMembership", farm)).isEqualTo(2);
    }

    protected ResultActions resend(AppUser actor, Farm farm, JsonNode invitation, String key) throws Exception {
        return mvc.perform(post("/api/farms/{f}/invitations/{i}/resend", farm.getId(), invitation.path("id").asLong())
            .with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf()).header("Idempotency-Key", key)
            .contentType("application/json").content("{\"expectedVersion\":" + invitation.path("version").asInt() + "}"));
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
