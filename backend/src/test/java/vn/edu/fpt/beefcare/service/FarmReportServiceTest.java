package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import jakarta.persistence.EntityManager;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportRequest;

@ExtendWith(MockitoExtension.class)
class FarmReportServiceTest {
    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock FarmClock clock;
    @Mock FarmDashboardService dashboard;
    @InjectMocks FarmReportService reports;

    @Test void rejectsReversedReportPeriodBeforeReadingSourceRows(){
        assertThatThrownBy(()->reports.report(7L,new ReportRequest("RPT-01",LocalDate.of(2026,10,29),LocalDate.of(2026,10,28),null,null,null,null)))
            .isInstanceOf(DomainException.class);
        verify(em,never()).createQuery(anyString(),any(Class.class));
    }

    @Test void rejectsReportPeriodLongerThanTwentyFourMonths(){
        assertThatThrownBy(()->reports.report(7L,new ReportRequest("RPT-07",LocalDate.of(2024,10,1),LocalDate.of(2026,10,2),null,null,null,null)))
            .isInstanceOf(DomainException.class);
        verify(em,never()).createQuery(anyString(),any(Class.class));
    }
}
