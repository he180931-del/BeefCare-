package vn.edu.fpt.beefcare.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import vn.edu.fpt.beefcare.domain.Attachment;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.repository.AttachmentRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;

class AttachmentServiceTest {

    @TempDir
    Path storageRoot;

    private AttachmentService service;
    private AttachmentRepository attachments;
    private Cattle cattle;

    @BeforeEach
    void setUp() {
        attachments = mock(AttachmentRepository.class);
        CattleRepository cattleRepository = mock(CattleRepository.class);
        HerdEntryRepository entries = mock(HerdEntryRepository.class);
        CattleGuardService cattleGuard = mock(CattleGuardService.class);
        FarmAccessService access = mock(FarmAccessService.class);
        EntityManager entityManager = mock(EntityManager.class);
        LocalAttachmentStorage storage = new LocalAttachmentStorage(storageRoot.toString());
        service = new AttachmentService(attachments, cattleRepository, entries, cattleGuard, access, storage, entityManager);
        cattle = new Cattle();
        cattle.setVersion(4);
        when(cattleGuard.lockWritable(17L, 23L)).thenReturn(cattle);
        when(entityManager.getReference(Farm.class, 17L)).thenReturn(new Farm());
        when(attachments.save(any(Attachment.class))).thenAnswer(invocation -> {
            Attachment saved = invocation.getArgument(0);
            saved.setId(91L);
            return saved;
        });
    }

    @Test
    void storesJpegAndReturnsMetadataWithoutStorageKey() {
        MockMultipartFile upload = new MockMultipartFile("file", "../my-cow.jpg", "image/jpeg", new byte[] { (byte) 0xff, (byte) 0xd8, (byte) 0xff, 1 });

        var metadata = service.uploadCattlePhoto(17L, 23L, 4, upload);

        assertEquals(91L, metadata.id());
        assertEquals("image/jpeg", metadata.contentType());
        assertEquals("my-cow.jpg", metadata.originalFilename());
        assertEquals(4, metadata.fileSize());
    }

    @Test
    void rejectsSpoofedContentAndOversizedFiles() {
        MockMultipartFile fake = new MockMultipartFile("file", "photo.jpg", "image/jpeg", "not a jpeg".getBytes());
        MockMultipartFile oversized = new MockMultipartFile("file", "large.png", "image/png", new byte[(int) AttachmentService.MAX_BYTES + 1]);

        assertThrows(DomainException.class, () -> service.uploadCattlePhoto(17L, 23L, 4, fake));
        assertThrows(DomainException.class, () -> service.uploadCattlePhoto(17L, 23L, 4, oversized));
    }
}
