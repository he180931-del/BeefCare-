package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.assertj.core.api.Assertions.assertThat;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;

@ServiceIntegrationTest
@TestPropertySource(properties = { "beefcare.security.cookie-same-site=None", "beefcare.security.cookie-secure=true" })
class CrossSiteCookieConfigurationIT {

    @Autowired MockMvc mockMvc;

    @Test
    void csrfCookieUsesSecureCrossSiteAttributesWhenConfiguredForProduction() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/csrf")).andExpect(status().isOk()).andReturn();

        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.getSecure()).isTrue();
        assertThat(cookie.getAttribute("SameSite")).isEqualTo("None");
    }
}
