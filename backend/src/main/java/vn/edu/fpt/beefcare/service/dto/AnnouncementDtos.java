package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class AnnouncementDtos {
    private AnnouncementDtos(){}
    public record DraftRequest(@NotBlank @Size(max=255) String title,@NotBlank @Size(max=10000) String body,
        @NotEmpty List<@NotBlank String> recipientRoles,Integer expectedVersion){}
    public record PublishRequest(@NotNull Integer expectedVersion){}
    public record CorrectionRequest(@NotBlank @Size(max=255) String title,@NotBlank @Size(max=10000) String body,
        @NotBlank @Size(max=500) String reason,@NotNull Integer expectedVersion){}
    public record VersionView(Long id,Integer versionNo,String title,String body,Instant publishedTime,
        String correctionReason,boolean unread){}
    public record AnnouncementView(Long id,String state,String authorName,String draftTitle,String draftBody,
        Integer version,List<VersionView> versions){}
    public record ReadResult(Long recipientId,Instant readTime){}
}
