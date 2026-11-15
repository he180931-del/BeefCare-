package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** SCR-59 local "Giả lập chuyển khoản": Owner-only, built from the request snapshot, same pipeline as a webhook. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:owner-transfer-simulator;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "beefcare.sepay.bank-code=TESTBANK", "beefcare.sepay.account-number=TEST-ACCOUNT",
    "beefcare.sepay.account-name=TEST RECIPIENT", "beefcare.sepay.environment=TEST",
    "beefcare.sepay.account-namespace=SIM-TEST", "beefcare.sepay.webhook-secret=simulator-fixture-signing-secret",
    "beefcare.sepay.processing-delay-ms=86400000"
})
class OwnerTransferSimulatorResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private long createRequest(AppUser owner, Farm farm) throws Exception {
        PlanVersion price = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant()));
        String body = mvc.perform(post("/api/farms/{farm}/subscription/payments", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
                .header("Idempotency-Key", "simulator-" + farm.getId()).contentType("application/json")
                .content(mapper.writeValueAsBytes(Map.of("durationYears", 1, "reviewedPriceVersion", price.getId()))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        // A real Owner clicks the button some time after the request exists.
        clock.set(clock.instant().plusSeconds(30));
        return mapper.readTree(body).path("id").asLong();
    }

    private ResultActions simulate(AppUser actor, Farm farm, long paymentId, Object body) throws Exception {
        var request = post("/api/dev/sepay/farms/{farm}/payments/{id}/transfer", farm.getId(), paymentId)
            .with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf());
        if (body != null) request = request.contentType("application/json").content(mapper.writeValueAsBytes(body));
        return mvc.perform(request);
    }

    private JsonNode detail(AppUser owner, Farm farm, long paymentId) throws Exception {
        em.flush();
        em.clear();
        return mapper.readTree(mvc.perform(get("/api/farms/{farm}/subscription/payments/{id}", farm.getId(), paymentId)
            .with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private List<BankTransferEvidence> evidences() {
        em.flush();
        return em.createQuery("select e from BankTransferEvidence e", BankTransferEvidence.class).getResultList();
    }

    @Test
    void ownerSimulatesTheExactTransferFromTheRequestSnapshotAndThePaymentIsConfirmed() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long paymentId = createRequest(owner, farm);
        Payment requested = em.find(Payment.class, paymentId);

        simulate(owner, farm, paymentId, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.duplicate").value(false))
            .andExpect(jsonPath("$.reviewStatus").value("ACCEPTED"))
            .andExpect(jsonPath("$.paymentId").value(paymentId));

        JsonNode read = detail(owner, farm, paymentId);
        assertThat(read.path("state").asText()).isEqualTo("PAID");
        assertThat(read.path("receiptCode").asText()).startsWith("RC-");
        assertThat(read.path("purchasedStart").isNull()).isFalse();
        List<BankTransferEvidence> stored = evidences();
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getQuoteRef()).isEqualTo(requested.getQuoteRef());
        assertThat(stored.get(0).getAmount()).isEqualByComparingTo(requested.getAmountVnd());
        assertThat(stored.get(0).getReceivingAccount()).isEqualTo("TEST-ACCOUNT");
        assertThat(stored.get(0).getBankPaidAt()).isAfterOrEqualTo(requested.getRequestedAt()).isBefore(requested.getExpiresAt());
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void anotherAmountIsReceivedAsEvidenceButLeavesTheRequestPendingForThePm() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long paymentId = createRequest(owner, farm);

        simulate(owner, farm, paymentId, Map.of("amountVnd", 1_000_000)).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.paymentId").doesNotExist());

        assertThat(detail(owner, farm, paymentId).path("state").asText()).isEqualTo("PENDING");
        List<BankTransferEvidence> stored = evidences();
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getAmount()).isEqualByComparingTo("1000000");
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("PENDING_PAYMENT");
    }

    @Test
    void onlyTheOwnerOfTheRequestsFarmCanSimulateAndNothingIsStoredOtherwise() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        Farm otherFarm = farm("PENDING_PAYMENT");
        AppUser otherOwner = memberWithRole(otherFarm, FarmRole.OWNER);
        long paymentId = createRequest(owner, farm);

        simulate(manager, farm, paymentId, null).andExpect(status().isForbidden());
        simulate(otherOwner, farm, paymentId, null).andExpect(status().is4xxClientError());
        // Their own farm in the path does not reach a request of another farm.
        simulate(otherOwner, otherFarm, paymentId, null).andExpect(status().isNotFound());

        assertThat(evidences()).isEmpty();
        assertThat(detail(owner, farm, paymentId).path("state").asText()).isEqualTo("PENDING");
    }

    @Test
    void aNonPositiveAmountIsRejectedBeforeAnyEvidence() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long paymentId = createRequest(owner, farm);

        simulate(owner, farm, paymentId, Map.of("amountVnd", 0)).andExpect(status().isBadRequest());

        assertThat(evidences()).isEmpty();
    }
}
