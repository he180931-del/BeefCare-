package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * User (gộp User Identity, Password Credential, Password Reset Token). Đặt tên AppUser để không trùng User có sẵn của JHipster.
 */
@Schema(
    description = "User (gộp User Identity, Password Credential, Password Reset Token). Đặt tên AppUser để không trùng User có sẵn của JHipster."
)
@Entity
@Table(name = "app_user")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class AppUser implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 255)
    @Column(name = "email", length = 255, nullable = false, unique = true)
    private String email;

    @NotNull
    @Size(max = 255)
    @Column(name = "full_name", length = 255, nullable = false)
    private String fullName;

    @Size(max = 255)
    @Column(name = "phone", length = 255)
    private String phone;

    @NotNull
    @Size(max = 30)
    @Column(name = "account_status", length = 30, nullable = false)
    private String accountStatus;

    /**
     * ERD: NOT NULL; để trống được vì tài khoản chỉ dùng mật khẩu không có Google subject
     */
    @Schema(description = "ERD: NOT NULL; để trống được vì tài khoản chỉ dùng mật khẩu không có Google subject")
    @Size(max = 255)
    @Column(name = "google_subject", length = 255, unique = true)
    private String googleSubject;

    /**
     * ERD: NOT NULL; để trống được vì tài khoản chỉ dùng Google không có mật khẩu
     */
    @Schema(description = "ERD: NOT NULL; để trống được vì tài khoản chỉ dùng Google không có mật khẩu")
    @Size(max = 255)
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @JsonIgnoreProperties(value = { "user" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "user")
    private PlatformStaffAccess platformStaffAccess;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public AppUser id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return this.email;
    }

    public AppUser email(String email) {
        this.setEmail(email);
        return this;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFullName() {
        return this.fullName;
    }

    public AppUser fullName(String fullName) {
        this.setFullName(fullName);
        return this;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return this.phone;
    }

    public AppUser phone(String phone) {
        this.setPhone(phone);
        return this;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAccountStatus() {
        return this.accountStatus;
    }

    public AppUser accountStatus(String accountStatus) {
        this.setAccountStatus(accountStatus);
        return this;
    }

    public void setAccountStatus(String accountStatus) {
        this.accountStatus = accountStatus;
    }

    public String getGoogleSubject() {
        return this.googleSubject;
    }

    public AppUser googleSubject(String googleSubject) {
        this.setGoogleSubject(googleSubject);
        return this;
    }

    public void setGoogleSubject(String googleSubject) {
        this.googleSubject = googleSubject;
    }

    public String getPasswordHash() {
        return this.passwordHash;
    }

    public AppUser passwordHash(String passwordHash) {
        this.setPasswordHash(passwordHash);
        return this;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public PlatformStaffAccess getPlatformStaffAccess() {
        return this.platformStaffAccess;
    }

    public void setPlatformStaffAccess(PlatformStaffAccess platformStaffAccess) {
        if (this.platformStaffAccess != null) {
            this.platformStaffAccess.setUser(null);
        }
        if (platformStaffAccess != null) {
            platformStaffAccess.setUser(this);
        }
        this.platformStaffAccess = platformStaffAccess;
    }

    public AppUser platformStaffAccess(PlatformStaffAccess platformStaffAccess) {
        this.setPlatformStaffAccess(platformStaffAccess);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AppUser)) {
            return false;
        }
        return getId() != null && getId().equals(((AppUser) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "AppUser{" +
            "id=" + getId() +
            ", email='" + getEmail() + "'" +
            ", fullName='" + getFullName() + "'" +
            ", phone='" + getPhone() + "'" +
            ", accountStatus='" + getAccountStatus() + "'" +
            ", googleSubject='" + getGoogleSubject() + "'" +
            ", passwordHash='" + getPasswordHash() + "'" +
            "}";
    }
}
