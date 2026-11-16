package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import jakarta.persistence.EntityManager;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportChartBar;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportMetricChart;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportTotalRow;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportRequest;

@ExtendWith(MockitoExtension.class)
class FarmReportServiceTest {
    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock FarmClock clock;
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

    @Test void finishingProjectionUsesExactRateAndCeilsOnlyTheFinalDayCount(){
        assertThat(FarmReportService.projectedDaysToTarget(new BigDecimal("450"),new BigDecimal("360"),new BigDecimal("60"),39))
            .isEqualByComparingTo("59");
        assertThat(FarmReportService.projectedDaysToTarget(new BigDecimal("420"),new BigDecimal("360"),new BigDecimal("60"),30))
            .isEqualByComparingTo("30");
        assertThat(FarmReportService.projectedDaysToTarget(new BigDecimal("450"),new BigDecimal("360"),BigDecimal.ZERO,39)).isNull();
    }

    @Test void monthlyConceptionChartUsesOneLatestDecisiveResultPerBreedingAndFarmLocalMonth(){
        ZoneId farmZone=ZoneId.of("Asia/Ho_Chi_Minh");
        List<FarmReportService.ConceptionObservation> observations=List.of(
            observation(1,"2026-01-15T00:00:00Z","2026-01-22T00:00:00Z","NOT_PREGNANT"),
            observation(1,"2026-01-15T00:00:00Z","2026-01-25T00:00:00Z","PREGNANT"),
            observation(2,"2026-01-16T00:00:00Z","2026-01-26T00:00:00Z","NOT_PREGNANT"),
            observation(3,"2026-01-17T00:00:00Z","2026-01-27T00:00:00Z","NOT_PREGNANT"),
            observation(4,"2026-01-31T17:30:00Z","2026-02-02T00:00:00Z","PREGNANT"),
            observation(5,"2026-02-10T00:00:00Z","2026-02-12T00:00:00Z","INCONCLUSIVE"),
            observation(6,"2026-03-01T00:00:00Z","2026-03-04T00:00:00Z","PREGNANT")
        );

        List<ReportChartBar> bars=FarmReportService.monthlyConceptionRate(LocalDate.of(2026,1,1),LocalDate.of(2026,2,28),farmZone,Set.of(1L,2L,3L,4L,5L),observations);

        assertThat(bars).extracting(ReportChartBar::label).containsExactly("01/2026","02/2026");
        assertThat(bars.get(0)).isEqualTo(new ReportChartBar("01/2026",new BigDecimal("33.3"),1,3));
        assertThat(bars.get(1)).isEqualTo(new ReportChartBar("02/2026",null,1,1));
    }

    @Test void fatteningTotalUsesTheFarmWideFilteredAccumulatorsAndIsAbsentWithoutRows(){
        Map<String,Object> summary=Map.of("cattleIncluded",2,"insufficientWeights",1,"totalGainKg",new BigDecimal("80"),"feedUsedKg",new BigDecimal("40"),
            "feedPerKgGain",new BigDecimal("0.500"),"feedCostPerKgGain",new BigDecimal("6250.00"),"averageAdgKgPerDay",new BigDecimal("1.000"));
        List<Map<String,Object>> rows=List.of(
            Map.of("pen","P1","cattleCount",1,"feedKg",new BigDecimal("20"),"feedCost",200_000L,"feedKgForIncluded",new BigDecimal("10"),"feedCostForIncluded",100_000L),
            Map.of("label","Chưa phân chuồng","cattleCount",1,"feedKg",new BigDecimal("20"),"feedCost",300_000L,"feedKgForIncluded",new BigDecimal("20"),"feedCostForIncluded",300_000L));

        ReportTotalRow total=FarmReportService.fatteningTotalRow(summary,rows);

        assertThat(total).isNotNull();
        assertThat(total.label()).isEqualTo("Tổng");
        assertThat(total.cells()).containsEntry("cattleCount",2).containsEntry("insufficientWeights",1).containsEntry("gainKg",new BigDecimal("80"))
            .containsEntry("feedKg",new BigDecimal("40")).containsEntry("feedCost",500_000L)
            .containsEntry("feedKgForIncluded",new BigDecimal("30")).containsEntry("feedCostForIncluded",400_000L)
            .containsEntry("feedKgPerGain",new BigDecimal("0.500")).containsEntry("feedCostPerGain",new BigDecimal("6250.00"));
        assertThat(FarmReportService.fatteningTotalRow(summary,List.of())).isNull();
    }

    @Test void metricChartPreservesMeasuredZeroAndRejectsMissingValues(){
        ReportMetricChart chart=FarmReportService.countChart("Counts","Counted source rows","con",List.of(Map.of("label","Empty","count",0L)),"count");
        assertThat(chart.bars()).hasSize(1);
        assertThat(chart.bars().get(0).value()).isEqualByComparingTo(BigDecimal.ZERO);

        Map<String,Object> missing=new java.util.LinkedHashMap<>();missing.put("label","Missing");missing.put("count",null);
        assertThatThrownBy(()->FarmReportService.countChart("Counts","Counted source rows","con",List.of(missing),"count"))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Missing numeric value");
    }

    private static FarmReportService.ConceptionObservation observation(long breedingId,String breedingAt,String checkedAt,String result){
        return new FarmReportService.ConceptionObservation(breedingId,Instant.parse(breedingAt),Instant.parse(checkedAt),result);
    }
}
