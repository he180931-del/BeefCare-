package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;

/** Exports the actual registered DTO schemas while ensuring raw legacy entity CRUD stays out. */
@ServiceIntegrationTest
@ActiveProfiles({"testh2","api-docs"})
class OpenApiContractTest {
    @DynamicPropertySource
    static void isolatedDatabase(DynamicPropertyRegistry properties) {
        // The documentation profile starts a second context; it must not share the first context's live pool/schema.
        properties.add("spring.datasource.url", () -> "jdbc:h2:mem:beefcare-contract;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Test void exportBusinessContractWithoutLegacyCrud() throws Exception {
        String json=mvc.perform(get("/v3/api-docs/beefcare").with(user("contract-reviewer").roles("ADMIN"))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode api=mapper.readTree(json),paths=api.path("paths");
        assertThat(paths.has("/api/farms")).isTrue();
        assertThat(paths.has("/api/support/tickets")).isTrue();
        assertThat(paths.has("/api/cattle")).isFalse();
        assertThat(paths.has("/api/support-tickets")).isFalse();
        assertThat(api.path("components").path("securitySchemes").has("session")).isTrue();
        JsonNode overview = api.path("components").path("schemas").path("SubscriptionOverview");
        assertThat(overview.path("properties").size()).isEqualTo(15);
        for (String field : java.util.List.of("farmName", "suspended", "suspendedSince", "currentPeriod", "daysRemaining", "futurePeriods", "periods", "eligibility")) {
            assertThat(overview.path("properties").has(field)).as("SCR-57 " + field).isTrue();
        }
        assertThat(overview.path("properties").path("serviceStatus").path("enum").toString()).contains("SUSPENDED", "EXPIRED");
        assertThat(api.path("components").path("schemas").has("SubscriptionPurchasedPeriod")).isTrue();
        for (String field : java.util.List.of("latestEnd", "renewalOpensAt", "suspendedSince", "currentPeriod", "daysRemaining", "currentPrices", "pendingPayment")) {
            assertThat(allowsNull(overview.path("properties").path(field))).as("SCR-57 nullable %s: %s", field, overview.path("properties").path(field)).isTrue();
        }
        JsonNode eligibility = api.path("components").path("schemas").path("SubscriptionRequestEligibility").path("properties");
        assertThat(allowsNull(eligibility.path("reason"))).isTrue();
        assertThat(allowsNull(eligibility.path("opensAt"))).isTrue();
        JsonNode payment = api.path("components").path("schemas").path("PaymentDTO").path("properties");
        for (String field : java.util.List.of("purchasedStart", "purchasedEnd", "receiptCode", "qrImageUrl", "bankCode", "accountNumber", "accountName")) {
            assertThat(allowsNull(payment.path(field))).as("pending payment nullable " + field).isTrue();
        }
        Files.writeString(Path.of("target","beefcare-openapi.json"),mapper.writerWithDefaultPrettyPrinter().writeValueAsString(api)+"\n",StandardCharsets.UTF_8);
    }

    private boolean allowsNull(JsonNode schema) {
        JsonNode type = schema.path("type");
        if (type.isTextual() && "null".equals(type.asText())) return true;
        if (type.isArray()) for (JsonNode member : type) if ("null".equals(member.asText())) return true;
        for (String union : java.util.List.of("anyOf", "oneOf")) {
            for (JsonNode member : schema.path(union)) if (allowsNull(member)) return true;
        }
        return false;
    }
}
