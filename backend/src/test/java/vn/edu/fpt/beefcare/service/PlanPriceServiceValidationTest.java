package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;

@ExtendWith(MockitoExtension.class)
class PlanPriceServiceValidationTest {
    @Mock PlatformAccessService access;
    @Mock PlanVersionRepository plans;
    @Mock AuditService audit;
    @Mock FarmClock clock;
    @Mock EntityManager em;
    @InjectMocks PlanPriceService service;

    @Test void tc1923RejectsPriceAboveOneBillionThroughPublishBeforeAnyWrite(){
        when(access.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(null,null,PlatformRole.PM));
        PlanPriceService.PublishPriceRequest request=new PlanPriceService.PublishPriceRequest(
            new BigDecimal("1000000001"),new BigDecimal("1200"),new BigDecimal("1500"),true,null,null);

        assertThatThrownBy(()->service.publish(request)).isInstanceOfSatisfying(DomainException.class,error->
            assertThat(error.getCode()).isEqualTo("MSG-FE19-13"));

        verify(access).requireRole(PlatformRole.PM);
        verifyNoInteractions(plans,audit,clock,em);
    }

    @Test void tc1923RejectsPriceBelowMinimumAndFractionalPriceBeforeAnyWrite(){
        when(access.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(null,null,PlatformRole.PM));
        PlanPriceService.PublishPriceRequest belowMinimum=new PlanPriceService.PublishPriceRequest(
            new BigDecimal("999"),new BigDecimal("1200"),new BigDecimal("1500"),true,null,null);
        PlanPriceService.PublishPriceRequest fractional=new PlanPriceService.PublishPriceRequest(
            new BigDecimal("1500.5"),new BigDecimal("1200"),new BigDecimal("1500"),true,null,null);

        assertThatThrownBy(()->service.publish(belowMinimum)).isInstanceOfSatisfying(DomainException.class,error->
            assertThat(error.getCode()).isEqualTo("MSG-FE19-13"));
        assertThatThrownBy(()->service.publish(fractional)).isInstanceOfSatisfying(DomainException.class,error->
            assertThat(error.getCode()).isEqualTo("MSG-FE19-13"));

        verify(access,org.mockito.Mockito.times(2)).requireRole(PlatformRole.PM);
        verifyNoInteractions(plans,audit,clock,em);
    }
}
