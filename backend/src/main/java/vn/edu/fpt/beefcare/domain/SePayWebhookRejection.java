package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** UC8 E1: restricted delivery metadata only; never a payload, signature, account number or payment reference. */
@Entity
@Table(name = "sepay_webhook_rejection")
public class SePayWebhookRejection {
    @Id @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator") @SequenceGenerator(name = "sequenceGenerator")
    private Long id;
    @Column(name = "received_at", nullable = false) private Instant receivedAt;
    @Column(name = "reason", nullable = false, length = 40) private String reason;
    @Column(name = "body_bytes", nullable = false) private int bodyBytes;

    public Long getId() { return id; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant value) { receivedAt = value; }
    public String getReason() { return reason; }
    public void setReason(String value) { reason = value; }
    public int getBodyBytes() { return bodyBytes; }
    public void setBodyBytes(int value) { bodyBytes = value; }
}
