package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** Opaque account links are persisted only as cryptographic digests. */
@Entity
@Table(name = "account_link_token")
public class AccountLinkToken {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    private Long id;

    @NotNull
    @Size(min = 64, max = 64)
    @Column(name = "token_hash", length = 64, nullable = false, unique = true)
    private String tokenHash;

    @JsonIgnore
    @Size(max = 64)
    @Column(name = "token_nonce", length = 64)
    private String tokenNonce;

    @NotNull
    @Size(max = 30)
    @Column(name = "token_type", length = 30, nullable = false)
    private String tokenType;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @NotNull
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public Long getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public String getTokenNonce() { return tokenNonce; }
    public void setTokenNonce(String tokenNonce) { this.tokenNonce = tokenNonce; }
    public String getTokenType() { return tokenType; }
    public void setTokenType(String tokenType) { this.tokenType = tokenType; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant usedAt) { this.usedAt = usedAt; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
