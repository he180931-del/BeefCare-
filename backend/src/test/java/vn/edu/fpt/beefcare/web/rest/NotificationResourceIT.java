package vn.edu.fpt.beefcare.web.rest;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.service.NotificationService;
import vn.edu.fpt.beefcare.service.NotificationService.NotificationView;

@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class NotificationResourceIT {
    @Autowired MockMvc mvc;
    @MockBean NotificationService notifications;

    @Test void inboxUsesTheAuthenticatedRecipientsProjection() throws Exception {
        when(notifications.mine()).thenReturn(List.of(new NotificationView(5L,"SUPPORT","Reply received","Open your ticket","SUPPORT_TICKET",7L,Instant.parse("2026-10-28T10:00:00Z"),null)));
        mvc.perform(get("/api/notifications/mine")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(5)).andExpect(jsonPath("$[0].targetId").value(7));
        verify(notifications).mine();
    }

    @Test void recipientCanMarkOneOrAllNoticesReadWithCsrf() throws Exception {
        when(notifications.markRead(5L)).thenReturn(new NotificationView(5L,"SUPPORT","Reply received","Open your ticket","SUPPORT_TICKET",7L,Instant.parse("2026-10-28T10:00:00Z"),Instant.parse("2026-10-28T10:01:00Z")));
        when(notifications.markAllAsRead()).thenReturn(3);
        mvc.perform(put("/api/notifications/5/read").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.readTime").exists());
        mvc.perform(put("/api/notifications/read-all").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isOk()).andExpect(content().string("3"));
        verify(notifications).markRead(5L);verify(notifications).markAllAsRead();
    }

    @Test void genericCrudCannotCreateArbitraryRecipientNotifications() throws Exception {
        mvc.perform(post("/api/notifications").contentType(MediaType.APPLICATION_JSON).content("{\"recipient\":{\"id\":999},\"targetType\":\"FARM\",\"targetId\":1}"))
            .andExpect(status().isNotFound());
        verifyNoInteractions(notifications);
    }
}
