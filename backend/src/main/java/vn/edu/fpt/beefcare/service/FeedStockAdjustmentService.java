package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.repository.*;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.*;

/**
 * UC-FE23-04 stock adjustment documents (ĐCK-YYYY-nnnn). A DRAFT has no stock effect; posting compares counted stock
 * with system stock at the count date and writes one ADJUSTMENT movement per non-zero difference at the weighted
 * average cost (GBR-100). Posted adjustments are immutable; a mistake is corrected by a new adjustment.
 */
@Service
public class FeedStockAdjustmentService {
    static final Set<String> TYPES=Set.of("PERIODIC_COUNT","LOSS","SPOILAGE","OTHER");
    private final FarmAccessService access;
    private final FarmClock clock;
    private final FeedItemRepository feeds;
    private final FeedStockMovementRepository movements;
    private final FeedStockAdjustmentRepository adjustments;
    private final FeedStockAdjustmentLineRepository lines;
    private final CodeSequenceService codes;
    private final OutboxService outbox;

    public FeedStockAdjustmentService(FarmAccessService access,FarmClock clock,FeedItemRepository feeds,FeedStockMovementRepository movements,
        FeedStockAdjustmentRepository adjustments,FeedStockAdjustmentLineRepository lines,CodeSequenceService codes,OutboxService outbox) {
        this.access=access;this.clock=clock;this.feeds=feeds;this.movements=movements;this.adjustments=adjustments;this.lines=lines;this.codes=codes;this.outbox=outbox;
    }

    @Transactional(readOnly=true)
    public List<AdjustmentView> list(Long farmId) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        return adjustments.findByFarm_IdOrderByCountDateDescIdDesc(farmId).stream().map(this::view).toList();
    }

    @Transactional(readOnly=true)
    public AdjustmentView get(Long farmId,Long adjustmentId) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        return view(adjustments.findByIdAndFarm_Id(adjustmentId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08)));
    }

    @Transactional
    public AdjustmentView create(Long farmId,StockAdjustmentRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        validateHeader(request.countDate(),request.adjustmentType(),request.lines());
        FeedStockAdjustment a=new FeedStockAdjustment();a.setFarm(ctx.farm());a.setCode(codes.nextStockAdjustmentCode(farmId));
        a.setCountDate(request.countDate());a.setAdjustmentType(request.adjustmentType());a.setCountedBy(trim(request.countedBy()));
        a.setCreatedBy(ctx.user());a.setCreatedAt(clock.now());a=adjustments.saveAndFlush(a);
        writeLines(a,request.lines(),farmId);
        if(request.postNow()) post(a,ctx);
        else outbox.enqueue(farmId,"FEED_STOCK_ADJUSTMENT_DRAFT_SAVED","FeedStockAdjustment",a.getId(),Map.of("adjustmentId",a.getId()));
        adjustments.saveAndFlush(a);
        return view(a);
    }

    @Transactional
    public AdjustmentView updateDraft(Long farmId,Long adjustmentId,UpdateDraftAdjustmentRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        FeedStockAdjustment a=adjustments.lockByIdAndFarm(adjustmentId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(a.getVersion(),request.expectedVersion());
        if(!"DRAFT".equals(a.getStatus())) throw DomainException.conflict(MessageCodes.COM_05,"reason","adjustment_is_not_draft");
        validateHeader(request.countDate(),request.adjustmentType(),request.lines());
        a.setCountDate(request.countDate());a.setAdjustmentType(request.adjustmentType());a.setCountedBy(trim(request.countedBy()));
        lines.deleteAll(lines.findByAdjustment_IdOrderByIdAsc(adjustmentId));lines.flush();
        writeLines(a,request.lines(),farmId);adjustments.saveAndFlush(a);
        outbox.enqueue(ctx.farmId(),"FEED_STOCK_ADJUSTMENT_DRAFT_SAVED","FeedStockAdjustment",a.getId(),Map.of("adjustmentId",a.getId()));
        return view(a);
    }

    @Transactional
    public AdjustmentView post(Long farmId,Long adjustmentId,Integer expectedVersion) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        FeedStockAdjustment a=adjustments.lockByIdAndFarm(adjustmentId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(a.getVersion(),expectedVersion);
        post(a,ctx);adjustments.saveAndFlush(a);
        return view(a);
    }

    /** System stock is recomputed at posting: a draft's snapshot may be stale after later receipts or feeding. */
    private void post(FeedStockAdjustment a,FarmContext ctx) {
        if(!"DRAFT".equals(a.getStatus())) throw DomainException.conflict(MessageCodes.COM_05,"reason","adjustment_is_not_draft");
        List<FeedStockAdjustmentLine> rows=lines.findByAdjustment_IdOrderByIdAsc(a.getId()).stream().sorted(Comparator.comparing(l->l.getFeedItem().getId())).toList();
        if(rows.isEmpty()) throw DomainException.required("lines");
        List<FeedItem> locked=rows.stream().map(l->feeds.lockByIdAndFarm(l.getFeedItem().getId(),ctx.farmId()).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08))).toList();
        for(int i=0;i<rows.size();i++){
            FeedStockAdjustmentLine l=rows.get(i);FeedItem f=locked.get(i);
            if(!Boolean.TRUE.equals(f.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_08,"field","feedItemId","feedItemId",f.getId());
            fill(l,f,a.getCountDate());
            if(l.getDifferenceKg().signum()!=0&&trim(l.getReason())==null) throw DomainException.badRequest(MessageCodes.FE23_08,"field","reason","feedItemId",f.getId());
            if(f.getOnHandKg().add(l.getDifferenceKg()).signum()<0) throw DomainException.unprocessable(MessageCodes.COM_10,"field","countedKg","feedItemId",f.getId());
        }
        for(int i=0;i<rows.size();i++){
            FeedStockAdjustmentLine l=rows.get(i);FeedItem f=locked.get(i);lines.save(l);
            if(l.getDifferenceKg().signum()==0) continue;
            f.setOnHandKg(f.getOnHandKg().add(l.getDifferenceKg()).setScale(3,RoundingMode.HALF_UP));feeds.saveAndFlush(f);
            FeedStockMovement m=new FeedStockMovement();m.setFarm(ctx.farm());m.setFeedItem(f);m.setMovementType("ADJUSTMENT");m.setQuantityKg(l.getDifferenceKg());
            m.setUnitCost(l.getUnitCost());m.setBalanceAfterKg(f.getOnHandKg());m.setSourceType("STOCK_ADJUSTMENT");m.setSourceId(a.getId());
            m.setOccurredAt(clock.now());m.setRecordedBy(ctx.user());movements.save(m);
        }
        totals(a,rows);a.setStatus("POSTED");a.setPostedAt(clock.now());a.setPostedBy(ctx.user());
        outbox.enqueue(ctx.farmId(),"FEED_STOCK_ADJUSTED","FeedStockAdjustment",a.getId(),Map.of("adjustmentId",a.getId(),"lineCount",rows.size()));
    }

    private void validateHeader(LocalDate countDate,String type,List<StockAdjustmentLine> input) {
        clock.assertNotFuture(countDate);
        if(!TYPES.contains(type)) throw DomainException.invalid("adjustmentType");
        Set<Long> seen=new HashSet<>();
        for(StockAdjustmentLine l:input) if(!seen.add(l.feedItemId())) throw DomainException.invalid("lines");
    }

    private void writeLines(FeedStockAdjustment a,List<StockAdjustmentLine> input,Long farmId) {
        List<FeedStockAdjustmentLine> rows=input.stream().map(in->{
            FeedItem f=feeds.findByIdAndFarm_Id(in.feedItemId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
            if(!Boolean.TRUE.equals(f.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_08,"field","feedItemId","feedItemId",f.getId());
            FeedStockAdjustmentLine l=new FeedStockAdjustmentLine();l.setAdjustment(a);l.setFeedItem(f);l.setFeedCodeSnapshot(f.getCode());l.setFeedNameSnapshot(f.getName());
            l.setCountedKg(in.countedKg().setScale(3,RoundingMode.HALF_UP));l.setReason(trim(in.reason()));fill(l,f,a.getCountDate());return lines.save(l);
        }).toList();
        totals(a,rows);
    }

    /** System stock at the end of the count date = current stock minus movements recorded after that day (farm time zone). */
    private void fill(FeedStockAdjustmentLine l,FeedItem f,LocalDate countDate) {
        Instant after=countDate.plusDays(1).atStartOfDay(zone(f.getFarm())).toInstant();
        BigDecimal later=movements.findByFarm_IdAndFeedItem_IdAndOccurredAtGreaterThanEqual(f.getFarm().getId(),f.getId(),after).stream()
            .map(FeedStockMovement::getQuantityKg).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal system=f.getOnHandKg().subtract(later).setScale(3,RoundingMode.HALF_UP);
        BigDecimal diff=l.getCountedKg().subtract(system).setScale(3,RoundingMode.HALF_UP);
        BigDecimal cost=f.getAvgUnitCost()==null?BigDecimal.ZERO:f.getAvgUnitCost();
        l.setSystemKg(system);l.setDifferenceKg(diff);l.setUnitCost(cost);l.setDifferenceValue(diff.multiply(cost).setScale(0,RoundingMode.HALF_UP).longValueExact());
    }

    private void totals(FeedStockAdjustment a,List<FeedStockAdjustmentLine> rows) {
        a.setTotalDifferenceKg(rows.stream().map(FeedStockAdjustmentLine::getDifferenceKg).reduce(BigDecimal.ZERO,BigDecimal::add));
        a.setTotalValue(rows.stream().mapToLong(FeedStockAdjustmentLine::getDifferenceValue).sum());
    }

    private AdjustmentView view(FeedStockAdjustment a) {
        List<AdjustmentLineView> rows=lines.findByAdjustment_IdOrderByIdAsc(a.getId()).stream().map(l->new AdjustmentLineView(l.getFeedItem().getId(),l.getFeedCodeSnapshot(),
            l.getFeedNameSnapshot(),l.getSystemKg(),l.getCountedKg(),l.getDifferenceKg(),l.getReason(),l.getUnitCost(),l.getDifferenceValue())).toList();
        return new AdjustmentView(a.getId(),a.getCode(),a.getCountDate(),a.getAdjustmentType(),a.getCountedBy(),a.getStatus(),a.getTotalDifferenceKg(),a.getTotalValue(),a.getPostedAt(),a.getVersion(),rows);
    }

    private ZoneId zone(Farm farm){try{return ZoneId.of(farm.getTimeZone());}catch(RuntimeException ignored){return clock.zone();}}

    private static String trim(String v){if(v==null)return null;String t=v.trim();return t.isEmpty()?null:t;}
}
