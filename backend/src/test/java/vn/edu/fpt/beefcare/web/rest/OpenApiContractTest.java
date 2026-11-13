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
        // D25: a typed client must send a numeric duration, and must collect both required invitation fields.
        JsonNode invite = api.path("components").path("schemas").path("InviteRequest");
        assertThat(invite.path("required").toString()).contains("email", "role");
        JsonNode days = invite.path("properties").path("validityDays");
        assertThat(allowsNull(days)).isTrue();
        JsonNode numericDays = days.path("anyOf").get(0);
        assertThat(numericDays.path("type").asText()).isEqualTo("integer");
        assertThat(numericDays.path("enum").toString()).isEqualTo("[3,7,14]");
        assertThat(numericDays.path("default").isNumber()).isTrue();
        assertThat(numericDays.path("default").asInt()).isEqualTo(7);
        assertThat(api.path("components").path("schemas").path("InvitationView").path("properties").has("hasAccount")).isTrue();
        JsonNode invitationList = paths.path("/api/farms/{farmId}/invitations").path("get");
        assertThat(invitationList.path("responses").path("200").toString()).contains("InvitationPage");
        assertThat(invitationList.path("parameters").toString()).contains("\"status\"", "\"page\"", "\"size\"", "\"sort\"", "\"dir\"", "\"invitationId\"");
        JsonNode invitationPage = api.path("components").path("schemas").path("InvitationPage");
        assertThat(invitationPage.path("required").toString()).contains("items", "counts", "total", "page", "size", "asOf");
        JsonNode invitationFields = api.path("components").path("schemas").path("InvitationView");
        assertThat(invitationFields.path("required").toString()).contains("id", "email", "role", "status", "createdAt", "lastSentAt", "expiresAt", "validityDays", "version", "hasAccount");
        assertThat(invitationFields.path("properties").path("status").path("enum").toString()).contains("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED");
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
        for (String field : java.util.List.of("purchasedStart", "purchasedEnd", "receiptCode", "qrImageUrl", "bankCode", "accountNumber", "accountName",
            "bankPaidAt", "receivedAt", "confirmedAt", "confirmationSource")) {
            assertThat(allowsNull(payment.path(field))).as("pending payment nullable " + field).isTrue();
        }
        JsonNode postPayment = paths.path("/api/farms/{farmId}/subscription/payments").path("post");
        JsonNode paymentHistory = paths.path("/api/farms/{farmId}/subscription/payments").path("get");
        assertThat(paymentHistory.path("parameters").toString()).contains("\"q\"", "\"status\"", "\"from\"", "\"to\"", "\"sort\"", "\"dir\"", "\"page\"");
        assertThat(paymentHistory.path("responses").path("200").toString()).contains("PaymentHistoryPage");
        paymentHistory.path("parameters").forEach(parameter -> {
            if ("page".equals(parameter.path("name").asText())) {
                assertThat(parameter.path("schema").path("type").asText()).isEqualTo("integer");
                assertThat(parameter.path("schema").path("minimum").asInt()).isZero();
                assertThat(parameter.path("schema").path("maximum").asLong()).isEqualTo(Integer.MAX_VALUE / 20);
            }
        });
        JsonNode historyPage = api.path("components").path("schemas").path("PaymentHistoryPage");
        assertThat(historyPage.path("required").toString()).contains("content", "number", "size", "totalElements", "totalPages");
        assertThat(historyPage.path("properties").path("content").path("items").path("$ref").asText()).endsWith("/PaymentDTO");
        assertThat(postPayment.path("parameters").toString()).contains("Idempotency-Key");
        JsonNode request = api.path("components").path("schemas").path("Request");
        assertThat(request.path("required").toString()).contains("durationYears", "reviewedPriceVersion");
        // D18: masked paged list, separately authorized full evidence detail, and exact payment allocation.
        assertThat(paths.has("/api/platform/payments/evidence/{evidenceId}")).isTrue();
        assertThat(paths.path("/api/platform/payments/evidence").path("get").path("parameters").toString())
            .contains("\"page\"", "\"size\"", "\"status\"", "\"bankFrom\"", "\"bankTo\"");
        JsonNode evidenceRow = api.path("components").path("schemas").path("PlatformBankEvidenceRow").path("properties");
        assertThat(evidenceRow.has("maskedTransactionId")).isTrue();
        assertThat(evidenceRow.has("transactionId")).isFalse();
        assertThat(allowsNull(evidenceRow.path("receivingAccountMatches"))).isTrue();
        // The strict SCR-62 adapter accepts only declared values; unknown stored states are read as PROCESSING.
        assertThat(evidenceRow.path("reviewStatus").path("enum").toString()).contains("TO_REVIEW", "LOCKED", "PROCESSING", "NO_ACTION");
        assertThat(evidenceRow.path("matchResult").path("enum").toString()).contains("PAID_AUTO", "EXACT_CODE", "ACCOUNT_MISMATCH");
        JsonNode evidenceDetail = api.path("components").path("schemas").path("PlatformBankEvidenceDetail").path("properties");
        assertThat(evidenceDetail.has("history")).isTrue();
        assertThat(evidenceDetail.has("transactionId")).isTrue();
        assertThat(allowsNull(evidenceDetail.path("firstReceivedAt"))).isTrue();
        JsonNode reviewHistory = api.path("components").path("schemas").path("PlatformEvidenceHistory").path("properties");
        assertThat(allowsNull(reviewHistory.path("relatedPaymentId"))).isTrue();
        assertThat(allowsNull(reviewHistory.path("relatedPaymentCode"))).isTrue();
        // D19 / UC6: keyed reconciliation commands, one reason field, dated return, period lookup and return state on detail.
        for (String command : java.util.List.of("review", "lock-return", "record-return", "unlock-return")) {
            assertThat(paths.path("/api/platform/payments/evidence/{evidenceId}/" + command).path("post").path("parameters").toString())
                .as(command).contains("Idempotency-Key");
        }
        JsonNode reviewBody = api.path("components").path("schemas").path("Review").path("properties");
        assertThat(reviewBody.has("references")).isFalse();
        assertThat(reviewBody.path("reason").path("maxLength").asInt()).isEqualTo(1000);
        assertThat(api.path("components").path("schemas").path("ReturnResult").path("properties").has("returnDate")).isTrue();
        assertThat(paths.path("/api/platform/payments/lookup").path("get").path("parameters").toString()).contains("\"from\"", "\"to\"");
        for (String field : java.util.List.of("returnReference", "returnDate", "returnResult")) {
            assertThat(allowsNull(evidenceDetail.path(field))).as("UC6 nullable " + field).isTrue();
        }
        JsonNode pmPayment = api.path("components").path("schemas").path("PlatformPaymentRead").path("properties");
        for (String field : java.util.List.of("evidenceId", "confirmedAt", "confirmationSource", "bankPaidAt", "receivedAt")) {
            assertThat(allowsNull(pmPayment.path(field))).as("UC5 nullable " + field).isTrue();
        }
        JsonNode pricePage = api.path("components").path("schemas").path("PlatformPlanPricePage").path("properties");
        assertThat(paths.path("/api/platform/plan-prices").path("get").path("responses").path("200").toString()).contains("PlatformPlanPricePage");
        assertThat(allowsNull(pricePage.path("current"))).isTrue();
        assertThat(allowsNull(pricePage.path("nextEffectiveAt"))).isTrue();
        JsonNode plan = api.path("components").path("schemas").path("PlatformPlanPriceVersion").path("properties");
        assertThat(plan.path("status").path("enum").toString()).contains("SCHEDULED", "EFFECTIVE", "SUPERSEDED", "WITHDRAWN");
        for (String field : java.util.List.of("terms", "publishedById", "publishedBy", "publishedAt", "withdrawnBy", "withdrawnAt", "withdrawReason")) {
            assertThat(allowsNull(plan.path(field))).as("UC7 nullable " + field).isTrue();
        }
        for (String path : java.util.List.of("/api/platform/plan-prices", "/api/platform/plan-prices/{version}/withdraw")) {
            assertThat(paths.path(path).path("post").path("parameters").toString()).contains("Idempotency-Key");
        }
        JsonNode priceRequest = api.path("components").path("schemas").path("PublishPriceRequest");
        assertThat(priceRequest.path("required").toString()).contains("price1y", "price2y", "price3y", "applyNow");
        assertThat(priceRequest.path("properties").path("terms").path("anyOf").get(0).path("maxLength").asInt()).isEqualTo(500);
        JsonNode withdrawRequest = api.path("components").path("schemas").path("WithdrawPriceRequest");
        assertThat(withdrawRequest.path("required").toString()).contains("reason", "expectedVersion");
        assertThat(withdrawRequest.path("properties").path("reason").path("maxLength").asInt()).isEqualTo(1000);
        assertThat(api.path("components").path("schemas").path("PriceVersion").path("properties").has("publishedBy")).isFalse();
        for (String route : java.util.List.of("/api/webhooks/sepay", "/api/v1/payments/sepay/webhook")) {
            JsonNode webhook = paths.path(route).path("post");
            assertThat(webhook.path("parameters").toString()).contains("X-SePay-Timestamp", "X-SePay-Signature");
            assertThat(webhook.path("requestBody").path("required").asBoolean()).isTrue();
            assertThat(webhook.path("responses").path("200").toString()).contains("WebhookAcknowledgement");
            assertThat(webhook.path("security").isArray()).as("Webhook authenticates HMAC, not a browser session").isTrue();
            assertThat(webhook.path("security").size()).isZero();
            assertThat(webhook.path("responses").has("401")).isTrue();
        }
        JsonNode ingress = api.path("components").path("schemas").path("SePayPayload");
        assertThat(ingress.path("required").toString()).contains("id", "transactionDate", "transferType", "transferAmount");
        assertThat(ingress.path("properties").has("description")).isTrue();
        // Review UC8 #3: the signed body (≤ 65,536 bytes) bounds every provider text field; none is refused or cut shorter.
        for (String field : java.util.List.of("gateway", "accountNumber", "code", "content", "referenceCode", "description")) {
            assertThat(ingress.path("properties").path(field).path("anyOf").get(0).path("maxLength").asInt()).as(field).isEqualTo(65536);
        }
        assertThat(api.path("components").path("schemas").path("WebhookAcknowledgement").path("properties").size()).isEqualTo(1);
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
