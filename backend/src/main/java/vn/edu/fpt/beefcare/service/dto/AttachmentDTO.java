package vn.edu.fpt.beefcare.service.dto;

import java.time.Instant;

/** Safe attachment metadata; storage keys and paths are never returned. */
public record AttachmentDTO(Long id, String contentType, long fileSize, String originalFilename, Instant createdAt) {}
