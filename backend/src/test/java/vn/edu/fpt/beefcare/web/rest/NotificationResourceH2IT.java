package vn.edu.fpt.beefcare.web.rest;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.service.NotificationService;
import vn.edu.fpt.beefcare.service.NotificationService.NotificationView;

/**
 * HTTP contract test using the offline H2 service-test profile and a mocked service.
 * It checks MockMvc routes/security only; it does not replace PostgreSQL/Testcontainers verification or exercise
 * PostgreSQL-specific DDL and transaction behavior.
 */
@ServiceIntegrationTest
@WithMockUser
class NotificationResourceH2IT {
    @Autowired MockMvc mvc;
    @MockBean NotificationService notifications;

    @Test
    void authenticatedRecipientCanReadOnlyTheirInboxProjection() throws Exception {
        when(notifications.mine()).thenReturn(List.of(new NotificationView(
            5L,
            "ANNOUNCEMENT",
            "Lịch tiêm phòng tháng 11",
            "Trại An Bình · Thông báo mới · phiên bản 2",
            "ANNOUNCEMENT_VERSION",
            12L,
            Instant.parse("2026-11-15T10:00:00Z"),
            null
        )));

        mvc.perform(get("/api/notifications/mine"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(5))
            .andExpect(jsonPath("$[0].category").value("ANNOUNCEMENT"))
            .andExpect(jsonPath("$[0].targetType").value("ANNOUNCEMENT_VERSION"))
            .andExpect(jsonPath("$[0].targetId").value(12));

        verify(notifications).mine();
    }

    @Test
    void recipientCanMarkOneOrAllNoticesReadWithCsrf() throws Exception {
        when(notifications.markRead(5L)).thenReturn(new NotificationView(
            5L,
            "ANNOUNCEMENT",
            "Lịch tiêm phòng tháng 11",
            "Trại An Bình · Thông báo mới · phiên bản 2",
            "ANNOUNCEMENT_VERSION",
            12L,
            Instant.parse("2026-11-15T10:00:00Z"),
            Instant.parse("2026-11-15T10:01:00Z")
        ));
        when(notifications.markAllAsRead()).thenReturn(3);

        mvc.perform(put("/api/notifications/5/read").with(SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.readTime").exists());
        mvc.perform(put("/api/notifications/read-all").with(SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isOk())
            .andExpect(content().string("3"));

        verify(notifications).markRead(5L);
        verify(notifications).markAllAsRead();
    }

    @Test
    void notificationResourceDoesNotExposeGenericCrudRoutes() throws Exception {
        // SecurityConfiguration's final /api/** deny rule rejects these paths before MVC can return 404.
        mvc.perform(get("/api/notifications"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/notifications")
                .with(SecurityMockMvcRequestPostProcessors.csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"recipient\":{\"id\":999},\"targetType\":\"FARM\",\"targetId\":1}"))
            .andExpect(status().isForbidden());
        mvc.perform(delete("/api/notifications/5").with(SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isForbidden());

        verifyNoInteractions(notifications);
    }
}
