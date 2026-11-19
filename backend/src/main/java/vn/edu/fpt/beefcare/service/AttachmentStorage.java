package vn.edu.fpt.beefcare.service;

import java.io.IOException;
import java.io.InputStream;

/** Private object storage abstraction. Keys are opaque identifiers, never client paths. */
public interface AttachmentStorage {
    void store(String key, InputStream content) throws IOException;
    InputStream open(String key) throws IOException;
    void delete(String key) throws IOException;
}
