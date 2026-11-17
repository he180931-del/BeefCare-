package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.repository.*;
import java.time.LocalDate;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.CreateReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.VoidReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.UpdateDraftReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.ReceiptLineRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.FeedingLineRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RecordFeedingRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.FeedingVoidRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.FeedingCorrectionRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationVersionRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.StopRationRequest;

@ExtendWith(MockitoExtension.class)
class FeedManagementServiceTest {
    @Mock FarmAccessService access; @Mock FarmClock clock; @Mock FeedItemRepository feeds; @Mock TradingPartnerRepository partners;
    @Mock FeedReceiptRepository receipts; @Mock FeedReceiptLineRepository lines; @Mock VoucherPaymentRepository payments;
    @Mock VoucherPaymentService voucherPayments; @Mock AuditService audit; @Mock FeedAttachmentService attachments; @Mock FeedStockMovementRepository movements;
    @Mock OutboxService outbox; @Mock FeedRationVersionRepository rationVersions; @Mock FeedRationPenRepository rationPens;
    @Mock FeedRationComponentRepository rationComponents; @Mock PenRepository pens; @Mock PenAssignmentRepository assignments;
    @Mock FeedingRecordRepository feedingRecords; @Mock FeedingRecordLineRepository feedingLines; @Mock RecordRevisionService revisions;
    @Mock CodeSequenceService codes; @Mock EntityManager entityManager;
    @InjectMocks FeedManagementService service;
    FarmContext context; FeedItem feed; FeedReceipt receipt; FeedReceiptLine line; TradingPartner supplier;

    @BeforeEach void setUp(){
        Farm farm=new Farm();ReflectionTestUtils.setField(farm,"id",12L);AppUser actor=new AppUser();actor.setId(41L);context=new FarmContext(farm,actor,FarmRole.OWNER);
        feed=new FeedItem();feed.setId(99L);feed.setFarm(farm);feed.setCode("TA-01");feed.setName("Hay");feed.setAvailable(true);feed.setOnHandKg(new BigDecimal("10.000"));feed.setAvgUnitCost(new BigDecimal("100.00"));
        supplier=new TradingPartner();supplier.setId(88L);supplier.setName("Supplier");
        receipt=new FeedReceipt();ReflectionTestUtils.setField(receipt,"id",77L);receipt.setFarm(farm);receipt.setSupplier(supplier);receipt.setCode("PNK-2026-000077");receipt.setReceiptDate(java.time.LocalDate.of(2026,10,28));receipt.setStatus("DRAFT");receipt.setTransportFee(0L);receipt.setCreatedAt(Instant.parse("2026-10-28T00:00:00Z"));receipt.setTotalPayable(1_000L);
        line=new FeedReceiptLine();line.setReceipt(receipt);line.setFeedItem(feed);line.setFeedCodeSnapshot("TA-01");line.setFeedNameSnapshot("Hay");line.setKgReceived(new BigDecimal("5.000"));line.setQuantityPurchase(new BigDecimal("5.000"));line.setPurchaseUnit("kg");line.setLineAmount(1_000L);line.setUnitPrice(200L);line.setUnitCostKg(new BigDecimal("200.00"));
        lenient().when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);
        lenient().when(clock.zone()).thenReturn(FarmTimeZones.OFFSET);
    }

    @Test void feedCatalogueRequiresStockPermission(){
        when(access.require(12L,FarmAction.VIEW_FEED_STOCK)).thenReturn(context);
        when(feeds.findByFarm_IdOrderByNameAsc(12L)).thenReturn(List.of(feed));

        assertThat(service.catalogue(12L)).hasSize(1);

        verify(access).require(12L,FarmAction.VIEW_FEED_STOCK);
    }

    @Test void postingReceiptUsesWeightedAverageAndWritesMovementAtomically(){
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T00:00:00Z"));
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenReturn(List.of(line));when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));when(receipts.saveAndFlush(receipt)).thenReturn(receipt);
        var result=service.postReceipt(12L,77L,0);
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("15.000");assertThat(feed.getAvgUnitCost()).isEqualByComparingTo("133.33");assertThat(result.status()).isEqualTo("POSTED");
        verify(movements).save(any(FeedStockMovement.class));verify(outbox).enqueue(eq(12L),eq("FEED_RECEIPT_POSTED"),eq("FeedReceipt"),eq(77L),any());
    }

    @Test void postingMultipleLotsForOneFeedAggregatesAverageCostAndStockMovement(){
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T00:00:00Z"));
        FeedReceiptLine second=new FeedReceiptLine();second.setReceipt(receipt);second.setFeedItem(feed);second.setFeedCodeSnapshot("TA-01");second.setFeedNameSnapshot("Hay");
        second.setKgReceived(new BigDecimal("2.000"));second.setQuantityPurchase(new BigDecimal("2.000"));second.setPurchaseUnit("kg");second.setLineAmount(400L);second.setUnitPrice(200L);
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenReturn(List.of(line,second));
        when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));when(receipts.saveAndFlush(receipt)).thenReturn(receipt);

        service.postReceipt(12L,77L,0);

        assertThat(feed.getOnHandKg()).isEqualByComparingTo("17.000");assertThat(feed.getAvgUnitCost()).isEqualByComparingTo("141.18");
        verify(feeds,times(1)).lockByIdAndFarm(99L,12L);
        var movementCaptor=org.mockito.ArgumentCaptor.forClass(FeedStockMovement.class);verify(movements,times(2)).save(movementCaptor.capture());
        assertThat(movementCaptor.getAllValues()).extracting(FeedStockMovement::getBalanceAfterKg).containsExactly(new BigDecimal("15.000"),new BigDecimal("17.000"));
    }

    @Test void voidReceiptRejectsAnyLineNotCoveredByCurrentStock(){
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));receipt.setStatus("POSTED");
        when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenReturn(List.of(line));feed.setOnHandKg(new BigDecimal("4.999"));when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));
        assertThatThrownBy(()->service.voidReceipt(12L,77L,new VoidReceiptRequest("recorded twice",0))).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_05);
            assertThat(e.getParams()).containsEntry("receipt_code","PNK-2026-000077").containsEntry("feed","Hay").containsEntry("stock",new BigDecimal("4.999"));});
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("4.999");verify(movements,never()).save(any());
    }

    @Test void voidReceiptChecksCombinedQuantityAcrossLotsBeforeChangingStock(){
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));receipt.setStatus("POSTED");feed.setOnHandKg(new BigDecimal("9.000"));
        FeedReceiptLine second=new FeedReceiptLine();second.setReceipt(receipt);second.setFeedItem(feed);second.setKgReceived(new BigDecimal("5.000"));second.setLineAmount(1_000L);
        when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenReturn(List.of(line,second));when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));

        assertThatThrownBy(()->service.voidReceipt(12L,77L,new VoidReceiptRequest("recorded twice",0))).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_05));
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("9.000");verify(feeds,times(1)).lockByIdAndFarm(99L,12L);verify(movements,never()).save(any());
    }

    @Test void receiptLineExpiryMustBeAfterReceiptDate(){
        activeSupplierAndFeed();
        var request=receiptRequest(LocalDate.of(2026,10,28));
        assertThatThrownBy(()->service.createReceipt(12L,request,true)).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_03);assertThat(e.getParams()).containsEntry("field","expiryDate");});
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("10.000");verify(movements,never()).save(any());
    }

    @Test void inactiveFeedOnReceiptIsReportedAsNoLongerAvailable(){
        activeSupplierAndFeed();feed.setAvailable(false);
        assertThatThrownBy(()->service.createReceipt(12L,receiptRequest(LocalDate.of(2026,11,30)),true)).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.COM_08);assertThat(e.getParams()).containsEntry("field","feedItemId");});
        verify(movements,never()).save(any());
    }

    @Test void lotNearExpiryIsTheNearestPostedLotWithinThirtyDays(){
        when(access.require(12L,FarmAction.VIEW_FEED_STOCK)).thenReturn(context);when(clock.today()).thenReturn(LocalDate.of(2026,10,28));
        when(feeds.findByFarm_IdOrderByNameAsc(12L)).thenReturn(List.of(feed));
        when(lines.findByFeedItem_IdOrderByExpiryDateAsc(99L)).thenReturn(List.of(
            lot("OLD","POSTED",LocalDate.of(2026,10,27)),lot("VOID","VOIDED",LocalDate.of(2026,11,1)),lot("DRAFT","DRAFT",LocalDate.of(2026,11,2)),
            lot("LOT-A","POSTED",LocalDate.of(2026,11,5)),lot("LOT-B","POSTED",LocalDate.of(2026,11,10))));
        var view=service.stock(12L).get(0);
        assertThat(view.nearestLotNumber()).isEqualTo("LOT-A");assertThat(view.nearestLotExpiryDate()).isEqualTo(LocalDate.of(2026,11,5));
    }

    @Test void lotNearExpiryIsEmptyWhenNoPostedLotExpiresWithinThirtyDays(){
        when(access.require(12L,FarmAction.VIEW_FEED_STOCK)).thenReturn(context);when(clock.today()).thenReturn(LocalDate.of(2026,10,28));
        when(feeds.findByFarm_IdOrderByNameAsc(12L)).thenReturn(List.of(feed));
        when(lines.findByFeedItem_IdOrderByExpiryDateAsc(99L)).thenReturn(List.of(lot("LATER","POSTED",LocalDate.of(2026,11,28)),lot("NONE","POSTED",null)));
        var view=service.stock(12L).get(0);
        assertThat(view.nearestLotNumber()).isNull();assertThat(view.nearestLotExpiryDate()).isNull();
    }

    private void activeSupplierAndFeed(){
        supplier.setSupplier(true);supplier.setStatus(vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus.ACTIVE);
        when(partners.findByIdAndFarmId(88L,12L)).thenReturn(Optional.of(supplier));when(feeds.findByIdAndFarm_Id(99L,12L)).thenReturn(Optional.of(feed));
        when(receipts.saveAndFlush(any(FeedReceipt.class))).thenAnswer(invocation->invocation.getArgument(0));
    }

    private CreateReceiptRequest receiptRequest(LocalDate expiry){
        return new CreateReceiptRequest(LocalDate.of(2026,10,28),88L,"INV-1","Alex","Shed 1",null,0L,List.of(new ReceiptLineRequest(99L,"LOT-1",expiry,new BigDecimal("2"),"kg",250L)),true);
    }

    private FeedReceiptLine lot(String number,String status,LocalDate expiry){
        FeedReceipt owner=new FeedReceipt();owner.setStatus(status);FeedReceiptLine l=new FeedReceiptLine();l.setReceipt(owner);l.setFeedItem(feed);l.setLotNumber(number);l.setExpiryDate(expiry);return l;
    }

    @Test void draftReceiptCanBeReplacedOnlyWithItsCurrentVersion(){
        ReflectionTestUtils.setField(receipt,"version",0);supplier.setSupplier(true);supplier.setStatus(vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus.ACTIVE);
        feed.setPurchaseUnit("kg");feed.setKgPerPurchaseUnit(BigDecimal.ONE);
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));when(partners.findByIdAndFarmId(88L,12L)).thenReturn(Optional.of(supplier));
        when(feeds.findByIdAndFarm_Id(99L,12L)).thenReturn(Optional.of(feed));
        java.util.concurrent.atomic.AtomicReference<FeedReceiptLine> savedLine = new java.util.concurrent.atomic.AtomicReference<>();
        when(lines.save(any(FeedReceiptLine.class))).thenAnswer(invocation -> { FeedReceiptLine saved=invocation.getArgument(0);savedLine.set(saved);return saved; });
        when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenAnswer(invocation -> List.of(savedLine.get()==null?line:savedLine.get()));
        when(receipts.saveAndFlush(receipt)).thenReturn(receipt);
        var request=new UpdateDraftReceiptRequest(0,java.time.LocalDate.of(2026,10,28),88L,"INV-2","Alex","Shed 1","corrected count",0L,List.of(new ReceiptLineRequest(99L,"LOT-2",java.time.LocalDate.of(2027,10,28),new BigDecimal("2"),"kg",250L)));
        var result=service.updateDraftReceipt(12L,77L,request);
        assertThat(result.status()).isEqualTo("DRAFT");assertThat(result.lines()).hasSize(1);assertThat(result.lines().get(0).lotNumber()).isEqualTo("LOT-2");
        verify(lines).deleteAll(List.of(line));verify(lines).flush();verify(outbox).enqueue(eq(12L),eq("FEED_RECEIPT_DRAFT_UPDATED"),eq("FeedReceipt"),eq(77L),any());
    }

    @Test void feedingPlanAndRecordUseServerPlanAndRoundTripSessionFields(){
        Pen pen=activePen(301L,"A1");FeedRationVersion ration=feedingRation(pen,true);
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);context.farm().setTimeZone("UTC");
        LocalDate date=LocalDate.of(2026,10,28);stubFeedingPen(pen,4);stubRation(ration,pen,new BigDecimal("2.500"));
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);
        when(feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(12L,301L,date,1,"VALID")).thenReturn(Optional.empty());
        when(clock.now()).thenReturn(Instant.parse("2026-11-15T00:00:00Z"));
        AtomicReference<FeedingRecordLine> savedLine=new AtomicReference<>();AtomicInteger nextId=new AtomicInteger(700);
        when(feedingRecords.saveAndFlush(any(FeedingRecord.class))).thenAnswer(invocation->{FeedingRecord saved=invocation.getArgument(0);if(saved.getId()==null)ReflectionTestUtils.setField(saved,"id",(long)nextId.getAndIncrement());return saved;});
        when(feedingLines.save(any(FeedingRecordLine.class))).thenAnswer(invocation->{FeedingRecordLine saved=invocation.getArgument(0);savedLine.set(saved);return saved;});
        when(feedingLines.findByFeedingRecord_Id(anyLong())).thenAnswer(invocation->savedLine.get()==null?List.of():List.of(savedLine.get()));
        when(revisions.history(anyString(),anyLong())).thenReturn(List.of());

        var plan=service.feedingPlan(12L,301L,date,1);
        assertThat(plan.ration().rationCode()).isEqualTo("KP-TEST");assertThat(plan.headCount()).isEqualTo(4);
        assertThat(plan.lines()).singleElement().satisfies(planLine->{assertThat(planLine.plannedKg()).isEqualByComparingTo("10.000");assertThat(planLine.stockKg()).isEqualByComparingTo("10.000");assertThat(planLine.available()).isTrue();});

        var result=service.recordFeeding(12L,new RecordFeedingRequest(301L,date,1,java.time.LocalTime.of(6,45),"Người cho ăn",new BigDecimal("0.5"),"Ghi nhận thực tế",List.of(new FeedingLineRequest(99L,new BigDecimal("2.5")))));

        verify(clock).assertNotFuture(Instant.parse("2026-10-27T23:45:00Z"));
        assertThat(result.time()).isEqualTo(java.time.LocalTime.of(6,45));assertThat(result.fedBy()).isEqualTo("Người cho ăn");
        assertThat(result.leftoverKg()).isEqualByComparingTo("0.5");assertThat(result.note()).isEqualTo("Ghi nhận thực tế");
        assertThat(result.lines()).singleElement().satisfies(saved->{assertThat(saved.plannedKg()).isEqualByComparingTo("10.000");assertThat(saved.actualKg()).isEqualByComparingTo("2.5");assertThat(saved.inRation()).isTrue();});
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("7.500");
        var movement=org.mockito.ArgumentCaptor.forClass(FeedStockMovement.class);verify(movements).save(movement.capture());
        assertThat(movement.getValue().getQuantityKg()).isEqualByComparingTo("-2.5");
    }

    @Test void inactivePlannedFeedCanBeRecordedAsZeroButCannotBeConsumed(){
        Pen pen=activePen(302L,"A2");FeedRationVersion ration=feedingRation(pen,false);
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);context.farm().setTimeZone("UTC");feed.setAvailable(false);
        LocalDate date=LocalDate.of(2026,10,28);stubFeedingPen(pen,4);stubRation(ration,pen,new BigDecimal("1.250"));
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);
        when(feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(12L,302L,date,1,"VALID")).thenReturn(Optional.empty());
        when(clock.now()).thenReturn(Instant.parse("2026-11-15T00:00:00Z"));
        AtomicReference<FeedingRecordLine> savedLine=new AtomicReference<>();
        when(feedingRecords.saveAndFlush(any(FeedingRecord.class))).thenAnswer(invocation->{FeedingRecord saved=invocation.getArgument(0);ReflectionTestUtils.setField(saved,"id",701L);return saved;});
        when(feedingLines.save(any(FeedingRecordLine.class))).thenAnswer(invocation->{FeedingRecordLine saved=invocation.getArgument(0);savedLine.set(saved);return saved;});
        when(feedingLines.findByFeedingRecord_Id(anyLong())).thenAnswer(invocation->savedLine.get()==null?List.of():List.of(savedLine.get()));
        when(revisions.history(anyString(),anyLong())).thenReturn(List.of());

        var plan=service.feedingPlan(12L,302L,date,1);assertThat(plan.lines()).singleElement().satisfies(planLine->{assertThat(planLine.available()).isFalse();assertThat(planLine.plannedKg()).isEqualByComparingTo("5.000");});
        var result=service.recordFeeding(12L,new RecordFeedingRequest(302L,date,1,null,null,null,null,List.of(new FeedingLineRequest(99L,BigDecimal.ZERO))));
        assertThat(result.lines()).singleElement().satisfies(saved->{assertThat(saved.plannedKg()).isEqualByComparingTo("5.000");assertThat(saved.actualKg()).isEqualByComparingTo(BigDecimal.ZERO);});
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("10.000");verify(movements,never()).save(any());

        assertThatThrownBy(()->service.recordFeeding(12L,new RecordFeedingRequest(302L,date,1,null,null,null,null,List.of(new FeedingLineRequest(99L,new BigDecimal("0.1"))))))
            .isInstanceOfSatisfying(DomainException.class,e->{assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_21);assertThat(e.getParams()).containsEntry("feed","Hay");});
        verify(feedingRecords,times(1)).saveAndFlush(any(FeedingRecord.class));
    }

    @Test void feedingPlanAndRecordRejectSessionsOutsideTheEffectiveRation(){
        Pen pen=activePen(305L,"C1");FeedRationVersion ration=feedingRation(pen,true);
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);context.farm().setTimeZone("UTC");
        LocalDate date=LocalDate.of(2026,10,28);stubFeedingPen(pen,4);stubRation(ration,pen,new BigDecimal("2.500"));
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);
        when(feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(12L,305L,date,2,"VALID")).thenReturn(Optional.empty());

        assertThatThrownBy(()->service.feedingPlan(12L,305L,date,2)).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10);assertThat(e.getParams()).containsEntry("field","sessionNo");});
        assertThatThrownBy(()->service.recordFeeding(12L,new RecordFeedingRequest(305L,date,2,null,null,null,null,
            List.of(new FeedingLineRequest(99L,new BigDecimal("0.5")))))).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10);assertThat(e.getParams()).containsEntry("field","sessionNo");});
        verify(feedingRecords,never()).saveAndFlush(any(FeedingRecord.class));verify(feeds,never()).lockByIdAndFarm(anyLong(),anyLong());
    }

    @Test void feedingRecordUsesTheActiveStatusReturnedByTheScopedPenLock(){
        Pen staleRead=activePen(306L,"C2");Pen lockedPen=activePen(306L,"C2");lockedPen.setStatus(ActiveStatus.INACTIVE);
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);
        lenient().when(pens.findByIdAndFarmId(306L,12L)).thenReturn(Optional.of(staleRead));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(306L))).thenReturn(List.of(lockedPen));

        assertThatThrownBy(()->service.recordFeeding(12L,new RecordFeedingRequest(306L,LocalDate.of(2026,10,28),1,null,null,null,null,
            List.of(new FeedingLineRequest(99L,BigDecimal.ZERO))))).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        verify(pens).lockAllByFarmIdAndIdIn(12L,List.of(306L));verify(pens,never()).findByIdAndFarmId(306L,12L);
        verifyNoInteractions(assignments,feedingRecords,feeds,movements);
    }

    @Test void zeroQuantityWhenStockIsEmptyRequiresAndStoresAnOutOfStockNote(){
        Pen pen=activePen(307L,"C3");context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);context.farm().setTimeZone("UTC");
        LocalDate date=LocalDate.of(2026,10,28);stubFeedingPen(pen,4);feed.setOnHandKg(BigDecimal.ZERO.setScale(3));
        when(rationPens.findByPen_Id(307L)).thenReturn(List.of());when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);
        when(feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(12L,307L,date,1,"VALID")).thenReturn(Optional.empty());
        when(clock.now()).thenReturn(Instant.parse("2026-11-15T00:00:00Z"));
        AtomicReference<FeedingRecordLine> savedLine=new AtomicReference<>();
        when(feedingRecords.saveAndFlush(any(FeedingRecord.class))).thenAnswer(invocation->{FeedingRecord saved=invocation.getArgument(0);ReflectionTestUtils.setField(saved,"id",702L);return saved;});
        when(feedingLines.save(any(FeedingRecordLine.class))).thenAnswer(invocation->{FeedingRecordLine saved=invocation.getArgument(0);savedLine.set(saved);return saved;});
        when(feedingLines.findByFeedingRecord_Id(702L)).thenAnswer(invocation->savedLine.get()==null?List.of():List.of(savedLine.get()));
        when(revisions.history("FeedingRecord",702L)).thenReturn(List.of());

        var missingNote=new RecordFeedingRequest(307L,date,1,null,null,null,"   ",List.of(new FeedingLineRequest(99L,BigDecimal.ZERO)));
        assertThatThrownBy(()->service.recordFeeding(12L,missingNote)).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.COM_06);assertThat(e.getParams()).containsEntry("field","note");});
        verify(feedingRecords,never()).saveAndFlush(any(FeedingRecord.class));

        var result=service.recordFeeding(12L,new RecordFeedingRequest(307L,date,1,null,null,null,"Hết hàng lúc cho ăn",
            List.of(new FeedingLineRequest(99L,BigDecimal.ZERO))));
        assertThat(result.note()).isEqualTo("Hết hàng lúc cho ăn");
        assertThat(result.lines()).singleElement().satisfies(saved->assertThat(saved.actualKg()).isEqualByComparingTo(BigDecimal.ZERO));
        assertThat(feed.getOnHandKg()).isEqualByComparingTo(BigDecimal.ZERO);verify(movements,never()).save(any());
        verify(feedingRecords,times(1)).saveAndFlush(any(FeedingRecord.class));
    }

    @Test void voidingReturnsStockAndAllowsAValidRecordToBeReRecorded(){
        Pen pen=activePen(303L,"B1");context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);context.farm().setTimeZone("UTC");
        LocalDate date=LocalDate.of(2026,10,28);stubFeedingPen(pen,4);when(rationPens.findByPen_Id(303L)).thenReturn(List.of());
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);when(clock.now()).thenReturn(Instant.parse("2026-11-15T00:00:00Z"));
        AtomicReference<FeedingRecord> valid=new AtomicReference<>();AtomicInteger nextId=new AtomicInteger(800);
        when(feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(12L,303L,date,1,"VALID"))
            .thenAnswer(invocation->valid.get()!=null&&"VALID".equals(valid.get().getStatus())?Optional.of(valid.get()):Optional.empty());
        when(feedingRecords.saveAndFlush(any(FeedingRecord.class))).thenAnswer(invocation->{FeedingRecord saved=invocation.getArgument(0);if(saved.getId()==null)ReflectionTestUtils.setField(saved,"id",(long)nextId.getAndIncrement());valid.set(saved);return saved;});
        java.util.Map<Long,FeedingRecordLine> storedLines=new java.util.HashMap<>();
        when(feedingLines.save(any(FeedingRecordLine.class))).thenAnswer(invocation->{FeedingRecordLine saved=invocation.getArgument(0);storedLines.put(saved.getFeedingRecord().getId(),saved);return saved;});
        when(feedingLines.findByFeedingRecord_Id(anyLong())).thenAnswer(invocation->{FeedingRecordLine saved=storedLines.get(invocation.getArgument(0));return saved==null?List.of():List.of(saved);});
        when(feedingRecords.lockByIdAndFarm(800L,12L)).thenAnswer(invocation->Optional.ofNullable(valid.get()));
        when(revisions.history(anyString(),anyLong())).thenReturn(List.of());
        var request=new RecordFeedingRequest(303L,date,1,null,"Người cho ăn",null,"Không có khẩu phần",List.of(new FeedingLineRequest(99L,new BigDecimal("2.5"))));
        var created=service.recordFeeding(12L,request);
        assertThatThrownBy(()->service.recordFeeding(12L,request)).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_13));

        assertThatThrownBy(()->service.voidFeeding(12L,created.id(),new FeedingVoidRequest("Lý do hủy hợp lệ",1)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        var voided=service.voidFeeding(12L,created.id(),new FeedingVoidRequest("Lý do hủy hợp lệ",0));
        assertThat(voided.status()).isEqualTo("VOIDED");assertThat(feed.getOnHandKg()).isEqualByComparingTo("10.000");
        var replacement=service.recordFeeding(12L,request);
        assertThat(replacement.id()).isNotEqualTo(created.id());assertThat(replacement.status()).isEqualTo("VALID");assertThat(feed.getOnHandKg()).isEqualByComparingTo("7.500");
    }

    @Test void correctionRequiresTheCurrentVersionAndReturnsOnlyTheQuantityDifference(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);Pen pen=activePen(304L,"B2");
        FeedingRecord record=new FeedingRecord();ReflectionTestUtils.setField(record,"id",804L);ReflectionTestUtils.setField(record,"version",3);
        record.setFarm(context.farm());record.setPen(pen);record.setFeedingDate(LocalDate.of(2026,10,28));record.setSessionNo(1);record.setHeadCount(4);record.setFedBy("Người cho ăn");record.setRecordedAt(Instant.parse("2026-10-28T06:30:00Z"));
        FeedingRecordLine recordLine=new FeedingRecordLine();recordLine.setFeedingRecord(record);recordLine.setFeedItem(feed);recordLine.setFeedCodeSnapshot("TA-01");recordLine.setFeedNameSnapshot("Hay");recordLine.setPlannedKg(new BigDecimal("10.000"));recordLine.setActualKg(new BigDecimal("2.500"));recordLine.setCostPerKg(new BigDecimal("100.00"));recordLine.setTotalCost(250L);
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenReturn(context);when(feedingRecords.lockByIdAndFarm(804L,12L)).thenReturn(Optional.of(record));
        when(feedingLines.findByFeedingRecord_Id(804L)).thenReturn(List.of(recordLine));when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));when(revisions.history(anyString(),anyLong())).thenReturn(List.of());
        var stale=new FeedingCorrectionRequest("Ghi sai lượng",2,null,List.of(new FeedingLineRequest(99L,new BigDecimal("1.5"))));
        assertThatThrownBy(()->service.correctFeeding(12L,804L,stale)).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        verify(feedingLines,never()).findByFeedingRecord_Id(804L);verify(feeds,never()).lockByIdAndFarm(99L,12L);

        doAnswer(invocation->{ReflectionTestUtils.setField(record,"version",record.getVersion()+1);return null;})
            .when(entityManager).lock(record,LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        var corrected=service.correctFeeding(12L,804L,new FeedingCorrectionRequest("Ghi sai lượng",3,null,List.of(new FeedingLineRequest(99L,new BigDecimal("1.5")))));
        assertThat(corrected.lines()).singleElement().satisfies(saved->{assertThat(saved.plannedKg()).isEqualByComparingTo("10.000");assertThat(saved.actualKg()).isEqualByComparingTo("1.5");assertThat(saved.totalCost()).isEqualTo(150L);});
        assertThat(corrected.version()).isEqualTo(4);verify(entityManager).lock(record,LockModeType.PESSIMISTIC_FORCE_INCREMENT);verify(entityManager).flush();
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("11.000");
        clearInvocations(feedingLines,feeds);
        assertThatThrownBy(()->service.correctFeeding(12L,804L,new FeedingCorrectionRequest("Ghi sai lượng",3,null,List.of(new FeedingLineRequest(99L,new BigDecimal("1.5"))))))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("11.000");verifyNoInteractions(feedingLines,feeds);
        verify(feedingRecords,times(3)).lockByIdAndFarm(804L,12L);verify(feedingRecords,never()).findById(804L);
        verify(revisions).record(eq(context),eq("FeedingRecord"),eq(804L),eq(RecordRevisionService.CORRECT),eq("Ghi sai lượng"),any(),any());
        var movement=org.mockito.ArgumentCaptor.forClass(FeedStockMovement.class);verify(movements).save(movement.capture());assertThat(movement.getValue().getQuantityKg()).isEqualByComparingTo("1.000");
    }

    @Test void feedingWritesAskTheManagerOnlyAuthorizationAction(){
        when(access.require(12L,FarmAction.MANAGE_FEEDING)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));
        assertThatThrownBy(()->service.feedingPlan(12L,1L,LocalDate.of(2026,10,28),1)).isInstanceOf(DomainException.class);
        verify(access).require(12L,FarmAction.MANAGE_FEEDING);verifyNoInteractions(pens,feedingRecords);
    }

    @Test void cancelScheduledVersionRestoresAnOpenEndedPredecessorAndKeepsHistory(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen=activePen(401L,"R1");FeedRationVersion prior=rationVersion(901L,1,LocalDate.of(2026,1,1),start.minusDays(1),"ENDED",2);
        FeedRationVersion scheduled=rationVersion(902L,2,start,null,"SCHEDULED",0);
        FeedRationPen priorLink=rationLink(prior,pen,null,null,true);
        FeedRationPen scheduledLink=rationLink(scheduled,pen,prior,null,true);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(902L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(401L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(902L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByRationVersion_Id(901L)).thenReturn(List.of(priorLink));
        when(rationPens.findByPen_Id(401L)).thenReturn(List.of(priorLink,scheduledLink));
        when(rationVersions.save(prior)).thenReturn(prior);
        when(rationVersions.saveAndFlush(scheduled)).thenAnswer(invocation->{scheduled.setVersion(scheduled.getVersion()+1);return scheduled;});

        var result=service.cancelRationVersion(12L,902L,2,new RationVersionRequest(0));

        assertThat(result.status()).isEqualTo("CANCELLED");assertThat(result.version()).isEqualTo(1);assertThat(result.effectiveTo()).isEqualTo(start.minusDays(1));
        assertThat(prior.getEffectiveTo()).isNull();
        verify(rationVersions).save(prior);verify(rationVersions).saveAndFlush(scheduled);
        verify(outbox).enqueue(eq(12L),eq("FEED_RATION_VERSION_CANCELLED"),eq("FeedRationVersion"),eq(902L),any());
    }

    @Test void cancellingAFirstScheduledRationKeepsItsTerminalHistoryWithoutAPredecessor(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.OWNER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen=activePen(405L,"R1A");FeedRationVersion scheduled=rationVersion(905L,1,start,null,"SCHEDULED",0);
        FeedRationPen scheduledLink=rationLink(scheduled,pen,null,null,true);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(905L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(405L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(905L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByPen_Id(405L)).thenReturn(List.of(scheduledLink));
        when(rationVersions.saveAndFlush(scheduled)).thenAnswer(invocation->{scheduled.setVersion(scheduled.getVersion()+1);return scheduled;});

        var result=service.cancelRationVersion(12L,905L,1,new RationVersionRequest(0));

        assertThat(result.status()).isEqualTo("CANCELLED");assertThat(result.version()).isEqualTo(1);
        assertThat(scheduled.getEffectiveTo()).isEqualTo(start.minusDays(1));
        verify(rationVersions).saveAndFlush(scheduled);
    }

    @Test void cancellationCarriesAnOpenEndedPredecessorThroughSameDateSuccessorsAcrossPens(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20),next=LocalDate.of(2026,11,30);
        Pen pen1=activePen(411L,"R1"),pen2=activePen(412L,"R2");
        FeedRationVersion prior=rationVersion(911L,1,LocalDate.of(2026,1,1),start.minusDays(1),"ENDED",2);
        FeedRationVersion scheduled=rationVersion(912L,2,start,next.minusDays(1),"SCHEDULED",0);
        FeedRationVersion successor=rationVersion(913L,3,next,null,"SCHEDULED",0);
        FeedRationPen prior1=rationLink(prior,pen1,null,null,true),prior2=rationLink(prior,pen2,null,null,true);
        FeedRationPen target1=rationLink(scheduled,pen1,prior,null,true),target2=rationLink(scheduled,pen2,prior,null,true);
        FeedRationPen next1=rationLink(successor,pen1,scheduled,null,true),next2=rationLink(successor,pen2,scheduled,null,true);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(912L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(411L,412L))).thenReturn(List.of(pen1,pen2));
        when(rationPens.findByRationVersion_Id(912L)).thenReturn(List.of(target1,target2));
        when(rationPens.findByRationVersion_Id(911L)).thenReturn(List.of(prior1,prior2));
        when(rationPens.findByPen_Id(411L)).thenReturn(List.of(prior1,target1,next1));
        when(rationPens.findByPen_Id(412L)).thenReturn(List.of(prior2,target2,next2));
        when(rationPens.save(any(FeedRationPen.class))).thenAnswer(invocation->invocation.getArgument(0));
        when(rationVersions.save(prior)).thenReturn(prior);
        when(rationVersions.saveAndFlush(scheduled)).thenAnswer(invocation->{scheduled.setVersion(scheduled.getVersion()+1);return scheduled;});

        service.cancelRationVersion(12L,912L,2,new RationVersionRequest(0));

        assertThat(prior.getEffectiveTo()).isEqualTo(next.minusDays(1));
        assertThat(next1.getPredecessorVersion()).isSameAs(prior);assertThat(next2.getPredecessorVersion()).isSameAs(prior);
        assertThat(next1.isPredecessorSnapshotCaptured()).isTrue();assertThat(next2.isPredecessorSnapshotCaptured()).isTrue();
    }

    @Test void cancellationFailsClosedForLegacyPredecessorAndStaleRowVersion(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen=activePen(421L,"R3");FeedRationVersion prior=rationVersion(921L,1,LocalDate.of(2026,1,1),start.minusDays(1),"ENDED",2);
        FeedRationVersion scheduled=rationVersion(922L,2,start,null,"SCHEDULED",4);
        FeedRationPen priorLink=rationLink(prior,pen,null,null,false),scheduledLink=rationLink(scheduled,pen,null,null,false);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(922L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(421L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(922L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByPen_Id(421L)).thenReturn(List.of(priorLink,scheduledLink));

        assertThatThrownBy(()->service.cancelRationVersion(12L,922L,2,new RationVersionRequest(4)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_22));
        scheduled.setVersion(5);
        assertThatThrownBy(()->service.cancelRationVersion(12L,922L,2,new RationVersionRequest(4)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        assertThat(scheduled.getStatus()).isEqualTo("SCHEDULED");verify(rationVersions,never()).saveAndFlush(any());verifyNoInteractions(outbox);
    }

    @Test void cancellationFailsClosedForLegacyLinkWhenAnEarlierVersionCouldCarryUnknownLineage(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen=activePen(423L,"R3L");FeedRationVersion older=rationVersion(923L,1,LocalDate.of(2026,1,1),LocalDate.of(2026,11,17),"ENDED",1);
        FeedRationVersion scheduled=rationVersion(924L,2,start,null,"SCHEDULED",0);
        FeedRationPen olderLink=rationLink(older,pen,null,null,false),scheduledLink=rationLink(scheduled,pen,null,null,false);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(924L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(423L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(924L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByPen_Id(423L)).thenReturn(List.of(olderLink,scheduledLink));

        assertThatThrownBy(()->service.cancelRationVersion(12L,924L,2,new RationVersionRequest(0)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_22));
        assertThat(scheduled.getStatus()).isEqualTo("SCHEDULED");
        verify(rationVersions,never()).saveAndFlush(any());verifyNoInteractions(outbox);
    }

    @Test void cancellationCanInferNoPredecessorForALegacyLinkOnlyWhenPenHasNoEarlierRation(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen=activePen(424L,"R3N");FeedRationVersion scheduled=rationVersion(924L,1,start,null,"SCHEDULED",0);
        FeedRationPen scheduledLink=rationLink(scheduled,pen,null,null,false);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(924L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(424L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(924L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByPen_Id(424L)).thenReturn(List.of(scheduledLink));
        when(rationVersions.saveAndFlush(scheduled)).thenAnswer(invocation->{scheduled.setVersion(scheduled.getVersion()+1);return scheduled;});

        service.cancelRationVersion(12L,924L,1,new RationVersionRequest(0));

        assertThat(scheduled.getStatus()).isEqualTo("CANCELLED");
        assertThat(scheduled.getEffectiveTo()).isEqualTo(start.minusDays(1));
    }

    @Test void cancellationKeepsALaterManualStopWhenCancellingItsScheduledSuccessor(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),manualEnd=LocalDate.of(2026,11,18),start=LocalDate.of(2026,11,20),next=LocalDate.of(2026,11,30);
        Pen pen=activePen(425L,"R3A");FeedRationVersion prior=rationVersion(925L,1,LocalDate.of(2026,1,1),manualEnd,"EFFECTIVE",3);
        prior.setEffectiveToManuallySet(true);
        FeedRationVersion scheduled=rationVersion(926L,2,start,next.minusDays(1),"SCHEDULED",0);
        FeedRationVersion successor=rationVersion(927L,3,next,null,"SCHEDULED",0);
        FeedRationPen priorLink=rationLink(prior,pen,null,null,true);
        FeedRationPen scheduledLink=rationLink(scheduled,pen,prior,null,true);
        FeedRationPen successorLink=rationLink(successor,pen,scheduled,null,true);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(926L,12L)).thenReturn(Optional.of(scheduled));
        when(rationVersions.findByIdAndFarm_Id(927L,12L)).thenReturn(Optional.of(successor));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(425L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(926L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByRationVersion_Id(927L)).thenReturn(List.of(successorLink));
        when(rationPens.findByRationVersion_Id(925L)).thenReturn(List.of(priorLink));
        when(rationPens.findByPen_Id(425L)).thenReturn(new java.util.ArrayList<>(List.of(priorLink,scheduledLink,successorLink)));
        when(rationPens.save(any(FeedRationPen.class))).thenAnswer(invocation->invocation.getArgument(0));
        when(rationVersions.save(prior)).thenReturn(prior);
        when(rationVersions.saveAndFlush(any(FeedRationVersion.class))).thenAnswer(invocation->{FeedRationVersion saved=invocation.getArgument(0);saved.setVersion(saved.getVersion()+1);return saved;});

        service.cancelRationVersion(12L,926L,2,new RationVersionRequest(0));
        assertThat(prior.getEffectiveTo()).isEqualTo(manualEnd);
        assertThat(successorLink.getPredecessorVersion()).isSameAs(prior);
        assertThat(successorLink.getPredecessorEffectiveTo()).isEqualTo(manualEnd);

        service.cancelRationVersion(12L,927L,3,new RationVersionRequest(0));
        assertThat(prior.getEffectiveTo()).isEqualTo(manualEnd);
        verify(outbox,times(2)).enqueue(eq(12L),eq("FEED_RATION_VERSION_CANCELLED"),eq("FeedRationVersion"),anyLong(),any());
    }

    @Test void cancellingScheduledVersionPreservesExplicitStopAtTheAutomaticBoundaryDate(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20),boundary=start.minusDays(1);
        Pen pen=activePen(432L,"R5");FeedRationVersion prior=rationVersion(932L,1,LocalDate.of(2026,1,1),boundary,"ENDED",1);
        FeedRationVersion scheduled=rationVersion(933L,2,start,null,"SCHEDULED",0);
        FeedRationPen priorLink=rationLink(prior,pen,null,null,true);
        FeedRationPen scheduledLink=rationLink(scheduled,pen,prior,null,true);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(932L,12L)).thenReturn(Optional.of(prior));
        when(rationVersions.findByIdAndFarm_Id(933L,12L)).thenReturn(Optional.of(scheduled));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(432L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(932L)).thenReturn(List.of(priorLink));
        when(rationPens.findByRationVersion_Id(933L)).thenReturn(List.of(scheduledLink));
        when(rationPens.findByPen_Id(432L)).thenReturn(List.of(priorLink,scheduledLink));
        when(rationVersions.saveAndFlush(prior)).thenAnswer(invocation->{prior.setVersion(prior.getVersion()+1);return prior;});
        when(rationVersions.save(prior)).thenReturn(prior);
        when(rationVersions.saveAndFlush(scheduled)).thenAnswer(invocation->{scheduled.setVersion(scheduled.getVersion()+1);return scheduled;});

        service.stopRation(12L,932L,new StopRationRequest(boundary,1));
        assertThat(prior.isEffectiveToManuallySet()).isTrue();assertThat(prior.getVersion()).isEqualTo(2);

        service.cancelRationVersion(12L,933L,2,new RationVersionRequest(0));

        assertThat(prior.getEffectiveTo()).isEqualTo(boundary);
        assertThat(prior.isEffectiveToManuallySet()).isTrue();
    }

    @Test void savingAcrossTwoPensSnapshotsTheSharedPredecessorBeforeAnyEndDateMutation(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen1=activePen(441L,"R5"),pen2=activePen(442L,"R6");
        FeedRationVersion prior=rationVersion(941L,1,LocalDate.of(2026,1,1),null,"EFFECTIVE",0);
        FeedRationPen prior1=rationLink(prior,pen1,null,null,false),prior2=rationLink(prior,pen2,null,null,false);
        List<FeedRationPen> priorLinks=List.of(prior1,prior2);List<FeedRationPen> savedLinks=new java.util.ArrayList<>();
        List<FeedRationComponent> savedComponents=new java.util.ArrayList<>();
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);when(clock.now()).thenReturn(Instant.parse("2026-11-15T00:00:00Z"));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(441L,442L))).thenReturn(List.of(pen1,pen2));
        when(rationVersions.findByFarm_IdAndRationCodeOrderByVersionNoDesc(12L,"KP-TEST")).thenReturn(List.of(prior));
        when(rationVersions.saveAndFlush(any(FeedRationVersion.class))).thenAnswer(invocation->{FeedRationVersion saved=invocation.getArgument(0);ReflectionTestUtils.setField(saved,"id",942L);saved.setVersion(0);return saved;});
        when(rationVersions.save(prior)).thenReturn(prior);
        when(rationPens.findByPen_Id(441L)).thenAnswer(invocation->java.util.stream.Stream.concat(java.util.stream.Stream.of(prior1),savedLinks.stream().filter(link->link.getPen().getId().equals(441L))).toList());
        when(rationPens.findByPen_Id(442L)).thenAnswer(invocation->java.util.stream.Stream.concat(java.util.stream.Stream.of(prior2),savedLinks.stream().filter(link->link.getPen().getId().equals(442L))).toList());
        when(rationPens.findByRationVersion_Id(anyLong())).thenAnswer(invocation->invocation.getArgument(0).equals(941L)?priorLinks:savedLinks);
        when(rationPens.save(any(FeedRationPen.class))).thenAnswer(invocation->{FeedRationPen saved=invocation.getArgument(0);savedLinks.add(saved);return saved;});
        when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));
        when(rationComponents.save(any(FeedRationComponent.class))).thenAnswer(invocation->{FeedRationComponent saved=invocation.getArgument(0);savedComponents.add(saved);return saved;});
        when(rationComponents.findByRationVersion_Id(942L)).thenAnswer(invocation->savedComponents);

        var saved=service.saveRation(12L,new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.SaveRationRequest("KP-TEST","Next","FATTENING","basis",start,1,List.of("06:30"),List.of(441L,442L),List.of(new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationComponentRequest(99L,BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO)),1));

        assertThat(saved.penIds()).containsExactly(441L,442L);
        assertThat(savedLinks).hasSize(2).allSatisfy(link->{assertThat(link.getPredecessorVersion()).isSameAs(prior);assertThat(link.getPredecessorEffectiveTo()).isNull();assertThat(link.isPredecessorSnapshotCaptured()).isTrue();});
        assertThat(prior.getEffectiveTo()).isEqualTo(start.minusDays(1));
    }

    @Test void insertingBetweenScheduledVersionsSurvivesCancelOrderInsertedParentSuccessor(){
        RationInsertionFixture fixture=rationInsertionFixture(true,2,LocalDate.of(2026,11,15));
        FeedRationVersion inserted=insertRationBetween(fixture,LocalDate.of(2026,11,25));
        FeedRationPen insertedLink=linkFor(fixture.links(),inserted,fixture.pens().get(0));
        FeedRationPen successorLink=linkFor(fixture.links(),fixture.successor(),fixture.pens().get(0));

        assertThat(fixture.scheduled().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,24));
        assertThat(inserted.getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(fixture.newVersionEffectiveToAtFlush().get()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(insertedLink.getPredecessorVersion()).isSameAs(fixture.scheduled());
        assertThat(successorLink.getPredecessorVersion()).isSameAs(inserted);
        assertThat(successorLink.getPredecessorEffectiveTo()).isNull();
        assertThat(successorLink.isPredecessorSnapshotCaptured()).isTrue();
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==inserted)).hasSize(2)
            .allSatisfy(link->{assertThat(link.getPredecessorVersion()).isSameAs(fixture.scheduled());assertThat(link.getPredecessorEffectiveTo()).isNull();});
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==fixture.successor())).hasSize(2)
            .allSatisfy(link->{assertThat(link.getPredecessorVersion()).isSameAs(inserted);assertThat(link.getPredecessorEffectiveTo()).isNull();});
        assertThat(fixture.successor().getVersion()).isEqualTo(1);
        verify(entityManager,times(1)).lock(fixture.successor(),LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        verify(entityManager).flush();
        var lockOrder=org.mockito.Mockito.inOrder(pens,entityManager,feeds);
        lockOrder.verify(pens).lockAllByFarmIdAndIdIn(12L,List.of(450L,451L));
        lockOrder.verify(entityManager).refresh(fixture.scheduled(),LockModeType.PESSIMISTIC_WRITE);
        lockOrder.verify(entityManager).refresh(fixture.successor(),LockModeType.PESSIMISTIC_WRITE);
        lockOrder.verify(feeds).lockByIdAndFarm(99L,12L);
        assertThatThrownBy(()->service.cancelRationVersion(12L,fixture.successor().getId(),fixture.successor().getVersionNo(),new RationVersionRequest(0)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));

        cancelRation(inserted);
        assertThat(fixture.scheduled().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(successorLink.getPredecessorVersion()).isSameAs(fixture.scheduled());
        cancelRation(fixture.scheduled());
        assertThat(fixture.prior().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(successorLink.getPredecessorVersion()).isSameAs(fixture.prior());
        cancelRation(fixture.successor());
        assertThat(fixture.prior().getEffectiveTo()).isNull();
        assertThat(List.of(fixture.scheduled().getStatus(),inserted.getStatus(),fixture.successor().getStatus())).containsOnly("CANCELLED");
    }

    @Test void insertingBetweenScheduledVersionsSurvivesCancelOrderParentInsertedSuccessor(){
        RationInsertionFixture fixture=rationInsertionFixture(true,1,LocalDate.of(2026,11,15));
        FeedRationVersion inserted=insertRationBetween(fixture,LocalDate.of(2026,11,25));
        FeedRationPen insertedLink=linkFor(fixture.links(),inserted,fixture.pens().get(0));
        FeedRationPen successorLink=linkFor(fixture.links(),fixture.successor(),fixture.pens().get(0));

        cancelRation(fixture.scheduled());
        assertThat(insertedLink.getPredecessorVersion()).isSameAs(fixture.prior());
        assertThat(fixture.prior().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,24));
        cancelRation(inserted);
        assertThat(successorLink.getPredecessorVersion()).isSameAs(fixture.prior());
        assertThat(fixture.prior().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        cancelRation(fixture.successor());
        assertThat(fixture.prior().getEffectiveTo()).isNull();
        assertThat(List.of(fixture.scheduled().getStatus(),inserted.getStatus(),fixture.successor().getStatus())).containsOnly("CANCELLED");
    }

    @Test void cancellingPredecessorRewiresSharedSuccessorAndBumpsItsRowVersionOnce(){
        RationInsertionFixture fixture=rationInsertionFixture(true,2,LocalDate.of(2026,11,15));

        cancelRation(fixture.scheduled());

        assertThat(fixture.successor().getVersion()).isEqualTo(1);
        verify(entityManager,times(1)).lock(fixture.successor(),LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==fixture.successor())).hasSize(2)
            .allSatisfy(link->{assertThat(link.getPredecessorVersion()).isSameAs(fixture.prior());assertThat(link.isPredecessorSnapshotCaptured()).isTrue();});
        var lockOrder=org.mockito.Mockito.inOrder(pens,entityManager);
        lockOrder.verify(pens).lockAllByFarmIdAndIdIn(12L,List.of(450L,451L));
        lockOrder.verify(entityManager).refresh(fixture.prior(),LockModeType.PESSIMISTIC_WRITE);
        lockOrder.verify(entityManager).refresh(fixture.scheduled(),LockModeType.PESSIMISTIC_WRITE);
        lockOrder.verify(entityManager).refresh(fixture.successor(),LockModeType.PESSIMISTIC_WRITE);
        lockOrder.verify(entityManager).lock(fixture.successor(),LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        assertThatThrownBy(()->service.cancelRationVersion(12L,fixture.successor().getId(),fixture.successor().getVersionNo(),new RationVersionRequest(0)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
    }

    @Test void insertingBetweenScheduledVersionsSurvivesCancelOrderSuccessorInsertedParent(){
        RationInsertionFixture fixture=rationInsertionFixture(true,1,LocalDate.of(2026,11,15));
        FeedRationVersion inserted=insertRationBetween(fixture,LocalDate.of(2026,11,25));

        cancelRation(fixture.successor());
        assertThat(inserted.getEffectiveTo()).isNull();
        cancelRation(inserted);
        assertThat(fixture.scheduled().getEffectiveTo()).isNull();
        cancelRation(fixture.scheduled());
        assertThat(fixture.prior().getEffectiveTo()).isNull();
        assertThat(List.of(fixture.scheduled().getStatus(),inserted.getStatus(),fixture.successor().getStatus())).containsOnly("CANCELLED");
    }

    @Test void insertingBetweenSchedulesCarriesPostSuccessorManualStopIntoBothSnapshots(){
        RationInsertionFixture fixture=rationInsertionFixture(true,1,LocalDate.of(2026,11,25));
        service.stopRation(12L,fixture.scheduled().getId(),new StopRationRequest(LocalDate.of(2026,11,29),0));
        assertThat(fixture.scheduled().isEffectiveToManuallySet()).isTrue();
        FeedRationVersion inserted=insertRationBetween(fixture,LocalDate.of(2026,11,27));
        FeedRationPen insertedLink=linkFor(fixture.links(),inserted,fixture.pens().get(0));
        FeedRationPen successorLink=linkFor(fixture.links(),fixture.successor(),fixture.pens().get(0));

        assertThat(insertedLink.getPredecessorEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(insertedLink.isPredecessorEffectiveToManuallySet()).isTrue();
        assertThat(successorLink.getPredecessorVersion()).isSameAs(inserted);
        assertThat(successorLink.getPredecessorEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(successorLink.isPredecessorEffectiveToManuallySet()).isTrue();

        cancelRation(fixture.successor());
        assertThat(inserted.getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(inserted.isEffectiveToManuallySet()).isTrue();
        cancelRation(inserted);
        assertThat(fixture.scheduled().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(fixture.scheduled().isEffectiveToManuallySet()).isTrue();
    }

    @Test void cancellingFirstScheduledVersionCarriesEmptyLineageThroughInsertedVersion(){
        RationInsertionFixture fixture=rationInsertionFixture(false,2,LocalDate.of(2026,11,15));
        FeedRationVersion inserted=insertRationBetween(fixture,LocalDate.of(2026,11,25));
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==inserted).map(FeedRationPen::getPredecessorVersion)).containsOnly(fixture.scheduled());
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==fixture.successor()).map(FeedRationPen::getPredecessorVersion)).containsOnly(inserted);

        cancelRation(fixture.scheduled());
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==inserted))
            .allSatisfy(link->{assertThat(link.getPredecessorVersion()).isNull();assertThat(link.isPredecessorSnapshotCaptured()).isTrue();});
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==fixture.successor()).map(FeedRationPen::getPredecessorVersion)).containsOnly(inserted);

        cancelRation(inserted);
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==fixture.successor()))
            .allSatisfy(link->{assertThat(link.getPredecessorVersion()).isNull();assertThat(link.isPredecessorSnapshotCaptured()).isTrue();});
        cancelRation(fixture.successor());
        assertThat(List.of(fixture.scheduled().getStatus(),inserted.getStatus(),fixture.successor().getStatus())).containsOnly("CANCELLED");
    }

    @Test void insertingAfterManualPredecessorStopCreatesAGuardInsteadOfOverlappingScheduleLineage(){
        RationInsertionFixture fixture=rationInsertionFixture(true,1,LocalDate.of(2026,11,25));
        service.stopRation(12L,fixture.scheduled().getId(),new StopRationRequest(LocalDate.of(2026,11,26),0));
        FeedRationPen successorLink=linkFor(fixture.links(),fixture.successor(),fixture.pens().get(0));
        assertThatThrownBy(()->insertRationBetween(fixture,LocalDate.of(2026,11,28)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_22));
        assertThat(fixture.scheduled().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,26));
        assertThat(fixture.scheduled().isEffectiveToManuallySet()).isTrue();
        assertThat(successorLink.getPredecessorVersion()).isSameAs(fixture.scheduled());
        verify(rationPens,never()).save(any(FeedRationPen.class));
        verify(outbox,never()).enqueue(eq(12L),eq("FEED_RATION_VERSION_SAVED"),eq("FeedRationVersion"),anyLong(),any());
    }

    @Test void insertionAfterManualGapKeepsSuccessorAndInsertedSnapshotsWithinTheirOwnCoverage(){
        RationInsertionFixture fixture=rationInsertionFixture(true,1,LocalDate.of(2026,11,23));
        service.stopRation(12L,fixture.scheduled().getId(),new StopRationRequest(LocalDate.of(2026,11,24),0));
        FeedRationPen successorLink=linkFor(fixture.links(),fixture.successor(),fixture.pens().get(0));
        // This represents a successor created after the manual stop, so the gap has no predecessor.
        successorLink.setPredecessorVersion(null);
        successorLink.setPredecessorEffectiveTo(null);
        successorLink.setPredecessorEffectiveToManuallySet(false);
        successorLink.setPredecessorSnapshotCaptured(true);

        FeedRationVersion inserted=insertRationBetween(fixture,LocalDate.of(2026,11,27));
        FeedRationPen insertedLink=linkFor(fixture.links(),inserted,fixture.pens().get(0));
        assertThat(inserted.getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(insertedLink.getPredecessorVersion()).isNull();
        assertThat(insertedLink.getPredecessorEffectiveTo()).isNull();
        assertThat(successorLink.getPredecessorVersion()).isSameAs(inserted);
        assertThat(successorLink.getPredecessorEffectiveTo()).isNull();

        cancelRation(fixture.successor());
        assertThat(inserted.getEffectiveTo()).isNull();
        cancelRation(inserted);
        assertThat(fixture.scheduled().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,24));
        assertThat(fixture.scheduled().isEffectiveToManuallySet()).isTrue();
    }

    @Test void insertionRejectsDifferentOrOutOfRangePredecessorSnapshotsAcrossPens(){
        RationInsertionFixture fixture=rationInsertionFixture(true,2,LocalDate.of(2026,11,15));
        FeedRationPen inconsistent=linkFor(fixture.links(),fixture.successor(),fixture.pens().get(1));
        inconsistent.setPredecessorEffectiveTo(LocalDate.of(2026,11,18));

        assertThatThrownBy(()->insertRationBetween(fixture,LocalDate.of(2026,11,25)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_22));
        assertThat(fixture.scheduled().getEffectiveTo()).isEqualTo(LocalDate.of(2026,11,29));
        assertThat(fixture.links().stream().filter(link->link.getRationVersion()==fixture.successor())
            .map(FeedRationPen::getPredecessorVersion)).containsOnly(fixture.scheduled());
        verify(rationPens,never()).save(any(FeedRationPen.class));verify(outbox,never()).enqueue(anyLong(),any(),any(),anyLong(),any());
    }

    @Test void rationSaveLocksFeedsByIdAfterPensAndChecksLockedAvailability(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate today=LocalDate.of(2026,11,15),start=LocalDate.of(2026,11,20);
        Pen pen=activePen(444L,"R8");
        FeedItem lockedInactive=new FeedItem();lockedInactive.setId(100L);lockedInactive.setFarm(context.farm());lockedInactive.setCode("TA-02");lockedInactive.setName("Cám");lockedInactive.setAvailable(false);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(444L))).thenReturn(List.of(pen));
        when(rationVersions.findByFarm_IdAndRationCodeOrderByVersionNoDesc(12L,"KP-NEW")).thenReturn(List.of());
        when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));when(feeds.lockByIdAndFarm(100L,12L)).thenReturn(Optional.of(lockedInactive));

        assertThatThrownBy(()->service.saveRation(12L,new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.SaveRationRequest(
            "KP-NEW","Locked check","FATTENING","basis",start,1,List.of("06:30"),List.of(444L),List.of(
                new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationComponentRequest(100L,BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO),
                new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationComponentRequest(99L,BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO)),null)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));

        var order=org.mockito.Mockito.inOrder(pens,feeds);
        order.verify(pens).lockAllByFarmIdAndIdIn(12L,List.of(444L));
        order.verify(feeds).lockByIdAndFarm(99L,12L);
        order.verify(feeds).lockByIdAndFarm(100L,12L);
        verify(feeds,never()).findByIdAndFarm_Id(100L,12L);
        verify(rationPens,never()).save(any(FeedRationPen.class));
        verify(rationComponents,never()).save(any(FeedRationComponent.class));
    }

    @Test void stopEffectiveRationUsesRowVersionAndCannotCrossNextSchedule(){
        context=new FarmContext(context.farm(),context.user(),FarmRole.OWNER);
        LocalDate today=LocalDate.of(2026,11,15),next=LocalDate.of(2026,12,1);
        Pen pen=activePen(431L,"R4");FeedRationVersion current=rationVersion(931L,1,LocalDate.of(2026,1,1),null,"EFFECTIVE",2);
        FeedRationVersion future=rationVersion(932L,2,next,null,"SCHEDULED",0);
        FeedRationPen currentLink=rationLink(current,pen,null,null,true),futureLink=rationLink(future,pen,current,null,true);
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);when(clock.today()).thenReturn(today);
        when(rationVersions.findByIdAndFarm_Id(931L,12L)).thenReturn(Optional.of(current));
        when(pens.lockAllByFarmIdAndIdIn(12L,List.of(431L))).thenReturn(List.of(pen));
        when(rationPens.findByRationVersion_Id(931L)).thenReturn(List.of(currentLink));
        when(rationPens.findByPen_Id(431L)).thenReturn(List.of(currentLink,futureLink));

        assertThatThrownBy(()->service.stopRation(12L,931L,new StopRationRequest(next,2)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_11));
        current.setVersion(3);
        when(rationVersions.saveAndFlush(current)).thenAnswer(invocation->{current.setVersion(current.getVersion()+1);return current;});
        var stopped=service.stopRation(12L,931L,new StopRationRequest(next.minusDays(1),3));
        assertThat(stopped.effectiveTo()).isEqualTo(next.minusDays(1));assertThat(stopped.version()).isEqualTo(4);
        assertThatThrownBy(()->service.stopRation(12L,931L,new StopRationRequest(next.minusDays(2),3)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        verify(outbox).enqueue(eq(12L),eq("FEED_RATION_STOPPED"),eq("FeedRationVersion"),eq(931L),any());
    }

    private record RationInsertionFixture(FeedRationVersion prior,FeedRationVersion scheduled,FeedRationVersion successor,
        List<Pen> pens,List<FeedRationPen> links,List<FeedRationVersion> versions,AtomicReference<LocalDate> newVersionEffectiveToAtFlush) {}

    private RationInsertionFixture rationInsertionFixture(boolean withParent,int penCount,LocalDate today){
        context=new FarmContext(context.farm(),context.user(),FarmRole.MANAGER);
        LocalDate priorStart=LocalDate.of(2026,1,1),scheduledStart=LocalDate.of(2026,11,20),successorStart=LocalDate.of(2026,11,30);
        List<Pen> fixturePens=new java.util.ArrayList<>();
        for(int i=0;i<penCount;i++)fixturePens.add(activePen(450L+i,"R-INS-"+(i+1)));
        FeedRationVersion prior=withParent?rationVersion(951L,1,priorStart,scheduledStart.minusDays(1),"EFFECTIVE",0):null;
        int scheduledVersionNo=withParent?2:1;
        FeedRationVersion scheduled=rationVersion(952L,scheduledVersionNo,scheduledStart,successorStart.minusDays(1),
            scheduledStart.isAfter(today)?"SCHEDULED":"EFFECTIVE",0);
        FeedRationVersion successor=rationVersion(953L,scheduledVersionNo+1,successorStart,null,"SCHEDULED",0);
        List<FeedRationVersion> fixtureVersions=new java.util.ArrayList<>();
        if(prior!=null)fixtureVersions.add(prior);
        fixtureVersions.add(scheduled);fixtureVersions.add(successor);
        List<FeedRationPen> fixtureLinks=new java.util.ArrayList<>();
        for(Pen pen:fixturePens){
            if(prior!=null)fixtureLinks.add(rationLink(prior,pen,null,null,true));
            fixtureLinks.add(rationLink(scheduled,pen,prior,null,true));
            fixtureLinks.add(rationLink(successor,pen,scheduled,null,true));
        }
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);
        when(clock.today()).thenReturn(today);lenient().when(clock.now()).thenReturn(Instant.parse("2026-11-15T00:00:00Z"));
        when(pens.lockAllByFarmIdAndIdIn(eq(12L),anyList())).thenAnswer(invocation->{
            List<Long> requestedIds=invocation.getArgument(1);
            return fixturePens.stream().filter(pen->requestedIds.contains(pen.getId())).toList();
        });
        lenient().when(rationVersions.findByFarm_IdAndRationCodeOrderByVersionNoDesc(12L,"KP-TEST")).thenAnswer(invocation->
            fixtureVersions.stream().filter(version->"KP-TEST".equals(version.getRationCode()))
                .sorted((left,right)->right.getVersionNo().compareTo(left.getVersionNo())).toList());
        lenient().when(rationVersions.findByIdAndFarm_Id(anyLong(),eq(12L))).thenAnswer(invocation->{
            Long id=invocation.getArgument(0);
            return fixtureVersions.stream().filter(version->version.getId().equals(id)).findFirst();
        });
        AtomicReference<LocalDate> newVersionEffectiveToAtFlush=new AtomicReference<>();
        AtomicInteger nextRationId=new AtomicInteger(960);
        lenient().when(rationVersions.saveAndFlush(any(FeedRationVersion.class))).thenAnswer(invocation->{
            FeedRationVersion saved=invocation.getArgument(0);
            if(saved.getId()==null){
                newVersionEffectiveToAtFlush.set(saved.getEffectiveTo());
                ReflectionTestUtils.setField(saved,"id",(long)nextRationId.getAndIncrement());
                saved.setVersion(0);fixtureVersions.add(saved);
            }else saved.setVersion(saved.getVersion()+1);
            return saved;
        });
        lenient().when(rationVersions.save(any(FeedRationVersion.class))).thenAnswer(invocation->{
            FeedRationVersion saved=invocation.getArgument(0);saved.setVersion(saved.getVersion()+1);return saved;
        });
        when(rationPens.findByPen_Id(anyLong())).thenAnswer(invocation->{
            Long penId=invocation.getArgument(0);
            return fixtureLinks.stream().filter(link->link.getPen().getId().equals(penId)).toList();
        });
        lenient().when(rationPens.findByRationVersion_Id(anyLong())).thenAnswer(invocation->{
            Long rationId=invocation.getArgument(0);
            return fixtureLinks.stream().filter(link->link.getRationVersion().getId().equals(rationId)).toList();
        });
        lenient().when(rationPens.save(any(FeedRationPen.class))).thenAnswer(invocation->{
            FeedRationPen saved=invocation.getArgument(0);
            if(fixtureLinks.stream().noneMatch(link->link==saved))fixtureLinks.add(saved);
            return saved;
        });
        lenient().when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));
        lenient().when(rationComponents.save(any(FeedRationComponent.class))).thenAnswer(invocation->invocation.getArgument(0));
        lenient().when(rationComponents.findByRationVersion_Id(anyLong())).thenReturn(List.of());
        lenient().doAnswer(invocation->{
            FeedRationVersion locked=invocation.getArgument(0);locked.setVersion(locked.getVersion()+1);return null;
        }).when(entityManager).lock(any(FeedRationVersion.class),eq(LockModeType.PESSIMISTIC_FORCE_INCREMENT));
        return new RationInsertionFixture(prior,scheduled,successor,fixturePens,fixtureLinks,fixtureVersions,newVersionEffectiveToAtFlush);
    }

    private FeedRationVersion insertRationBetween(RationInsertionFixture fixture,LocalDate start){
        int baseVersion=fixture.versions().stream().map(FeedRationVersion::getVersionNo).max(Integer::compareTo).orElseThrow();
        var saved=service.saveRation(12L,new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.SaveRationRequest(
            "KP-TEST","Inserted ration","FATTENING","between schedule",start,1,List.of("06:30"),
            fixture.pens().stream().map(Pen::getId).toList(),
            List.of(new vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationComponentRequest(99L,BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO)),baseVersion));
        return fixture.versions().stream().filter(version->version.getId().equals(saved.id())).findFirst().orElseThrow();
    }

    private void cancelRation(FeedRationVersion ration){
        service.cancelRationVersion(12L,ration.getId(),ration.getVersionNo(),new RationVersionRequest(ration.getVersion()));
    }

    private FeedRationPen linkFor(List<FeedRationPen> links,FeedRationVersion ration,Pen pen){
        return links.stream().filter(link->link.getRationVersion()==ration&&link.getPen()==pen).findFirst().orElseThrow();
    }

    private Pen activePen(long id,String code){Pen pen=new Pen();ReflectionTestUtils.setField(pen,"id",id);pen.setFarm(context.farm());pen.setCode(code);pen.setName(code);pen.setCapacity(20);pen.setStatus(ActiveStatus.ACTIVE);return pen;}
    private FeedRationVersion rationVersion(long id,int versionNo,LocalDate from,LocalDate to,String status,int rowVersion){FeedRationVersion version=new FeedRationVersion();ReflectionTestUtils.setField(version,"id",(long)id);version.setFarm(context.farm());version.setRationCode("KP-TEST");version.setVersionNo(versionNo);version.setName("Khẩu phần " + versionNo);version.setEffectiveFrom(from);version.setEffectiveTo(to);version.setStatus(status);version.setSessionsPerDay(1);version.setSessionTimes("06:30");version.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));version.setVersion(rowVersion);return version;}
    private FeedRationPen rationLink(FeedRationVersion ration,Pen pen,FeedRationVersion predecessor,LocalDate predecessorEnd,boolean snapshotCaptured){FeedRationPen link=new FeedRationPen();link.setRationVersion(ration);link.setPen(pen);link.setPredecessorVersion(predecessor);link.setPredecessorEffectiveTo(predecessorEnd);link.setPredecessorSnapshotCaptured(snapshotCaptured);return link;}
    private FeedRationVersion feedingRation(Pen pen,boolean available){FeedRationVersion ration=new FeedRationVersion();ReflectionTestUtils.setField(ration,"id",901L);ration.setFarm(context.farm());ration.setRationCode("KP-TEST");ration.setVersionNo(2);ration.setName("Khẩu phần kiểm thử");ration.setEffectiveFrom(LocalDate.of(2026,1,1));ration.setSessionsPerDay(1);ration.setSessionTimes("06:30");feed.setAvailable(available);return ration;}
    private void stubFeedingPen(Pen pen,int headCount){lenient().when(pens.findByIdAndFarmId(pen.getId(),12L)).thenReturn(Optional.of(pen));when(pens.lockAllByFarmIdAndIdIn(12L,List.of(pen.getId()))).thenReturn(List.of(pen));when(assignments.countAssignedAt(pen.getId(),LocalDate.of(2026,10,28))).thenReturn((long)headCount);lenient().when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));}
    private void stubRation(FeedRationVersion ration,Pen pen,BigDecimal perHead){FeedRationPen link=new FeedRationPen();link.setRationVersion(ration);link.setPen(pen);FeedRationComponent component=new FeedRationComponent();component.setRationVersion(ration);component.setFeedItem(feed);component.setFeedCodeSnapshot("TA-01");component.setFeedNameSnapshot("Hay");component.setSession1(perHead);when(rationPens.findByPen_Id(pen.getId())).thenReturn(List.of(link));lenient().when(rationComponents.findByRationVersion_Id(901L)).thenReturn(List.of(component));}
}
