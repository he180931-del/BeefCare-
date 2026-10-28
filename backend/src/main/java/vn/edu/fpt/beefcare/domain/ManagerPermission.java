package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;

/**
 * ERD: PK ghép membership_id + permission_code; JDL không hỗ trợ PK ghép nên dùng id và cần thêm unique(membership_id, permission_code)
 */
@Schema(
    description = "ERD: PK ghép membership_id + permission_code; JDL không hỗ trợ PK ghép nên dùng id và cần thêm unique(membership_id, permission_code)"
)
@Entity
@Table(name = "manager_permission")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class ManagerPermission implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 50)
    @Column(name = "permission_code", length = 50, nullable = false)
    private String permissionCode;

    @NotNull
    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @ManyToOne(optional = false)
    @NotNull
    @JsonIgnoreProperties(value = { "farm", "user" }, allowSetters = true)
    private FarmMembership membership;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public ManagerPermission id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPermissionCode() {
        return this.permissionCode;
    }

    public ManagerPermission permissionCode(String permissionCode) {
        this.setPermissionCode(permissionCode);
        return this;
    }

    public void setPermissionCode(String permissionCode) {
        this.permissionCode = permissionCode;
    }

    public Boolean getEnabled() {
        return this.enabled;
    }

    public ManagerPermission enabled(Boolean enabled) {
        this.setEnabled(enabled);
        return this;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public FarmMembership getMembership() {
        return this.membership;
    }

    public void setMembership(FarmMembership farmMembership) {
        this.membership = farmMembership;
    }

    public ManagerPermission membership(FarmMembership farmMembership) {
        this.setMembership(farmMembership);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ManagerPermission)) {
            return false;
        }
        return getId() != null && getId().equals(((ManagerPermission) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "ManagerPermission{" +
            "id=" + getId() +
            ", permissionCode='" + getPermissionCode() + "'" +
            ", enabled='" + getEnabled() + "'" +
            "}";
    }
}
