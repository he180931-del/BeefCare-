package vn.edu.fpt.beefcare.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalAttachmentStorageTest {

    @TempDir
    Path root;

    @Test
    void storesReadsAndDeletesOnlyGeneratedKeys() throws Exception {
        LocalAttachmentStorage storage = new LocalAttachmentStorage(root.toString());
        String uuid = UUID.randomUUID().toString();
        String key = uuid.substring(0, 2) + "/" + uuid + ".jpg";
        byte[] content = new byte[] { 1, 2, 3 };

        storage.store(key, new ByteArrayInputStream(content));
        try (var loaded = storage.open(key)) {
            assertArrayEquals(content, loaded.readAllBytes());
        }
        storage.delete(key);

        assertThrows(DomainException.class, () -> storage.resolve("../../secret.jpg"));
    }
}
