package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.function.Supplier;
import java.lang.Runnable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.domain.IdempotencyRecord;
import vn.edu.fpt.beefcare.repository.IdempotencyRecordRepository;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;

/** Executes a command and saves its replay value atomically with the command's database work. */
@Service
public class IdempotencyCommandService {

    public static final int MAX_KEY_LENGTH = 128;
    private static final int MAX_ACTION_LENGTH = 80;
    /** Supports large but bounded voucher imports/replays (200 lines plus DTO metadata) without unbounded blobs. */
    private static final int MAX_SERIALIZED_BYTES = 8 * 1024 * 1024;
    private static final Long ACCOUNT_SCOPE = 0L;

    private final IdempotencyRecordRepository records;
    private final FarmAccessService access;
    private final PlatformAccessService platformAccess;
    private final ObjectMapper objectMapper;
    private final OutboxService outbox;
    private final TransactionTemplate transaction;
    private final TransactionTemplate readTransaction;

    public IdempotencyCommandService(
        IdempotencyRecordRepository records,
        FarmAccessService access,
        PlatformAccessService platformAccess,
        OutboxService outbox,
        ObjectMapper objectMapper,
        PlatformTransactionManager transactionManager
    ) {
        this.records = records;
        this.access = access;
        this.platformAccess = platformAccess;
        this.outbox = outbox;
        this.objectMapper = objectMapper;
        this.transaction = new TransactionTemplate(transactionManager);
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
        this.readTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Idempotency scope is (verified actor, farm or account scope, action, key). The request is hashed and discarded;
     * only a bounded response value is stored. Calls made by {@code command} join this transaction.
     */
    public <T> T execute(Long farmId, FarmAction permission, String action, String key, Object request, Class<T> resultType, Supplier<T> command) {
        return executeScoped(farmId, permission, null, action, key, request, resultType, command);
    }

    /** Executes a platform command with the actor's current platform role rechecked before replay lookup and writes. */
    public <T> T executePlatform(
        PlatformRole requiredRole,
        String action,
        String key,
        Object request,
        Class<T> resultType,
        Supplier<T> command
    ) {
        if (requiredRole == null) throw new IllegalArgumentException("A platform role is required");
        return executeScoped(null, null, requiredRole, action, key, request, resultType, command);
    }

    /**
     * Platform command variant for resources whose visibility depends on a mutable assignment (for example an
     * assigned support ticket). The authorization callback is evaluated inside the command transaction before a
     * replay is read, before a new command is run, and again after a concurrent-key race.
     */
    public <T> T executePlatformAuthorized(
        PlatformRole requiredRole,
        String action,
        String key,
        Object request,
        Class<T> resultType,
        Runnable authorize,
        Supplier<T> command
    ) {
        if (requiredRole == null || authorize == null) throw new IllegalArgumentException("Role and authorization are required");
        return executeScoped(null, null, requiredRole, action, key, request, resultType, authorize, command);
    }

    private <T> T executeScoped(
        Long farmId,
        FarmAction permission,
        PlatformRole platformRole,
        String action,
        String key,
        Object request,
        Class<T> resultType,
        Supplier<T> command
    ) {
        return executeScoped(farmId, permission, platformRole, action, key, request, resultType, null, command);
    }

    private <T> T executeScoped(
        Long farmId,
        FarmAction permission,
        PlatformRole platformRole,
        String action,
        String key,
        Object request,
        Class<T> resultType,
        Runnable authorize,
        Supplier<T> command
    ) {
        String normalizedKey = validateKey(key);
        if (action == null || action.isBlank() || action.length() > MAX_ACTION_LENGTH) {
            throw DomainException.badRequest(MessageCodes.COM_19, "field", "action");
        }
        if (resultType == null || command == null) {
            throw new IllegalArgumentException("A result type and command are required");
        }
        Long actorId = verifiedActorId(farmId, permission, platformRole);
        Long scope = farmId == null ? ACCOUNT_SCOPE : farmId;
        String payloadHash = digest(serialize(request, "request"));

        try {
            return transaction.execute(status -> {
                if (authorize != null) authorize.run();
                var existing = records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(actorId, scope, action, normalizedKey);
                if (existing.isPresent()) {
                    return replay(existing.get(), payloadHash, resultType);
                }

                IdempotencyRecord record = new IdempotencyRecord();
                record.setActorId(actorId);
                record.setFarmScope(scope);
                record.setAction(action);
                record.setIdempotencyKey(normalizedKey);
                record.setPayloadHash(payloadHash);
                record.setResultType(resultType.getName());
                record.setResultJson("null");
                record.setCreatedAt(Instant.now());
                records.saveAndFlush(record); // the unique key serializes concurrent uses of the same key

                T result = command.get();
                String eventType = platformRole == null ? "FARM_COMMAND_COMMITTED" : "PLATFORM_COMMAND_COMMITTED";
                String aggregateType = platformRole == null ? "FarmCommand" : "PlatformCommand";
                outbox.enqueue(farmId, eventType, aggregateType, action, Map.of("actorId", actorId, "action", action));
                byte[] json = serialize(result, "result");
                record.setResultJson(new String(json, StandardCharsets.UTF_8));
                records.saveAndFlush(record);
                return result;
            });
        } catch (DataIntegrityViolationException concurrentConflict) {
            // A competing transaction may have won the unique-key insert. Its record is visible after its commit.
            verifiedActorId(farmId, permission, platformRole);
            IdempotencyRecord winner = readTransaction.execute(status -> {
                if (authorize != null) authorize.run();
                return records.findByActorIdAndFarmScopeAndActionAndIdempotencyKey(actorId, scope, action, normalizedKey).orElse(null);
            });
            if (winner == null) {
                throw concurrentConflict;
            }
            return replay(winner, payloadHash, resultType);
        }
    }

    private Long verifiedActorId(Long farmId, FarmAction permission, PlatformRole platformRole) {
        if (platformRole != null) return platformAccess.requireRole(platformRole).user().getId();
        if (farmId == null) return access.currentActiveUser().getId();
        if (permission == null) throw new IllegalArgumentException("A farm permission is required for a farm-scoped command");
        // Revalidate access before looking up a replay record, including conflict recovery.
        return access.require(farmId, permission).user().getId();
    }

    private <T> T replay(IdempotencyRecord record, String payloadHash, Class<T> resultType) {
        if (!MessageDigest.isEqual(record.getPayloadHash().getBytes(StandardCharsets.US_ASCII), payloadHash.getBytes(StandardCharsets.US_ASCII))) {
            throw DomainException.conflict(MessageCodes.COM_19, "reason", "key_reused_with_different_request");
        }
        if (!resultType.getName().equals(record.getResultType()) || record.getResultJson() == null) {
            throw DomainException.conflict(MessageCodes.COM_19, "reason", "result_unavailable");
        }
        try {
            return objectMapper.readValue(record.getResultJson(), resultType);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored idempotency result cannot be read", e);
        }
    }

    private String validateKey(String key) {
        if (key == null || key.isBlank()) {
            throw DomainException.badRequest(MessageCodes.COM_19, "field", "Idempotency-Key");
        }
        String normalized = key.trim();
        if (normalized.length() > MAX_KEY_LENGTH || normalized.chars().anyMatch(Character::isISOControl)) {
            throw DomainException.badRequest(MessageCodes.COM_19, "field", "Idempotency-Key");
        }
        return normalized;
    }

    private byte[] serialize(Object value, String label) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(value);
            if (bytes.length > MAX_SERIALIZED_BYTES) {
                throw DomainException.badRequest(MessageCodes.COM_19, "field", label, "maxBytes", MAX_SERIALIZED_BYTES);
            }
            return bytes;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Unable to serialize idempotent " + label, e);
        }
    }

    private String digest(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
