package vn.edu.fpt.beefcare.service.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Request and response contracts for the farm announcement workflow. */
public final class AnnouncementDtos {
    private AnnouncementDtos() {}

    public record DraftRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(min = 1, max = 150) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(min = 1, max = 5000) String body,
        @NotNull List<@NotBlank String> recipientRoles,
        // IDs are FarmMembership IDs (the same IDs returned in MemberOption.id), never AppUser IDs.
        // Null means an older client omitted the additive field; on update the service preserves the saved selection.
        List<@NotNull Long> recipientMemberIds,
        @Schema(description = "Required when updating a draft; omit when creating one") Integer expectedVersion
    ) {
        /** Source compatibility for role-only FE-07 callers. */
        public DraftRequest(String title, String body, List<String> recipientRoles, Integer expectedVersion) {
            this(title, body, recipientRoles, null, expectedVersion);
        }
    }

    public record PublishRequest(@NotNull Integer expectedVersion) {}

    public record CorrectionRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(min = 1, max = 150) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(min = 1, max = 5000) String body,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(min = 1, max = 500) String reason,
        @NotNull Integer expectedVersion
    ) {}

    public record MemberOption(Long id, String name, String role, boolean active) {}

    public record VersionView(Long id, Integer versionNo, String title, String body, Instant publishedTime, String correctionReason, boolean unread) {}

    public record DeliveryView(Long recipientId, String name, String role, String status, Instant readTime) {}

    /** All fields are scoped to the caller's membership in the requested farm. */
    public record AnnouncementView(
        Long id,
        String state,
        String authorName,
        String authorRole,
        String draftTitle,
        String draftBody,
        String title,
        String body,
        Integer version,
        List<String> recipientRoles,
        List<Long> recipientMemberIds,
        List<VersionView> versions,
        Integer recipientCount,
        List<DeliveryView> deliveries,
        Instant publishedTime,
        String farmName,
        boolean unread,
        Instant readTime,
        boolean isAuthor,
        boolean isReceived,
        boolean canCorrect,
        Long myDeliveryId
    ) {}

    public record PublishPreview(AnnouncementView announcement, List<MemberOption> recipients) {}

    public record ReadResult(Long recipientId, Instant readTime) {}
}
