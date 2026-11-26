package vn.edu.fpt.beefcare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
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
                nullableFields(api, "NotificationView", "farmId");
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
                fe01AuthContract(api);
            })
            .build();
    }

    private static void fe01AuthContract(OpenAPI api) {
        var paths = api.getPaths();
        var schemas = api.getComponents().getSchemas();

        Operation authenticated = paths.get("/api/authenticate").getGet();
        authenticated.setResponses(new ApiResponses()
            .addApiResponse("204", new ApiResponse().description("Authenticated"))
            .addApiResponse("401", problemResponse("Not authenticated")));
        authenticated.setSecurity(java.util.List.of());

        Operation login = paths.get("/api/authenticate").getPost();
        login.setResponses(new ApiResponses()
            .addApiResponse("204", new ApiResponse().description("Authenticated"))
            .addApiResponse("400", problemResponse("Invalid credentials request"))
            .addApiResponse("401", problemResponse("Authentication failed"))
            .addApiResponse("403", problemResponse("Account suspended"))
            .addApiResponse("423", problemResponse("Authentication temporarily locked")));
        login.setSecurity(java.util.List.of(new SecurityRequirement().addList("csrf")));

        Operation csrf = paths.get("/api/csrf").getGet();
        csrf.setParameters(java.util.List.of());
        csrf.setSecurity(java.util.List.of());

        Operation activate = paths.get("/api/activate").getGet();
        activate.getResponses().remove("200");
        activate.getResponses().addApiResponse("303", new ApiResponse().description("Activated and redirected"));
        activate.setSecurity(java.util.List.of());

        setPublic(paths, "/api/account/reset-password/validate", "get");
        setCsrfOnly(paths, "/api/register", "post");
        setCsrfOnly(paths, "/api/account/reset-password/init", "post");
        setCsrfOnly(paths, "/api/account/reset-password/finish", "post");
        setCsrfOnly(paths, "/api/account/verification/resend", "post");
        setSessionAndCsrf(paths, "/api/account/terms-acceptance", "post");
        setSessionAndCsrf(paths, "/api/account/profile", "post");
        setSessionAndCsrf(paths, "/api/account/change-password", "post");
        setSessionAndCsrf(paths, "/api/account/google-reauthentication", "post");

        Operation resetInit = paths.get("/api/account/reset-password/init").getPost();
        resetInit.getResponses().get("200").setContent(null);

        PathItem logout = new PathItem();
        logout.setPost(new Operation()
            .operationId("logout")
            .addTagsItem("authenticate-controller")
            .responses(new ApiResponses().addApiResponse("204", new ApiResponse().description("Logged out")))
            .security(java.util.List.of(new SecurityRequirement().addList("session").addList("csrf"))));
        paths.addPathItem("/api/logout", logout);

        required(schemas.get("RegistrationRequest"), "fullName", "email", "password", "confirmPassword", "termsAccepted");
        required(schemas.get("EmailRequest"), "email");
        required(schemas.get("KeyAndPasswordVM"), "key", "newPassword", "confirmPassword");
        required(schemas.get("ResetLinkValidation"), "valid", "email");
        required(schemas.get("PasswordChangeDTO"), "newPassword", "confirmPassword");

        Schema<?> loginPassword = property(schemas.get("LoginVM"), "password");
        if (loginPassword != null) {
            loginPassword.setMaxLength(128);
            loginPassword.setDescription("Sign-in credential; required and at most 128 Unicode code points. Creation and reset password rules do not apply here.");
        }

        passwordSchema(property(schemas.get("RegistrationRequest"), "password"),
            "8–128 Unicode code points; must not equal the email address (case-insensitive); no composition rule.");
        passwordSchema(property(schemas.get("RegistrationRequest"), "confirmPassword"),
            "Must match password; 8–128 Unicode code points; no composition rule.");
        passwordSchema(property(schemas.get("KeyAndPasswordVM"), "newPassword"),
            "8–128 Unicode code points; must not equal the account email; no composition rule.");
        passwordSchema(property(schemas.get("KeyAndPasswordVM"), "confirmPassword"),
            "Must match newPassword; 8–128 Unicode code points; no composition rule.");
        passwordSchema(property(schemas.get("PasswordChangeDTO"), "newPassword"),
            "8–128 Unicode code points; must not equal the account email; no composition rule.");
        passwordSchema(property(schemas.get("PasswordChangeDTO"), "confirmPassword"),
            "Must match newPassword; 8–128 Unicode code points; no composition rule.");
        Schema<?> currentPassword = property(schemas.get("PasswordChangeDTO"), "currentPassword");
        if (currentPassword != null) currentPassword.setDescription("Required for password accounts; optional only with a recent server-verified Google reauthentication.");
        Schema<?> registrationEmail = property(schemas.get("RegistrationRequest"), "email");
        if (registrationEmail != null) {
            registrationEmail.setFormat("email");
            registrationEmail.setMinLength(1);
            registrationEmail.setMaxLength(254);
        }
        Schema<?> resetEmail = property(schemas.get("EmailRequest"), "email");
        if (resetEmail != null) {
            resetEmail.setFormat("email");
            resetEmail.setMinLength(1);
            resetEmail.setMaxLength(254);
        }
        nullableFields(api, "ResetLinkValidation", "email");

        Schema<?> problem = schemas.get("ProblemDetail");
        problem.addProperty("code", new StringSchema().description("Stable BeefCare error code."));
        problem.addProperty("params", new Schema<>().type("object").description("Safe structured error parameters."));
        problem.addProperty("message", new StringSchema().description("User-facing or generic error message."));
        problem.addProperty("path", new StringSchema().format("uri").description("Request path."));
    }

    private static ApiResponse problemResponse(String description) {
        return new ApiResponse().description(description).content(new Content().addMediaType("application/problem+json",
            new MediaType().schema(new Schema<>().$ref("#/components/schemas/ProblemDetail"))));
    }

    private static void required(Schema<?> schema, String... fields) {
        if (schema != null) schema.setRequired(java.util.List.of(fields));
    }

    private static void passwordSchema(Schema<?> schema, String description) {
        if (schema == null) return;
        schema.setMinLength(8);
        schema.setMaxLength(128);
        schema.setDescription(description);
    }

    private static Schema<?> property(Schema<?> schema, String name) {
        if (schema == null || schema.getProperties() == null) return null;
        Object value = schema.getProperties().get(name);
        return value instanceof Schema<?> typed ? typed : null;
    }

    private static void setPublic(io.swagger.v3.oas.models.Paths paths, String path, String method) {
        Operation operation = operation(paths, path, method);
        if (operation != null) operation.setSecurity(java.util.List.of());
    }

    private static void setCsrfOnly(io.swagger.v3.oas.models.Paths paths, String path, String method) {
        Operation operation = operation(paths, path, method);
        if (operation != null) operation.setSecurity(java.util.List.of(new SecurityRequirement().addList("csrf")));
    }

    private static void setSessionAndCsrf(io.swagger.v3.oas.models.Paths paths, String path, String method) {
        Operation operation = operation(paths, path, method);
        if (operation != null) operation.setSecurity(java.util.List.of(new SecurityRequirement().addList("session").addList("csrf")));
    }

    private static Operation operation(io.swagger.v3.oas.models.Paths paths, String path, String method) {
        PathItem item = paths.get(path);
        if (item == null) return null;
        return switch (method) {
            case "get" -> item.getGet();
            case "post" -> item.getPost();
            default -> null;
        };
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
