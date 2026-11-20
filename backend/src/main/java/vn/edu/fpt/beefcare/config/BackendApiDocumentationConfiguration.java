package vn.edu.fpt.beefcare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Published business endpoints only. Generated, denied entity CRUD is excluded from the FE contract. */
@Configuration
public class BackendApiDocumentationConfiguration {
    @Bean
    GroupedOpenApi beefCareBusinessApi() {
        return GroupedOpenApi.builder().group("beefcare")
            .pathsToMatch("/api/farms", "/api/farms/**", "/api/csrf", "/api/authenticate", "/api/register", "/api/activate",
                "/api/account", "/api/account/**", "/api/invitations/**", "/api/support/tickets/**", "/api/platform/**",
                "/api/public/**", "/api/notifications/mine", "/api/notifications/*/read", "/api/notifications/read-all", "/api/webhooks/sepay", "/api/v1/payments/sepay/webhook")
            .addOpenApiCustomizer(api -> api.info(new Info().title("BeefCare backend API").version("2026-10-28")
                .description("Work in progress. Session cookie authentication; fetch /api/csrf before login and commands. " +
                    "Mutating business commands require Idempotency-Key and observed versions where specified. " +
                    "Identifiers are numeric IDs; display codes are separate fields. See docs/api/README.md for integration and verification status.")))
            .addOpenApiCustomizer(api -> {
                // FE-03 / D25: record annotations do not export requiredness or numeric enums reliably in 3.1.
                Schema<?> invite = api.getComponents().getSchemas().get("InviteRequest");
                if (invite != null) {
                    invite.setRequired(java.util.List.of("email", "role"));
                    invite.addProperty("email", new StringSchema().format("email").minLength(1).maxLength(254));
                    invite.addProperty("role", new StringSchema()._enum(java.util.List.of("MANAGER", "TECHNICIAN")));
                    IntegerSchema days = new IntegerSchema();
                    days.setEnum(java.util.List.of(3, 7, 14)); days.setDefault(7);
                    invite.addProperty("validityDays", days);
                    nullableFields(api, "InviteRequest", "validityDays");
                }
                Schema<?> invitation = api.getComponents().getSchemas().get("InvitationView");
                if (invitation != null) {
                    invitation.setRequired(java.util.List.of("id", "email", "role", "status", "createdAt", "lastSentAt", "expiresAt", "validityDays", "version", "hasAccount"));
                    invitation.addProperty("role", new StringSchema()._enum(java.util.List.of("MANAGER", "TECHNICIAN")));
                    invitation.addProperty("status", new StringSchema()._enum(java.util.List.of("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED")));
                    IntegerSchema duration = new IntegerSchema(); duration.setEnum(java.util.List.of(3, 7, 14));
                    invitation.addProperty("validityDays", duration);
                }
                Schema<?> invitationPage = api.getComponents().getSchemas().get("InvitationPage");
                if (invitationPage != null) {
                    invitationPage.setRequired(java.util.List.of("items", "total", "page", "size", "counts", "asOf"));
                    Schema<?> counts = new Schema<>().type("object");
                    counts.setRequired(java.util.List.of("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"));
                    for (String state : java.util.List.of("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED")) {
                        counts.addProperty(state, new IntegerSchema().format("int64").minimum(java.math.BigDecimal.ZERO));
                    }
                    counts.setAdditionalProperties(false); invitationPage.addProperty("counts", counts);
                }
                for (String route : java.util.List.of("/api/webhooks/sepay", "/api/v1/payments/sepay/webhook")) {
                    if (api.getPaths().get(route) != null && api.getPaths().get(route).getPost() != null)
                        api.getPaths().get(route).getPost().setSecurity(java.util.List.of());
                }
                // OpenAPI 3.1 needs an explicit null alternative; nullable=true is a 3.0 keyword and is omitted on export.
                nullableFields(api, "SubscriptionOverview", "latestEnd", "renewalOpensAt", "suspendedSince", "currentPeriod",
                    "daysRemaining", "currentPrices", "pendingPayment");
                nullableFields(api, "SubscriptionRequestEligibility", "reason", "opensAt");
                nullableFields(api, "PaymentDTO", "purchasedStart", "purchasedEnd", "receiptCode", "qrImageUrl",
                    "bankCode", "accountNumber", "accountName", "bankPaidAt", "receivedAt", "confirmedAt", "confirmationSource");
                nullableFields(api, "PlatformBankEvidenceRow", "direction", "content", "reviewReason", "receivingAccountMatches", "paymentId", "paymentCode");
                nullableFields(api, "PlatformBankEvidenceDetail", "receivingAccount", "bank", "referenceCode", "quoteRef", "firstReceivedAt",
                    "returnReference", "returnDate", "returnResult");
                nullableFields(api, "PlatformEvidenceHistory", "reason", "reference", "result", "returnDate", "pmId", "pmName",
                    "relatedPaymentId", "relatedPaymentCode");
                nullableFields(api, "SePayLookupRow", "content", "referenceCode", "evidenceId");
                nullableFields(api, "SePayPayload", "gateway", "accountNumber", "code", "content", "referenceCode", "description");
                nullableFields(api, "PlatformPlanPriceVersion", "terms", "publishedById", "publishedBy", "publishedAt", "withdrawnBy", "withdrawnAt", "withdrawReason");
                nullableFields(api, "PlatformPlanPricePage", "current", "nextEffectiveAt");
                nullableFields(api, "PublishPriceRequest", "effectiveAt", "terms");
                nullableFields(api, "PlatformPaymentRead", "purchasedStart", "purchasedEnd", "receiptCode", "requestedByEmail",
                    "evidenceId", "confirmedAt", "confirmationSource", "bankPaidAt", "receivedAt");
            })
            .build();
    }

    private static void nullableFields(OpenAPI api, String name, String... fields) {
        Schema<?> model = api.getComponents().getSchemas().get(name);
        if (model == null || model.getProperties() == null) return;
        for (String field : fields) {
            Schema<?> original = model.getProperties().get(field);
            if (original == null) continue;
            ComposedSchema nullable = new ComposedSchema();
            nullable.setDescription(original.getDescription());
            nullable.addAnyOfItem(original);
            nullable.addAnyOfItem(new Schema<>().types(java.util.Set.of("null")));
            model.addProperty(field, nullable);
        }
    }
    @Bean
    OpenAPI beefCareApiMetadata() {
        return new OpenAPI().addServersItem(new Server().url("/")).components(new Components()
            .addSecuritySchemes("session", new SecurityScheme().type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("JSESSIONID"))
            .addSecuritySchemes("csrf", new SecurityScheme().type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name("X-XSRF-TOKEN")))
            .addSecurityItem(new SecurityRequirement().addList("session"));
    }
}
