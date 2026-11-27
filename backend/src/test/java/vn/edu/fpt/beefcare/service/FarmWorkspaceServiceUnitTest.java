package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.Registration;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.Summary;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.Update;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE02-01..03:
 * {@link FarmWorkspaceService#register}, {@link FarmWorkspaceService#list} and {@link FarmWorkspaceService#update}.
 * Each method name starts with its case reference in the DucNV Report5 workbook.
 */
@ExtendWith(MockitoExtension.class)
class FarmWorkspaceServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");
    private static final long FARM_ID = 501L;
    private static Validator validator;
    private static jakarta.validation.ValidatorFactory factory;

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock FarmRepository farms;
    @Mock StarterCatalogueService starters;
    @Mock AuditService audit;
    @Mock OutboxService outbox;
    @Mock FarmServiceFacts facts;

    private FarmWorkspaceService service;
    private AppUser owner;

    @BeforeAll
    static void startValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        factory.close();
    }

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service = new FarmWorkspaceService(em, access, farms, starters, audit, outbox, facts, clock);
        owner = new AppUser();
        owner.setId(11L);
        owner.setFullName("Nguyen Van Duc");
        owner.setPhone("0912345678");
        owner.setEmail("owner@beefcare.test");
        owner.setAccountStatus("ACTIVE");
        owner.setOwnerRegistrationCompleted(true);
    }

    // ------------------------------------------------------------------ UC-FE02-01 register()

    private static Registration registration(String name, String province, String commune, String person, String phone, String herd) {
        return new Registration(name, province, commune, "Thon 3", person, phone, "GCN-01", herd, Set.of("BRAHMAN"));
    }

    private List<Object> persistedWithIds() {
        List<Object> persisted = new ArrayList<>();
        doAnswer(call -> {
            Object entity = call.getArgument(0);
            if (entity instanceof Farm farm) farm.setId(FARM_ID);
            persisted.add(entity);
            return null;
        }).when(em).persist(any());
        return persisted;
    }

    @Test
    void tc0207ValidRegistrationCreatesAPendingFarmWithOneOwnerMembershipStarterCatalogueAndAudit() {
        when(access.currentActiveUser()).thenReturn(owner);
        List<Object> persisted = persistedWithIds();

        var details = service.register(registration("Trai Ba Vi", "Hà Nội", "Ba Vi", "Le Thi Mai", "0987654321", "50_149"));

        assertThat(persisted).hasSize(2);
        Farm farm = (Farm) persisted.get(0);
        FarmMembership membership = (FarmMembership) persisted.get(1);
        assertThat(farm.getServiceStatus()).isEqualTo("PENDING_PAYMENT");
        assertThat(farm.getTimeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(membership.getRole()).isEqualTo("OWNER");
        assertThat(membership.getStatus()).isEqualTo("ACTIVE");
        assertThat(membership.getFarm()).isSameAs(farm);
        assertThat(membership.getJoinedAt()).isEqualTo(NOW);
        verify(starters).create(farm, owner, Set.of("BRAHMAN"));
        verify(audit).log(farm, owner, "FARM_REGISTER", "Farm", FARM_ID, Map.of("name", "Trai Ba Vi"));
        verify(outbox).enqueue(eq(FARM_ID), eq("FARM_REGISTERED"), eq("Farm"), eq(FARM_ID), any());
        assertThat(details.id()).isEqualTo(FARM_ID);
        assertThat(details.serviceStatus()).isEqualTo("PENDING_PAYMENT");
        assertThat(details.currentPeriodUntil()).isNull();
    }

    @Test
    void tc0205AnOwnerCanRegisterASecondFarmWithTheSameNameBecauseNamesAreNotUnique() {
        when(access.currentActiveUser()).thenReturn(owner);
        List<Object> persisted = persistedWithIds();

        service.register(registration("Trai A", "Hà Nội", "Ba Vi", null, null, null));

        assertThat(persisted).hasSize(2);
        verifyNoInteractions(farms);
    }

    @Test
    void tc0206AnOwnerWithAnUnfinishedProfileGetsMsgFe0202AndNothingIsCreated() {
        owner.setOwnerRegistrationCompleted(false);
        when(access.currentActiveUser()).thenReturn(owner);

        assertThatThrownBy(() -> service.register(registration("Trai Ba Vi", "Hà Nội", "Ba Vi", null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE02_02);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
            });
        verify(em, never()).persist(any());
        verifyNoInteractions(starters, audit, outbox);
    }

    @Test
    void tcDuc020101AProvinceOutsideTheThirtyFourProvincesIsRejectedWithMsgCom10BeforeAnyWrite() {
        when(access.currentActiveUser()).thenReturn(owner);

        assertThatThrownBy(() -> service.register(registration("Trai Ba Vi", "Ha Tay", "Ba Vi", null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "province");
            });
        verify(em, never()).persist(any());
        verifyNoInteractions(starters, audit, outbox);
    }

    @Test
    void tcDuc020102BlankContactFieldsFallBackToTheOwnerProfileAndABlankHerdSizeIsNotProvided() {
        when(access.currentActiveUser()).thenReturn(owner);
        List<Object> persisted = persistedWithIds();

        var details = service.register(registration("  Trai Ba Vi  ", " Hà Nội ", " Ba Vi ", "  ", "", " "));

        Farm farm = (Farm) persisted.get(0);
        assertThat(farm.getName()).isEqualTo("Trai Ba Vi");
        assertThat(farm.getLocation()).isEqualTo("Hà Nội, Ba Vi");
        assertThat(details.contactPerson()).isEqualTo("Nguyen Van Duc");
        assertThat(details.contactPhone()).isEqualTo("0912345678");
        assertThat(details.expectedHerdSize()).isNull();
    }

    @Test
    void tc0210AFailureWhileCreatingTheStarterCatalogueStopsBeforeTheAuditAndOutboxEntries() {
        when(access.currentActiveUser()).thenReturn(owner);
        persistedWithIds();
        doThrow(new IllegalStateException("starter catalogue failed")).when(starters).create(any(), any(), any());

        assertThatThrownBy(() -> service.register(registration("Trai Ba Vi", "Hà Nội", "Ba Vi", null, null, null)))
            .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(audit, outbox);
        verify(em, never()).flush();
    }

    @Test
    void tc0201TheFarmNameMustHaveTwoToOneHundredFiftyCharacters() {
        assertThat(violations(registration("A", "Hà Nội", "Ba Vi", null, null, null))).containsExactly("name");
        assertThat(violations(registration("AB", "Hà Nội", "Ba Vi", null, null, null))).isEmpty();
        assertThat(violations(registration("A".repeat(150), "Hà Nội", "Ba Vi", null, null, null))).isEmpty();
        assertThat(violations(registration("A".repeat(151), "Hà Nội", "Ba Vi", null, null, null))).containsExactly("name");
    }

    @Test
    void tc0202ProvinceAndCommuneAreRequired() {
        assertThat(violations(registration("Trai Ba Vi", " ", "Ba Vi", null, null, null))).containsExactly("province");
        assertThat(violations(registration("Trai Ba Vi", "Hà Nội", "", null, null, null))).containsExactly("commune");
    }

    @Test
    void tc0203OptionalTextFieldsStopAtTheirMaximumLength() {
        var tooLong = new Registration("Trai Ba Vi", "Hà Nội", "C".repeat(151), "D".repeat(256), "P".repeat(101), null, "G".repeat(256), null, null);
        var longest = new Registration("Trai Ba Vi", "Hà Nội", "C".repeat(150), "D".repeat(255), "P".repeat(100), null, "G".repeat(255), null, null);

        assertThat(violations(tooLong)).containsExactlyInAnyOrder("commune", "detailedAddress", "contactPerson", "registrationCertificateInfo");
        assertThat(violations(longest)).isEmpty();
    }

    @Test
    void tc0204TheContactPhoneIsZeroOrPlus84FollowedByNineDigits() {
        assertThat(violations(registration("Trai Ba Vi", "Hà Nội", "Ba Vi", null, "0912345678", null))).isEmpty();
        assertThat(violations(registration("Trai Ba Vi", "Hà Nội", "Ba Vi", null, "+84912345678", null))).isEmpty();
        assertThat(violations(registration("Trai Ba Vi", "Hà Nội", "Ba Vi", null, "12345", null))).containsExactly("contactPhone");
    }

    private static List<String> violations(Object request) {
        return validator.validate(request).stream().map(ConstraintViolation::getPropertyPath).map(Object::toString).sorted().toList();
    }

    // ------------------------------------------------------------------ UC-FE02-02 list()

    private Farm farm(long id, String name, String status) {
        Farm farm = new Farm();
        farm.setId(id);
        farm.setName(name);
        farm.setServiceStatus(status);
        farm.setProvince("Hà Nội");
        farm.setCommune("Ba Vi");
        farm.setTimeZone("Asia/Ho_Chi_Minh");
        farm.setVersion(3);
        return farm;
    }

    private static FarmMembership membership(Farm farm, String role) {
        FarmMembership membership = new FarmMembership();
        membership.setFarm(farm);
        membership.setRole(role);
        membership.setStatus("ACTIVE");
        return membership;
    }

    @SuppressWarnings("unchecked")
    private TypedQuery<FarmMembership> membershipQuery(List<FarmMembership> rows) {
        TypedQuery<FarmMembership> query = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(FarmMembership.class))).thenReturn(query);
        when(query.setParameter("user", owner.getId())).thenReturn(query);
        when(query.getResultList()).thenReturn(rows);
        return query;
    }

    @Test
    void tcDuc020201EachCardShowsTheRoleStatusLocationActiveCattleAndLatestServiceEnd() {
        Instant until = Instant.parse("2027-02-01T16:59:59Z");
        when(access.currentActiveUser()).thenReturn(owner);
        membershipQuery(List.of(membership(farm(1L, "Trai A", "ACTIVE"), "OWNER")));
        when(facts.activeCattle(List.of(1L))).thenReturn(Map.of(1L, 42L));
        when(facts.latestEnd(List.of(1L))).thenReturn(Map.of(1L, until));

        List<Summary> cards = service.list();

        assertThat(cards).containsExactly(new Summary(1L, "Trai A", "OWNER", "ACTIVE", 3, "Hà Nội", "Ba Vi", 42L, until, "Asia/Ho_Chi_Minh"));
    }

    @Test
    void tc0211AManagerStillSeesAFarmThatIsNotActiveSoTheCardCanBeShownLocked() {
        when(access.currentActiveUser()).thenReturn(owner);
        membershipQuery(List.of(membership(farm(1L, "Trai A", "ACTIVE"), "MANAGER"), membership(farm(2L, "Trai B", "EXPIRED"), "MANAGER")));

        List<Summary> cards = service.list();

        assertThat(cards).extracting(Summary::id, Summary::role, Summary::serviceStatus)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1L, "MANAGER", "ACTIVE"), org.assertj.core.groups.Tuple.tuple(2L, "MANAGER", "EXPIRED"));
    }

    @Test
    void tcDuc020202AFarmWithoutCattleOrConfirmedPeriodShowsZeroCattleAndNoServiceEnd() {
        when(access.currentActiveUser()).thenReturn(owner);
        membershipQuery(List.of(membership(farm(3L, "Trai C", "PENDING_PAYMENT"), "OWNER")));

        Summary card = service.list().get(0);

        assertThat(card.activeCattleCount()).isZero();
        assertThat(card.serviceUntil()).isNull();
    }

    @Test
    void tcDuc020203TheQueryIsScopedToTheCallerAndActiveMembershipsOnly() {
        when(access.currentActiveUser()).thenReturn(owner);
        TypedQuery<FarmMembership> query = membershipQuery(List.of());
        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);

        assertThat(service.list()).isEmpty();

        verify(em).createQuery(jpql.capture(), eq(FarmMembership.class));
        assertThat(jpql.getValue()).contains("m.user.id=:user").contains("upper(m.status)='ACTIVE'");
        verify(query).setParameter("user", 11L);
        verifyNoInteractions(facts);
    }

    @Test
    void tcDuc020204ASuspendedAccountIsRefusedBeforeAnyFarmIsRead() {
        when(access.currentActiveUser()).thenThrow(DomainException.forbidden(MessageCodes.FE01_03, "email", "owner@beefcare.test"));

        assertThatThrownBy(() -> service.list())
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE01_03));
        verifyNoInteractions(em, facts);
    }

    // ------------------------------------------------------------------ UC-FE02-03 update()

    private Farm stored;

    private void ownerContext() {
        stored = farm(FARM_ID, "Trai Cu", "ACTIVE");
        when(access.require(FARM_ID, FarmAction.MANAGE_FARM_INFORMATION)).thenReturn(new FarmContext(stored, owner, FarmRole.OWNER));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(stored));
    }

    private static Update update(String province, String zone, Set<Long> breeds, Integer version) {
        return new Update(" Trai Moi ", province, " Tan Linh ", " ", " Le Thi Mai ", "", " GCN-02 ", zone, LocalTime.of(5, 30), "  ", breeds, version);
    }

    @Test
    void tcDuc020301TheOwnerSavesTrimmedInformationWithBlankOptionalFieldsAsNotProvidedAndAnAudit() {
        ownerContext();

        var details = service.update(FARM_ID, update("Lâm Đồng", null, null, 3));

        assertThat(stored.getName()).isEqualTo("Trai Moi");
        assertThat(stored.getProvince()).isEqualTo("Lâm Đồng");
        assertThat(stored.getCommune()).isEqualTo("Tan Linh");
        assertThat(stored.getDetailedAddress()).isNull();
        assertThat(stored.getContactPerson()).isEqualTo("Le Thi Mai");
        assertThat(stored.getContactPhone()).isNull();
        assertThat(stored.getOperatingNotes()).isNull();
        assertThat(stored.getMorningShiftStart()).isEqualTo(LocalTime.of(5, 30));
        assertThat(details.timeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        verify(audit).log(any(FarmContext.class), eq("FARM_UPDATE"), eq("Farm"), eq(FARM_ID), eq(Map.of("name", "Trai Moi")));
        verify(outbox).enqueue(FARM_ID, "FARM_UPDATED", "Farm", FARM_ID, Map.of("farmId", FARM_ID));
    }

    @Test
    void tc0217AManagerCannotUpdateTheFarmAndNothingIsLocked() {
        when(access.require(FARM_ID, FarmAction.MANAGE_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.update(FARM_ID, update("Lâm Đồng", null, null, 3)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(farms, audit, outbox);
    }

    @Test
    void tc0219ASecondSaveWithAnOutdatedVersionGetsMsgCom05AndChangesNothing() {
        ownerContext();

        assertThatThrownBy(() -> service.update(FARM_ID, update("Lâm Đồng", null, null, 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(error.getParams()).containsEntry("expected", 2).containsEntry("actual", 3);
            });
        assertThat(stored.getName()).isEqualTo("Trai Cu");
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tcDuc020302AMissingExpectedVersionIsRejectedWithMsgCom05() {
        ownerContext();

        assertThatThrownBy(() -> service.update(FARM_ID, update("Lâm Đồng", null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
                assertThat(error.getParams()).containsEntry("reason", "expected_version_required");
            });
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tcDuc020303AnEquivalentUtcPlus7ZoneIsStoredAsAsiaHoChiMinhAndAnotherZoneIsRejected() {
        ownerContext();

        assertThat(service.update(FARM_ID, update("Lâm Đồng", "Asia/Bangkok", null, 3)).timeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        stored.setVersion(3);
        assertThatThrownBy(() -> service.update(FARM_ID, update("Lâm Đồng", "Europe/Paris", null, 3)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "timeZone");
            });
        verify(audit, times(1)).log(any(FarmContext.class), anyString(), anyString(), any(), any());
    }

    @Test
    void tcDuc020304AProvinceOutsideTheListIsRejectedWithMsgCom10() {
        ownerContext();

        assertThatThrownBy(() -> service.update(FARM_ID, update("Ha Tay", null, null, 3)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "province"));
        assertThat(stored.getName()).isEqualTo("Trai Cu");
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tcDuc020305MainBreedsMustBeAvailableBreedsOfTheSameFarm() {
        ownerContext();
        Farm other = farm(77L, "Trai Khac", "ACTIVE");
        Breed own = breed(1L, stored, true);
        Breed foreign = breed(2L, other, true);
        Breed retired = breed(3L, stored, false);
        when(em.find(Breed.class, 1L)).thenReturn(own);
        when(em.find(Breed.class, 2L)).thenReturn(foreign);
        when(em.find(Breed.class, 3L)).thenReturn(retired);

        assertThat(service.update(FARM_ID, update("Lâm Đồng", null, Set.of(1L), 3)).mainBreedIds()).containsExactly(1L);
        for (long rejected : List.of(2L, 3L)) {
            stored.setVersion(3);
            assertThatThrownBy(() -> service.update(FARM_ID, update("Lâm Đồng", null, Set.of(rejected), 3)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "mainBreedIds"));
        }
        assertThat(stored.getMainBreeds()).containsExactly(own);
    }

    @Test
    void tcDuc020306WithoutMainBreedIdsTheStoredMainBreedsStayUnchanged() {
        ownerContext();
        Breed own = breed(1L, stored, true);
        stored.setMainBreeds(Set.of(own));

        service.update(FARM_ID, update("Lâm Đồng", null, null, 3));

        assertThat(stored.getMainBreeds()).containsExactly(own);
        verify(em, never()).find(eq(Breed.class), any());
    }

    @Test
    void tcDuc020307AFarmThatNoLongerExistsGetsMsgCom08() {
        when(access.require(FARM_ID, FarmAction.MANAGE_FARM_INFORMATION)).thenReturn(new FarmContext(farm(FARM_ID, "X", "ACTIVE"), owner, FarmRole.OWNER));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(FARM_ID, update("Lâm Đồng", null, null, 3)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
            });
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tc0218OperatingNotesStopAtOneThousandCharacters() {
        var atLimit = new Update("Trai", "Hà Nội", "Ba Vi", null, null, null, null, null, null, "N".repeat(1000), null, 1);
        var overLimit = new Update("Trai", "Hà Nội", "Ba Vi", null, null, null, null, null, null, "N".repeat(1001), null, 1);

        assertThat(violations(atLimit)).isEmpty();
        assertThat(violations(overLimit)).containsExactly("operatingNotes");
    }

    private static Breed breed(long id, Farm farm, boolean available) {
        Breed breed = new Breed();
        breed.setId(id);
        breed.setFarm(farm);
        breed.setAvailable(available);
        return breed;
    }
}
