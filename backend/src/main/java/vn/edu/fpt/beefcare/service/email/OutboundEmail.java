package vn.edu.fpt.beefcare.service.email;

import java.time.Instant;

/** Message value kept in the after-commit event; it is not persisted with account tokens. */
public record OutboundEmail(String to, String subject, String content, boolean html, Instant createdAt, String plainText) {
    public OutboundEmail(String to, String subject, String content, boolean html, Instant createdAt) {
        this(to, subject, content, html, createdAt, html ? null : content);
    }
}
