package vn.edu.fpt.beefcare.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Filesystem-backed private storage used for local development. */
@Component
public class LocalAttachmentStorage implements AttachmentStorage {

    private static final Pattern KEY = Pattern.compile("[a-f0-9]{2}/[a-f0-9-]{36}\\.(jpg|png)");
    private final Path root;

    public LocalAttachmentStorage(@Value("${beefcare.attachments.local-root:.local-storage}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @Override
    public void store(String key, InputStream content) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Path temporary = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
        try {
            Files.copy(content, temporary, StandardCopyOption.REPLACE_EXISTING);
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    @Override
    public InputStream open(String key) throws IOException {
        return Files.newInputStream(resolve(key));
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(resolve(key));
    }

    public Path resolve(String key) {
        if (key == null || !KEY.matcher(key).matches()) throw DomainException.invalid("attachmentKey");
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) throw DomainException.invalid("attachmentKey");
        return path;
    }
}
