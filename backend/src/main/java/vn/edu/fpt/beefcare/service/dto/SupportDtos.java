package vn.edu.fpt.beefcare.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;

public final class SupportDtos {
    private SupportDtos() {}
    public record Create(
        @Schema(allowableValues = {"ACCOUNT_ACCESS", "PAYMENT", "FARM_SERVICE", "SYSTEM_USAGE", "OTHER"}) @NotBlank String category,
        @Schema(description = "ACCOUNT_ACCESS requires ACCOUNT; PAYMENT and FARM_SERVICE require FARM; SYSTEM_USAGE and OTHER allow either scope", allowableValues = {"FARM", "ACCOUNT"}) @NotBlank String scope,
        @Schema(description = "Required for PAYMENT and FARM_SERVICE, and for any FARM-scoped ticket; must be null for ACCOUNT_ACCESS and any ACCOUNT-scoped ticket") Long farmId,
        @NotBlank @Size(max=150) String subject,
        @NotBlank @Size(max=3000) String description
    ) {}
    public record Reply(@NotBlank @Size(max=3000) String content,@NotNull Integer expectedVersion) {}
    public record Processing(@NotBlank String action,Long recipientId,String category,String priority,@Size(max=1000) String reason,@Size(max=3000) String question,@NotNull Integer expectedVersion) {}
    public record Resolution(@NotBlank @Size(max=3000) String content,@NotNull Integer expectedVersion) {}
    public record Acknowledge(@NotNull Integer resolutionVersion,@Size(max=1000) String comment,@NotNull Integer expectedVersion) {}
    public record Reopen(@NotBlank @Size(max=1000) String reason,@NotNull Integer expectedVersion) {}
    public record Close(boolean reviewedAcknowledgment,@Size(max=500) String note,@NotNull Integer expectedVersion) {}
    public record ContextReference(@NotBlank String type,@NotNull Long id,String label) {
        public ContextReference(String type, Long id) { this(type, id, null); }
    }
    @JsonIgnoreProperties(ignoreUnknown = false)
    @JsonDeserialize(using = InternalCreateDeserializer.class)
    public record InternalCreate(
        @NotNull PlatformRole targetRole,
        @NotNull Long recipientId,
        @Schema(description = "FE20 request text; includes the question and minimum owner-provided hint", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank @Size(max=2000) String requestText,
        @NotNull Integer ticketVersion
    ) {
        /**
         * Source compatibility for existing service fixtures. The context argument is
         * intentionally ignored and is not a JSON/runtime request field.
         */
        @Deprecated
        public InternalCreate(PlatformRole targetRole, Long recipientId, String requestText, List<ContextReference> ignoredContext, Integer ticketVersion) {
            this(targetRole, recipientId, requestText, ticketVersion);
        }
    }

    /** Reject retired question/context keys instead of silently accepting a mixed contract. */
    static final class InternalCreateDeserializer extends StdDeserializer<InternalCreate> {
        private static final java.util.Set<String> FIELDS = java.util.Set.of("targetRole", "recipientId", "requestText", "ticketVersion");

        InternalCreateDeserializer() { super(InternalCreate.class); }

        @Override
        public InternalCreate deserialize(JsonParser parser, com.fasterxml.jackson.databind.DeserializationContext context) throws java.io.IOException {
            JsonNode node = parser.getCodec().readTree(parser);
            var fields = node.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                if (!FIELDS.contains(field)) throw JsonMappingException.from(parser, "Unsupported InternalCreate field: " + field);
            }
            PlatformRole role = null;
            var roleNode = node.get("targetRole");
            if (roleNode != null && !roleNode.isNull()) {
                try { role = PlatformRole.valueOf(roleNode.asText()); }
                catch (IllegalArgumentException ex) { throw JsonMappingException.from(parser, "Invalid targetRole"); }
            }
            Long recipientId = node.has("recipientId") && !node.get("recipientId").isNull() ? node.get("recipientId").asLong() : null;
            String requestText = node.has("requestText") && !node.get("requestText").isNull() ? node.get("requestText").asText() : null;
            Integer ticketVersion = node.has("ticketVersion") && !node.get("ticketVersion").isNull() ? node.get("ticketVersion").asInt() : null;
            return new InternalCreate(role, recipientId, requestText, ticketVersion);
        }
    }
    public record InternalManage(
        @Schema(description = "CLARIFY requires clarificationText; REASSIGN requires recipientId and reason; CANCEL requires reason",
            allowableValues = {"CLARIFY", "REASSIGN", "CANCEL"}, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank String action,
        Long recipientId,
        @Schema(description = "Required for REASSIGN and CANCEL") @Size(max=1000) String reason,
        @Schema(description = "Required for CLARIFY") @Size(max=2000) String clarificationText,
        @NotNull Integer expectedVersion) {
        /** Compatibility constructor for the existing reassignment/cancellation callers. */
        public InternalManage(String action, Long recipientId, String reason, Integer expectedVersion) {
            this(action, recipientId, reason, null, expectedVersion);
        }
    }
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Complete(
        @Schema(allowableValues = {"CONFIRMED", "NOT_CONFIRMED", "NEED_MORE_INFO", "OUT_OF_SCOPE"}, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank String outcome,
        @Schema(description = "FE20 target result note", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank @Size(max=2000) String resultNote,
        @NotNull Integer expectedVersion) {}
    public record InternalHistory(Long id,String type,String note,Long actorId,String actor,String actorRole,Instant at,Integer version,String state,String outcome) {}
    public record Message(Long id,String type,String audience,Long authorId,String author,String authorRole,String content,Instant createdAt) {}
    public record MessagePage(List<Message> items,Long nextBeforeId,boolean hasMore) {}
    public record ResolutionView(Long id,int version,String content,String resolvedBy,Instant resolvedAt,boolean acknowledged,Instant acknowledgedAt,String acknowledgmentComment,boolean reviewed) {}
    public record InternalView(Long id,String code,Long ticketId,String ticketCode,String ticketSubject,String ticketCategory,String ticketRequester,Long farmId,String farmName,String targetRole,Long recipientId,String recipient,
        String from,Instant createdAt,String status,String outcome,Instant completedAt,Integer version,
        @io.swagger.v3.oas.annotations.media.Schema(description = "OPEN request whose recipient is no longer available (account suspended or platform role lost): the CS should change the recipient (UC-FE03-08 step 6, D32)")
        boolean needsReassignment,List<InternalHistory> history,
        @Schema(description = "FE20 target request text", requiredMode = Schema.RequiredMode.REQUIRED) String requestText,
        @Schema(description = "FE20 target result note") String resultNote) {}
    /**
     * Minimal projection for the named PM/SA recipient audience. It intentionally has no
     * CS-selected context or domain audit reference; those fields must never cross this
     * audience boundary.
     */
    public record RecipientInternalView(Long id,String code,Long ticketId,String ticketCode,String ticketSubject,String ticketCategory,String ticketRequester,Long farmId,String farmName,String targetRole,Long recipientId,String recipient,
        String from,Instant createdAt,String status,String outcome,Instant completedAt,Integer version,
        boolean needsReassignment,List<InternalHistory> history,
        @Schema(description = "FE20 target request text", requiredMode = Schema.RequiredMode.REQUIRED) String requestText,
        @Schema(description = "FE20 target result note") String resultNote) {}
    public record Ticket(Long id,String code,String subject,String category,String priority,String status,Long farmId,String farmName,
        Long requesterId,String requester,Long assignedCsId,String assignedCs,boolean assignedCsAvailable,Instant createdAt,Instant updatedAt,Integer version,
        List<Message> messages,Long messagesBeforeId,boolean messagesHasMore,List<ResolutionView> resolutions,List<Map<String,Object>> history,List<InternalView> internalRequests,
        Map<String,List<ContextReference>> contextOptions) {}
    public record Page(List<Ticket> items,long total,int page,int size,Map<String,Long> counts) {}
}
