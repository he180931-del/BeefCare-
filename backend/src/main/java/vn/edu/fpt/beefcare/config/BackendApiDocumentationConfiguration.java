package vn.edu.fpt.beefcare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
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
                "/api/public/**", "/api/notifications/mine", "/api/notifications/*/read", "/api/notifications/read-all", "/api/webhooks/sepay")
            .addOpenApiCustomizer(api -> api.info(new Info().title("BeefCare backend API").version("2026-10-28")
                .description("Work in progress. Session cookie authentication; fetch /api/csrf before login and commands. " +
                    "Mutating business commands require Idempotency-Key and observed versions where specified. " +
                    "Identifiers are numeric IDs; display codes are separate fields. See docs/api/README.md for integration and verification status.")))
            .build();
    }
    @Bean
    OpenAPI beefCareApiMetadata() {
        return new OpenAPI().addServersItem(new Server().url("/")).components(new Components()
            .addSecuritySchemes("session", new SecurityScheme().type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("JSESSIONID"))
            .addSecuritySchemes("csrf", new SecurityScheme().type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name("X-XSRF-TOKEN")))
            .addSecurityItem(new SecurityRequirement().addList("session"));
    }
}
