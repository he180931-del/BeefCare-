package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.*;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.VoidReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.UpdateDraftReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.ReceiptLineRequest;

@ExtendWith(MockitoExtension.class)
class FeedManagementServiceTest {
    @Mock FarmAccessService access; @Mock FarmClock clock; @Mock FeedItemRepository feeds; @Mock TradingPartnerRepository partners;
    @Mock FeedReceiptRepository receipts; @Mock FeedReceiptLineRepository lines; @Mock FeedStockMovementRepository movements;
    @Mock OutboxService outbox; @Mock FeedRationVersionRepository rationVersions; @Mock FeedRationPenRepository rationPens;
    @Mock FeedRationComponentRepository rationComponents; @Mock PenRepository pens; @Mock PenAssignmentRepository assignments;
    @Mock FeedingRecordRepository feedingRecords; @Mock FeedingRecordLineRepository feedingLines; @Mock RecordRevisionService revisions;
    @InjectMocks FeedManagementService service;
    FarmContext context; FeedItem feed; FeedReceipt receipt; FeedReceiptLine line; TradingPartner supplier;

    @BeforeEach void setUp(){
        Farm farm=new Farm();ReflectionTestUtils.setField(farm,"id",12L);AppUser actor=new AppUser();actor.setId(41L);context=new FarmContext(farm,actor,FarmRole.OWNER);
        feed=new FeedItem();feed.setId(99L);feed.setFarm(farm);feed.setCode("TA-01");feed.setName("Hay");feed.setAvailable(true);feed.setOnHandKg(new BigDecimal("10.000"));feed.setAvgUnitCost(new BigDecimal("100.00"));
        supplier=new TradingPartner();supplier.setId(88L);supplier.setName("Supplier");
        receipt=new FeedReceipt();ReflectionTestUtils.setField(receipt,"id",77L);receipt.setFarm(farm);receipt.setSupplier(supplier);receipt.setCode("PNK-2026-000077");receipt.setReceiptDate(java.time.LocalDate.of(2026,10,28));receipt.setStatus("DRAFT");receipt.setTransportFee(0L);receipt.setCreatedAt(Instant.parse("2026-10-28T00:00:00Z"));receipt.setTotalPayable(1_000L);
        line=new FeedReceiptLine();line.setReceipt(receipt);line.setFeedItem(feed);line.setFeedCodeSnapshot("TA-01");line.setFeedNameSnapshot("Hay");line.setKgReceived(new BigDecimal("5.000"));line.setQuantityPurchase(new BigDecimal("5.000"));line.setPurchaseUnit("kg");line.setLineAmount(1_000L);line.setUnitPrice(200L);line.setUnitCostKg(new BigDecimal("200.00"));
        when(access.require(12L,FarmAction.MANAGE_FEED)).thenReturn(context);
    }

    @Test void postingReceiptUsesWeightedAverageAndWritesMovementAtomically(){
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T00:00:00Z"));
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenReturn(List.of(line));when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));when(receipts.saveAndFlush(receipt)).thenReturn(receipt);
        var result=service.postReceipt(12L,77L,0);
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("15.000");assertThat(feed.getAvgUnitCost()).isEqualByComparingTo("133.33");assertThat(result.status()).isEqualTo("POSTED");
        verify(movements).save(any(FeedStockMovement.class));verify(outbox).enqueue(eq(12L),eq("FEED_RECEIPT_POSTED"),eq("FeedReceipt"),eq(77L),any());
    }

    @Test void voidReceiptRejectsAnyLineNotCoveredByCurrentStock(){
        when(receipts.lockByIdAndFarm(77L,12L)).thenReturn(Optional.of(receipt));receipt.setStatus("POSTED");
        when(lines.findByReceipt_IdOrderByIdAsc(77L)).thenReturn(List.of(line));feed.setOnHandKg(new BigDecimal("4.999"));when(feeds.lockByIdAndFarm(99L,12L)).thenReturn(Optional.of(feed));
        assertThatThrownBy(()->service.voidReceipt(12L,77L,new VoidReceiptRequest("recorded twice",0))).isInstanceOf(DomainException.class);
        assertThat(feed.getOnHandKg()).isEqualByComparingTo("4.999");verify(movements,never()).save(any());
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
}
