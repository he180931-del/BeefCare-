package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlanPriceLock;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;
import vn.edu.fpt.beefcare.service.PlanPriceService.PriceStatus;
import vn.edu.fpt.beefcare.service.PlanPriceService.PublishPriceRequest;
import vn.edu.fpt.beefcare.service.PlanPriceService.PublishedPrice;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main function of UC-FE19-07: {@link PlanPriceService#publish}.
 * The publication lock row and the repository are mocks; the farm clock is fixed.
 */
@ExtendWith(MockitoExtension.class)
class PlanPriceServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");

    @Mock PlatformAccessService access;
    @Mock PlanVersionRepository plans;
    @Mock AuditService audit;
    @Mock EntityManager em;

    private PlanPriceService service;
    private AppUser pm;

    @BeforeEach
    void setUp() {
        service = new PlanPriceService(access, plans, audit, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), em);
        pm = new AppUser();
        pm.setId(5L);
        pm.setFullName("Platform Manager");
    }

    private void signedInAsPm() {
        when(access.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(pm, null, PlatformRole.PM));
    }

    private void publishable() {
        signedInAsPm();
        when(em.find(PlanPriceLock.class, 1, LockModeType.PESSIMISTIC_WRITE)).thenReturn(new PlanPriceLock());
        lenient().when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAt(any())).thenReturn(Optional.empty());
        lenient().when(plans.saveAndFlush(any(PlanVersion.class))).thenAnswer(call -> {
            PlanVersion saved = call.getArgument(0);
            saved.setId(7L);
            return saved;
        });
    }

    private static PublishPriceRequest request(long oneYear, Boolean now, Instant at, String terms) {
        return new PublishPriceRequest(BigDecimal.valueOf(oneYear), BigDecimal.valueOf(2_200_000), BigDecimal.valueOf(3_000_000), now, at, terms);
    }

    @Test
    void tcDuc190701ApplyNowPublishesAnEffectiveVersionAtTheServerTimeWithAnAudit() {
        publishable();
        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(NOW)).thenAnswer(call -> {
            PlanVersion current = new PlanVersion();
            current.setId(7L);
            return Optional.of(current);
        });
        ArgumentCaptor<PlanVersion> saved = ArgumentCaptor.forClass(PlanVersion.class);

        PublishedPrice price = service.publish(request(1_200_000, true, Instant.parse("2020-01-01T00:00:00Z"), "  Gia moi  "));

        verify(plans).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getEffectiveAt()).isEqualTo(NOW);
        assertThat(saved.getValue().getPublishedAt()).isEqualTo(NOW);
        assertThat(saved.getValue().getPublishedBy()).isSameAs(pm);
        assertThat(price.status()).isEqualTo(PriceStatus.EFFECTIVE);
        assertThat(price.terms()).isEqualTo("Gia moi");
        verify(audit).logAndFlush(isNull(), eq(pm), eq("PLAN_PRICE_PUBLISH"), eq("PlanVersion"), eq(7L), eq(Map.of(
            "price1y", BigDecimal.valueOf(1_200_000), "price2y", BigDecimal.valueOf(2_200_000), "price3y", BigDecimal.valueOf(3_000_000),
            "effectiveAt", NOW, "terms", "Gia moi")), eq(NOW));
        InOrder order = inOrder(em, plans);
        order.verify(em).find(PlanPriceLock.class, 1, LockModeType.PESSIMISTIC_WRITE);
        order.verify(plans).saveAndFlush(any());
    }

    @Test
    void tcDuc190702AFutureTimeIsPublishedAsAScheduledVersion() {
        publishable();
        Instant future = NOW.plus(Duration.ofDays(30));

        PublishedPrice price = service.publish(request(1_200_000, false, future, null));

        assertThat(price.effectiveAt()).isEqualTo(future);
        assertThat(price.status()).isEqualTo(PriceStatus.SCHEDULED);
        assertThat(price.terms()).isNull();
    }

    @Test
    void tc1924AScheduledTimeInThePastGetsMsgFe1914AndNothingIsSaved() {
        publishable();

        assertThatThrownBy(() -> service.publish(request(1_200_000, false, NOW.minusSeconds(1), null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-FE19-14");
                assertThat(error.getParams()).containsEntry("field", "effectiveAt");
            });
        verify(plans, never()).saveAndFlush(any());
        verifyNoInteractions(audit);
    }

    @Test
    void tcDuc190703AScheduledTimeEqualToNowIsAccepted() {
        publishable();

        assertThat(service.publish(request(1_200_000, false, NOW, null)).effectiveAt()).isEqualTo(NOW);
    }

    @Test
    void tc1925AnotherVersionAtTheSameInstantGetsMsgFe1915WithThatVersion() {
        publishable();
        Instant newYear = Instant.parse("2026-12-31T17:00:00Z");
        PlanVersion scheduled = new PlanVersion();
        scheduled.setId(3L);
        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAt(newYear)).thenReturn(Optional.of(scheduled));

        assertThatThrownBy(() -> service.publish(request(1_200_000, false, newYear, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-FE19-15");
                assertThat(error.getParams()).containsEntry("version", 3L).containsEntry("time", newYear);
            });
        verify(plans, never()).saveAndFlush(any());
        verifyNoInteractions(audit);
    }

    @Test
    void tcDuc190704TheLowestAndHighestWholePricesAreAcceptedIncludingTrailingZeros() {
        publishable();

        PublishedPrice price = service.publish(new PublishPriceRequest(new BigDecimal("1000"), new BigDecimal("1000000000"), new BigDecimal("1500.00"),
            true, null, null));

        assertThat(price.price1y()).isEqualByComparingTo("1000");
        assertThat(price.price2y()).isEqualByComparingTo("1000000000");
    }

    @Test
    void tcDuc190705MissingPricesApplyNowOrScheduledTimeGetMsgCom06AndLongTermsGetMsgCom10() {
        signedInAsPm();

        assertThatThrownBy(() -> service.publish(null))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "body"));
        assertThatThrownBy(() -> service.publish(new PublishPriceRequest(BigDecimal.valueOf(1000), null, BigDecimal.valueOf(1000), true, null, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
                assertThat(error.getParams()).containsEntry("field", "price2y");
            });
        assertThatThrownBy(() -> service.publish(request(1_200_000, null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "applyNow"));
        assertThatThrownBy(() -> service.publish(request(1_200_000, true, null, "T".repeat(501))))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "terms");
            });
        verifyNoInteractions(plans, audit, em);

        when(em.find(PlanPriceLock.class, 1, LockModeType.PESSIMISTIC_WRITE)).thenReturn(new PlanPriceLock());
        assertThatThrownBy(() -> service.publish(request(1_200_000, false, null, "T".repeat(500))))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "effectiveAt"));
        verify(plans, never()).saveAndFlush(any());
    }

    @Test
    void tcDuc190706OnlyAnActivePlatformManagerCanPublishAPrice() {
        when(access.requireRole(PlatformRole.PM)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.publish(request(1_200_000, true, null, null)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(plans, audit, em);
    }

    @Test
    void tcDuc190707WithoutThePublicationLockRowNothingIsPublished() {
        signedInAsPm();
        when(em.find(PlanPriceLock.class, 1, LockModeType.PESSIMISTIC_WRITE)).thenReturn(null);

        assertThatThrownBy(() -> service.publish(request(1_200_000, true, null, null))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(plans, audit);
    }
}
