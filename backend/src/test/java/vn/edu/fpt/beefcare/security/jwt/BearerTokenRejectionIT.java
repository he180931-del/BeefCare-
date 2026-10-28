package vn.edu.fpt.beefcare.security.jwt;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;

@AutoConfigureMockMvc
@ServiceIntegrationTest
class BearerTokenRejectionIT {

    @Autowired MockMvc mockMvc;

    @Test
    void bearerTokensAreNotAcceptedAsSessions() throws Exception {
        mockMvc.perform(get("/api/authenticate").header(AUTHORIZATION, "Bearer arbitrary-token"))
            .andExpect(status().isUnauthorized());
    }
}

