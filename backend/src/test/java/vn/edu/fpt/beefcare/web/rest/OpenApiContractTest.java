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
import org.junit.jupiter.api.BeforeAll;
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

    @BeforeAll
    static void initializeDocumentation(@Autowired MockMvc mvc) throws Exception {
        // Schema discovery is fixture initialization (not an API latency assertion).
        // Cold Windows discovery can exceed the 15s test-method limit; the existing
        // before-all timeout bounds setup, while all contract assertions stay below.
        mvc.perform(get("/v3/api-docs/beefcare").with(user("contract-reviewer").roles("ADMIN")))
            .andExpect(status().isOk());
    }

    @Test void exportBusinessContractWithoutLegacyCrud() throws Exception {
        String json=mvc.perform(get("/v3/api-docs/beefcare").with(user("contract-reviewer").roles("ADMIN"))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode api=mapper.readTree(json),paths=api.path("paths");
        // D55: keep the 405 compatibility tombstone out of generated clients.
        assertThat(paths.has("/api/farms/{farmId}/pending-calves/{calfId}/parentage")).isFalse();
        assertThat(api.path("components").path("schemas").has("AssignCalfParentageRequest")).isFalse();
        JsonNode calfDeath = api.path("components").path("schemas").path("DiedBeforeRegistrationRequest");
        assertThat(calfDeath.path("required").toString()).contains("reason");
        assertThat(calfDeath.path("properties").path("reason").path("minLength").asInt()).isEqualTo(1);
        assertThat(calfDeath.path("properties").path("reason").path("maxLength").asInt()).isEqualTo(500);
        assertThat(paths.has("/api/farms")).isTrue();
        assertThat(paths.has("/api/support/tickets")).isTrue();
        assertThat(paths.has("/api/cattle")).isFalse();
        assertThat(paths.has("/api/support-tickets")).isFalse();
        // D42: vaccines alone expose catalogue deletion; retired routes must not return in generated clients.
        assertThat(paths.path("/api/farms/{farmId}/catalogues/breeds/{id}").has("delete")).isFalse();
        assertThat(paths.path("/api/farms/{farmId}/catalogues/production-purposes/{id}").has("delete")).isFalse();
        assertThat(paths.path("/api/farms/{farmId}/medicines/{medicineId}").has("delete")).isFalse();
        assertThat(paths.path("/api/farms/{farmId}/vaccines/{vaccineId}").has("delete")).isTrue();
        assertThat(api.path("components").path("securitySchemes").has("session")).isTrue();
        JsonNode schemas = api.path("components").path("schemas");
        JsonNode notification = schemas.path("NotificationView").path("properties");
        assertThat(notification.has("farmId")).as("SCR-45 payment target farm context").isTrue();
        assertThat(allowsNull(notification.path("farmId"))).as("farmId is null for non-payment targets").isTrue();
        JsonNode supportTicketCreate = schemas.path("Create").path("properties");
        assertThat(supportTicketCreate.path("category").path("enum").toString())
            .contains("ACCOUNT_ACCESS", "PAYMENT", "FARM_SERVICE", "SYSTEM_USAGE", "OTHER");
        assertThat(supportTicketCreate.path("scope").path("enum").toString()).contains("FARM", "ACCOUNT");
        assertThat(supportTicketCreate.path("farmId").path("description").asText()).contains("PAYMENT", "FARM_SERVICE", "ACCOUNT_ACCESS");
        assertThat(schemas.path("RecordFeedingRequest").path("required").toString()).contains("lines");
        for (String name : java.util.List.of("FeedingVoidRequest", "FeedingCorrectionRequest")) {
            JsonNode request = schemas.path(name);
            assertThat(request.path("required").toString()).contains("reason", "expectedVersion");
            assertThat(request.path("properties").path("reason").path("minLength").asInt()).isEqualTo(5);
        }
        assertThat(schemas.path("FeedingCorrectionRequest").path("required").toString()).contains("lines");
        assertThat(schemas.path("DraftRequest").path("required").toString()).contains("title", "body", "recipientRoles");
        assertThat(schemas.path("CorrectionRequest").path("required").toString()).contains("title", "body", "reason", "expectedVersion");
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
        // D26: numeric query values are integers with the server defaults; a typed client must not send them as strings.
        java.util.Map<String, JsonNode> listQuery = new java.util.HashMap<>();
        invitationList.path("parameters").forEach(parameter -> listQuery.put(parameter.path("name").asText(), parameter.path("schema")));
        assertThat(listQuery.get("page").path("type").asText()).as("page %s", listQuery.get("page")).isEqualTo("integer");
        assertThat(listQuery.get("page").path("minimum").asInt()).isZero();
        assertThat(listQuery.get("page").path("maximum").asLong()).isEqualTo(Integer.MAX_VALUE / 100);
        assertThat(listQuery.get("page").path("default").isNumber()).as("page default %s", listQuery.get("page")).isTrue();
        assertThat(listQuery.get("page").path("default").asInt()).isZero();
        assertThat(listQuery.get("size").path("type").asText()).as("size %s", listQuery.get("size")).isEqualTo("integer");
        assertThat(listQuery.get("size").path("minimum").asInt()).isEqualTo(1);
        assertThat(listQuery.get("size").path("maximum").asInt()).isEqualTo(100);
        assertThat(listQuery.get("size").path("default").isNumber()).as("size default %s", listQuery.get("size")).isTrue();
        assertThat(listQuery.get("size").path("default").asInt()).isEqualTo(20);
        assertThat(listQuery.get("invitationId").path("type").asText()).as("invitationId %s", listQuery.get("invitationId")).isEqualTo("integer");
        assertThat(listQuery.get("invitationId").path("format").asText()).isEqualTo("int64");
        assertThat(listQuery.get("invitationId").path("minimum").asInt()).isEqualTo(1);
        assertThat(listQuery.get("sort").path("default").asText()).as("sort %s", listQuery.get("sort")).isEqualTo("lastSentAt");
        assertThat(listQuery.get("dir").path("enum").toString()).isEqualTo("[\"asc\",\"desc\"]");
        assertThat(listQuery.get("dir").path("default").asText()).as("dir %s", listQuery.get("dir")).isEqualTo("desc");
        assertThat(listQuery.get("status").path("default").isMissingNode()).as("status has no default: absent means every state").isTrue();
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
        JsonNode reportLine = api.path("components").path("schemas").path("ReportLine").path("properties");
        assertThat(reportLine.has("sourceVersion")).as("FE21 report snapshot source version").isTrue();
        Files.writeString(Path.of("target","beefcare-openapi.json"),mapper.writerWithDefaultPrettyPrinter().writeValueAsString(api)+"\n",StandardCharsets.UTF_8);
    }

    @Test
    void fe20InternalRequestContractExposesTargetFieldsAndAudienceSafeResponses() throws Exception {
        JsonNode api = readGeneratedApi();
        JsonNode paths = api.path("paths");
        JsonNode schemas = api.path("components").path("schemas");

        JsonNode management = schemas.path("InternalManage");
        assertThat(management.path("properties").path("action").path("enum").toString())
            .contains("CLARIFY", "REASSIGN", "CANCEL");
        assertThat(management.path("properties").path("clarificationText").path("maxLength").asInt()).isEqualTo(2000);
        assertThat(management.path("properties").path("reason").path("maxLength").asInt()).isEqualTo(1000);

        assertThat(schemas.path("InternalCreate").path("properties").path("requestText").path("maxLength").asInt()).isEqualTo(2000);
        JsonNode complete = schemas.path("Complete");
        assertThat(complete.path("properties").path("resultNote").path("maxLength").asInt()).isEqualTo(2000);
        assertThat(complete.path("properties").path("result").isMissingNode()).isTrue();
        assertThat(complete.path("properties").path("domainResultAuditId").isMissingNode()).isTrue();
        assertThat(complete.path("properties").path("outcome").path("enum").toString())
            .isEqualTo("[\"CONFIRMED\",\"NOT_CONFIRMED\",\"NEED_MORE_INFO\",\"OUT_OF_SCOPE\"]");

        assertThat(schemas.has("InternalHistory")).isTrue();
        JsonNode internal = schemas.path("InternalView");
        assertThat(internal.path("properties").path("history").path("items").path("$ref").asText())
            .isEqualTo("#/components/schemas/InternalHistory");
        assertThat(internal.path("properties").has("requestText")).isTrue();
        assertThat(internal.path("properties").has("resultNote")).isTrue();
        assertThat(internal.path("properties").has("question")).isFalse();
        assertThat(internal.path("properties").has("context")).isFalse();
        assertThat(internal.path("properties").has("result")).isFalse();
        assertThat(internal.path("properties").has("domainResultAuditId")).isFalse();
        assertThat(schemas.has("RecipientInternalView")).isTrue();
        JsonNode recipient = schemas.path("RecipientInternalView");
        assertThat(recipient.path("properties").has("requestText")).isTrue();
        assertThat(recipient.path("properties").has("resultNote")).isTrue();
        assertThat(recipient.path("properties").has("question")).isFalse();
        assertThat(recipient.path("properties").has("context")).isFalse();
        assertThat(recipient.path("properties").has("result")).isFalse();
        assertThat(recipient.path("properties").has("domainResultAuditId")).isFalse();

        assertThat(paths.path("/api/platform/internal-requests/{id}/completion").path("post")
            .path("responses").path("200").path("content").toString()).contains("RecipientInternalView");
        assertThat(paths.path("/api/platform/internal-requests").path("get")
            .path("responses").path("200").path("content").toString()).contains("RecipientInternalView");
        assertThat(paths.path("/api/platform/internal-requests/{id}").path("get")
            .path("responses").path("200").path("content").toString()).contains("RecipientInternalView");
        assertThat(paths.has("/api/platform/internal-requests/{id}/domain-results")).isFalse();
    }

    @Test
    void fe01AuthOperationsExposeRuntimeStatusesAndNoBogusCsrfQuery() throws Exception {
        JsonNode api = readGeneratedApi();
        JsonNode paths = api.path("paths");

        assertResponse(paths, "/api/authenticate", "get", "204");
        assertResponse(paths, "/api/authenticate", "post", "204");
        assertResponse(paths, "/api/register", "post", "201");
        assertResponse(paths, "/api/account/google-reauthentication", "post", "204");
        assertResponse(paths, "/api/account/reset-password/init", "post", "200");
        assertResponse(paths, "/api/account/reset-password/validate", "get", "200");
        assertResponse(paths, "/api/account/reset-password/finish", "post", "200");
        assertResponse(paths, "/api/activate", "get", "303");

        JsonNode csrf = paths.path("/api/csrf").path("get");
        assertThat(csrf.path("responses").has("200")).isTrue();
        assertThat(csrf.path("parameters").toString()).doesNotContain("\"token\"");
    }

    @Test
    void fe01PublicAndAuthenticatedSecurityOverridesAreDeclared() throws Exception {
        JsonNode paths = readGeneratedApi().path("paths");

        assertPublic(paths, "/api/csrf", "get");
        assertPublic(paths, "/api/authenticate", "get");
        assertPublic(paths, "/api/activate", "get");
        assertPublic(paths, "/api/account/reset-password/validate", "get");
        assertCsrfOnly(paths, "/api/authenticate", "post");
        assertCsrfOnly(paths, "/api/register", "post");
        assertCsrfOnly(paths, "/api/account/reset-password/init", "post");
        assertCsrfOnly(paths, "/api/account/reset-password/finish", "post");
        assertCsrfOnly(paths, "/api/account/verification/resend", "post");
        assertSessionAndCsrf(paths, "/api/account/terms-acceptance", "post");
        assertSessionAndCsrf(paths, "/api/account/profile", "post");
        assertSessionAndCsrf(paths, "/api/account/change-password", "post");
        assertSessionAndCsrf(paths, "/api/account/google-reauthentication", "post");

        // Logout is installed by Spring Security's filter, not a controller; its curated declaration must still be checked.
        assertThat(paths.has("/api/logout")).as("curated/generated logout operation").isTrue();
        assertProblemResponse(paths.path("/api/authenticate").path("post"), "400");
        assertProblemResponse(paths.path("/api/authenticate").path("post"), "401");
        assertProblemResponse(paths.path("/api/authenticate").path("post"), "403");
        assertProblemResponse(paths.path("/api/authenticate").path("post"), "423");
        assertProblemResponse(paths.path("/api/authenticate").path("get"), "401");
    }

    @Test
    void fe01PasswordAndConditionalSchemasExposeSourceOfTruth() throws Exception {
        JsonNode schemas = readGeneratedApi().path("components").path("schemas");

        JsonNode registration = schemas.path("RegistrationRequest");
        assertRequired(registration, "fullName", "email", "password", "confirmPassword", "termsAccepted");
        assertPasswordSchema(registration.path("properties").path("password"));
        assertPasswordSchema(registration.path("properties").path("confirmPassword"));
        assertThat(registration.path("properties").path("password").path("description").asText())
            .containsIgnoringCase("email");

        JsonNode reset = schemas.path("KeyAndPasswordVM");
        assertRequired(reset, "key", "newPassword", "confirmPassword");
        assertPasswordSchema(reset.path("properties").path("newPassword"));
        assertPasswordSchema(reset.path("properties").path("confirmPassword"));

        JsonNode change = schemas.path("PasswordChangeDTO");
        assertRequired(change, "newPassword", "confirmPassword");
        assertPasswordSchema(change.path("properties").path("newPassword"));
        assertPasswordSchema(change.path("properties").path("confirmPassword"));
        assertThat(change.path("properties").path("currentPassword").path("description").asText())
            .containsIgnoringCase("Google");

        // Sign-in credentials are intentionally separate from password-creation policy: only max-128 is asserted here.
        JsonNode login = schemas.path("LoginVM");
        assertRequired(login, "username", "password");
        assertThat(login.path("properties").path("password").path("maxLength").asInt()).isEqualTo(128);
        assertThat(login.path("properties").path("password").toString()).doesNotContain("uppercase", "lowercase", "digit", "symbol");
    }

    @Test
    void fe01ResetAndErrorSchemasAreGenericAndNullable() throws Exception {
        JsonNode api = readGeneratedApi();
        JsonNode paths = api.path("paths");
        JsonNode schemas = api.path("components").path("schemas");

        JsonNode init = paths.path("/api/account/reset-password/init").path("post");
        assertResponse(init, "200");
        assertThat(init.path("responses").path("200").path("content").isMissingNode())
            .as("reset-init must not disclose account or token data").isTrue();

        assertRequired(schemas.path("EmailRequest"), "email");
        assertRequired(schemas.path("KeyAndPasswordVM"), "key", "newPassword", "confirmPassword");

        JsonNode validation = schemas.path("ResetLinkValidation");
        assertRequired(validation, "valid", "email");
        assertThat(allowsNull(validation.path("properties").path("email"))).isTrue();

        JsonNode problem = schemas.path("ProblemDetail");
        assertThat(problem.path("properties").has("code")).isTrue();
        assertThat(problem.path("properties").has("params")).isTrue();
        assertThat(problem.path("properties").has("message")).isTrue();
        assertThat(problem.path("properties").has("path")).isTrue();
    }

    private JsonNode readGeneratedApi() throws Exception {
        String json = mvc.perform(get("/v3/api-docs/beefcare").with(user("contract-reviewer").roles("ADMIN")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return mapper.readTree(json);
    }

    private void assertResponse(JsonNode paths, String path, String method, String statusCode) {
        assertResponse(paths.path(path).path(method), statusCode);
    }

    private void assertResponse(JsonNode operation, String statusCode) {
        assertThat(operation.path("responses").has(statusCode)).as("response %s in %s", statusCode, operation).isTrue();
    }

    private void assertRequired(JsonNode schema, String... names) {
        for (String name : names) assertThat(schema.path("required").toString()).as("required %s", name).contains(name);
    }

    private void assertPasswordSchema(JsonNode schema) {
        assertThat(schema.path("minLength").asInt()).isEqualTo(8);
        assertThat(schema.path("maxLength").asInt()).isEqualTo(128);
        assertThat(schema.toString()).doesNotContain("(?=.*", "uppercase", "lowercase", "digit", "symbol");
    }

    private void assertPublic(JsonNode paths, String path, String method) {
        JsonNode security = paths.path(path).path(method).path("security");
        assertThat(security.isArray()).as("explicit public security override for %s %s", method, path).isTrue();
        assertThat(security.size()).isZero();
    }

    private void assertCsrfOnly(JsonNode paths, String path, String method) {
        JsonNode security = paths.path(path).path(method).path("security");
        assertThat(security.toString()).contains("csrf").doesNotContain("session");
    }

    private void assertSessionAndCsrf(JsonNode paths, String path, String method) {
        JsonNode security = paths.path(path).path(method).path("security");
        assertThat(security.toString()).contains("session", "csrf");
        assertThat(security.size()).isEqualTo(1);
    }

    private void assertProblemResponse(JsonNode operation, String statusCode) {
        assertThat(operation.path("responses").path(statusCode).toString())
            .as("ProblemDetail response %s", statusCode).contains("#/components/schemas/ProblemDetail");
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
