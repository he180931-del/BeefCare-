package vn.edu.fpt.beefcare.config;

import static org.springframework.security.config.Customizer.withDefaults;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer.FrameOptionsConfig;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.security.web.session.HttpSessionEventPublisher;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.filter.OncePerRequestFilter;
import tech.jhipster.config.JHipsterProperties;
import vn.edu.fpt.beefcare.security.AuthoritiesConstants;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmAccessService;
import vn.edu.fpt.beefcare.web.filter.SpaWebFilter;

@Configuration
@EnableMethodSecurity(securedEnabled = true)
public class SecurityConfiguration {

    @Value("${beefcare.security.cookie-secure:false}")
    private boolean secureCookies;

    @Value("${beefcare.security.google.enabled:false}")
    private boolean googleLoginEnabled;

    private final JHipsterProperties jHipsterProperties;

    public SecurityConfiguration(JHipsterProperties jHipsterProperties) {
        this.jHipsterProperties = jHipsterProperties;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SessionRegistry sessionRegistry() {
        return new SessionRegistryImpl();
    }

    @Bean
    public HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    public SecurityFilterChain filterChain(
        HttpSecurity http,
        FarmAccessService farmAccessService,
        SessionRegistry sessionRegistry,
        vn.edu.fpt.beefcare.security.GoogleOidcSuccessHandler googleSuccessHandler
    ) throws Exception {
        CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepository.setCookiePath("/");
        csrfRepository.setCookieCustomizer(cookie -> cookie.secure(secureCookies).sameSite("Lax"));
        CsrfTokenRequestAttributeHandler csrfRequestHandler = new CsrfTokenRequestAttributeHandler();

        http.cors(withDefaults())
            .csrf(csrf -> csrf.csrfTokenRepository(csrfRepository).csrfTokenRequestHandler(csrfRequestHandler).ignoringRequestMatchers("/api/webhooks/sepay"))
            .addFilterAfter(new SpaWebFilter(), AnonymousAuthenticationFilter.class)
            .addFilterAfter(new ActiveAccountFilter(farmAccessService, sessionRegistry), AnonymousAuthenticationFilter.class)
            .headers(headers ->
                headers
                    .contentSecurityPolicy(csp -> csp.policyDirectives(jHipsterProperties.getSecurity().getContentSecurityPolicy()))
                    .frameOptions(FrameOptionsConfig::sameOrigin)
                    .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
            )
            .authorizeHttpRequests(authz ->
                authz
                    .requestMatchers("/index.html", "/*.js", "/*.txt", "/*.json", "/*.map", "/*.css").permitAll()
                    .requestMatchers("/*.ico", "/*.png", "/*.svg", "/*.webapp").permitAll()
                    .requestMatchers("/app/**", "/i18n/**", "/content/**", "/swagger-ui/**").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/csrf", "/api/authenticate").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/authenticate", "/api/register", "/api/account/reset-password/init", "/api/account/reset-password/finish").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/account/verification/resend").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/account/reset-password/validate").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/activate").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/logout").authenticated()
                    .requestMatchers("/api/account/**").authenticated()
                    .requestMatchers("/api/farms/**").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/notifications/mine").authenticated()
                    .requestMatchers(HttpMethod.PUT, "/api/notifications/read-all").authenticated()
                    .requestMatchers(HttpMethod.PUT, "/api/notifications/*/read").authenticated()
                    .requestMatchers("/api/invitations/**").authenticated()
                    .requestMatchers("/api/platform/accounts/**").authenticated()
                    .requestMatchers("/api/platform/audit/**").authenticated()
                    .requestMatchers("/api/platform/plan-prices/**").authenticated()
                    .requestMatchers("/api/platform/payments/**").authenticated()
                    .requestMatchers("/api/platform/finance/**").authenticated()
                    .requestMatchers("/api/platform/farms/**").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/platform/subscriptions", "/api/platform/subscriptions/*").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/public/prices").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/public/landing").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/webhooks/sepay").permitAll()
                    .requestMatchers("/api/dev/sepay/**").authenticated()
                    .requestMatchers("/api/support/tickets/**", "/api/platform/support/tickets/**", "/api/platform/support/recipients", "/api/platform/internal-requests/**").authenticated()
                    .requestMatchers("/api/admin/**").hasAuthority(AuthoritiesConstants.ADMIN)
                    .requestMatchers("/v3/api-docs/**").hasAuthority(AuthoritiesConstants.ADMIN)
                    .requestMatchers("/management/health", "/management/health/**", "/management/info", "/management/prometheus").permitAll()
                    .requestMatchers("/management/**").hasAuthority(AuthoritiesConstants.ADMIN)
                    // Unfinished JHipster entity CRUD controllers and all other API routes are deliberately closed.
                    .requestMatchers("/api/**").denyAll()
                    .anyRequest().permitAll()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .logout(logout ->
                logout
                    .logoutUrl("/api/logout")
                    .deleteCookies("JSESSIONID", "XSRF-TOKEN")
                    .invalidateHttpSession(true)
                    .logoutSuccessHandler((request, response, authentication) -> response.setStatus(HttpServletResponse.SC_NO_CONTENT))
            )
            .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint((request, response, exception) -> response.sendError(401)));

        if (googleLoginEnabled) http.oauth2Login(oauth2 -> oauth2.successHandler(googleSuccessHandler));

        return http.build();
    }

    /** Forces account revocation and account-status changes to take effect on the next authenticated API request. */
    static final class ActiveAccountFilter extends OncePerRequestFilter {

        private final FarmAccessService access;
        private final SessionRegistry sessionRegistry;

        ActiveAccountFilter(FarmAccessService access, SessionRegistry sessionRegistry) {
            this.access = access;
            this.sessionRegistry = sessionRegistry;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
            var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (request.getRequestURI().startsWith(request.getContextPath() + "/api/") &&
                authentication != null && authentication.isAuthenticated() &&
                !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) &&
                !request.getRequestURI().equals(request.getContextPath() + "/api/csrf")) {
                var session = request.getSession(false);
                if (session != null) {
                    var sessionInformation = sessionRegistry.getSessionInformation(session.getId());
                    if (sessionInformation != null && sessionInformation.isExpired()) {
                        session.invalidate();
                        org.springframework.security.core.context.SecurityContextHolder.clearContext();
                        response.sendError(401);
                        return;
                    }
                }
                try {
                    access.currentActiveUser();
                } catch (DomainException ex) {
                    if (session != null) {
                        var sessionInformation = sessionRegistry.getSessionInformation(session.getId());
                        if (sessionInformation != null) {
                            sessionInformation.expireNow();
                        }
                        session.invalidate();
                    }
                    org.springframework.security.core.context.SecurityContextHolder.clearContext();
                    response.sendError(ex.getStatus().value());
                    return;
                }
            }
            chain.doFilter(request, response);
        }
    }
}
