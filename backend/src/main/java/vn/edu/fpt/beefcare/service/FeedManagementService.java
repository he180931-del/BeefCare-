package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.repository.*;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.*;

/** FE-23 commands. Every stock delta is written to an append-only movement ledger in the same transaction. */
@Service
public class FeedManagementService {
    private final FarmAccessService access;
    private final FarmClock clock;
    private final FeedItemRepository feeds;
    private final TradingPartnerRepository partners;
    private final FeedReceiptRepository receipts;
    private final FeedReceiptLineRepository lines;
    private final VoucherPaymentRepository payments;
    private final VoucherPaymentService voucherPayments;
    private final AuditService audit;
    private final FeedAttachmentService attachments;
    private final FeedStockMovementRepository movements;
    private final OutboxService outbox;
    private final FeedRationVersionRepository rationVersions;
    private final FeedRationPenRepository rationPens;
    private final FeedRationComponentRepository rationComponents;
    private final PenRepository pens;
    private final PenAssignmentRepository assignments;
    private final FeedingRecordRepository feedingRecords;
    private final FeedingRecordLineRepository feedingLines;
    private final RecordRevisionService revisions;
    private final CodeSequenceService codes;
    private final EntityManager entityManager;

    public FeedManagementService(FarmAccessService access, FarmClock clock, FeedItemRepository feeds, TradingPartnerRepository partners,
        FeedReceiptRepository receipts, FeedReceiptLineRepository lines, VoucherPaymentRepository payments, VoucherPaymentService voucherPayments,
        AuditService audit, FeedAttachmentService attachments, FeedStockMovementRepository movements, OutboxService outbox,
        FeedRationVersionRepository rationVersions,FeedRationPenRepository rationPens,FeedRationComponentRepository rationComponents,
        PenRepository pens,PenAssignmentRepository assignments,FeedingRecordRepository feedingRecords,FeedingRecordLineRepository feedingLines,RecordRevisionService revisions,
        CodeSequenceService codes, EntityManager entityManager) {
        this.access=access; this.clock=clock; this.feeds=feeds; this.partners=partners; this.receipts=receipts; this.lines=lines;
        this.payments=payments; this.voucherPayments=voucherPayments; this.audit=audit; this.attachments=attachments; this.movements=movements; this.outbox=outbox;
        this.rationVersions=rationVersions;this.rationPens=rationPens;this.rationComponents=rationComponents;this.pens=pens;this.assignments=assignments;this.feedingRecords=feedingRecords;this.feedingLines=feedingLines;
        this.revisions=revisions;this.codes=codes;this.entityManager=entityManager;
    }

    @Transactional(readOnly=true)
    public List<StockView> stock(Long farmId) {
        access.require(farmId,FarmAction.VIEW_FEED_STOCK);
        return feeds.findByFarm_IdOrderByNameAsc(farmId).stream().map(f->stockProjection(farmId,f)).toList();
    }

    @Transactional(readOnly=true)
    public List<ReceiptView> receipts(Long farmId) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        return receipts.findByFarm_IdOrderByReceiptDateDescIdDesc(farmId).stream().map(this::view).toList();
    }

    @Transactional(readOnly=true)
    public ReceiptView receipt(Long farmId, Long receiptId) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        FeedReceipt receipt=receipts.findByIdAndFarm_Id(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        return view(receipt);
    }

    @Transactional(readOnly=true)
    public List<FeedItemView> catalogue(Long farmId){access.require(farmId,FarmAction.VIEW_FEED_STOCK);return feeds.findByFarm_IdOrderByNameAsc(farmId).stream().map(FeedManagementService::feedView).toList();}

    @Transactional
    public FeedItemView createFeedItem(Long farmId,FeedItemRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);String code=request.code().trim().toUpperCase(java.util.Locale.ROOT);
        if(feeds.existsByFarm_IdAndCodeIgnoreCase(farmId,code))throw DomainException.unprocessable(MessageCodes.COM_10,"field","code");validatePurchaseUnit(request.purchaseUnit(),request.kgPerPurchaseUnit());
        FeedItem f=new FeedItem();f.setFarm(ctx.farm());f.setCode(code);f.setName(request.name().trim());f.setFeedGroup(normalizeFeedGroup(request.feedGroup()));f.setNutritionNote(trim(request.nutritionNote()));f.setPurchaseUnit(trim(request.purchaseUnit()));f.setKgPerPurchaseUnit(request.kgPerPurchaseUnit());f.setMinimumStockKg(request.minimumStockKg());f.setAvailable(request.available());f.setStockUnit("kg");f.setOnHandKg(BigDecimal.ZERO.setScale(3));f.setAvgUnitCost(BigDecimal.ZERO.setScale(2));FeedItem saved=feeds.saveAndFlush(f);
        outbox.enqueue(farmId,"FEED_ITEM_CREATED","FeedItem",saved.getId(),Map.of("feedItemId",saved.getId()));return feedView(saved);
    }

    @Transactional
    public FeedItemView updateFeedItem(Long farmId,Long feedId,FeedItemRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);FeedItem f=feeds.lockByIdAndFarm(feedId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));VersionGuard.requireExpected(f.getVersion(),request.expectedVersion());String code=request.code().trim().toUpperCase(java.util.Locale.ROOT);validatePurchaseUnit(request.purchaseUnit(),request.kgPerPurchaseUnit());
        boolean referenced=movements.existsByFeedItem_Id(feedId)||rationComponents.existsByFeedItem_Id(feedId);
        if(referenced&&!f.getCode().equalsIgnoreCase(code))throw DomainException.conflict(MessageCodes.COM_05,"reason","feed_identity_is_in_use");
        if(!f.getCode().equalsIgnoreCase(code)&&feeds.existsByFarm_IdAndCodeIgnoreCase(farmId,code))throw DomainException.unprocessable(MessageCodes.COM_10,"field","code");
        f.setCode(code);f.setName(request.name().trim());f.setFeedGroup(normalizeFeedGroup(request.feedGroup()));f.setNutritionNote(trim(request.nutritionNote()));f.setPurchaseUnit(trim(request.purchaseUnit()));f.setKgPerPurchaseUnit(request.kgPerPurchaseUnit());f.setMinimumStockKg(request.minimumStockKg());f.setAvailable(request.available());FeedItem saved=feeds.saveAndFlush(f);
        outbox.enqueue(farmId,"FEED_ITEM_UPDATED","FeedItem",feedId,Map.of("feedItemId",feedId));return feedView(saved);
    }

    @Transactional(readOnly=true)
    public List<MovementView> movements(Long farmId, Long feedId) {
        access.require(farmId,FarmAction.VIEW_FEED_STOCK);
        feeds.findByIdAndFarm_Id(feedId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        return movements.findByFarm_IdAndFeedItem_IdOrderByOccurredAtDescIdDesc(farmId,feedId).stream().map(m ->
            new MovementView(m.getId(),feedId,m.getFeedItem().getCode(),m.getMovementType(),m.getQuantityKg(),m.getUnitCost(),m.getBalanceAfterKg(),m.getSourceType(),m.getSourceId(),m.getOccurredAt())
        ).toList();
    }

    @Transactional
    public ReceiptView createReceipt(Long farmId, CreateReceiptRequest request, boolean postNow) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        clock.assertNotFuture(request.receiptDate());
        TradingPartner supplier=partners.findByIdAndFarmId(request.supplierId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        if (!supplier.isSupplier() || supplier.getStatus()!=ActiveStatus.ACTIVE) throw DomainException.unprocessable(MessageCodes.COM_08,"field","supplierId");
        FeedReceipt r=new FeedReceipt(); r.setFarm(ctx.farm()); r.setSupplier(supplier); r.setReceiptDate(request.receiptDate());
        r.setInvoiceNumber(trim(request.invoiceNumber())); r.setReceivedBy(trim(request.receivedBy())); r.setStorageLocation(trim(request.storageLocation()));
        r.setNote(trim(request.note())); r.setTransportFee(request.transportFee()==null?0:request.transportFee()); r.setCreatedBy(ctx.user()); r.setCreatedAt(clock.now());
        setInitialPayment(r,request.amountPaid(),request.method(),request.paymentDate(),request.paymentDueDate());
        r.setCode(codes.nextFeedReceiptCode(farmId)); r=receipts.saveAndFlush(r);
        long goods=0;
        for (ReceiptLineRequest input:request.lines()) {
            FeedItem feed=feeds.findByIdAndFarm_Id(input.feedItemId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
            if (!Boolean.TRUE.equals(feed.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_08,"field","feedItemId");
            BigDecimal kg=toKg(feed,input);
            if (input.expiryDate()!=null&&!input.expiryDate().isAfter(request.receiptDate())) throw DomainException.unprocessable(MessageCodes.FE23_03,"field","expiryDate");
            long amount=input.quantityPurchase().multiply(BigDecimal.valueOf(input.unitPrice())).setScale(0,RoundingMode.HALF_UP).longValueExact();
            FeedReceiptLine line=new FeedReceiptLine(); line.setReceipt(r); line.setFeedItem(feed);line.setFeedCodeSnapshot(feed.getCode());line.setFeedNameSnapshot(feed.getName()); line.setLotNumber(trim(input.lotNumber())); line.setExpiryDate(input.expiryDate());
            line.setQuantityPurchase(input.quantityPurchase()); line.setPurchaseUnit(trim(input.purchaseUnit())==null?feed.getStockUnit():input.purchaseUnit().trim()); line.setKgReceived(kg); line.setUnitPrice(input.unitPrice()); line.setLineAmount(amount); lines.save(line);
            goods=Math.addExact(goods,amount);
        }
        r.setTotalPayable(Math.addExact(goods,r.getTransportFee()));
        validateInitialPayment(r);
        if(postNow) post(r,ctx);
        receipts.saveAndFlush(r);
        return view(r);
    }

    @Transactional
    public ReceiptView updateDraftReceipt(Long farmId,Long receiptId,UpdateDraftReceiptRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        FeedReceipt receipt=receipts.lockByIdAndFarm(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(receipt.getVersion(),request.expectedVersion());
        if(!"DRAFT".equals(receipt.getStatus()))throw DomainException.conflict(MessageCodes.COM_05,"reason","receipt_is_not_draft");
        clock.assertNotFuture(request.receiptDate());
        TradingPartner supplier=partners.findByIdAndFarmId(request.supplierId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        if(!supplier.isSupplier()||supplier.getStatus()!=ActiveStatus.ACTIVE)throw DomainException.unprocessable(MessageCodes.COM_08,"field","supplierId");
        receipt.setSupplier(supplier);receipt.setReceiptDate(request.receiptDate());receipt.setInvoiceNumber(trim(request.invoiceNumber()));
        receipt.setReceivedBy(trim(request.receivedBy()));receipt.setStorageLocation(trim(request.storageLocation()));receipt.setNote(trim(request.note()));
        receipt.setTransportFee(request.transportFee()==null?0:request.transportFee());
        setInitialPayment(receipt,request.amountPaid(),request.method(),request.paymentDate(),request.paymentDueDate());
        List<FeedReceiptLine> old=lines.findByReceipt_IdOrderByIdAsc(receiptId);lines.deleteAll(old);lines.flush();
        long goods=0;
        for(ReceiptLineRequest input:request.lines()){
            FeedItem feed=feeds.findByIdAndFarm_Id(input.feedItemId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
            if(!Boolean.TRUE.equals(feed.getAvailable()))throw DomainException.unprocessable(MessageCodes.COM_08,"field","feedItemId");
            BigDecimal kg=toKg(feed,input);
            if(input.expiryDate()!=null&&!input.expiryDate().isAfter(request.receiptDate()))throw DomainException.unprocessable(MessageCodes.FE23_03,"field","expiryDate");
            long amount=input.quantityPurchase().multiply(BigDecimal.valueOf(input.unitPrice())).setScale(0,RoundingMode.HALF_UP).longValueExact();
            FeedReceiptLine line=new FeedReceiptLine();line.setReceipt(receipt);line.setFeedItem(feed);line.setFeedCodeSnapshot(feed.getCode());line.setFeedNameSnapshot(feed.getName());
            line.setLotNumber(trim(input.lotNumber()));line.setExpiryDate(input.expiryDate());line.setQuantityPurchase(input.quantityPurchase());
            line.setPurchaseUnit(trim(input.purchaseUnit())==null?feed.getStockUnit():input.purchaseUnit().trim());line.setKgReceived(kg);line.setUnitPrice(input.unitPrice());line.setLineAmount(amount);lines.save(line);goods=Math.addExact(goods,amount);
        }
        receipt.setTotalPayable(Math.addExact(goods,receipt.getTransportFee()));validateInitialPayment(receipt);receipts.saveAndFlush(receipt);
        outbox.enqueue(ctx.farmId(),"FEED_RECEIPT_DRAFT_UPDATED","FeedReceipt",receiptId,Map.of("receiptId",receiptId));
        return view(receipt);
    }

    @Transactional
    public ReceiptView postReceipt(Long farmId, Long receiptId, Integer expectedVersion) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED); FeedReceipt r=receipts.lockByIdAndFarm(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(r.getVersion(),expectedVersion); post(r,ctx); receipts.saveAndFlush(r); return view(r);
    }

    @Transactional
    public void discardDraftReceipt(Long farmId,Long receiptId,VersionRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);FeedReceipt receipt=receipts.lockByIdAndFarm(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(receipt.getVersion(),request.expectedVersion());
        if(!"DRAFT".equals(receipt.getStatus()))throw DomainException.conflict(MessageCodes.COM_05,"reason","receipt_is_not_draft");
        if(!payments.findAllByFeedReceiptIdOrderByPaymentDateAscIdAsc(receiptId).isEmpty())throw DomainException.conflict(MessageCodes.COM_05,"reason","draft_has_payment_history");
        attachments.retireReceiptAttachmentsForDiscard(farmId,receiptId);
        lines.deleteAll(lines.findByReceipt_IdOrderByIdAsc(receiptId));lines.flush();
        audit.log(ctx,"FEED_RECEIPT_DISCARD","FeedReceipt",receiptId,Map.of("code",receipt.getCode()));
        receipts.delete(receipt);receipts.flush();
    }

    private void post(FeedReceipt receipt,FarmContext ctx) {
        if(!"DRAFT".equals(receipt.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        validateInitialPayment(receipt);
        List<FeedReceiptLine> receiptLines=lines.findByReceipt_IdOrderByIdAsc(receipt.getId()).stream().sorted(java.util.Comparator.comparing(l->l.getFeedItem().getId())).toList();
        if(receiptLines.isEmpty()) throw DomainException.required("lines");
        Map<Long,List<FeedReceiptLine>> linesByFeed=receiptLines.stream().collect(java.util.stream.Collectors.groupingBy(l->l.getFeedItem().getId(),java.util.TreeMap::new,java.util.stream.Collectors.toList()));
        Map<Long,FeedItem> locked=new java.util.LinkedHashMap<>();
        for(Long feedId:linesByFeed.keySet()){
            FeedItem feed=feeds.lockByIdAndFarm(feedId,ctx.farmId()).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
            if(!Boolean.TRUE.equals(feed.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_08,"field","feedItemId");
            locked.put(feedId,feed);
        }
        for(Map.Entry<Long,List<FeedReceiptLine>> entry:linesByFeed.entrySet()){
            FeedItem feed=locked.get(entry.getKey());BigDecimal receivedKg=entry.getValue().stream().map(FeedReceiptLine::getKgReceived).reduce(BigDecimal.ZERO,BigDecimal::add).setScale(3,RoundingMode.HALF_UP);
            long receivedValue=entry.getValue().stream().mapToLong(FeedReceiptLine::getLineAmount).sum();BigDecimal before=feed.getOnHandKg();BigDecimal after=before.add(receivedKg).setScale(3,RoundingMode.HALF_UP);
            BigDecimal oldValue=before.multiply(feed.getAvgUnitCost());BigDecimal average=after.signum()==0?BigDecimal.ZERO:oldValue.add(BigDecimal.valueOf(receivedValue)).divide(after,2,RoundingMode.HALF_UP);
            for(FeedReceiptLine line:entry.getValue()){
                BigDecimal unitCost=line.getLineAmount()==0?BigDecimal.ZERO:BigDecimal.valueOf(line.getLineAmount()).divide(line.getKgReceived(),2,RoundingMode.HALF_UP);
                line.setUnitCostKg(unitCost);lines.save(line);
            }
            feed.setOnHandKg(after);feed.setAvgUnitCost(average);feeds.saveAndFlush(feed);
            BigDecimal movementBalance=before;
            for(FeedReceiptLine line:entry.getValue()){
                movementBalance=movementBalance.add(line.getKgReceived()).setScale(3,RoundingMode.HALF_UP);
                movement(ctx,feed,"RECEIPT",line.getKgReceived(),line.getUnitCostKg(),"FEED_RECEIPT",receipt.getId(),movementBalance);
            }
        }
        receipt.setStatus("POSTED"); receipt.setPostedBy(ctx.user()); receipt.setPostedAt(clock.now());
        voucherPayments.recordInitialFeedReceiptPayment(ctx,receipt,receipt.getInitialPaymentAmount(),receipt.getInitialPaymentDate(),receipt.getInitialPaymentMethod());
        audit.log(ctx,"FEED_RECEIPT_POST","FeedReceipt",receipt.getId(),Map.of("code",receipt.getCode(),"totalPayable",receipt.getTotalPayable()));
        outbox.enqueue(ctx.farmId(),"FEED_RECEIPT_POSTED","FeedReceipt",receipt.getId(),Map.of("receiptId",receipt.getId()));
    }

    @Transactional
    public ReceiptView voidReceipt(Long farmId, Long receiptId, VoidReceiptRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED); FeedReceipt r=receipts.lockByIdAndFarm(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(r.getVersion(),request.expectedVersion());
        if(!"POSTED".equals(r.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        List<FeedReceiptLine> receiptLines=lines.findByReceipt_IdOrderByIdAsc(r.getId()).stream().sorted(java.util.Comparator.comparing(l->l.getFeedItem().getId())).toList();
        Map<Long,BigDecimal> receivedByFeed=receiptLines.stream().collect(java.util.stream.Collectors.groupingBy(l->l.getFeedItem().getId(),java.util.TreeMap::new,java.util.stream.Collectors.reducing(BigDecimal.ZERO,FeedReceiptLine::getKgReceived,BigDecimal::add)));
        List<FeedItem> locked=new ArrayList<>();
        for(Map.Entry<Long,BigDecimal> received:receivedByFeed.entrySet()){FeedItem f=feeds.lockByIdAndFarm(received.getKey(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));if(f.getOnHandKg().compareTo(received.getValue())<0)throw DomainException.unprocessable(MessageCodes.FE23_05,"receipt_code",r.getCode(),"feed",f.getName(),"stock",f.getOnHandKg());locked.add(f);}
        Map<String,Object> before=receiptSnapshot(r,receiptLines);
        for(int i=0;i<locked.size();i++){
            FeedItem f=locked.get(i);BigDecimal currentCost=f.getAvgUnitCost();BigDecimal balance=f.getOnHandKg();
            for(FeedReceiptLine line:receiptLines.stream().filter(l->l.getFeedItem().getId().equals(f.getId())).toList()){
                balance=balance.subtract(line.getKgReceived()).setScale(3,RoundingMode.HALF_UP);
                movement(ctx,f,"RECEIPT_VOID",line.getKgReceived().negate(),currentCost,"FEED_RECEIPT",r.getId(),balance);
            }
            // The SRS void gate is quantity coverage; reverse at current weighted average after subsequent consumption.
            f.setOnHandKg(balance); if(balance.signum()==0)f.setAvgUnitCost(BigDecimal.ZERO); feeds.saveAndFlush(f);
        }
        r.setStatus("VOIDED"); r.setVoidReason(request.reason().trim());r.setVoidedBy(ctx.user());r.setVoidedAt(clock.now());receipts.saveAndFlush(r);
        revisions.record(ctx,"FeedReceipt",r.getId(),RecordRevisionService.VOID,request.reason(),before,receiptSnapshot(r,receiptLines));
        audit.log(ctx,"FEED_RECEIPT_VOID","FeedReceipt",r.getId(),Map.of("code",r.getCode(),"reason",request.reason().trim()));
        outbox.enqueue(ctx.farmId(),"FEED_RECEIPT_VOIDED","FeedReceipt",r.getId(),Map.of("receiptId",r.getId()));
        return view(r);
    }

    @Transactional(readOnly=true)
    public List<RationView> rations(Long farmId) {
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_FEED);
        boolean includeCosts=ctx.role()!=vn.edu.fpt.beefcare.domain.enumeration.FarmRole.TECHNICIAN;
        return rationVersions.findByFarm_IdOrderByEffectiveFromDescVersionNoDesc(farmId).stream().map(ration->rationView(ration,includeCosts)).toList();
    }

    @Transactional
    public RationView saveRation(Long farmId,SaveRationRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        LocalDate tomorrow=clock.today().plusDays(1);
        if(request.effectiveFrom().isBefore(tomorrow))throw DomainException.unprocessable(MessageCodes.FE23_10,"date",tomorrow);
        if(request.sessionTimes().size()!=request.sessionsPerDay())throw DomainException.invalid("sessionTimes");
        String times=request.sessionTimes().stream().map(t->{try{return java.time.LocalTime.parse(t).toString();}catch(RuntimeException ex){throw DomainException.invalid("sessionTimes");}}).collect(java.util.stream.Collectors.joining(","));
        var penIds=request.penIds().stream().distinct().sorted().toList();if(penIds.size()!=request.penIds().size())throw DomainException.invalid("penIds");
        List<Pen> lockedPens=pens.lockAllByFarmIdAndIdIn(farmId,penIds);
        if(lockedPens.size()!=penIds.size()||lockedPens.stream().anyMatch(p->p.getStatus()!=ActiveStatus.ACTIVE))throw DomainException.notFound(MessageCodes.COM_08);
        String code=request.rationCode()==null||request.rationCode().isBlank()?String.format("KP-%02d",rationVersions.findByFarm_IdOrderByEffectiveFromDescVersionNoDesc(farmId).size()+1):request.rationCode().trim();
        List<FeedRationVersion> versions=rationVersions.findByFarm_IdAndRationCodeOrderByVersionNoDesc(farmId,code);
        if(versions.isEmpty()&&request.baseVersion()!=null||!versions.isEmpty()&&(request.baseVersion()==null||!request.baseVersion().equals(versions.get(0).getVersionNo())))throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_version");
        int nextVersion=versions.isEmpty()?1:versions.get(0).getVersionNo()+1;
        List<RationComponentRequest> components=request.components();
        var componentIds=components.stream().map(RationComponentRequest::feedItemId).distinct().toList();if(componentIds.size()!=components.size())throw DomainException.invalid("components");
        for(RationComponentRequest c:components){if(c.session1Kg().signum()==0&&(request.sessionsPerDay()==1||c.session2Kg().signum()==0&&(request.sessionsPerDay()==2||c.session3Kg().signum()==0)))throw DomainException.invalid("components");if(request.sessionsPerDay()<2&&c.session2Kg().signum()>0||request.sessionsPerDay()<3&&c.session3Kg().signum()>0)throw DomainException.invalid("components");}
        LocalDate versionEnd=null;
        Boolean sawPenWithNextStart=null;
        Map<Long,FeedRationVersion> predecessorByPen=new HashMap<>();
        Map<Long,LocalDate> predecessorEndByPen=new HashMap<>();
        Map<Long,Boolean> predecessorManualStopByPen=new HashMap<>();
        Map<Long,FeedRationPen> immediateSuccessorByPen=new HashMap<>();
        Map<Long,LocalDate> immediateSuccessorStartByPen=new HashMap<>();
        Map<Long,Boolean> ambiguousImmediateSuccessorByPen=new HashMap<>();
        Map<Long,FeedRationVersion> predecessorsToEnd=new HashMap<>();
        for(Pen pen:lockedPens){
            LocalDate nextStart=null;
            FeedRationVersion predecessor=null;
            LocalDate predecessorEnd=null;
            for(FeedRationPen link:rationPens.findByPen_Id(pen.getId())){
                FeedRationVersion old=link.getRationVersion();if(!old.getFarm().getId().equals(farmId))continue;
                if("CANCELLED".equals(old.getStatus()))continue;
                if(old.getEffectiveFrom().isEqual(request.effectiveFrom()))throw DomainException.conflict(MessageCodes.FE23_11,"pen",pen.getCode(),"ration_code",old.getRationCode(),"date",request.effectiveFrom());
                if(old.getEffectiveFrom().isBefore(request.effectiveFrom())&&(old.getEffectiveTo()==null||!old.getEffectiveTo().isBefore(request.effectiveFrom()))){
                    if(predecessor!=null)throw DomainException.conflict(MessageCodes.FE23_11,"pen",pen.getCode(),"ration_code",old.getRationCode(),"date",request.effectiveFrom());
                    List<Long> predecessorPenIds=rationPens.findByRationVersion_Id(old.getId()).stream().map(oldLink->oldLink.getPen().getId()).distinct().toList();
                    if(!penIds.containsAll(predecessorPenIds))
                        throw DomainException.conflict(MessageCodes.FE23_11,"pen",pen.getCode(),"ration_code",old.getRationCode(),"date",request.effectiveFrom());
                    predecessor=old;
                    predecessorEnd=old.getEffectiveTo();
                    predecessorByPen.put(pen.getId(),old);
                    predecessorEndByPen.put(pen.getId(),predecessorEnd);
                    predecessorManualStopByPen.put(pen.getId(),old.isEffectiveToManuallySet());
                    predecessorsToEnd.put(old.getId(),old);
                }
                if(old.getEffectiveFrom().isAfter(request.effectiveFrom())){
                    if(nextStart==null||old.getEffectiveFrom().isBefore(nextStart)){
                        nextStart=old.getEffectiveFrom();
                        immediateSuccessorByPen.put(pen.getId(),link);
                        ambiguousImmediateSuccessorByPen.put(pen.getId(),false);
                    }else if(old.getEffectiveFrom().isEqual(nextStart)){
                        ambiguousImmediateSuccessorByPen.put(pen.getId(),true);
                    }
                }
            }
            if(nextStart!=null)immediateSuccessorStartByPen.put(pen.getId(),nextStart);
            if(sawPenWithNextStart==null)sawPenWithNextStart=nextStart!=null;
            else if(sawPenWithNextStart!=(nextStart!=null))
                throw DomainException.conflict(MessageCodes.FE23_11,"pen",pen.getCode(),"ration_code",code,"date",request.effectiveFrom());
            if(nextStart!=null){
                LocalDate penVersionEnd=nextStart.minusDays(1);
                if(versionEnd==null)versionEnd=penVersionEnd;
                else if(!versionEnd.equals(penVersionEnd))
                    throw DomainException.conflict(MessageCodes.FE23_11,"pen",pen.getCode(),"ration_code",code,"date",nextStart);
            }
        }
        Map<Long,LocalDate> inheritedEndByPen=new HashMap<>();
        Map<Long,Boolean> inheritedManualStopByPen=new HashMap<>();
        LocalDate sharedSuccessorSnapshotEnd=null;
        boolean sharedSuccessorSnapshotManual=false;
        boolean sawSuccessorSnapshot=false;
        for(Pen pen:lockedPens){
            FeedRationPen successorLink=immediateSuccessorByPen.get(pen.getId());
            LocalDate successorStart=immediateSuccessorStartByPen.get(pen.getId());
            if(successorStart==null)continue;
            if(successorLink==null||Boolean.TRUE.equals(ambiguousImmediateSuccessorByPen.get(pen.getId())))
                throw rationLineageConflict(code,request.effectiveFrom());
            FeedRationVersion successorPredecessor=successorLink.getPredecessorVersion();
            FeedRationVersion predecessor=predecessorByPen.get(pen.getId());
            if(!sameRationVersion(successorPredecessor,predecessor))
                throw rationLineageConflict(code,request.effectiveFrom());

            LocalDate inheritedEnd;
            boolean inheritedManual;
            if(successorPredecessor==null){
                if(!successorLink.isPredecessorSnapshotCaptured()
                    &&hasLegacyLineageEvidence(successorLink.getRationVersion(),pen.getId()))
                    throw rationLineageConflict(code,request.effectiveFrom());
                LocalDate uncapturedEnd=successorLink.getPredecessorEffectiveTo();
                if(uncapturedEnd!=null||successorLink.isPredecessorEffectiveToManuallySet())
                    throw rationLineageConflict(code,request.effectiveFrom());
                inheritedEnd=null;
                inheritedManual=false;
            }else{
                if(!successorLink.isPredecessorSnapshotCaptured())
                    throw rationLineageConflict(code,request.effectiveFrom());
                if(predecessor.isEffectiveToManuallySet()){
                    inheritedEnd=predecessor.getEffectiveTo();
                    inheritedManual=true;
                }else{
                    inheritedEnd=successorLink.getPredecessorEffectiveTo();
                    inheritedManual=successorLink.isPredecessorEffectiveToManuallySet();
                }
                if(inheritedEnd!=null&&inheritedEnd.isBefore(request.effectiveFrom())||inheritedManual&&inheritedEnd==null)
                    throw rationLineageConflict(code,request.effectiveFrom());
            }
            if(sawSuccessorSnapshot&&(!Objects.equals(sharedSuccessorSnapshotEnd,inheritedEnd)||sharedSuccessorSnapshotManual!=inheritedManual))
                throw rationLineageConflict(code,request.effectiveFrom());
            sharedSuccessorSnapshotEnd=inheritedEnd;
            sharedSuccessorSnapshotManual=inheritedManual;
            sawSuccessorSnapshot=true;
            inheritedEndByPen.put(pen.getId(),inheritedEnd);
            inheritedManualStopByPen.put(pen.getId(),inheritedManual);
        }
        List<FeedRationVersion> rationRowsToLock=new ArrayList<>(predecessorsToEnd.values());
        immediateSuccessorByPen.values().stream().map(FeedRationPen::getRationVersion).forEach(rationRowsToLock::add);
        lockRationVersionsInIdOrder(rationRowsToLock);
        List<FeedItem> componentFeeds=componentIds.stream().sorted().map(id->feeds.lockByIdAndFarm(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08))).toList();
        if(componentFeeds.stream().anyMatch(f->!Boolean.TRUE.equals(f.getAvailable())))throw DomainException.unprocessable(MessageCodes.COM_10,"field","components");
        FeedRationVersion version=new FeedRationVersion();version.setFarm(ctx.farm());version.setRationCode(code);version.setVersionNo(nextVersion);version.setName(request.name().trim());version.setHerdGroup(trim(request.herdGroup()));version.setBasis(trim(request.basis()));version.setEffectiveFrom(request.effectiveFrom());version.setEffectiveTo(versionEnd);version.setStatus("SCHEDULED");version.setSessionsPerDay(request.sessionsPerDay());version.setSessionTimes(times);version.setCreatedBy(ctx.user());version.setCreatedAt(clock.now());rationVersions.saveAndFlush(version);
        for(FeedRationVersion predecessor:predecessorsToEnd.values()){
            predecessor.setEffectiveTo(request.effectiveFrom().minusDays(1));
            predecessor.setEffectiveToManuallySet(false);
            if(!predecessor.getEffectiveFrom().isAfter(clock.today()))predecessor.setStatus("ENDED");
            rationVersions.save(predecessor);
        }
        for(Pen pen:lockedPens){
            FeedRationVersion predecessor=predecessorByPen.get(pen.getId());
            FeedRationPen newLink=new FeedRationPen();newLink.setRationVersion(version);newLink.setPen(pen);newLink.setPredecessorSnapshotCaptured(true);
            if(predecessor!=null){
                newLink.setPredecessorVersion(predecessor);
                newLink.setPredecessorEffectiveTo(inheritedEndByPen.containsKey(pen.getId())?inheritedEndByPen.get(pen.getId()):predecessorEndByPen.get(pen.getId()));
                newLink.setPredecessorEffectiveToManuallySet(inheritedManualStopByPen.containsKey(pen.getId())?inheritedManualStopByPen.get(pen.getId()):predecessorManualStopByPen.getOrDefault(pen.getId(),false));
            }
            rationPens.save(newLink);
        }
        for(Pen pen:lockedPens){
            FeedRationPen successorLink=immediateSuccessorByPen.get(pen.getId());
            if(successorLink==null)continue;
            successorLink.setPredecessorVersion(version);
            successorLink.setPredecessorEffectiveTo(inheritedEndByPen.get(pen.getId()));
            successorLink.setPredecessorEffectiveToManuallySet(inheritedManualStopByPen.getOrDefault(pen.getId(),false));
            successorLink.setPredecessorSnapshotCaptured(true);
            rationPens.save(successorLink);
        }
        incrementRationLinkSuccessorVersions(immediateSuccessorByPen.values().stream().map(FeedRationPen::getRationVersion).toList());
        for(RationComponentRequest c:components){FeedItem feed=componentFeeds.stream().filter(f->f.getId().equals(c.feedItemId())).findFirst().orElseThrow();FeedRationComponent component=new FeedRationComponent();component.setRationVersion(version);component.setFeedItem(feed);component.setFeedCodeSnapshot(feed.getCode());component.setFeedNameSnapshot(feed.getName());component.setSession1(c.session1Kg());component.setSession2(c.session2Kg());component.setSession3(c.session3Kg());rationComponents.save(component);}
        outbox.enqueue(farmId,"FEED_RATION_VERSION_SAVED","FeedRationVersion",version.getId(),Map.of("rationId",version.getId(),"versionNo",version.getVersionNo()));
        return rationView(version,true);
    }

    @Transactional
    public RationView cancelRationVersion(Long farmId,Long rationId,Integer pathVersion,RationVersionRequest request) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        FeedRationVersion target=loadRationAndLockPens(farmId,rationId);
        List<FeedRationPen> targetLinks=rationPens.findByRationVersion_Id(target.getId());
        Map<Long,FeedRationPen> successorLinkByPen=new HashMap<>();
        List<FeedRationVersion> rationRowsToLock=new ArrayList<>();rationRowsToLock.add(target);
        for(FeedRationPen targetLink:targetLinks){
            if(targetLink.getPredecessorVersion()!=null)rationRowsToLock.add(targetLink.getPredecessorVersion());
            List<FeedRationPen> successors=scheduledSuccessorLinks(target,targetLink.getPen().getId());
            if(successors.size()>1)throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_successor_ambiguous");
            if(successors.size()==1){
                FeedRationPen successor=successors.get(0);
                successorLinkByPen.put(targetLink.getPen().getId(),successor);
                rationRowsToLock.add(successor.getRationVersion());
            }
        }
        lockRationVersionsInIdOrder(rationRowsToLock);
        validateRationVersionNo(target,pathVersion);
        validateRationRowVersion(target,request.version());
        LocalDate today=clock.today();
        if("CANCELLED".equals(target.getStatus())||!target.getEffectiveFrom().isAfter(today))
            throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_not_scheduled");

        Map<Long,RationRestorePlan> restores=new HashMap<>();
        for(FeedRationPen targetLink:targetLinks){
            if(!targetLink.isPredecessorSnapshotCaptured()){
                if(hasLegacyLineageEvidence(target,targetLink.getPen().getId()))
                    throw rationLineageConflict(target.getRationCode(),target.getEffectiveFrom());
                continue;
            }
            FeedRationVersion predecessor=targetLink.getPredecessorVersion();
            if(predecessor==null)continue;
            LocalDate supersededOn=target.getEffectiveFrom().minusDays(1);
            LocalDate currentPredecessorEnd=predecessor.getEffectiveTo();
            boolean predecessorWasManuallyStoppedAfterTarget=predecessor.isEffectiveToManuallySet();
            if(!Objects.equals(currentPredecessorEnd,supersededOn)&&!predecessorWasManuallyStoppedAfterTarget)
                throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_predecessor_changed");

            LocalDate successorSnapshotEnd=predecessorWasManuallyStoppedAfterTarget?currentPredecessorEnd:targetLink.getPredecessorEffectiveTo();
            boolean successorSnapshotManual=predecessorWasManuallyStoppedAfterTarget||targetLink.isPredecessorEffectiveToManuallySet();
            LocalDate desiredEnd=successorSnapshotEnd;
            boolean desiredManual=successorSnapshotManual;
            boolean firstPen=true;
            for(FeedRationPen predecessorLink:rationPens.findByRationVersion_Id(predecessor.getId())){
                LocalDate nextStart=nextRationStart(predecessor,predecessorLink.getPen().getId(),target.getId());
                LocalDate penEnd=successorSnapshotEnd;
                if(nextStart!=null){
                    LocalDate beforeNext=nextStart.minusDays(1);
                    if(penEnd==null||beforeNext.isBefore(penEnd))penEnd=beforeNext;
                }
                if(firstPen){
                    desiredEnd=penEnd;
                    desiredManual=successorSnapshotManual&&Objects.equals(penEnd,successorSnapshotEnd);
                    firstPen=false;
                }
                else if(!Objects.equals(desiredEnd,penEnd)||desiredManual!=(successorSnapshotManual&&Objects.equals(penEnd,successorSnapshotEnd)))
                    throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_pen_schedule_not_representable");
            }
            if(firstPen)throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_predecessor_missing_pen");
            RationRestorePlan prior=restores.putIfAbsent(predecessor.getId(),new RationRestorePlan(predecessor,desiredEnd,desiredManual,successorSnapshotEnd,successorSnapshotManual));
            if(prior!=null&&(!Objects.equals(prior.effectiveTo(),desiredEnd)||prior.effectiveToManuallySet()!=desiredManual||!Objects.equals(prior.successorSnapshotEnd(),successorSnapshotEnd)||prior.successorSnapshotManuallySet()!=successorSnapshotManual))
                throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_pen_schedule_not_representable");
        }

        // Carry the saved predecessor through any later scheduled version, so cancelling versions in either order is safe.
        for(FeedRationPen targetLink:targetLinks){
            FeedRationPen successor=successorLinkByPen.get(targetLink.getPen().getId());
            if(successor!=null){
                successor.setPredecessorVersion(targetLink.getPredecessorVersion());
                RationRestorePlan restore=targetLink.getPredecessorVersion()==null?null:restores.get(targetLink.getPredecessorVersion().getId());
                successor.setPredecessorEffectiveTo(restore==null?targetLink.getPredecessorEffectiveTo():restore.successorSnapshotEnd());
                successor.setPredecessorEffectiveToManuallySet(restore==null?targetLink.isPredecessorEffectiveToManuallySet():restore.successorSnapshotManuallySet());
                successor.setPredecessorSnapshotCaptured(targetLink.isPredecessorSnapshotCaptured());
                rationPens.save(successor);
            }
        }
        restores.values().forEach(plan->{plan.predecessor().setEffectiveTo(plan.effectiveTo());plan.predecessor().setEffectiveToManuallySet(plan.effectiveToManuallySet());rationVersions.save(plan.predecessor());});
        target.setEffectiveTo(target.getEffectiveFrom().minusDays(1));
        target.setStatus("CANCELLED");
        rationVersions.saveAndFlush(target);
        incrementRationLinkSuccessorVersions(successorLinkByPen.values().stream().map(FeedRationPen::getRationVersion).toList());
        outbox.enqueue(farmId,"FEED_RATION_VERSION_CANCELLED","FeedRationVersion",target.getId(),Map.of("rationId",target.getId(),"versionNo",target.getVersionNo()));
        return rationView(target,true);
    }

    @Transactional
    public RationView stopRation(Long farmId,Long rationId,StopRationRequest request) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        FeedRationVersion target=loadRationAndLockPens(farmId,rationId);
        lockRationVersionsInIdOrder(List.of(target));
        validateRationRowVersion(target,request.version());
        LocalDate today=clock.today();
        if("CANCELLED".equals(target.getStatus())||target.getEffectiveFrom().isAfter(today)||target.getEffectiveTo()!=null&&target.getEffectiveTo().isBefore(today))
            throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_not_effective");
        LocalDate tomorrow=today.plusDays(1);
        if(request.endDate().isBefore(tomorrow))throw DomainException.unprocessable(MessageCodes.FE23_10,"date",tomorrow);
        for(FeedRationPen link:rationPens.findByRationVersion_Id(target.getId())){
            LocalDate nextStart=nextRationStart(target,link.getPen().getId(),null);
            if(nextStart!=null&&!request.endDate().isBefore(nextStart))
                throw DomainException.conflict(MessageCodes.FE23_11,"pen",link.getPen().getCode(),"ration_code",target.getRationCode(),"date",nextStart);
        }
        target.setEffectiveTo(request.endDate());
        target.setEffectiveToManuallySet(true);
        rationVersions.saveAndFlush(target);
        outbox.enqueue(farmId,"FEED_RATION_STOPPED","FeedRationVersion",target.getId(),Map.of("rationId",target.getId(),"versionNo",target.getVersionNo(),"endDate",request.endDate()));
        return rationView(target,true);
    }

    private FeedRationVersion loadRationAndLockPens(Long farmId,Long rationId){
        FeedRationVersion ration=rationVersions.findByIdAndFarm_Id(rationId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        List<Long> penIds=rationPens.findByRationVersion_Id(rationId).stream().map(link->link.getPen().getId()).distinct().sorted().toList();
        if(penIds.isEmpty()||pens.lockAllByFarmIdAndIdIn(farmId,penIds).size()!=penIds.size())
            throw DomainException.notFound(MessageCodes.COM_08);
        return ration;
    }

    private void lockRationVersionsInIdOrder(List<FeedRationVersion> candidates){
        Map<Long,FeedRationVersion> byId=new TreeMap<>();
        for(FeedRationVersion candidate:candidates)if(candidate!=null&&candidate.getId()!=null)byId.put(candidate.getId(),candidate);
        byId.values().forEach(candidate->entityManager.refresh(candidate,LockModeType.PESSIMISTIC_WRITE));
    }

    private void incrementRationLinkSuccessorVersions(List<FeedRationVersion> successors){
        Map<Long,FeedRationVersion> byId=new TreeMap<>();
        for(FeedRationVersion successor:successors)if(successor!=null&&successor.getId()!=null)byId.put(successor.getId(),successor);
        if(byId.isEmpty())return;
        byId.values().forEach(successor->entityManager.lock(successor,LockModeType.PESSIMISTIC_FORCE_INCREMENT));
        // Hibernate may defer the forced @Version update until flush; callers must see the new token in this transaction.
        entityManager.flush();
    }

    private boolean sameRationVersion(FeedRationVersion left,FeedRationVersion right){
        return left==null?right==null:right!=null&&Objects.equals(left.getId(),right.getId());
    }

    private DomainException rationLineageConflict(String rationCode,LocalDate date){
        return DomainException.conflict(MessageCodes.FE23_22,"ration_code",rationCode,"date",date);
    }

    private void validateRationVersionNo(FeedRationVersion target,Integer pathVersion){
        if(pathVersion==null||!pathVersion.equals(target.getVersionNo()))
            throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_version");
    }

    private void validateRationRowVersion(FeedRationVersion target,Integer requestVersion){
        if(requestVersion==null||!requestVersion.equals(target.getVersion()))
            throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_version");
    }

    /** Legacy links cannot prove whether an earlier version was auto-shortened or manually stopped. */
    private boolean hasLegacyLineageEvidence(FeedRationVersion target,Long penId){
        return rationPens.findByPen_Id(penId).stream().map(FeedRationPen::getRationVersion)
            .filter(candidate->!candidate.getId().equals(target.getId()))
            .filter(candidate->candidate.getEffectiveFrom().isBefore(target.getEffectiveFrom()))
            .anyMatch(candidate->!"CANCELLED".equals(candidate.getStatus()));
    }

    private LocalDate nextRationStart(FeedRationVersion predecessor,Long penId,Long cancelledVersionId){
        return rationPens.findByPen_Id(penId).stream().map(FeedRationPen::getRationVersion)
            .filter(candidate->!candidate.getId().equals(predecessor.getId()))
            .filter(candidate->cancelledVersionId==null||!candidate.getId().equals(cancelledVersionId))
            .filter(candidate->!"CANCELLED".equals(candidate.getStatus()))
            .filter(candidate->candidate.getEffectiveFrom().isAfter(predecessor.getEffectiveFrom()))
            .map(FeedRationVersion::getEffectiveFrom).min(LocalDate::compareTo).orElse(null);
    }

    private List<FeedRationPen> scheduledSuccessorLinks(FeedRationVersion target,Long penId){
        return rationPens.findByPen_Id(penId).stream()
            .filter(link->link.getPredecessorVersion()!=null&&link.getPredecessorVersion().getId().equals(target.getId()))
            .filter(link->link.getRationVersion().getEffectiveFrom().isAfter(target.getEffectiveFrom()))
            .filter(link->!"CANCELLED".equals(link.getRationVersion().getStatus()))
            .toList();
    }

    @Transactional(readOnly=true)
    public FeedingPlanView feedingPlan(Long farmId,Long penId,LocalDate date,Integer sessionNo) {
        access.require(farmId,FarmAction.MANAGE_FEEDING);
        if(penId==null||date==null||sessionNo==null||sessionNo<1||sessionNo>3)throw DomainException.invalid("plan");
        clock.assertNotFuture(date);
        Pen pen=pens.findByIdAndFarmId(penId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        if(pen.getStatus()!=ActiveStatus.ACTIVE)throw DomainException.conflict(MessageCodes.COM_05);
        int headCount=Math.toIntExact(assignments.countAssignedAt(pen.getId(),date));
        FeedRationVersion ration=effectiveRation(farmId,pen.getId(),date);
        validateSessionForRation(ration,sessionNo);
        List<FeedingPlanLineView> plannedLines=new ArrayList<>();
        if(ration!=null)for(FeedRationComponent component:rationComponents.findByRationVersion_Id(ration.getId())){
            BigDecimal perHead=component.sessionAmount(sessionNo);
            if(perHead.signum()<=0)continue;
            FeedItem feed=component.getFeedItem();
            plannedLines.add(new FeedingPlanLineView(feed.getId(),component.getFeedCodeSnapshot(),component.getFeedNameSnapshot(),perHead,
                perHead.multiply(BigDecimal.valueOf(headCount)).setScale(3,RoundingMode.HALF_UP),feed.getOnHandKg(),Boolean.TRUE.equals(feed.getAvailable())));
        }
        var existing=feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(farmId,penId,date,sessionNo,"VALID");
        FeedingPlanRationView rationView=ration==null?null:new FeedingPlanRationView(ration.getId(),ration.getRationCode(),ration.getVersionNo(),ration.getName(),ration.getSessionsPerDay());
        return new FeedingPlanView(pen.getId(),pen.getCode(),date,sessionNo,sessionTime(ration,sessionNo),rationView,headCount,plannedLines,existing.map(FeedingRecord::getId).orElse(null));
    }

    @Transactional
    public FeedingView recordFeeding(Long farmId,RecordFeedingRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEEDING);
        clock.assertNotFuture(request.feedingDate());
        List<Pen> lockedPens=pens.lockAllByFarmIdAndIdIn(farmId,List.of(request.penId()));
        Pen pen=lockedPens.stream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        if(pen.getStatus()!=ActiveStatus.ACTIVE)throw DomainException.conflict(MessageCodes.COM_05);
        var existing=feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(farmId,pen.getId(),request.feedingDate(),request.sessionNo(),"VALID");
        if(existing.isPresent())throw DomainException.conflict(MessageCodes.FE23_13,"pen",pen.getCode(),"session",sessionLabel(request.sessionNo()),"date",request.feedingDate());
        int headCount=Math.toIntExact(assignments.countAssignedAt(pen.getId(),request.feedingDate()));
        if(headCount<=0)throw DomainException.conflict(MessageCodes.COM_05,"reason","pen_empty");
        FeedRationVersion ration=effectiveRation(farmId,pen.getId(),request.feedingDate());
        validateSessionForRation(ration,request.sessionNo());
        List<FeedRationComponent> components=ration==null?List.of():rationComponents.findByRationVersion_Id(ration.getId());
        Map<Long,FeedRationComponent> plannedComponents=components.stream().filter(c->c.sessionAmount(request.sessionNo()).signum()>0)
            .collect(java.util.stream.Collectors.toMap(c->c.getFeedItem().getId(),c->c));
        Map<Long,FeedingLineRequest> requested=new java.util.LinkedHashMap<>();
        for(FeedingLineRequest line:request.lines())if(requested.put(line.feedItemId(),line)!=null)throw DomainException.invalid("lines");
        if(!requested.keySet().containsAll(plannedComponents.keySet()))throw DomainException.invalid("lines");
        List<FeedItem> locked=requested.keySet().stream().sorted().map(id->feeds.lockByIdAndFarm(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08))).toList();
        String note=trim(request.note());
        for(Map.Entry<Long,FeedingLineRequest> entry:requested.entrySet()){
            FeedItem feed=locked.stream().filter(row->row.getId().equals(entry.getKey())).findFirst().orElseThrow();
            validateFeedingQuantity(entry.getValue().actualKg());
            if(feed.getOnHandKg().signum()<=0&&entry.getValue().actualKg().signum()==0&&note==null)throw DomainException.required("note");
            if(!Boolean.TRUE.equals(feed.getAvailable())&&(entry.getValue().actualKg().signum()>0||!plannedComponents.containsKey(feed.getId())))
                throw DomainException.unprocessable(MessageCodes.FE23_21,"feed",feed.getName());
        }
        java.time.LocalTime feedingTime=request.feedingTime()==null?sessionTime(ration,request.sessionNo()):request.feedingTime();
        java.time.Instant eventTime=request.feedingDate().atTime(feedingTime).atZone(ctx.farm().getTimeZone()==null?clock.zone():java.time.ZoneId.of(ctx.farm().getTimeZone())).toInstant();
        clock.assertNotFuture(eventTime);
        FeedingRecord record=new FeedingRecord();record.setFarm(ctx.farm());record.setPen(pen);record.setRationVersion(ration);record.setFeedingDate(request.feedingDate());record.setSessionNo(request.sessionNo());record.setHeadCount(headCount);
        record.setFeedingTime(feedingTime);record.setFedBy(trim(request.fedBy()));record.setLeftoverKg(request.leftoverKg());record.setNote(note);record.setRecordedBy(ctx.user());record.setRecordedAt(clock.now());record=feedingRecords.saveAndFlush(record);
        for(Map.Entry<Long,FeedingLineRequest> entry:requested.entrySet()){
            FeedItem feed=locked.stream().filter(row->row.getId().equals(entry.getKey())).findFirst().orElseThrow();
            BigDecimal actual=entry.getValue().actualKg();validateFeedingQuantity(actual);
            if(feed.getOnHandKg().compareTo(actual)<0)throw DomainException.unprocessable(MessageCodes.FE23_14,"feed",feed.getName(),"stock",feed.getOnHandKg());
            FeedRationComponent component=plannedComponents.get(feed.getId());
            BigDecimal planned=component==null?BigDecimal.ZERO:component.sessionAmount(request.sessionNo()).multiply(BigDecimal.valueOf(headCount)).setScale(3,RoundingMode.HALF_UP);
            BigDecimal unitCost=feed.getAvgUnitCost();long cost=actual.multiply(unitCost).setScale(0,RoundingMode.HALF_UP).longValueExact();
            if(actual.signum()>0){feed.setOnHandKg(feed.getOnHandKg().subtract(actual));feeds.saveAndFlush(feed);movement(ctx,feed,"FEEDING",actual.negate(),unitCost,"FEEDING_RECORD",record.getId());}
            FeedingRecordLine line=new FeedingRecordLine();line.setFeedingRecord(record);line.setFeedItem(feed);line.setFeedCodeSnapshot(component==null?feed.getCode():component.getFeedCodeSnapshot());line.setFeedNameSnapshot(component==null?feed.getName():component.getFeedNameSnapshot());
            line.setPlannedKg(planned);line.setActualKg(actual);line.setCostPerKg(unitCost);line.setTotalCost(cost);feedingLines.save(line);
        }
        outbox.enqueue(farmId,"FEEDING_RECORDED","FeedingRecord",record.getId(),Map.of("recordId",record.getId(),"penId",pen.getId()));
        return feedingView(record);
    }

    @Transactional(readOnly=true)
    public List<FeedingView> feedingLog(Long farmId,LocalDate from,LocalDate to){access.require(farmId,FarmAction.VIEW_FEED);if(from==null||to==null||from.isAfter(to))throw DomainException.invalid("period");return feedingRecords.findByFarm_IdAndFeedingDateBetweenOrderByFeedingDateDescSessionNoAsc(farmId,from,to).stream().map(this::feedingView).toList();}

    @Transactional(readOnly=true)
    public List<FeedReminderView> feedReminders(Long farmId){
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_FEED);List<FeedReminderView> result=new ArrayList<>();
        if(ctx.role()==vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER||ctx.role()==vn.edu.fpt.beefcare.domain.enumeration.FarmRole.MANAGER){
            for(FeedItem f:feeds.findByFarm_IdOrderByNameAsc(farmId))if(Boolean.TRUE.equals(f.getAvailable())&&f.getMinimumStockKg()!=null&&f.getOnHandKg().compareTo(f.getMinimumStockKg())<=0)result.add(new FeedReminderView("REM-10",f.getId(),f.getId(),null,f.getCode(),f.getOnHandKg().signum()==0?"Out of stock":"Low feed stock",clock.now(),"ACTIVE"));
        }
        if(ctx.role()==vn.edu.fpt.beefcare.domain.enumeration.FarmRole.MANAGER||ctx.role()==vn.edu.fpt.beefcare.domain.enumeration.FarmRole.TECHNICIAN){
            LocalDate today=clock.today();java.time.ZoneId zone=java.time.ZoneId.of(ctx.farm().getTimeZone());
            for(Pen pen:pens.findAllByFarmIdOrderByCodeAsc(farmId)){
                if(pen.getStatus()!=ActiveStatus.ACTIVE||assignments.countAssignedAt(pen.getId(),today)==0)continue;
                FeedRationVersion ration=effectiveRation(farmId,pen.getId(),today);if(ration==null)continue;String[] times=ration.getSessionTimes().split(",");
                for(int i=0;i<Math.min(times.length,ration.getSessionsPerDay());i++){
                    LocalDate sessionDate=today;java.time.Instant due=sessionDate.atTime(java.time.LocalTime.parse(times[i])).plusHours(2).atZone(zone).toInstant();if(due.isAfter(clock.now()))continue;
                    if(feedingRecords.findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(farmId,pen.getId(),today,i+1,"VALID").isPresent())continue;
                    result.add(new FeedReminderView("REM-11",ration.getId(),null,pen.getId(),pen.getCode(),"Feeding session not recorded",due,"ACTIVE"));
                }
            }
        }
        return List.copyOf(result);
    }

    @Transactional(readOnly=true)
    public ConsumptionReport consumptionReport(Long farmId,ConsumptionReportRequest request){
        access.require(farmId,FarmAction.MANAGE_FEED);if(request.from().isAfter(request.to()))throw DomainException.invalid("period");if(request.from().plusMonths(24).isBefore(request.to()))throw DomainException.unprocessable(MessageCodes.COM_10,"field","period","maximumMonths",24);
        record Key(Long penId,String herdGroup,Long feedId){}
        record Aggregate(Pen pen,String herdGroup,FeedItem feed,BigDecimal[] kg,long[] cost){}
        java.util.Map<Key,Aggregate> values=new java.util.LinkedHashMap<>();
        for(FeedingRecord record:feedingRecords.findByFarm_IdAndFeedingDateBetweenOrderByFeedingDateDescSessionNoAsc(farmId,request.from(),request.to()))if("VALID".equals(record.getStatus())){
            String group=record.getRationVersion()==null?"Unknown":record.getRationVersion().getHerdGroup();
            for(FeedingRecordLine line:feedingLines.findByFeedingRecord_Id(record.getId())){Key key=new Key(record.getPen().getId(),group,line.getFeedItem().getId());Aggregate agg=values.computeIfAbsent(key,k->new Aggregate(record.getPen(),group,line.getFeedItem(),new BigDecimal[]{BigDecimal.ZERO,BigDecimal.ZERO},new long[]{0L}));agg.kg()[0]=agg.kg()[0].add(line.getPlannedKg());agg.kg()[1]=agg.kg()[1].add(line.getActualKg());agg.cost()[0]=Math.addExact(agg.cost()[0],line.getTotalCost());}
        }
        List<ConsumptionRow> rows=values.values().stream().map(a->{BigDecimal variance=a.kg()[0].signum()==0?null:a.kg()[1].subtract(a.kg()[0]).divide(a.kg()[0],4,RoundingMode.HALF_UP);return new ConsumptionRow(a.pen().getId(),a.pen().getCode(),a.herdGroup(),a.feed().getId(),a.feed().getCode(),a.kg()[0],a.kg()[1],variance,a.cost()[0]);}).toList();
        java.time.Instant from=request.from().atStartOfDay(java.time.ZoneId.of(access.require(farmId,FarmAction.MANAGE_FEED).farm().getTimeZone())).toInstant();java.time.Instant to=request.to().plusDays(1).atStartOfDay(java.time.ZoneId.of(access.require(farmId,FarmAction.MANAGE_FEED).farm().getTimeZone())).toInstant();
        List<FeedStockMovement> adjustment=movements.findByFarm_IdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(farmId,from,to).stream().filter(m->"STOCK_ADJUSTMENT".equals(m.getSourceType())&&m.getQuantityKg().signum()<0).toList();BigDecimal lossKg=adjustment.stream().map(m->m.getQuantityKg().negate()).reduce(BigDecimal.ZERO,BigDecimal::add);long lossValue=adjustment.stream().mapToLong(m->m.getQuantityKg().negate().multiply(m.getUnitCost()).setScale(0,RoundingMode.HALF_UP).longValue()).sum();
        return new ConsumptionReport(request.from(),request.to(),rows,lossKg,lossValue,clock.now());
    }

    @Transactional
    public FeedingView voidFeeding(Long farmId,Long recordId,FeedingVoidRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEEDING);
        validateFeedingReason(request.reason());
        FeedingRecord record=feedingRecords.lockByIdAndFarm(recordId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(record.getVersion(),request.expectedVersion());
        if(!"VALID".equals(record.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        List<FeedingRecordLine> recordLines=feedingLines.findByFeedingRecord_Id(recordId);Map<String,Object> before=snapshot(record,recordLines);
        for(FeedingRecordLine line:recordLines.stream().sorted(java.util.Comparator.comparing(l->l.getFeedItem().getId())).toList()){
            if(line.getActualKg().signum()==0)continue;
            FeedItem feed=feeds.lockByIdAndFarm(line.getFeedItem().getId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
            BigDecimal beforeStock=feed.getOnHandKg();BigDecimal after=beforeStock.add(line.getActualKg());
            BigDecimal value=beforeStock.multiply(feed.getAvgUnitCost()).add(line.getActualKg().multiply(line.getCostPerKg()));
            feed.setOnHandKg(after);feed.setAvgUnitCost(after.signum()==0?BigDecimal.ZERO:value.divide(after,2,RoundingMode.HALF_UP));feeds.saveAndFlush(feed);
            movement(ctx,feed,"FEEDING_VOID",line.getActualKg(),line.getCostPerKg(),"FEEDING_RECORD",recordId);
        }
        record.setStatus("VOIDED");record.setVoidReason(request.reason().trim());record.setVoidedBy(ctx.user());record.setVoidedAt(clock.now());feedingRecords.saveAndFlush(record);
        revisions.record(ctx,"FeedingRecord",recordId,RecordRevisionService.VOID,request.reason(),before,snapshot(record,recordLines));
        outbox.enqueue(farmId,"FEEDING_VOIDED","FeedingRecord",recordId,Map.of("recordId",recordId));return feedingView(record);
    }

    @Transactional
    public FeedingView correctFeeding(Long farmId,Long recordId,FeedingCorrectionRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEEDING);validateFeedingReason(request.reason());FeedingRecord record=feedingRecords.lockByIdAndFarm(recordId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));VersionGuard.requireExpected(record.getVersion(),request.expectedVersion());if(!"VALID".equals(record.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);Integer startingVersion=record.getVersion();
        List<FeedingRecordLine> oldLines=feedingLines.findByFeedingRecord_Id(recordId);Map<Long,FeedingLineRequest> requested=new java.util.HashMap<>();for(FeedingLineRequest line:request.lines())if(requested.put(line.feedItemId(),line)!=null)throw DomainException.invalid("lines");if(requested.size()!=oldLines.size()||!requested.keySet().containsAll(oldLines.stream().map(l->l.getFeedItem().getId()).toList()))throw DomainException.invalid("lines");
        Map<String,Object> before=snapshot(record,oldLines);List<FeedItem> locked=oldLines.stream().map(l->l.getFeedItem().getId()).distinct().sorted().map(id->feeds.lockByIdAndFarm(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08))).toList();
        for(FeedingRecordLine line:oldLines){FeedItem feed=locked.stream().filter(f->f.getId().equals(line.getFeedItem().getId())).findFirst().orElseThrow();BigDecimal oldActual=line.getActualKg();BigDecimal newActual=requested.get(feed.getId()).actualKg();validateFeedingQuantity(newActual);BigDecimal delta=newActual.subtract(oldActual).setScale(3,RoundingMode.HALF_UP);BigDecimal oldCost=line.getCostPerKg();BigDecimal currentCost=feed.getAvgUnitCost();if(delta.signum()>0&&!Boolean.TRUE.equals(feed.getAvailable()))throw DomainException.unprocessable(MessageCodes.FE23_21,"feed",feed.getName());if(delta.signum()>0&&feed.getOnHandKg().compareTo(delta)<0)throw DomainException.unprocessable(MessageCodes.FE23_14,"feed",feed.getName(),"stock",feed.getOnHandKg());
            if(delta.signum()>0){feed.setOnHandKg(feed.getOnHandKg().subtract(delta));}else if(delta.signum()<0){BigDecimal returned=delta.negate();BigDecimal value=feed.getOnHandKg().multiply(currentCost).add(returned.multiply(oldCost));feed.setOnHandKg(feed.getOnHandKg().add(returned));feed.setAvgUnitCost(value.divide(feed.getOnHandKg(),2,RoundingMode.HALF_UP));}
            feeds.saveAndFlush(feed);if(delta.signum()!=0)movement(ctx,feed,"FEEDING_CORRECTION",delta.negate(),delta.signum()>0?currentCost:oldCost,"FEEDING_RECORD",recordId);
            BigDecimal retainedCost=oldActual.min(newActual).multiply(oldCost);BigDecimal addedCost=newActual.compareTo(oldActual)>0?delta.multiply(currentCost):BigDecimal.ZERO;BigDecimal totalValue=retainedCost.add(addedCost);BigDecimal unitCost=newActual.signum()==0?BigDecimal.ZERO:totalValue.divide(newActual,2,RoundingMode.HALF_UP);line.setActualKg(newActual);line.setCostPerKg(unitCost);line.setTotalCost(totalValue.setScale(0,RoundingMode.HALF_UP).longValueExact());feedingLines.save(line);
        }
        if(trim(request.fedBy())!=null)record.setFedBy(trim(request.fedBy()));feedingRecords.saveAndFlush(record);
        if(java.util.Objects.equals(record.getVersion(),startingVersion)){
            // A line-only correction does not dirty the parent row, so force its version after flushing.
            entityManager.lock(record,LockModeType.PESSIMISTIC_FORCE_INCREMENT);
            entityManager.flush();
        }
        List<FeedingRecordLine> now=feedingLines.findByFeedingRecord_Id(recordId);revisions.record(ctx,"FeedingRecord",recordId,RecordRevisionService.CORRECT,request.reason(),before,snapshot(record,now));outbox.enqueue(farmId,"FEEDING_CORRECTED","FeedingRecord",recordId,Map.of("recordId",recordId));return feedingView(record);
    }

    private void movement(FarmContext ctx,FeedItem feed,String type,BigDecimal qty,BigDecimal unitCost,String source,Long sourceId){
        movement(ctx,feed,type,qty,unitCost,source,sourceId,feed.getOnHandKg());
    }
    private void movement(FarmContext ctx,FeedItem feed,String type,BigDecimal qty,BigDecimal unitCost,String source,Long sourceId,BigDecimal balanceAfter){
        FeedStockMovement m=new FeedStockMovement();m.setFarm(ctx.farm());m.setFeedItem(feed);m.setMovementType(type);m.setQuantityKg(qty);m.setUnitCost(unitCost);m.setBalanceAfterKg(balanceAfter);m.setSourceType(source);m.setSourceId(sourceId);m.setOccurredAt(clock.now());m.setRecordedBy(ctx.user());movements.save(m);
    }
    private void setInitialPayment(FeedReceipt receipt,Long amount,PaymentMethod method,LocalDate date,LocalDate dueDate){
        long initialAmount=amount==null?0L:amount;
        receipt.setInitialPaymentAmount(initialAmount);receipt.setInitialPaymentMethod(method);
        receipt.setInitialPaymentDate(date==null&&initialAmount>0?receipt.getReceiptDate():date);receipt.setPaymentDueDate(dueDate);
    }
    private void validateInitialPayment(FeedReceipt receipt){
        long amount=receipt.getInitialPaymentAmount()==null?0L:receipt.getInitialPaymentAmount();
        if(amount>receipt.getTotalPayable())throw DomainException.unprocessable(MessageCodes.FE06_13,"amount",receipt.getTotalPayable());
        if(amount>0&&receipt.getInitialPaymentMethod()==null)throw DomainException.required("method");
        LocalDate date=receipt.getInitialPaymentDate();
        if(date!=null){clock.assertNotFuture(date);if(date.isBefore(receipt.getReceiptDate()))throw DomainException.unprocessable(MessageCodes.COM_15,"date",receipt.getReceiptDate());}
    }
    private static Map<String,Object> receiptSnapshot(FeedReceipt receipt,List<FeedReceiptLine> values){
        Map<String,Object> snapshot=new java.util.LinkedHashMap<>();snapshot.put("status",receipt.getStatus());snapshot.put("totalPayable",receipt.getTotalPayable());
        snapshot.put("initialPaymentAmount",receipt.getInitialPaymentAmount());snapshot.put("initialPaymentMethod",receipt.getInitialPaymentMethod()==null?null:receipt.getInitialPaymentMethod().name());
        snapshot.put("paymentDueDate",receipt.getPaymentDueDate());snapshot.put("voidReason",receipt.getVoidReason());
        snapshot.put("lines",values.stream().map(l->Map.of("feedItemId",l.getFeedItem().getId(),"kgReceived",l.getKgReceived(),"lineAmount",l.getLineAmount())).toList());
        return snapshot;
    }
    private RationView rationView(FeedRationVersion v,boolean includeCosts){
        String state="CANCELLED".equals(v.getStatus())?"CANCELLED":v.getEffectiveFrom().isAfter(clock.today())?"SCHEDULED":v.getEffectiveTo()!=null&&v.getEffectiveTo().isBefore(clock.today())?"ENDED":"EFFECTIVE";
        List<Long> penIds=rationPens.findByRationVersion_Id(v.getId()).stream().map(link->link.getPen().getId()).sorted().toList();
        List<RationComponentView> components=rationComponents.findByRationVersion_Id(v.getId()).stream().map(c->{BigDecimal daily=c.getSession1().add(c.getSession2()).add(c.getSession3());BigDecimal cost=includeCosts?daily.multiply(c.getFeedItem().getAvgUnitCost()).setScale(0,RoundingMode.HALF_UP):null;return new RationComponentView(c.getFeedItem().getId(),c.getFeedCodeSnapshot(),c.getFeedNameSnapshot(),c.getSession1(),c.getSession2(),c.getSession3(),daily,cost,c.getFeedItem().getOnHandKg().signum()<=0);}).toList();
        List<String> sessionTimes=List.of(v.getSessionTimes().split(","));
        return new RationView(v.getId(),v.getRationCode(),v.getVersionNo(),v.getName(),v.getHerdGroup(),v.getBasis(),v.getEffectiveFrom(),v.getEffectiveTo(),state,v.getVersion(),v.getSessionsPerDay(),sessionTimes,penIds,components);
    }
    private FeedRationVersion effectiveRation(Long farmId,Long penId,LocalDate day){
        return rationPens.findByPen_Id(penId).stream().map(FeedRationPen::getRationVersion).filter(v->v.getFarm().getId().equals(farmId)&&!v.getEffectiveFrom().isAfter(day)&&(v.getEffectiveTo()==null||!v.getEffectiveTo().isBefore(day))).max(java.util.Comparator.comparing(FeedRationVersion::getEffectiveFrom).thenComparing(FeedRationVersion::getVersionNo)).orElse(null);
    }
    private FeedingView feedingView(FeedingRecord r){
        List<FeedingRecordLine> lines=feedingLines.findByFeedingRecord_Id(r.getId());
        java.util.Set<Long> rationFeedIds=r.getRationVersion()==null?java.util.Set.of():rationComponents.findByRationVersion_Id(r.getRationVersion().getId()).stream().map(c->c.getFeedItem().getId()).collect(java.util.stream.Collectors.toSet());
        List<FeedingLineView> lineViews=lines.stream().map(l->new FeedingLineView(l.getFeedItem().getId(),l.getFeedCodeSnapshot(),l.getFeedNameSnapshot(),l.getPlannedKg(),l.getActualKg(),rationFeedIds.contains(l.getFeedItem().getId()),l.getCostPerKg(),l.getTotalCost())).toList();
        List<FeedingRevisionView> history=revisions.history("FeedingRecord",r.getId()).stream().map(revision->new FeedingRevisionView(revision.getAction(),revision.getReason(),revision.getChangedAt(),userName(revision.getActor()))).toList();
        BigDecimal planned=lineViews.stream().map(FeedingLineView::plannedKg).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal actual=lineViews.stream().map(FeedingLineView::actualKg).reduce(BigDecimal.ZERO,BigDecimal::add);
        FeedRationVersion ration=r.getRationVersion();
        return new FeedingView(r.getId(),r.getPen().getId(),r.getPen().getCode(),r.getPen().getName(),r.getFeedingDate(),r.getSessionNo(),r.getFeedingTime(),r.getHeadCount(),r.getStatus(),r.getVersion(),
            ration==null?null:ration.getId(),ration==null?null:ration.getRationCode(),ration==null?null:ration.getVersionNo(),r.getFedBy(),userName(r.getRecordedBy()),r.getRecordedAt(),r.getLeftoverKg(),r.getNote(),r.getVoidReason(),planned,actual,lineViews,history);
    }
    private Map<String,Object> snapshot(FeedingRecord r,List<FeedingRecordLine> values){
        Map<String,Object> snapshot=new java.util.LinkedHashMap<>();snapshot.put("status",r.getStatus());snapshot.put("fedBy",r.getFedBy());snapshot.put("feedingTime",r.getFeedingTime());snapshot.put("leftoverKg",r.getLeftoverKg());snapshot.put("note",r.getNote());
        snapshot.put("lines",values.stream().map(l->Map.of("feedItemId",l.getFeedItem().getId(),"feedCode",l.getFeedCodeSnapshot(),"feedName",l.getFeedNameSnapshot(),"plannedKg",l.getPlannedKg(),"actualKg",l.getActualKg(),"unitCost",l.getCostPerKg(),"totalCost",l.getTotalCost())).toList());return snapshot;
    }
    private java.time.LocalTime sessionTime(FeedRationVersion ration,Integer sessionNo){
        if(ration!=null&&sessionNo<=ration.getSessionsPerDay()){
            String[] values=ration.getSessionTimes().split(",");int index=sessionNo-1;
            if(index>=0&&index<values.length)try{return java.time.LocalTime.parse(values[index]);}catch(RuntimeException ignored){/* use the documented default */}
        }
        return switch(sessionNo){case 1->java.time.LocalTime.of(6,30);case 2->java.time.LocalTime.of(16,30);default->java.time.LocalTime.of(20,0);};
    }
    private void validateSessionForRation(FeedRationVersion ration,Integer sessionNo){
        if(sessionNo==null||sessionNo<1||sessionNo>3||ration!=null&&sessionNo>ration.getSessionsPerDay())throw DomainException.invalid("sessionNo");
    }

    private record RationRestorePlan(FeedRationVersion predecessor,LocalDate effectiveTo,boolean effectiveToManuallySet,LocalDate successorSnapshotEnd,boolean successorSnapshotManuallySet) {}
    private void validateFeedingQuantity(BigDecimal value){if(value==null||value.signum()<0||value.stripTrailingZeros().scale()>1)throw DomainException.invalid("actualKg");}
    private void validateFeedingReason(String reason){if(reason==null||reason.trim().replaceAll("\\s+","").length()<5)throw DomainException.required("reason");if(reason.length()>500)throw DomainException.invalid("reason");}
    private static String sessionLabel(Integer sessionNo){return switch(sessionNo){case 1->"sáng";case 2->"chiều";case 3->"tối";default->String.valueOf(sessionNo);};}
    private ReceiptView view(FeedReceipt r){
        List<ReceiptLineView> content=lines.findByReceipt_IdOrderByIdAsc(r.getId()).stream()
            .map(l->new ReceiptLineView(l.getId(),l.getFeedItem().getId(),l.getFeedCodeSnapshot(),l.getFeedNameSnapshot(),l.getLotNumber(),l.getExpiryDate(),l.getQuantityPurchase(),l.getPurchaseUnit(),l.getKgReceived(),l.getUnitPrice(),l.getLineAmount())).toList();
        long goods=content.stream().mapToLong(ReceiptLineView::lineAmount).sum();
        long paid=payments.sumByFeedReceipt(r.getId(),PaymentRecordStatus.RECORDED);
        return new ReceiptView(r.getId(),r.getCode(),r.getReceiptDate(),r.getSupplier().getId(),r.getSupplier().getName(),
            r.getInvoiceNumber(),r.getReceivedBy(),r.getStorageLocation(),r.getNote(),r.getStatus(),goods,r.getTransportFee(),r.getTotalPayable(),
            paid,MoneyCalculator.outstanding(r.getTotalPayable(),paid),r.getInitialPaymentAmount(),r.getInitialPaymentMethod(),r.getInitialPaymentDate(),
            r.getPaymentDueDate(),MoneyCalculator.paymentState(r.getTotalPayable(),paid),r.getVersion(),
            userId(r.getCreatedBy()),userName(r.getCreatedBy()),r.getCreatedAt(),userId(r.getPostedBy()),userName(r.getPostedBy()),r.getPostedAt(),
            r.getVoidReason(),userId(r.getVoidedBy()),userName(r.getVoidedBy()),r.getVoidedAt(),content);
    }
    private StockView stockProjection(Long farmId,FeedItem f){BigDecimal daily=averageDailyUse(farmId,f.getId());BigDecimal cover=daily.signum()==0?null:f.getOnHandKg().divide(daily,1,RoundingMode.HALF_UP);FeedReceiptLine lot=lines.findByFeedItem_IdOrderByExpiryDateAsc(f.getId()).stream().filter(l->l.getExpiryDate()!=null&&!l.getExpiryDate().isBefore(clock.today())&&!l.getExpiryDate().isAfter(clock.today().plusDays(30))&&"POSTED".equals(l.getReceipt().getStatus())).findFirst().orElse(null);String status=f.getOnHandKg().signum()==0?"OUT_OF_STOCK":f.getMinimumStockKg()!=null&&f.getOnHandKg().compareTo(f.getMinimumStockKg())<=0?"LOW":"SUFFICIENT";return new StockView(f.getId(),f.getCode(),f.getName(),f.getFeedGroup(),f.getOnHandKg(),f.getMinimumStockKg(),daily,cover,f.getOnHandKg().multiply(f.getAvgUnitCost()).setScale(0,RoundingMode.HALF_UP),status,f.getVersion(),lot==null?null:lot.getLotNumber(),lot==null?null:lot.getExpiryDate());}
    private BigDecimal averageDailyUse(Long farmId,Long feedId){LocalDate today=clock.today();List<FeedingRecord> recent=feedingRecords.findByFarm_IdAndFeedingDateBetweenOrderByFeedingDateDescSessionNoAsc(farmId,today.minusDays(6),today).stream().filter(r->"VALID".equals(r.getStatus())).toList();BigDecimal total=recent.stream().flatMap(r->feedingLines.findByFeedingRecord_Id(r.getId()).stream()).filter(l->l.getFeedItem().getId().equals(feedId)).map(FeedingRecordLine::getActualKg).reduce(BigDecimal.ZERO,BigDecimal::add);return total.divide(BigDecimal.valueOf(7),3,RoundingMode.HALF_UP);}
    private BigDecimal toKg(FeedItem f,ReceiptLineRequest l){String requested=trim(l.purchaseUnit());String unit=requested==null?f.getStockUnit():requested;BigDecimal conversion;if(unit.equalsIgnoreCase("kg")||unit.equalsIgnoreCase(f.getStockUnit()))conversion=BigDecimal.ONE;else if(f.getPurchaseUnit()!=null&&unit.equalsIgnoreCase(f.getPurchaseUnit())&&f.getKgPerPurchaseUnit()!=null)conversion=f.getKgPerPurchaseUnit();else throw DomainException.invalid("purchaseUnit");BigDecimal kg=l.quantityPurchase().multiply(conversion).setScale(3,RoundingMode.HALF_UP);if(kg.signum()<=0)throw DomainException.invalid("quantityPurchase");return kg;}
    private static String trim(String v){return v==null||v.isBlank()?null:v.trim();}
    private static String normalizeFeedGroup(String value){
        if(value==null||value.isBlank())throw DomainException.required("feedGroup");
        String group=value.trim().toUpperCase(java.util.Locale.ROOT);
        if(!List.of("GREEN_ROUGHAGE","DRY_ROUGHAGE","CONCENTRATE","TMR","MINERAL_ADDITIVE","CALF_FEED").contains(group))throw DomainException.invalid("feedGroup");
        return group;
    }
    private static void validatePurchaseUnit(String unit,BigDecimal kgPerUnit){if(unit==null||unit.isBlank()){if(kgPerUnit!=null)throw DomainException.invalid("kgPerPurchaseUnit");return;}if(unit.equalsIgnoreCase("kg")){if(kgPerUnit!=null&&kgPerUnit.compareTo(BigDecimal.ONE)!=0)throw DomainException.invalid("kgPerPurchaseUnit");return;}if(kgPerUnit==null||kgPerUnit.signum()<=0)throw DomainException.required("kgPerPurchaseUnit");}
    private static FeedItemView feedView(FeedItem f){return new FeedItemView(f.getId(),f.getCode(),f.getName(),f.getFeedGroup(),f.getNutritionNote(),f.getPurchaseUnit(),f.getKgPerPurchaseUnit(),f.getStockUnit(),f.getOnHandKg(),f.getAvgUnitCost(),f.getMinimumStockKg(),f.getAvailable(),f.getVersion());}
    private static Long userId(AppUser user){return user==null?null:user.getId();}
    private static String userName(AppUser user){return user==null?null:user.getFullName();}
}
