package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;

/** File metadata; file bytes remain in the configured object store. */
@Entity
@Table(name = "attachment", uniqueConstraints = @UniqueConstraint(name = "uq_attachment_storage_key", columnNames = "storage_key"))
public class Attachment implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "owner_type", length = 30, nullable = false)
    private AttachmentOwnerType ownerType;

    @NotNull
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @NotNull
    @Size(max = 500)
    @Column(name = "storage_key", length = 500, nullable = false)
    private String storageKey;

    @NotNull
    @Size(max = 255)
    @Column(name = "original_filename", length = 255, nullable = false)
    private String originalFilename;

    @NotNull
    @Size(max = 100)
    @Pattern(regexp = "image/(jpeg|png)|application/pdf") // photos: JPEG/PNG; feed documents (SCR-79/80): JPEG or PDF. Per-owner rules are in the services.
    @Column(name = "content_type", length = 100, nullable = false)
    private String contentType;

    @NotNull
    @Min(1)
    @Max(10_485_760) // photos stay at 5 MB in AttachmentService; feed documents may be 10 MB
    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id", nullable = false)
    @JsonIgnoreProperties(value = { "subscription", "mainBreeds" }, allowSetters = true)
    private Farm farm;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public AttachmentOwnerType getOwnerType() { return ownerType; }
    public void setOwnerType(AttachmentOwnerType ownerType) { this.ownerType = ownerType; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    @JsonIgnore
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getRemovedAt() { return removedAt; }
    public void setRemovedAt(Instant removedAt) { this.removedAt = removedAt; }
    public Farm getFarm() { return farm; }
    public void setFarm(Farm farm) { this.farm = farm; }

    @PrePersist
    void onCreate() { if (createdAt == null) createdAt = Instant.now(); }
}
