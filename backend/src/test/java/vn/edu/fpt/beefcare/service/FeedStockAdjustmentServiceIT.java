package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.*;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC-FE23-04 / GBR-100 / BR-D34 / BR-D36 against the real H2 schema, including migration 20261029001000. */
@ServiceIntegrationTest
@Transactional
class FeedStockAdjustmentServiceIT extends DomainTestSupport {
    @Autowired FeedStockAdjustmentService adjustments;
    @Autowired FeedManagementService feedService;
    @Autowired VoucherPaymentService voucherPayments;

    private FeedItem feed(Farm farm,String kg,String avgCost) {
        FeedItem f=new FeedItem();f.setFarm(farm);f.setCode("TA-"+next());f.setName("Cỏ khô "+next());f.setFeedGroup("DRY_ROUGHAGE");
        f.setOnHandKg(new BigDecimal(kg));f.setAvgUnitCost(new BigDecimal(avgCost));f.setAvailable(true);return save(f);
    }
    private void movement(Farm farm,FeedItem f,String kg,String source) {
        FeedStockMovement m=new FeedStockMovement();m.setFarm(farm);m.setFeedItem(f);m.setMovementType(source);m.setQuantityKg(new BigDecimal(kg));
        m.setUnitCost(f.getAvgUnitCost());m.setBalanceAfterKg(f.getOnHandKg());m.setSourceType(source);m.setOccurredAt(clock.instant());save(m);
    }
    private StockAdjustmentRequest request(LocalDate date,FeedItem f,String counted,String reason,boolean postNow) {
        return new StockAdjustmentRequest(date,"PERIODIC_COUNT","Tổ kho",List.of(new StockAdjustmentLine(f.getId(),new BigDecimal(counted),reason)),postNow);
    }
    private long movementCount(FeedItem f) {
        return em.createQuery("select count(m) from FeedStockMovement m where m.feedItem.id=:f",Long.class).setParameter("f",f.getId()).getSingleResult();
    }

    @Test void draftHasNoStockEffectAndPostingWritesOneMovementAtAverageCost() {
        Farm farm=farm();actAs(memberWithRole(farm,FarmRole.MANAGER));FeedItem hay=feed(farm,"100.000","50.00");
        AdjustmentView draft=adjustments.create(farm.getId(),request(TODAY,hay,"95","Hao hụt khi bốc xếp",false));
        assertThat(draft.code()).isEqualTo("ĐCK-2026-0001");assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(draft.lines().get(0).systemKg()).isEqualByComparingTo("100");assertThat(draft.lines().get(0).differenceKg()).isEqualByComparingTo("-5");
        assertThat(draft.totalValue()).isEqualTo(-250L);
        em.flush();em.refresh(hay);assertThat(hay.getOnHandKg()).isEqualByComparingTo("100");assertThat(movementCount(hay)).isZero();

        AdjustmentView posted=adjustments.post(farm.getId(),draft.id(),draft.version());
        assertThat(posted.status()).isEqualTo("POSTED");assertThat(posted.postedAt()).isNotNull();
        em.flush();em.refresh(hay);assertThat(hay.getOnHandKg()).isEqualByComparingTo("95");
        FeedStockMovement m=em.createQuery("select m from FeedStockMovement m where m.feedItem.id=:f",FeedStockMovement.class).setParameter("f",hay.getId()).getSingleResult();
        assertThat(m.getMovementType()).isEqualTo("ADJUSTMENT");assertThat(m.getQuantityKg()).isEqualByComparingTo("-5");assertThat(m.getUnitCost()).isEqualByComparingTo("50");
        assertThat(m.getSourceType()).isEqualTo("STOCK_ADJUSTMENT");assertThat(m.getSourceId()).isEqualTo(draft.id());

        assertThat(adjustments.create(farm.getId(),request(TODAY,hay,"95",null,true)).code()).isEqualTo("ĐCK-2026-0002");
        assertThat(adjustments.list(farm.getId())).hasSize(2);
    }

    @Test void postedAdjustmentIsImmutable() {
        Farm farm=farm();actAs(memberWithRole(farm,FarmRole.OWNER));FeedItem hay=feed(farm,"10","100");
        AdjustmentView posted=adjustments.create(farm.getId(),request(TODAY,hay,"12","Đếm lại",true));
        assertThatThrownBy(()->adjustments.post(farm.getId(),posted.id(),posted.version()))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        var edit=new UpdateDraftAdjustmentRequest(posted.version(),TODAY,"LOSS",null,List.of(new StockAdjustmentLine(hay.getId(),BigDecimal.ONE,"x")));
        assertThatThrownBy(()->adjustments.updateDraft(farm.getId(),posted.id(),edit))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
    }

    @Test void postingRequiresAReasonForEveryDifference() {
        Farm farm=farm();actAs(memberWithRole(farm,FarmRole.MANAGER));FeedItem hay=feed(farm,"40","100");
        AdjustmentView draft=adjustments.create(farm.getId(),request(TODAY,hay,"30"," ",false));
        assertThatThrownBy(()->adjustments.post(farm.getId(),draft.id(),draft.version())).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo(MessageCodes.FE23_08);assertThat(e.getParams()).containsEntry("feedItemId",hay.getId());});
        assertThat(movementCount(hay)).isZero();
    }

    @Test void systemStockIsTakenAtTheCountDateAndTheDifferenceAppliesToCurrentStock() {
        Farm farm=farm();actAs(memberWithRole(farm,FarmRole.MANAGER));FeedItem hay=feed(farm,"120","100");
        movement(farm,hay,"20","FEED_RECEIPT");
        AdjustmentView posted=adjustments.create(farm.getId(),request(TODAY.minusDays(1),hay,"98","Kiểm kê cuối ngày",true));
        assertThat(posted.lines().get(0).systemKg()).isEqualByComparingTo("100");assertThat(posted.lines().get(0).differenceKg()).isEqualByComparingTo("-2");
        em.flush();em.refresh(hay);assertThat(hay.getOnHandKg()).isEqualByComparingTo("118");
    }

    @Test void adjustmentCannotMakeCurrentStockNegative() {
        Farm farm=farm();actAs(memberWithRole(farm,FarmRole.MANAGER));FeedItem hay=feed(farm,"10","100");
        movement(farm,hay,"-90","FEEDING_RECORD");
        assertThatThrownBy(()->adjustments.create(farm.getId(),request(TODAY.minusDays(1),hay,"50","Đếm sai",true)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));
    }

    @Test void futureDateUnknownTypeAndDuplicateFeedAreRejected() {
        Farm farm=farm();actAs(memberWithRole(farm,FarmRole.MANAGER));FeedItem hay=feed(farm,"10","100");
        assertThatThrownBy(()->adjustments.create(farm.getId(),request(TODAY.plusDays(1),hay,"10",null,false)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_07));
        assertThatThrownBy(()->adjustments.create(farm.getId(),new StockAdjustmentRequest(TODAY,"THEFT",null,List.of(new StockAdjustmentLine(hay.getId(),BigDecimal.TEN,null)),false)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getParams()).containsEntry("field","adjustmentType"));
        var twice=List.of(new StockAdjustmentLine(hay.getId(),BigDecimal.TEN,null),new StockAdjustmentLine(hay.getId(),BigDecimal.ONE,"x"));
        assertThatThrownBy(()->adjustments.create(farm.getId(),new StockAdjustmentRequest(TODAY,"OTHER",null,twice,false)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getParams()).containsEntry("field","lines"));
    }

    @Test void technicianAndOtherFarmCannotUseAdjustments() {
        Farm farm=farm();Farm other=farm();FeedItem hay=feed(farm,"10","100");
        actAs(memberWithRole(farm,FarmRole.MANAGER));AdjustmentView draft=adjustments.create(farm.getId(),request(TODAY,hay,"10",null,false));
        actAs(memberWithRole(farm,FarmRole.TECHNICIAN));
        assertThatThrownBy(()->adjustments.create(farm.getId(),request(TODAY,hay,"9","x",true))).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->adjustments.list(farm.getId())).isInstanceOf(DomainException.class);
        actAs(memberWithRole(other,FarmRole.OWNER));
        assertThatThrownBy(()->adjustments.get(farm.getId(),draft.id())).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->adjustments.get(other.getId(),draft.id())).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_08));
    }

    @Test void feedReceiptCodesFollowTheYearlySequence() {
        Farm farm=farm();AppUser manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);FeedItem hay=feed(farm,"0","0");
        TradingPartner supplier=partner(farm,manager,false,false);supplier.setSupplier(true);save(supplier);
        var line=List.of(new ReceiptLineRequest(hay.getId(),"L1",TODAY.plusMonths(6),new BigDecimal("2"),"kg",1000L));
        var receipt=new CreateReceiptRequest(TODAY,supplier.getId(),null,null,null,null,0L,line,false);
        assertThat(feedService.createReceipt(farm.getId(),receipt,false).code()).isEqualTo("PNK-2026-0001");
        assertThat(feedService.createReceipt(farm.getId(),receipt,false).code()).isEqualTo("PNK-2026-0002");
    }

    @Test void feedReceiptDraftPaymentPostReadbackAndVoidStayConsistent() {
        Farm farm=farm();AppUser manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);FeedItem hay=feed(farm,"0.000","0.00");
        TradingPartner supplier=partner(farm,manager,false,false);supplier.setSupplier(true);save(supplier);
        List<ReceiptLineRequest> receiptLines=List.of(
            new ReceiptLineRequest(hay.getId(),"LOT-A",TODAY.plusMonths(6),new BigDecimal("2.000"),"kg",1_000L),
            new ReceiptLineRequest(hay.getId(),"LOT-B",TODAY.plusMonths(12),new BigDecimal("1.000"),"kg",2_000L));
        LocalDate dueDate=TODAY.plusDays(30);
        var create=new CreateReceiptRequest(TODAY,supplier.getId(),"INV-23","Manager","Shed A","delivery note",100L,300L,PaymentMethod.BANK_TRANSFER,TODAY,dueDate,receiptLines,false);

        ReceiptView draft=feedService.createReceipt(farm.getId(),create,false);
        assertThat(draft.status()).isEqualTo("DRAFT");assertThat(draft.initialPaymentAmount()).isEqualTo(300L);
        assertThat(draft.initialPaymentMethod()).isEqualTo(PaymentMethod.BANK_TRANSFER);assertThat(draft.paymentDueDate()).isEqualTo(dueDate);
        assertThat(draft.amountPaid()).isZero();assertThat(draft.outstandingAmount()).isEqualTo(4_100L);
        assertThat(movementCount(hay)).isZero();assertThat(hay.getOnHandKg()).isEqualByComparingTo("0.000");

        var update=new UpdateDraftReceiptRequest(draft.version(),TODAY,supplier.getId(),"INV-23","Manager","Shed A","corrected note",100L,
            500L,PaymentMethod.CASH,TODAY,dueDate,receiptLines);
        ReceiptView edited=feedService.updateDraftReceipt(farm.getId(),draft.id(),update);
        assertThat(edited.version()).isGreaterThan(draft.version());assertThat(edited.initialPaymentAmount()).isEqualTo(500L);
        assertThat(edited.note()).isEqualTo("corrected note");assertThat(edited.lines()).hasSize(2);
        assertThat(edited.lines()).extracting(line->line.lotNumber()).containsExactly("LOT-A","LOT-B");
        assertThat(edited.lines()).extracting(line->line.lineAmount()).containsExactly(2_000L,2_000L);

        ReceiptView posted=feedService.postReceipt(farm.getId(),edited.id(),edited.version());
        assertThat(posted.status()).isEqualTo("POSTED");assertThat(posted.postedById()).isEqualTo(manager.getId());assertThat(posted.postedAt()).isNotNull();
        assertThat(posted.amountPaid()).isEqualTo(500L);assertThat(posted.outstandingAmount()).isEqualTo(3_600L);
        assertThat(posted.paymentState().name()).isEqualTo("PARTLY_PAID");
        em.flush();em.refresh(hay);assertThat(hay.getOnHandKg()).isEqualByComparingTo("3.000");assertThat(hay.getAvgUnitCost()).isEqualByComparingTo("1333.33");assertThat(movementCount(hay)).isEqualTo(2L);
        List<FeedStockMovement> receiptMoves=em.createQuery("select m from FeedStockMovement m where m.feedItem.id=:feedId and m.movementType='RECEIPT' order by m.id",FeedStockMovement.class)
            .setParameter("feedId",hay.getId()).getResultList();
        assertThat(receiptMoves).extracting(FeedStockMovement::getBalanceAfterKg).containsExactly(new BigDecimal("2.000"),new BigDecimal("3.000"));
        var history=voucherPayments.listFeedReceiptPayments(farm.getId(),posted.id());
        assertThat(history.summary().paid()).isEqualTo(500L);assertThat(history.payments()).hasSize(1);
        assertThat(history.payments().get(0).amount()).isEqualTo(500L);assertThat(history.payments().get(0).paymentDate()).isEqualTo(TODAY);
        assertThat(history.payments().get(0).method()).isEqualTo(PaymentMethod.CASH);
        assertThat(feedService.receipt(farm.getId(),posted.id()).invoiceNumber()).isEqualTo("INV-23");

        var later=voucherPayments.recordFeedReceiptPayment(farm.getId(),posted.id(),
            new RecordPaymentRequest(TODAY,200L,PaymentMethod.BANK_TRANSFER,"REF-1","second payment",posted.version()));
        assertThat(later.summary().paid()).isEqualTo(700L);assertThat(later.summary().voucherVersion()).isGreaterThan(posted.version());
        assertThatThrownBy(()->voucherPayments.recordFeedReceiptPayment(farm.getId(),posted.id(),
            new RecordPaymentRequest(TODAY,100L,PaymentMethod.CASH,null,null,posted.version())))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));

        var latestHistory=voucherPayments.listFeedReceiptPayments(farm.getId(),posted.id());
        var wrongPayment=latestHistory.payments().get(0);
        voucherPayments.voidPayment(farm.getId(),wrongPayment.id(),new VoidPaymentRequest("wrong transfer",wrongPayment.version()));
        ReceiptView beforeVoid=feedService.receipt(farm.getId(),posted.id());
        assertThat(beforeVoid.amountPaid()).isEqualTo(200L);assertThat(beforeVoid.outstandingAmount()).isEqualTo(3_900L);

        ReceiptView voided=feedService.voidReceipt(farm.getId(),posted.id(),new VoidReceiptRequest("wrong receipt",beforeVoid.version()));
        assertThat(voided.status()).isEqualTo("VOIDED");assertThat(voided.voidReason()).isEqualTo("wrong receipt");
        assertThat(voided.voidedById()).isEqualTo(manager.getId());assertThat(voided.voidedAt()).isNotNull();
        em.flush();em.refresh(hay);assertThat(hay.getOnHandKg()).isEqualByComparingTo("0.000");assertThat(hay.getAvgUnitCost()).isEqualByComparingTo("0.00");assertThat(movementCount(hay)).isEqualTo(4L);
        List<FeedStockMovement> voidMoves=em.createQuery("select m from FeedStockMovement m where m.feedItem.id=:feedId and m.movementType='RECEIPT_VOID' order by m.id",FeedStockMovement.class)
            .setParameter("feedId",hay.getId()).getResultList();
        assertThat(voidMoves).extracting(FeedStockMovement::getBalanceAfterKg).containsExactly(new BigDecimal("1.000"),new BigDecimal("0.000"));
        var retainedHistory=voucherPayments.listFeedReceiptPayments(farm.getId(),posted.id());
        assertThat(retainedHistory.payments()).hasSize(2);assertThat(retainedHistory.payments()).extracting(p->p.status()).contains(PaymentRecordStatus.RECORDED,PaymentRecordStatus.VOIDED);
    }

    @Test void feedCatalogueNutritionNoteRoundTripsThroughPersistence() {
        Farm farm=farm();AppUser manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);
        var create=new FeedItemRequest("TA-77","Calf starter","CALF_FEED","bag",new BigDecimal("25.000"),new BigDecimal("10.000"),"High protein starter",true,null);
        var created=feedService.createFeedItem(farm.getId(),create);
        assertThat(created.nutritionNote()).isEqualTo("High protein starter");
        em.clear();
        assertThat(feedService.catalogue(farm.getId())).filteredOn(item->item.id().equals(created.id())).singleElement()
            .extracting(item->item.nutritionNote()).isEqualTo("High protein starter");

        var update=new FeedItemRequest("TA-77","Calf starter","CALF_FEED","bag",new BigDecimal("25.000"),new BigDecimal("10.000"),"Use for calves under six months",true,created.version());
        var updated=feedService.updateFeedItem(farm.getId(),created.id(),update);
        assertThat(updated.nutritionNote()).isEqualTo("Use for calves under six months");
        em.flush();em.clear();assertThat(em.find(FeedItem.class,created.id()).getNutritionNote()).isEqualTo("Use for calves under six months");
    }

    @Test void discardingDraftReceiptRemovesOnlyTheDraftAndHasNoStockEffect() {
        Farm farm=farm();AppUser manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);FeedItem hay=feed(farm,"0.000","0.00");
        TradingPartner supplier=partner(farm,manager,false,false);supplier.setSupplier(true);save(supplier);
        var request=new CreateReceiptRequest(TODAY,supplier.getId(),null,null,null,null,0L,0L,null,null,null,
            List.of(new ReceiptLineRequest(hay.getId(),"L-1",TODAY.plusMonths(2),new BigDecimal("4.000"),"kg",1_000L)),false);
        ReceiptView draft=feedService.createReceipt(farm.getId(),request,false);
        feedService.discardDraftReceipt(farm.getId(),draft.id(),new VersionRequest(draft.version()));

        assertThatThrownBy(()->feedService.receipt(farm.getId(),draft.id()))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(MessageCodes.COM_08));
        assertThat(movementCount(hay)).isZero();em.flush();em.refresh(hay);assertThat(hay.getOnHandKg()).isEqualByComparingTo("0.000");
        long leftoverLines=((Number)em.createNativeQuery("select count(*) from feed_receipt_line where receipt_id=:id").setParameter("id",draft.id()).getSingleResult()).longValue();
        assertThat(leftoverLines).isZero();
    }
}
