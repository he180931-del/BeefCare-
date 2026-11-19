package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;

public final class SupportDtos {
    private SupportDtos() {}
    public record Create(@NotBlank String category,@NotBlank String scope,Long farmId,@NotBlank @Size(max=150) String subject,@NotBlank @Size(max=3000) String description) {}
    public record Reply(@NotBlank @Size(max=3000) String content,@NotNull Integer expectedVersion) {}
    public record Processing(@NotBlank String action,Long recipientId,String category,String priority,@Size(max=1000) String reason,@Size(max=3000) String question,@NotNull Integer expectedVersion) {}
    public record Resolution(@NotBlank @Size(max=3000) String content,@NotNull Integer expectedVersion) {}
    public record Acknowledge(@NotNull Integer resolutionVersion,@Size(max=1000) String comment,@NotNull Integer expectedVersion) {}
    public record Reopen(@NotBlank @Size(max=1000) String reason,@NotNull Integer expectedVersion) {}
    public record Close(boolean reviewedAcknowledgment,@Size(max=500) String note,@NotNull Integer expectedVersion) {}
    public record ContextReference(@NotBlank String type,@NotNull Long id) {}
    public record InternalCreate(@NotNull PlatformRole targetRole,@NotNull Long recipientId,@NotBlank @Size(max=2000) String question,List<@jakarta.validation.Valid ContextReference> context,@NotNull Integer ticketVersion) {}
    public record InternalManage(@NotBlank String action,Long recipientId,@NotBlank @Size(max=1000) String reason,@NotNull Integer expectedVersion) {}
    public record Complete(@NotBlank String outcome,@NotBlank @Size(max=2000) String result,Long domainResultAuditId,@NotNull Integer expectedVersion) {}
    public record Message(Long id,String type,String audience,Long authorId,String author,String authorRole,String content,Instant createdAt) {}
    public record ResolutionView(Long id,int version,String content,String resolvedBy,Instant resolvedAt,boolean acknowledged,Instant acknowledgedAt,String acknowledgmentComment,boolean reviewed) {}
    public record InternalView(Long id,String code,Long ticketId,String ticketCode,Long farmId,String farmName,String targetRole,Long recipientId,String recipient,
        String from,Instant createdAt,String question,List<ContextReference> context,String status,String outcome,String result,Long domainResultAuditId,Instant completedAt,Integer version) {}
    public record Ticket(Long id,String code,String subject,String category,String priority,String status,Long farmId,String farmName,
        Long requesterId,String requester,Long assignedCsId,String assignedCs,Instant createdAt,Instant updatedAt,Integer version,
        List<Message> messages,List<ResolutionView> resolutions,List<Map<String,Object>> history,List<InternalView> internalRequests) {}
    public record Page(List<Ticket> items,long total,int page,int size,Map<String,Long> counts) {}
}
