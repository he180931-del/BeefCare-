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
import jakarta.persistence.TypedQuery;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.FeedingRecord;
import vn.edu.fpt.beefcare.domain.FeedingRecordLine;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import org.springframework.test.util.ReflectionTestUtils;

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

    @Test void tc1508TwoPregnantOutOfThreeDecisiveChecksProducesSixtySixPointSevenPercent(){
        ZoneId farmZone=ZoneId.of("Asia/Ho_Chi_Minh");
        List<FarmReportService.ConceptionObservation> observations=List.of(
            observation(11,"2026-11-01T00:00:00Z","2026-11-15T00:00:00Z","PREGNANT"),
            observation(12,"2026-11-02T00:00:00Z","2026-11-16T00:00:00Z","PREGNANT"),
            observation(13,"2026-11-03T00:00:00Z","2026-11-17T00:00:00Z","NOT_PREGNANT"),
            observation(14,"2026-11-04T00:00:00Z","2026-11-18T00:00:00Z","INCONCLUSIVE")
        );

        List<ReportChartBar> bars=FarmReportService.monthlyConceptionRate(LocalDate.of(2026,11,1),LocalDate.of(2026,11,30),farmZone,
            Set.of(11L,12L,13L,14L),observations);

        assertThat(bars).containsExactly(new ReportChartBar("11/2026",new BigDecimal("66.7"),2,3));
    }

    @Test void tc1507TwoCalvingsProduceInsufficientDataForCalvingInterval(){
        Map<String,Object> metric=ReflectionTestUtils.invokeMethod(reports,"measuredAverage",List.of(new BigDecimal("150")));

        assertThat(metric).containsEntry("value",null).containsEntry("n",1).containsEntry("status","INSUFFICIENT_DATA");
    }

    @Test void tc1510InterpolatesTheOctoberTwentiethWeightTo320Kg(){
        @SuppressWarnings("unchecked")
        TypedQuery<Growth> query=mock(TypedQuery.class);
        when(em.createQuery(anyString(),eq(Growth.class))).thenReturn(query);
        when(query.setParameter("id",101L)).thenReturn(query);
        Cattle cow=new Cattle();
        ReflectionTestUtils.setField(cow,"id",101L);
        when(query.getResultList()).thenReturn(List.of(
            growth(1L,cow,LocalDate.of(2026,10,10),"300"),
            growth(2L,cow,LocalDate.of(2026,10,30),"340")));

        BigDecimal interpolated=ReflectionTestUtils.invokeMethod(reports,"weightAt",101L,LocalDate.of(2026,10,20));

        assertThat(interpolated).isEqualByComparingTo("320");
    }

    @Test void tc1514RejectsTheExactReversedReportPeriodWithCom11(){
        ReportRequest request=new ReportRequest("RPT-01",LocalDate.of(2026,11,10),LocalDate.of(2026,11,1),null,null,null,null);

        assertThatThrownBy(()->ReflectionTestUtils.invokeMethod(reports,"validate",request)).isInstanceOfSatisfying(DomainException.class,error->{
            assertThat(error.getCode()).isEqualTo(MessageCodes.COM_11);
            assertThat(error.getParams()).containsEntry("field","period");
        });
    }

    @Test void tc1515RejectsTheExactTwentyFiveMonthPeriodWithCom10(){
        ReportRequest request=new ReportRequest("RPT-07",LocalDate.of(2024,10,1),LocalDate.of(2026,11,1),null,null,null,null);

        assertThatThrownBy(()->ReflectionTestUtils.invokeMethod(reports,"validate",request)).isInstanceOfSatisfying(DomainException.class,error->{
            assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
            assertThat(error.getParams()).containsEntry("field","period").containsEntry("maximumMonths",24);
        });
    }

    @Test void tc1511AllocatesTenKgToEachCowFromFortyKgAcrossFourHeadForOneDay(){
        long cattleId=1511L,penId=151L,recordId=151L;LocalDate day=LocalDate.of(2026,10,20);
        Cattle cow=new Cattle();ReflectionTestUtils.setField(cow,"id",cattleId);
        Pen pen=new Pen();pen.setId(penId);
        PenAssignment assignment=new PenAssignment();assignment.setCattle(cow);assignment.setPen(pen);assignment.setFromDate(day);
        FeedingRecord feeding=new FeedingRecord();ReflectionTestUtils.setField(feeding,"id",recordId);feeding.setPen(pen);feeding.setFeedingDate(day);feeding.setStatus("VALID");
        FeedingRecordLine line=new FeedingRecordLine();line.setActualKg(new BigDecimal("40.000"));line.setTotalCost(400_000L);

        @SuppressWarnings("unchecked") TypedQuery<PenAssignment> assignments=mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<Long> headCount=mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<FeedingRecordLine> lines=mock(TypedQuery.class);
        when(em.createQuery(anyString(),eq(PenAssignment.class))).thenReturn(assignments);
        when(assignments.setParameter("id",cattleId)).thenReturn(assignments);
        when(assignments.setParameter("from",day)).thenReturn(assignments);
        when(assignments.setParameter("to",day)).thenReturn(assignments);
        when(assignments.getResultList()).thenReturn(List.of(assignment));
        when(em.createQuery(anyString(),eq(Long.class))).thenReturn(headCount);
        when(headCount.setParameter("pen",penId)).thenReturn(headCount);
        when(headCount.setParameter("day",day)).thenReturn(headCount);
        when(headCount.getSingleResult()).thenReturn(4L);
        when(em.createQuery(anyString(),eq(FeedingRecordLine.class))).thenReturn(lines);
        when(lines.setParameter("id",recordId)).thenReturn(lines);
        when(lines.getResultList()).thenReturn(List.of(line));

        Object allocation=ReflectionTestUtils.invokeMethod(reports,"allocatedFeed",cow,day,day,List.of(feeding));

        assertThat((BigDecimal)ReflectionTestUtils.getField(allocation,"kilograms")).isEqualByComparingTo("10");
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

    private static Growth growth(long id,Cattle cattle,LocalDate day,String kg){
        Growth growth=new Growth();
        ReflectionTestUtils.setField(growth,"id",id);
        growth.setCattle(cattle);growth.setCheckDate(day);growth.setWeightKg(new BigDecimal(kg));growth.setStatus("VALID");
        return growth;
    }
}
