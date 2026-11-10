package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** A missing receiving account must fail before creating the first subscription. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = { "beefcare.sepay.account-name=",
    "spring.datasource.url=jdbc:h2:mem:uc02-config;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1" })
class SubscriptionPaymentRequestConfigurationTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Test
    void missingBankConfigurationCreatesNothing() throws Exception {
        var farm = farm("PENDING_PAYMENT"); var owner = memberWithRole(farm, FarmRole.OWNER);
        var price = save(new PlanVersion().price1y(new java.math.BigDecimal("1200000")).price2y(new java.math.BigDecimal("2160000"))
            .price3y(new java.math.BigDecimal("3060000")).effectiveAt(clock.instant()));
        mvc.perform(post("/api/farms/{farm}/subscription/payments", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
            .header("Idempotency-Key", "no-account").contentType("application/json")
            .content("{\"durationYears\":1,\"reviewedPriceVersion\":" + price.getId() + "}")).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE19-04"));
        assertThat(em.createQuery("select count(s) from Subscription s where s.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(p) from Payment p where p.subscription.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isZero();
    }
}
