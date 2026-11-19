package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.fpt.beefcare.IntegrationTest;

@IntegrationTest @AutoConfigureMockMvc @WithMockUser
class FarmAnnouncementResourceIT {
    @Autowired MockMvc mvc;
    @Test void unsafeGeneratedAnnouncementCrudIsNotRegistered() throws Exception {mvc.perform(get("/api/farm-announcements")).andExpect(status().isNotFound());}
}
