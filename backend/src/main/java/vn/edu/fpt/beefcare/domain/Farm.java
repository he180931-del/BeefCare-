package vn.edu.fpt.beefcare.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

/**
 * A Farm.
 */
@Entity
@Table(name = "farm")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Farm implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "sequenceGenerator")
    @SequenceGenerator(name = "sequenceGenerator")
    @Column(name = "id")
    private Long id;

    @NotNull
    @Size(max = 255)
    @Column(name = "name", length = 255, nullable = false)
    private String name;

    @NotNull
    @Size(max = 255)
    @Column(name = "location", length = 255, nullable = false)
    private String location;

    @NotNull
    @Size(max = 255)
    @Column(name = "contact", length = 255, nullable = false)
    private String contact;

    @NotNull
    @Size(max = 30)
    @Column(name = "service_status", length = 30, nullable = false)
    private String serviceStatus;

    @NotNull
    @Size(max = 80)
    @Column(name = "time_zone", length = 80, nullable = false)
    private String timeZone = "Asia/Ho_Chi_Minh";

    @Size(max = 150)
    @Column(name = "contact_person", length = 150)
    private String contactPerson;

    @Size(max = 30)
    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Size(max = 150)
    @Column(name = "province", length = 150)
    private String province;

    @Size(max = 150)
    @Column(name = "commune", length = 150)
    private String commune;

    @Size(max = 255)
    @Column(name = "detailed_address", length = 255)
    private String detailedAddress;

    @Size(max = 255)
    @Column(name = "registration_certificate_info", length = 255)
    private String registrationCertificateInfo;

    @Size(max = 30)
    @Column(name = "expected_herd_size", length = 30)
    private String expectedHerdSize;

    @Size(max = 1000)
    @Column(name = "operating_notes", length = 1000)
    private String operatingNotes;

    @Column(name = "morning_shift_start")
    private LocalTime morningShiftStart;

    @Column(name = "onboarding_dismissed_at")
    private Instant onboardingDismissedAt;

    @Convert(converter = StringSetConverter.class)
    @Column(name = "onboarding_steps_done")
    private Set<String> onboardingStepsDone = new HashSet<>();

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    @JsonIgnoreProperties(value = { "farm", "planVersion" }, allowSetters = true)
    @OneToOne(fetch = FetchType.LAZY, mappedBy = "farm")
    private Subscription subscription;

    @ManyToMany
    @JoinTable(
        name = "farm_main_breed",
        joinColumns = @JoinColumn(name = "farm_id"),
        inverseJoinColumns = @JoinColumn(name = "breed_id")
    )
    @JsonIgnoreProperties(value = { "farm" }, allowSetters = true)
    private Set<Breed> mainBreeds = new HashSet<>();

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Farm id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return this.name;
    }

    public Farm name(String name) {
        this.setName(name);
        return this;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return this.location;
    }

    public Farm location(String location) {
        this.setLocation(location);
        return this;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getContact() {
        return this.contact;
    }

    public Farm contact(String contact) {
        this.setContact(contact);
        return this;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getServiceStatus() {
        return this.serviceStatus;
    }

    public Farm serviceStatus(String serviceStatus) {
        this.setServiceStatus(serviceStatus);
        return this;
    }

    public void setServiceStatus(String serviceStatus) {
        this.serviceStatus = serviceStatus;
    }

    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String timeZone) { this.timeZone = timeZone; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getProvince() { return province; }
    public void setProvince(String province) { this.province = province; }
    public String getCommune() { return commune; }
    public void setCommune(String commune) { this.commune = commune; }
    public String getDetailedAddress() { return detailedAddress; }
    public void setDetailedAddress(String detailedAddress) { this.detailedAddress = detailedAddress; }
    public String getRegistrationCertificateInfo() { return registrationCertificateInfo; }
    public void setRegistrationCertificateInfo(String registrationCertificateInfo) { this.registrationCertificateInfo = registrationCertificateInfo; }
    public String getExpectedHerdSize() { return expectedHerdSize; }
    public void setExpectedHerdSize(String expectedHerdSize) { this.expectedHerdSize = expectedHerdSize; }
    public String getOperatingNotes() { return operatingNotes; }
    public void setOperatingNotes(String operatingNotes) { this.operatingNotes = operatingNotes; }
    public LocalTime getMorningShiftStart() { return morningShiftStart; }
    public void setMorningShiftStart(LocalTime morningShiftStart) { this.morningShiftStart = morningShiftStart; }
    public Instant getOnboardingDismissedAt() { return onboardingDismissedAt; }
    public void setOnboardingDismissedAt(Instant onboardingDismissedAt) { this.onboardingDismissedAt = onboardingDismissedAt; }
    public Set<String> getOnboardingStepsDone() { return onboardingStepsDone; }
    public void setOnboardingStepsDone(Set<String> onboardingStepsDone) { this.onboardingStepsDone = onboardingStepsDone; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public Set<Breed> getMainBreeds() { return mainBreeds; }
    public void setMainBreeds(Set<Breed> mainBreeds) { this.mainBreeds = mainBreeds == null ? new HashSet<>() : new HashSet<>(mainBreeds); }

    public Subscription getSubscription() {
        return this.subscription;
    }

    public void setSubscription(Subscription subscription) {
        if (this.subscription != null) {
            this.subscription.setFarm(null);
        }
        if (subscription != null) {
            subscription.setFarm(this);
        }
        this.subscription = subscription;
    }

    public Farm subscription(Subscription subscription) {
        this.setSubscription(subscription);
        return this;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Farm)) {
            return false;
        }
        return getId() != null && getId().equals(((Farm) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Farm{" +
            "id=" + getId() +
            ", name='" + getName() + "'" +
            ", location='" + getLocation() + "'" +
            ", contact='" + getContact() + "'" +
            ", serviceStatus='" + getServiceStatus() + "'" +
            "}";
    }
}
