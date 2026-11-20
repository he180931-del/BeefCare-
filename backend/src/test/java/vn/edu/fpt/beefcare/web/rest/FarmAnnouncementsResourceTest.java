package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FarmAnnouncementService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.AnnouncementView;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.CorrectionRequest;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.DraftRequest;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.PublishRequest;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.ReadResult;

@ExtendWith(MockitoExtension.class)
class FarmAnnouncementsResourceTest {
    private static final Long FARM_ID = 12L;
    private static final Long ANNOUNCEMENT_ID = 200L;
    private static final Long RECIPIENT_ID = 401L;
    private static final String KEY = "fe07-command-key";

    @Mock FarmAnnouncementService service;
    @Mock IdempotencyCommandService commands;
    @Captor ArgumentCaptor<Object> requestCaptor;

    FarmAnnouncementsResource resource;

    @BeforeEach
    void setUp() {
        resource = new FarmAnnouncementsResource(service, commands);
    }

    @Test
    void everyMutationUsesFarmScopedIdempotencyWithTheSuppliedKeyAndVersionedPayload() {
        DraftRequest create = new DraftRequest("Title", "Body", List.of("TECHNICIAN"), null);
        DraftRequest update = new DraftRequest("Updated", "Body", List.of("TECHNICIAN"), 3);
        PublishRequest publish = new PublishRequest(4);
        CorrectionRequest correction = new CorrectionRequest("Fixed", "Body", "Reason", 5);

        resource.createDraft(FARM_ID, KEY, create);
        resource.updateDraft(FARM_ID, ANNOUNCEMENT_ID, KEY, update);
        resource.publish(FARM_ID, ANNOUNCEMENT_ID, KEY, publish);
        resource.correct(FARM_ID, ANNOUNCEMENT_ID, KEY, correction);
        resource.markRead(FARM_ID, RECIPIENT_ID, KEY);

        verify(commands).execute(
            eq(FARM_ID),
            eq(FarmAction.MANAGE_ANNOUNCEMENTS),
            eq("ANNOUNCEMENT_DRAFT_CREATE"),
            eq(KEY),
            eq(create),
            eq(AnnouncementView.class),
            any(Supplier.class)
        );
        verify(commands).execute(
            eq(FARM_ID),
            eq(FarmAction.MANAGE_ANNOUNCEMENTS),
            eq("ANNOUNCEMENT_DRAFT_UPDATE:" + ANNOUNCEMENT_ID),
            eq(KEY),
            requestCaptor.capture(),
            eq(AnnouncementView.class),
            any(Supplier.class)
        );
        verify(commands).execute(
            eq(FARM_ID),
            eq(FarmAction.MANAGE_ANNOUNCEMENTS),
            eq("ANNOUNCEMENT_PUBLISH:" + ANNOUNCEMENT_ID),
            eq(KEY),
            requestCaptor.capture(),
            eq(AnnouncementView.class),
            any(Supplier.class)
        );
        verify(commands).execute(
            eq(FARM_ID),
            eq(FarmAction.MANAGE_ANNOUNCEMENTS),
            eq("ANNOUNCEMENT_CORRECT:" + ANNOUNCEMENT_ID),
            eq(KEY),
            requestCaptor.capture(),
            eq(AnnouncementView.class),
            any(Supplier.class)
        );
        verify(commands).execute(
            eq(FARM_ID),
            eq(FarmAction.VIEW_ANNOUNCEMENTS),
            eq("ANNOUNCEMENT_READ:" + RECIPIENT_ID),
            eq(KEY),
            eq(Map.of("recipientId", RECIPIENT_ID)),
            eq(ReadResult.class),
            any(Supplier.class)
        );

        assertThat(requestCaptor.getAllValues())
            .extracting(Object::toString)
            .anySatisfy(value -> org.assertj.core.api.Assertions.assertThat(value).contains("id=" + ANNOUNCEMENT_ID, "expectedVersion=" + update.expectedVersion()))
            .anySatisfy(value -> org.assertj.core.api.Assertions.assertThat(value).contains("id=" + ANNOUNCEMENT_ID, "expectedVersion=" + publish.expectedVersion()))
            .anySatisfy(value -> org.assertj.core.api.Assertions.assertThat(value).contains("id=" + ANNOUNCEMENT_ID, "expectedVersion=" + correction.expectedVersion()));
    }

    @Test
    void recipientOptionsUseTheDedicatedAnnouncementRoute() {
        resource.recipients(FARM_ID);

        verify(service).listEligibleRecipients(FARM_ID);
    }
}
