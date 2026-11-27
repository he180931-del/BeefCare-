package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.BreedView;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.BreedWrite;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.PurposeView;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.PurposeWrite;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.ReceivingPen;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE18-01 Manage Breed Catalogue
 * ({@link HerdCatalogueCommandService#saveBreed}) and UC-FE18-04 Manage Production Purpose Catalogue
 * ({@link HerdCatalogueCommandService#savePurpose}); each saves a new item, an edit, or a stop / resume through the
 * {@code available} flag. The count queries are mocked {@link TypedQuery} objects chosen by their JPQL text.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HerdCatalogueCommandServiceUnitTest {

    private static final long FARM_ID = 501L;

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock AuditService audit;
    @Mock CatalogueReferenceService references;

    private HerdCatalogueCommandService service;
    private Farm farm;
    private final Map<String, Long> counts = new LinkedHashMap<>();
    private final Map<String, TypedQuery<Long>> lastCountQuery = new LinkedHashMap<>();
    private final List<PenCriteriaVersion> criteria = new ArrayList<>();
    private final List<Object> persisted = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new HerdCatalogueCommandService(em, access, audit, new FarmClock(Clock.fixed(Instant.parse("2026-11-27T03:00:00Z"), ZoneOffset.UTC)),
            references);
        farm = new Farm();
        farm.setId(FARM_ID);
        AppUser manager = new AppUser();
        manager.setId(31L);
        when(access.require(FARM_ID, FarmAction.MANAGE_CATALOGUES)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        counts.put("c.herdStatus=:s", 0L);
        counts.put("from Cattle c where c.breed.id=:id", 0L);
        counts.put("from Cattle c where c.purpose.id=:id", 0L);
        counts.put("from Breed x", 0L);
        counts.put("from ProductionPurpose x", 0L);
        when(em.createQuery(anyString(), eq(Long.class))).thenAnswer(inv -> {
            String jpql = inv.getArgument(0);
            String fragment = counts.keySet().stream().filter(jpql::contains).findFirst().orElse("");
            TypedQuery<Long> query = count(counts.getOrDefault(fragment, 0L));
            lastCountQuery.put(fragment, query);
            return query;
        });
        when(em.createQuery(anyString(), eq(PenCriteriaVersion.class))).thenAnswer(inv -> criteriaQuery());
        when(references.revisedSources(anyLong(), anyString(), anyString(), anyLong())).thenReturn(Set.of());
        doAnswer(inv -> {
            Object entity = inv.getArgument(0);
            if (entity instanceof Breed b) {
                b.setId(41L);
            } else if (entity instanceof ProductionPurpose p) {
                p.setId(61L);
            }
            persisted.add(entity);
            return null;
        }).when(em).persist(any());
    }

    @SuppressWarnings("unchecked")
    private static TypedQuery<Long> count(long value) {
        TypedQuery<Long> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getSingleResult()).thenReturn(value);
        return query;
    }

    @SuppressWarnings("unchecked")
    private TypedQuery<PenCriteriaVersion> criteriaQuery() {
        TypedQuery<PenCriteriaVersion> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getResultList()).thenReturn(criteria);
        return query;
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    // ------------------------------------------------------------------ UC-FE18-01 saveBreed()

    private Breed storedBreed(String code, boolean available) {
        Breed b = new Breed();
        b.setId(41L);
        b.setFarm(farm);
        b.setCode(code);
        b.setName("Lai Sind");
        b.setAvailable(available);
        b.setVersion(3);
        when(em.find(Breed.class, 41L, LockModeType.PESSIMISTIC_WRITE)).thenReturn(b);
        return b;
    }

    private static BreedWrite breed(String code, String name, boolean available, Integer version) {
        return new BreedWrite(code, name, "  ", null, available, version);
    }

    @Test
    void tcAnnt180101ANewBreedIsSavedForTheFarmAndAudited() {
        BreedView view = service.saveBreed(FARM_ID, null, breed("LAISIND", "  Lai Sind  ", true, null));

        assertThat(persisted).singleElement().isInstanceOfSatisfying(Breed.class, b -> {
            assertThat(b.getFarm()).isSameAs(farm);
            assertThat(b.getCode()).isEqualTo("LAISIND");
            assertThat(b.getName()).isEqualTo("Lai Sind");
            assertThat(b.getBreedGroup()).isNull();
            assertThat(b.getAvailable()).isTrue();
        });
        verify(em).lock(farm, LockModeType.PESSIMISTIC_WRITE);
        verify(audit).log(any(FarmContext.class), eq("BREED_CREATE"), eq("Breed"), eq(41L), any());
        assertThat(view.id()).isEqualTo(41L);
        assertThat(view.referenced()).isFalse();
        assertThat(view.messages()).isEmpty();
    }

    @Test
    void tc1802ABreedCodeMustBeUpperCase() {
        Throwable thrown = catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("lai-sind", "Lai Sind", true, null)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "code");
        assertThat(persisted).isEmpty();
    }

    @Test
    void tc1803ABreedCodeHasTwoToTwentyCharacters() {
        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("A", "Lai Sind", true, null))), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("B".repeat(21), "Lai Sind", true, null))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);
        assertThat(persisted).isEmpty();

        service.saveBreed(FARM_ID, null, breed("AB", "Lai Sind", true, null));
        service.saveBreed(FARM_ID, null, breed("B".repeat(20), "Lai Sind", true, null));
        assertThat(persisted).hasSize(2);
    }

    @Test
    void tc1804ACodeAlreadyUsedOnTheFarmIsRejected() {
        counts.put("from Breed x", 1L);

        Throwable thrown = catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("LAISIND", "Lai Sind", true, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_02);
        assertThat(((DomainException) thrown).getParams()).containsEntry("code", "LAISIND");
        assertThat(persisted).isEmpty();
    }

    @Test
    void tc1805TheDuplicateCheckOnlyLooksAtTheSameFarm() {
        service.saveBreed(FARM_ID, null, breed("X-01", "Giong X", true, null));

        TypedQuery<Long> unique = lastCountQuery.get("from Breed x");
        verify(unique).setParameter("f", FARM_ID);
        verify(unique).setParameter("c", "X-01");
        verify(unique).setParameter("id", -1L);
        verify(em).createQuery(contains("x.farm.id=:f and upper(x.code)=:c"), eq(Long.class));
    }

    @Test
    void tc1806TheCodeOfABreedInUseCannotChange() {
        storedBreed("LAISIND", true);
        counts.put("from Cattle c where c.breed.id=:id", 3L);

        Throwable thrown = catchThrowable(() -> service.saveBreed(FARM_ID, 41L, breed("LAISIND-F1", "Lai Sind", true, 3)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "code");
        verifyNoInteractions(audit);
    }

    @Test
    void tc1807StoppingABreedWithTwelveCattleWarnsAndKeepsTheirBreed() {
        Breed b = storedBreed("LAISIND", true);
        counts.put("c.herdStatus=:s", 12L);
        counts.put("from Cattle c where c.breed.id=:id", 12L);

        BreedView view = service.saveBreed(FARM_ID, 41L, breed("LAISIND", "Lai Sind", false, 3));

        assertThat(b.getAvailable()).isFalse();
        assertThat(view.available()).isFalse();
        assertThat(view.messages()).containsExactly("MSG-FE18-03");
        assertThat(view.referencedCount()).isEqualTo(12);
        assertThat(view.activeCattle()).isEqualTo(12);
        verify(em, never()).merge(any());
        assertThat(persisted).isEmpty();
    }

    @Test
    void tc1809RenamingABreedInUseOnlyChangesTheCatalogueItem() {
        Breed b = storedBreed("LAISIND", true);
        counts.put("from Cattle c where c.breed.id=:id", 3L);

        service.saveBreed(FARM_ID, 41L, breed("LAISIND", "Lai Sind F1", true, 3));

        assertThat(b.getName()).isEqualTo("Lai Sind F1");
        assertThat(b.getCode()).isEqualTo("LAISIND");
        assertThat(persisted).isEmpty();
        verify(em).flush();
        verify(audit).log(any(FarmContext.class), eq("BREED_UPDATE"), eq("Breed"), eq(41L), any());
    }

    @Test
    void tc1832AStoppedBreedCanBeUsedAgainWithTheSameId() {
        Breed b = storedBreed("LAISIND", false);

        BreedView view = service.saveBreed(FARM_ID, 41L, breed("LAISIND", "Lai Sind", true, 3));

        assertThat(b.getAvailable()).isTrue();
        assertThat(view.id()).isEqualTo(41L);
        assertThat(view.messages()).isEmpty();
    }

    @Test
    void tcAnnt180102AStaleBreedVersionIsAConflict() {
        storedBreed("LAISIND", true);

        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, 41L, breed("LAISIND", "Lai Sind", true, 2))), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, 41L, breed("LAISIND", "Lai Sind", true, null))), HttpStatus.CONFLICT, MessageCodes.COM_05);
        verifyNoInteractions(audit);
    }

    @Test
    void tcAnnt180103ABreedOfAnotherFarmIsNotFound() {
        Breed b = storedBreed("LAISIND", true);
        Farm other = new Farm();
        other.setId(999L);
        b.setFarm(other);

        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, 41L, breed("LAISIND", "Lai Sind", true, 3))), HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, 77L, breed("LAISIND", "Lai Sind", true, 3))), HttpStatus.NOT_FOUND, MessageCodes.COM_08);
    }

    @Test
    void tcAnnt180104TheNameIsRequiredAndTextFieldsStayWithinTheirLimits() {
        Throwable blank = catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("LAISIND", "  ", true, null)));
        Throwable longName = catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("LAISIND", "N".repeat(101), true, null)));
        Throwable longGroup = catchThrowable(() -> service.saveBreed(FARM_ID, null, new BreedWrite("LAISIND", "Lai Sind", "G".repeat(51), null, true, null)));

        assertDomain(blank, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertDomain(longName, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) longGroup).getParams()).containsEntry("field", "group");
        assertThat(persisted).isEmpty();
    }

    @Test
    void tc1801ATechnicianCannotSaveABreed() {
        when(access.require(FARM_ID, FarmAction.MANAGE_CATALOGUES)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> service.saveBreed(FARM_ID, null, breed("LAISIND", "Lai Sind", true, null))), HttpStatus.FORBIDDEN,
            MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_CATALOGUES.allows(FarmRole.TECHNICIAN)).isFalse();
        verifyNoInteractions(em, audit);
    }

    // ------------------------------------------------------------------ UC-FE18-04 savePurpose()

    private ProductionPurpose storedPurpose(PurposeType type) {
        ProductionPurpose p = new ProductionPurpose();
        p.setId(61L);
        p.setFarm(farm);
        p.setCode("SINH-SAN");
        p.setName("Sinh san");
        p.setPurposeType(type);
        p.setAvailable(true);
        p.setVersion(2);
        when(em.find(ProductionPurpose.class, 61L, LockModeType.PESSIMISTIC_WRITE)).thenReturn(p);
        return p;
    }

    private static PurposeWrite purpose(String code, PurposeType type, boolean available, Integer version) {
        return new PurposeWrite(code, "Sinh san", type, null, available, version);
    }

    private void criterion(long penId, String penCode, int versionNo, Set<PurposeType> types) {
        Pen pen = new Pen();
        pen.setId(penId);
        pen.setCode(penCode);
        pen.setName("Chuong " + penCode);
        PenCriteriaVersion c = new PenCriteriaVersion();
        c.setPen(pen);
        c.setVersionNo(versionNo);
        c.setPurposeTypes(types);
        c.setEffectiveFrom(LocalDate.of(2026, 10, versionNo));
        criteria.add(c);
    }

    @Test
    void tcAnnt180401ANewPurposeIsSavedAndListsThePensThatCurrentlyAcceptItsType() {
        criterion(12L, "B-01", 2, EnumSet.of(PurposeType.FATTENING));
        criterion(12L, "B-01", 1, EnumSet.of(PurposeType.BREEDING));
        criterion(11L, "A-01", 1, EnumSet.of(PurposeType.BREEDING));

        PurposeView view = service.savePurpose(FARM_ID, null, new PurposeWrite("VO-BEO", "Vo beo", PurposeType.FATTENING, null, true, null));

        assertThat(persisted).singleElement().isInstanceOfSatisfying(ProductionPurpose.class, p -> {
            assertThat(p.getCode()).isEqualTo("VO-BEO");
            assertThat(p.getPurposeType()).isEqualTo(PurposeType.FATTENING);
        });
        assertThat(view.receivingPens()).extracting(ReceivingPen::code).containsExactly("B-01");
        verify(audit).log(any(FarmContext.class), eq("PURPOSE_CREATE"), eq("ProductionPurpose"), eq(61L), any());
    }

    @Test
    void tc1815AUsedPurposeCannotChangeItsType() {
        storedPurpose(PurposeType.BREEDING);
        counts.put("from Cattle c where c.purpose.id=:id", 4L);

        Throwable thrown = catchThrowable(() -> service.savePurpose(FARM_ID, 61L, purpose("SINH-SAN", PurposeType.FATTENING, true, 2)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_09);
        assertThat(((DomainException) thrown).getParams()).containsEntry("count", 4L);
        verifyNoInteractions(audit);
    }

    @Test
    void tc1816AnUnusedPurposeCanChangeItsType() {
        ProductionPurpose p = storedPurpose(PurposeType.BREEDING);

        PurposeView view = service.savePurpose(FARM_ID, 61L, purpose("SINH-SAN", PurposeType.FATTENING, true, 2));

        assertThat(p.getPurposeType()).isEqualTo(PurposeType.FATTENING);
        assertThat(view.referenced()).isFalse();
    }

    @Test
    void tc1817APurposeTypeUsedByPenCriteriaCannotChangeEvenWithoutCattle() {
        storedPurpose(PurposeType.BREEDING);
        criterion(11L, "A-01", 1, EnumSet.of(PurposeType.BREEDING));

        Throwable thrown = catchThrowable(() -> service.savePurpose(FARM_ID, 61L, purpose("SINH-SAN", PurposeType.FATTENING, true, 2)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_09);
        assertThat(((DomainException) thrown).getParams()).containsEntry("count", 1L);
    }

    @Test
    void tc1831AReferencedPurposeWithoutActiveCattleCanBeStoppedButKeepsItsCode() {
        ProductionPurpose p = storedPurpose(PurposeType.BREEDING);
        counts.put("from Cattle c where c.purpose.id=:id", 2L);

        PurposeView view = service.savePurpose(FARM_ID, 61L, purpose("SINH-SAN", PurposeType.BREEDING, false, 2));

        assertThat(p.getAvailable()).isFalse();
        assertThat(view.messages()).containsExactly("MSG-FE18-03");
        assertThat(view.referencedCount()).isEqualTo(2);
        assertThat(view.activeCattle()).isZero();
        Throwable renamed = catchThrowable(() -> service.savePurpose(FARM_ID, 61L, purpose("SS-MOI", PurposeType.BREEDING, false, 2)));
        assertDomain(renamed, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
    }

    @Test
    void tcAnnt180402APurposeTypeIsRequired() {
        Throwable thrown = catchThrowable(() -> service.savePurpose(FARM_ID, null, purpose("VO-BEO", null, true, null)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "purposeType");
        assertThat(persisted).isEmpty();
    }

    @Test
    void tcAnnt180403ADuplicatePurposeCodeIsRejected() {
        counts.put("from ProductionPurpose x", 1L);

        assertDomain(catchThrowable(() -> service.savePurpose(FARM_ID, null, purpose("VO-BEO", PurposeType.FATTENING, true, null))),
            HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_02);
        assertThat(persisted).isEmpty();
    }

    @Test
    void tcAnnt180404AStalePurposeVersionIsAConflict() {
        storedPurpose(PurposeType.BREEDING);

        assertDomain(catchThrowable(() -> service.savePurpose(FARM_ID, 61L, purpose("SINH-SAN", PurposeType.BREEDING, true, 1))), HttpStatus.CONFLICT,
            MessageCodes.COM_05);
        verifyNoInteractions(audit);
    }

    @Test
    void tc1801ATechnicianCannotSaveAPurpose() {
        when(access.require(FARM_ID, FarmAction.MANAGE_CATALOGUES)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> service.savePurpose(FARM_ID, null, purpose("VO-BEO", PurposeType.FATTENING, true, null))), HttpStatus.FORBIDDEN,
            MessageCodes.COM_01);
        verifyNoInteractions(em, audit);
    }
}
