package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.fpt.beefcare.domain.Attachment;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.repository.AttachmentRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/** Farm-scoped private cattle and draft herd-entry photo operations. */
@Service
public class AttachmentService {

    public static final long MAX_BYTES = 5L * 1024 * 1024;

    private final AttachmentRepository attachments;
    private final CattleRepository cattleRepository;
    private final HerdEntryRepository entryRepository;
    private final CattleGuardService cattleGuard;
    private final FarmAccessService access;
    private final AttachmentStorage storage;
    private final EntityManager entityManager;

    public AttachmentService(
        AttachmentRepository attachments,
        CattleRepository cattleRepository,
        HerdEntryRepository entryRepository,
        CattleGuardService cattleGuard,
        FarmAccessService access,
        AttachmentStorage storage,
        EntityManager entityManager
    ) {
        this.attachments = attachments;
        this.cattleRepository = cattleRepository;
        this.entryRepository = entryRepository;
        this.cattleGuard = cattleGuard;
        this.access = access;
        this.storage = storage;
        this.entityManager = entityManager;
    }

    @Transactional
    public AttachmentDTO uploadCattlePhoto(Long farmId, Long cattleId, Integer expectedVersion, MultipartFile file) {
        access.require(farmId, FarmAction.MANAGE_CATTLE_PHOTOS);
        Cattle cattle = cattleGuard.lockWritable(farmId, cattleId);
        requireVersion(cattle.getVersion(), expectedVersion);
        Photo photo = validate(file);
        Attachment prior = cattle.getPhotoAttachment();
        Attachment attachment = create(farmId, AttachmentOwnerType.CATTLE, cattleId, photo);
        cattle.setPhotoAttachment(attachment);
        // Old URLs are no longer authoritative when a real attachment photo is saved.
        cattle.setPhotoUrl(null);
        retire(prior);
        entityManager.flush();
        return dto(attachment);
    }

    @Transactional
    public AttachmentDTO uploadEntryPhoto(Long farmId, Long entryId, Integer expectedVersion, MultipartFile file) {
        access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntry entry = entryRepository.findByIdAndFarmId(entryId, farmId)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "entry_id", entryId));
        if (entry.getStatus() != EntryLineStatus.DRAFT) throw DomainException.unprocessable(MessageCodes.COM_10, "field", "status");
        requireVersion(entry.getVersion(), expectedVersion);
        Photo photo = validate(file);
        Attachment prior = attachments.findByOwnerTypeAndOwnerIdAndFarm_Id(AttachmentOwnerType.HERD_ENTRY, entryId, farmId).orElse(null);
        Attachment attachment = create(farmId, AttachmentOwnerType.HERD_ENTRY, entryId, photo);
        retire(prior);
        entry.setUpdatedAt(Instant.now());
        entityManager.flush();
        return dto(attachment);
    }

    @Transactional
    public AttachmentDTO removeCattlePhoto(Long farmId, Long cattleId, Integer expectedVersion) {
        access.require(farmId, FarmAction.MANAGE_CATTLE_PHOTOS);
        Cattle cattle = cattleGuard.lockWritable(farmId, cattleId);
        requireVersion(cattle.getVersion(), expectedVersion);
        Attachment current = cattle.getPhotoAttachment();
        if (current != null) retire(current);
        cattle.setPhotoAttachment(null);
        cattle.setPhotoUrl(null);
        entityManager.flush();
        return current == null ? null : dto(current);
    }

    @Transactional
    public AttachmentDTO removeEntryPhoto(Long farmId, Long entryId, Integer expectedVersion) {
        access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntry entry = entryRepository.findByIdAndFarmId(entryId, farmId)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "entry_id", entryId));
        if (entry.getStatus() != EntryLineStatus.DRAFT) throw DomainException.unprocessable(MessageCodes.COM_10, "field", "status");
        requireVersion(entry.getVersion(), expectedVersion);
        Attachment current = attachments.findByOwnerTypeAndOwnerIdAndFarm_Id(AttachmentOwnerType.HERD_ENTRY, entryId, farmId).orElse(null);
        if (current != null) retire(current);
        entry.setUpdatedAt(Instant.now());
        entityManager.flush();
        return current == null ? null : dto(current);
    }

    @Transactional(readOnly = true)
    public StoredPhoto read(Long farmId, Long attachmentId) {
        Attachment attachment = attachments.findByIdAndFarm_Id(attachmentId, farmId)
            .filter(value -> value.getRemovedAt() == null)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId));
        if (attachment.getOwnerType() == AttachmentOwnerType.CATTLE) {
            access.require(farmId, FarmAction.VIEW_PENS);
            boolean current = cattleRepository.findByIdAndFarmId(attachment.getOwnerId(), farmId)
                .map(Cattle::getPhotoAttachment)
                .map(Attachment::getId)
                .filter(attachmentId::equals)
                .isPresent();
            if (!current) throw DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId);
        } else if (attachment.getOwnerType() == AttachmentOwnerType.HERD_ENTRY) {
            access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
            boolean draft = entryRepository.findByIdAndFarmId(attachment.getOwnerId(), farmId)
                .filter(entry -> entry.getStatus() == EntryLineStatus.DRAFT)
                .isPresent();
            if (!draft) throw DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId);
        } else {
            // Feed documents (and any later owner type) are served only by their own routes, with their own permission checks.
            throw DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId);
        }
        try {
            return new StoredPhoto(attachment.getContentType(), storage.open(attachment.getStorageKey()));
        } catch (IOException error) {
            throw new IllegalStateException("Unable to read attachment content", error);
        }
    }

    /** Transfers the pending photo to the cattle record after the entry line is posted. */
    @Transactional
    public void transferEntryPhoto(Long farmId, Long entryId, Cattle cattle) {
        Attachment attachment = attachments.findByOwnerTypeAndOwnerIdAndFarm_Id(AttachmentOwnerType.HERD_ENTRY, entryId, farmId).orElse(null);
        if (attachment == null || attachment.getRemovedAt() != null) return;
        Attachment old = cattle.getPhotoAttachment();
        if (old != null && !old.getId().equals(attachment.getId())) retire(old);
        attachment.setOwnerType(AttachmentOwnerType.CATTLE);
        attachment.setOwnerId(cattle.getId());
        cattle.setPhotoAttachment(attachment);
        cattle.setPhotoUrl(null);
    }

    public String requestHash(MultipartFile file, Long targetId, Integer version) {
        Photo photo = validate(file);
        String payload = targetId + ":" + version + ":" + photo.contentType + ":" + photo.bytes.length + ":" + digest(photo.bytes);
        return digest(payload.getBytes(StandardCharsets.UTF_8));
    }

    private Attachment create(Long farmId, AttachmentOwnerType ownerType, Long ownerId, Photo photo) {
        return store(farmId, ownerType, ownerId, photo.bytes, photo.contentType, photo.extension, photo.filename);
    }

    /**
     * Writes already-validated bytes to the private store under an opaque key and records the metadata row. The stored file is
     * removed again if the surrounding transaction rolls back. The caller owns type, size and authorization checks.
     */
    public Attachment store(Long farmId, AttachmentOwnerType ownerType, Long ownerId, byte[] bytes, String contentType, String extension, String filename) {
        String id = UUID.randomUUID().toString();
        String key = id.substring(0, 2) + "/" + id + extension;
        try (var content = new ByteArrayInputStream(bytes)) {
            storage.store(key, content);
        } catch (IOException error) {
            throw new IllegalStateException("Unable to store attachment content", error);
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != TransactionSynchronization.STATUS_COMMITTED) {
                        try { storage.delete(key); } catch (IOException ignored) { /* best effort rollback cleanup */ }
                    }
                }
            });
        }
        Attachment attachment = new Attachment();
        attachment.setFarm(entityManager.getReference(vn.edu.fpt.beefcare.domain.Farm.class, farmId));
        attachment.setOwnerType(ownerType);
        attachment.setOwnerId(ownerId);
        attachment.setStorageKey(key);
        attachment.setOriginalFilename(safeFilename(filename));
        attachment.setContentType(contentType);
        attachment.setFileSize((long) bytes.length);
        attachment.setCreatedAt(Instant.now());
        attachments.save(attachment);
        return attachment;
    }

    private void retire(Attachment attachment) {
        if (attachment != null && attachment.getRemovedAt() == null) attachment.setRemovedAt(Instant.now());
    }

    private Photo validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw DomainException.invalid("photo");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException error) { throw DomainException.invalid("photo"); }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw DomainException.invalid("photo");
        boolean jpeg = bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff;
        boolean png = bytes.length >= 8 && bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47 && bytes[4] == 0x0d && bytes[5] == 0x0a && bytes[6] == 0x1a && bytes[7] == 0x0a;
        if (!jpeg && !png) throw DomainException.invalid("photo");
        return new Photo(bytes, jpeg ? MediaType.IMAGE_JPEG_VALUE : MediaType.IMAGE_PNG_VALUE, jpeg ? ".jpg" : ".png", file.getOriginalFilename());
    }

    private static String safeFilename(String filename) {
        if (filename == null || filename.isBlank()) return "photo";
        String leaf = filename.replace('\\', '/');
        leaf = leaf.substring(leaf.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        if (leaf.isBlank()) return "photo";
        return leaf.length() > 255 ? leaf.substring(0, 255) : leaf;
    }

    private static void requireVersion(Integer actual, Integer expected) {
        if (expected == null) throw DomainException.required("expectedVersion");
        VersionGuard.requireExpected(actual, expected);
    }

    private static AttachmentDTO dto(Attachment attachment) {
        return new AttachmentDTO(attachment.getId(), attachment.getContentType(), attachment.getFileSize(), attachment.getOriginalFilename(), attachment.getCreatedAt());
    }

    private static String digest(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }

    private record Photo(byte[] bytes, String contentType, String extension, String filename) {}
    public record StoredPhoto(String contentType, InputStream content) implements AutoCloseable {
        @Override public void close() throws IOException { content.close(); }
    }
}
