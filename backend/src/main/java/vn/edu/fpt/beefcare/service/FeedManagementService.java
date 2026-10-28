package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
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

    public FeedManagementService(FarmAccessService access, FarmClock clock, FeedItemRepository feeds, TradingPartnerRepository partners,
        FeedReceiptRepository receipts, FeedReceiptLineRepository lines, FeedStockMovementRepository movements, OutboxService outbox,
        FeedRationVersionRepository rationVersions,FeedRationPenRepository rationPens,FeedRationComponentRepository rationComponents,
        PenRepository pens,PenAssignmentRepository assignments,FeedingRecordRepository feedingRecords,FeedingRecordLineRepository feedingLines,RecordRevisionService revisions,
        CodeSequenceService codes) {
        this.access=access; this.clock=clock; this.feeds=feeds; this.partners=partners; this.receipts=receipts; this.lines=lines; this.movements=movements; this.outbox=outbox;
        this.rationVersions=rationVersions;this.rationPens=rationPens;this.rationComponents=rationComponents;this.pens=pens;this.assignments=assignments;this.feedingRecords=feedingRecords;this.feedingLines=feedingLines;
        this.revisions=revisions;this.codes=codes;
    }

    @Transactional(readOnly=true)
    public List<StockView> stock(Long farmId) {
        access.require(farmId,FarmAction.VIEW_FEED);
        return feeds.findByFarm_IdOrderByNameAsc(farmId).stream().map(f->stockProjection(farmId,f)).toList();
    }

    @Transactional(readOnly=true)
    public List<ReceiptView> receipts(Long farmId) {
        access.require(farmId,FarmAction.MANAGE_FEED);
        return receipts.findByFarm_IdOrderByReceiptDateDescIdDesc(farmId).stream().map(this::view).toList();
    }

    @Transactional(readOnly=true)
    public List<FeedItemView> catalogue(Long farmId){access.require(farmId,FarmAction.VIEW_FEED);return feeds.findByFarm_IdOrderByNameAsc(farmId).stream().map(FeedManagementService::feedView).toList();}

    @Transactional
    public FeedItemView createFeedItem(Long farmId,FeedItemRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);String code=request.code().trim().toUpperCase(java.util.Locale.ROOT);
        if(feeds.existsByFarm_IdAndCodeIgnoreCase(farmId,code))throw DomainException.unprocessable(MessageCodes.COM_10,"field","code");validatePurchaseUnit(request.purchaseUnit(),request.kgPerPurchaseUnit());
        FeedItem f=new FeedItem();f.setFarm(ctx.farm());f.setCode(code);f.setName(request.name().trim());f.setFeedGroup(request.feedGroup().trim());f.setPurchaseUnit(trim(request.purchaseUnit()));f.setKgPerPurchaseUnit(request.kgPerPurchaseUnit());f.setMinimumStockKg(request.minimumStockKg());f.setAvailable(request.available());f.setStockUnit("kg");f.setOnHandKg(BigDecimal.ZERO.setScale(3));f.setAvgUnitCost(BigDecimal.ZERO.setScale(2));FeedItem saved=feeds.saveAndFlush(f);
        outbox.enqueue(farmId,"FEED_ITEM_CREATED","FeedItem",saved.getId(),Map.of("feedItemId",saved.getId()));return feedView(saved);
    }

    @Transactional
    public FeedItemView updateFeedItem(Long farmId,Long feedId,FeedItemRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);FeedItem f=feeds.lockByIdAndFarm(feedId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));VersionGuard.requireExpected(f.getVersion(),request.expectedVersion());String code=request.code().trim().toUpperCase(java.util.Locale.ROOT);validatePurchaseUnit(request.purchaseUnit(),request.kgPerPurchaseUnit());
        boolean referenced=movements.existsByFeedItem_Id(feedId)||rationComponents.existsByFeedItem_Id(feedId);
        if(referenced&&!f.getCode().equalsIgnoreCase(code))throw DomainException.conflict(MessageCodes.COM_05,"reason","feed_identity_is_in_use");
        if(!f.getCode().equalsIgnoreCase(code)&&feeds.existsByFarm_IdAndCodeIgnoreCase(farmId,code))throw DomainException.unprocessable(MessageCodes.COM_10,"field","code");
        f.setCode(code);f.setName(request.name().trim());f.setFeedGroup(request.feedGroup().trim());f.setPurchaseUnit(trim(request.purchaseUnit()));f.setKgPerPurchaseUnit(request.kgPerPurchaseUnit());f.setMinimumStockKg(request.minimumStockKg());f.setAvailable(request.available());FeedItem saved=feeds.saveAndFlush(f);
        outbox.enqueue(farmId,"FEED_ITEM_UPDATED","FeedItem",feedId,Map.of("feedItemId",feedId));return feedView(saved);
    }

    @Transactional(readOnly=true)
    public List<MovementView> movements(Long farmId, Long feedId) {
        access.require(farmId,FarmAction.VIEW_FEED);
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
        receipt.setTotalPayable(Math.addExact(goods,receipt.getTransportFee()));receipts.saveAndFlush(receipt);
        outbox.enqueue(ctx.farmId(),"FEED_RECEIPT_DRAFT_UPDATED","FeedReceipt",receiptId,Map.of("receiptId",receiptId));
        return view(receipt);
    }

    @Transactional
    public ReceiptView postReceipt(Long farmId, Long receiptId, Integer expectedVersion) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED); FeedReceipt r=receipts.lockByIdAndFarm(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(r.getVersion(),expectedVersion); post(r,ctx); receipts.saveAndFlush(r); return view(r);
    }

    private void post(FeedReceipt receipt,FarmContext ctx) {
        if(!"DRAFT".equals(receipt.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        List<FeedReceiptLine> receiptLines=lines.findByReceipt_IdOrderByIdAsc(receipt.getId()).stream().sorted(java.util.Comparator.comparing(l->l.getFeedItem().getId())).toList();
        if(receiptLines.isEmpty()) throw DomainException.required("lines");
        for(FeedReceiptLine line:receiptLines) {
            FeedItem feed=feeds.lockByIdAndFarm(line.getFeedItem().getId(),ctx.farmId()).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
            if(!Boolean.TRUE.equals(feed.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_08,"field","feedItemId");
            BigDecimal before=feed.getOnHandKg(); BigDecimal after=before.add(line.getKgReceived()).setScale(3,RoundingMode.HALF_UP);
            BigDecimal oldValue=before.multiply(feed.getAvgUnitCost()); BigDecimal receivedValue=BigDecimal.valueOf(line.getLineAmount());
            BigDecimal average=after.signum()==0?BigDecimal.ZERO:oldValue.add(receivedValue).divide(after,2,RoundingMode.HALF_UP);
            BigDecimal unitCost=line.getLineAmount()==0?BigDecimal.ZERO:BigDecimal.valueOf(line.getLineAmount()).divide(line.getKgReceived(),2,RoundingMode.HALF_UP);
            line.setUnitCostKg(unitCost); lines.save(line); feed.setOnHandKg(after); feed.setAvgUnitCost(average); feeds.saveAndFlush(feed);
            movement(ctx,feed,"RECEIPT",line.getKgReceived(),unitCost,"FEED_RECEIPT",receipt.getId());
        }
        receipt.setStatus("POSTED"); receipt.setPostedAt(clock.now());
        outbox.enqueue(ctx.farmId(),"FEED_RECEIPT_POSTED","FeedReceipt",receipt.getId(),Map.of("receiptId",receipt.getId()));
    }

    @Transactional
    public ReceiptView voidReceipt(Long farmId, Long receiptId, VoidReceiptRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED); FeedReceipt r=receipts.lockByIdAndFarm(receiptId,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(r.getVersion(),request.expectedVersion());
        if(!"POSTED".equals(r.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        List<FeedReceiptLine> receiptLines=lines.findByReceipt_IdOrderByIdAsc(r.getId()).stream().sorted(java.util.Comparator.comparing(l->l.getFeedItem().getId())).toList();
        List<FeedItem> locked=new ArrayList<>();
        for(FeedReceiptLine l:receiptLines){FeedItem f=feeds.lockByIdAndFarm(l.getFeedItem().getId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));if(f.getOnHandKg().compareTo(l.getKgReceived())<0)throw DomainException.unprocessable(MessageCodes.FE23_05,"receipt_code",r.getCode(),"feed",f.getName(),"stock",f.getOnHandKg());locked.add(f);}
        for(int i=0;i<receiptLines.size();i++){
            FeedReceiptLine l=receiptLines.get(i); FeedItem f=locked.get(i); BigDecimal after=f.getOnHandKg().subtract(l.getKgReceived());BigDecimal currentCost=f.getAvgUnitCost();
            // The SRS void gate is quantity coverage; reverse at current weighted average after subsequent consumption.
            f.setOnHandKg(after); if(after.signum()==0)f.setAvgUnitCost(BigDecimal.ZERO); feeds.saveAndFlush(f);
            movement(ctx,f,"RECEIPT_VOID",l.getKgReceived().negate(),currentCost,"FEED_RECEIPT",r.getId());
        }
        r.setStatus("VOIDED"); r.setVoidReason(request.reason().trim()); receipts.saveAndFlush(r);
        outbox.enqueue(ctx.farmId(),"FEED_RECEIPT_VOIDED","FeedReceipt",r.getId(),Map.of("receiptId",r.getId()));
        return view(r);
    }

    @Transactional(readOnly=true)
    public List<RationView> rations(Long farmId) {
        access.require(farmId,FarmAction.VIEW_FEED);
        return rationVersions.findByFarm_IdOrderByEffectiveFromDescVersionNoDesc(farmId).stream().map(this::rationView).toList();
    }

    @Transactional
    public RationView saveRation(Long farmId,SaveRationRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEED);
        LocalDate tomorrow=clock.today().plusDays(1);
        if(request.effectiveFrom().isBefore(tomorrow))throw DomainException.unprocessable(MessageCodes.COM_10,"field","effectiveFrom","minimum",tomorrow);
        if(request.sessionTimes().size()!=request.sessionsPerDay())throw DomainException.invalid("sessionTimes");
        String times=request.sessionTimes().stream().map(t->{try{return java.time.LocalTime.parse(t).toString();}catch(RuntimeException ex){throw DomainException.invalid("sessionTimes");}}).collect(java.util.stream.Collectors.joining(","));
        var penIds=request.penIds().stream().distinct().sorted().toList();if(penIds.size()!=request.penIds().size())throw DomainException.invalid("penIds");
        List<Pen> lockedPens=pens.lockAllByFarmIdAndIdIn(farmId,penIds);
        if(lockedPens.size()!=penIds.size()||lockedPens.stream().anyMatch(p->p.getStatus()!=ActiveStatus.ACTIVE))throw DomainException.notFound(MessageCodes.COM_08);
        String code=request.rationCode()==null||request.rationCode().isBlank()?String.format("KP-%02d",rationVersions.findByFarm_IdOrderByEffectiveFromDescVersionNoDesc(farmId).size()+1):request.rationCode().trim();
        List<FeedRationVersion> versions=rationVersions.findByFarm_IdAndRationCodeOrderByVersionNoDesc(farmId,code);
        int nextVersion=versions.isEmpty()?1:versions.get(0).getVersionNo()+1;
        List<RationComponentRequest> components=request.components();
        var componentIds=components.stream().map(RationComponentRequest::feedItemId).distinct().toList();if(componentIds.size()!=components.size())throw DomainException.invalid("components");
        List<FeedItem> componentFeeds=componentIds.stream().map(id->feeds.findByIdAndFarm_Id(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08))).toList();
        if(componentFeeds.stream().anyMatch(f->!Boolean.TRUE.equals(f.getAvailable())))throw DomainException.unprocessable(MessageCodes.COM_10,"field","components");
        for(RationComponentRequest c:components){if(c.session1Kg().signum()==0&&(request.sessionsPerDay()==1||c.session2Kg().signum()==0&&(request.sessionsPerDay()==2||c.session3Kg().signum()==0)))throw DomainException.invalid("components");if(request.sessionsPerDay()<2&&c.session2Kg().signum()>0||request.sessionsPerDay()<3&&c.session3Kg().signum()>0)throw DomainException.invalid("components");}
        FeedRationVersion version=new FeedRationVersion();version.setFarm(ctx.farm());version.setRationCode(code);version.setVersionNo(nextVersion);version.setName(request.name().trim());version.setHerdGroup(trim(request.herdGroup()));version.setBasis(trim(request.basis()));version.setEffectiveFrom(request.effectiveFrom());version.setStatus("SCHEDULED");version.setSessionsPerDay(request.sessionsPerDay());version.setSessionTimes(times);version.setCreatedBy(ctx.user());version.setCreatedAt(clock.now());rationVersions.saveAndFlush(version);
        for(Pen pen:lockedPens){
            LocalDate nextStart=null;
            for(FeedRationPen link:rationPens.findByPen_Id(pen.getId())){
                FeedRationVersion old=link.getRationVersion();if(!old.getFarm().getId().equals(farmId))continue;
                if(old.getEffectiveFrom().isEqual(request.effectiveFrom()))throw DomainException.conflict(MessageCodes.COM_05,"reason","ration_overlap");
                if(old.getEffectiveFrom().isBefore(request.effectiveFrom())&&(old.getEffectiveTo()==null||!old.getEffectiveTo().isBefore(request.effectiveFrom()))){old.setEffectiveTo(request.effectiveFrom().minusDays(1));if(!old.getEffectiveFrom().isAfter(clock.today()))old.setStatus("ENDED");}
                if(old.getEffectiveFrom().isAfter(request.effectiveFrom())&&(nextStart==null||old.getEffectiveFrom().isBefore(nextStart)))nextStart=old.getEffectiveFrom();
                rationVersions.save(old);
            }
            if(nextStart!=null)version.setEffectiveTo(nextStart.minusDays(1));
            FeedRationPen link=new FeedRationPen();link.setRationVersion(version);link.setPen(pen);rationPens.save(link);
        }
        for(RationComponentRequest c:components){FeedItem feed=componentFeeds.stream().filter(f->f.getId().equals(c.feedItemId())).findFirst().orElseThrow();FeedRationComponent component=new FeedRationComponent();component.setRationVersion(version);component.setFeedItem(feed);component.setFeedCodeSnapshot(feed.getCode());component.setFeedNameSnapshot(feed.getName());component.setSession1(c.session1Kg());component.setSession2(c.session2Kg());component.setSession3(c.session3Kg());rationComponents.save(component);}
        outbox.enqueue(farmId,"FEED_RATION_VERSION_SAVED","FeedRationVersion",version.getId(),Map.of("rationId",version.getId(),"versionNo",version.getVersionNo()));
        return rationView(version);
    }

    @Transactional
    public FeedingView recordFeeding(Long farmId,RecordFeedingRequest request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEEDING);clock.assertNotFuture(request.feedingDate());
        Pen pen=pens.findByIdAndFarmId(request.penId(),farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        if(pen.getStatus()!=ActiveStatus.ACTIVE)throw DomainException.conflict(MessageCodes.COM_05);
        pens.lockAllByFarmIdAndIdIn(farmId,List.of(pen.getId()));
        if(feedingRecords.findByFarm_IdAndPen_IdAndFeedingDateAndSessionNo(farmId,pen.getId(),request.feedingDate(),request.sessionNo()).isPresent())throw DomainException.conflict(MessageCodes.COM_05);
        FeedRationVersion ration=effectiveRation(farmId,pen.getId(),request.feedingDate());
        if(ration==null||request.sessionNo()>ration.getSessionsPerDay())throw DomainException.conflict(MessageCodes.COM_05,"reason","no_effective_ration");
        int headCount=Math.toIntExact(assignments.countAssignedAt(pen.getId(),request.feedingDate()));if(headCount<=0)throw DomainException.conflict(MessageCodes.COM_05,"reason","pen_empty");
        List<FeedRationComponent> components=rationComponents.findByRationVersion_Id(ration.getId());
        var requestedIds=request.lines().stream().map(FeedingLineRequest::feedItemId).distinct().toList();
        if(requestedIds.size()!=request.lines().size()||!requestedIds.containsAll(components.stream().map(c->c.getFeedItem().getId()).toList()))throw DomainException.invalid("lines");
        List<Long> ids=requestedIds.stream().sorted().toList();List<FeedItem> locked=new ArrayList<>();for(Long id:ids)locked.add(feeds.lockByIdAndFarm(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08)));
        FeedingRecord record=new FeedingRecord();record.setFarm(ctx.farm());record.setPen(pen);record.setRationVersion(ration);record.setFeedingDate(request.feedingDate());record.setSessionNo(request.sessionNo());record.setHeadCount(headCount);record.setFedBy(trim(request.fedBy()));record.setRecordedBy(ctx.user());record.setRecordedAt(clock.now());record=feedingRecords.saveAndFlush(record);
        List<FeedingLineView> result=new ArrayList<>();
        for(FeedRationComponent component:components){FeedItem feed=locked.stream().filter(f->f.getId().equals(component.getFeedItem().getId())).findFirst().orElseThrow();if(!Boolean.TRUE.equals(feed.getAvailable()))throw DomainException.unprocessable(MessageCodes.COM_10,"field","feedItemId");BigDecimal planned=component.sessionAmount(request.sessionNo()).multiply(BigDecimal.valueOf(headCount)).setScale(3,RoundingMode.HALF_UP);BigDecimal actual=request.lines().stream().filter(l->l.feedItemId().equals(feed.getId())).findFirst().orElseThrow().actualKg();if(feed.getOnHandKg().compareTo(actual)<0)throw DomainException.unprocessable(MessageCodes.COM_10,"field","actualKg");BigDecimal unitCost=feed.getAvgUnitCost();long cost=actual.multiply(unitCost).setScale(0,RoundingMode.HALF_UP).longValueExact();feed.setOnHandKg(feed.getOnHandKg().subtract(actual));feeds.saveAndFlush(feed);movement(ctx,feed,"FEEDING",actual.negate(),unitCost,"FEEDING_RECORD",record.getId());FeedingRecordLine line=new FeedingRecordLine();line.setFeedingRecord(record);line.setFeedItem(feed);line.setFeedCodeSnapshot(component.getFeedCodeSnapshot());line.setFeedNameSnapshot(component.getFeedNameSnapshot());line.setPlannedKg(planned);line.setActualKg(actual);line.setCostPerKg(unitCost);line.setTotalCost(cost);feedingLines.save(line);result.add(new FeedingLineView(feed.getId(),component.getFeedCodeSnapshot(),planned,actual,unitCost,cost));}
        outbox.enqueue(farmId,"FEEDING_RECORDED","FeedingRecord",record.getId(),Map.of("recordId",record.getId(),"penId",pen.getId()));
        return new FeedingView(record.getId(),pen.getId(),record.getFeedingDate(),record.getSessionNo(),headCount,"VALID",record.getVersion(),ration.getId(),result);
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
                    if(feedingRecords.findByFarm_IdAndPen_IdAndFeedingDateAndSessionNo(farmId,pen.getId(),today,i+1).filter(r->"VALID".equals(r.getStatus())).isPresent())continue;
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
        FeedingRecord record=feedingRecords.findById(recordId).filter(r->r.getFarm().getId().equals(farmId)).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(record.getVersion(),request.expectedVersion());
        if(!"VALID".equals(record.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        List<FeedingRecordLine> recordLines=feedingLines.findByFeedingRecord_Id(recordId);Map<String,Object> before=snapshot(record,recordLines);
        for(FeedingRecordLine line:recordLines.stream().sorted(java.util.Comparator.comparing(l->l.getFeedItem().getId())).toList()){
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
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FEEDING);FeedingRecord record=feedingRecords.findById(recordId).filter(r->r.getFarm().getId().equals(farmId)).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));VersionGuard.requireExpected(record.getVersion(),request.expectedVersion());if(!"VALID".equals(record.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        List<FeedingRecordLine> oldLines=feedingLines.findByFeedingRecord_Id(recordId);Map<Long,FeedingLineRequest> requested=new java.util.HashMap<>();for(FeedingLineRequest line:request.lines())if(requested.put(line.feedItemId(),line)!=null)throw DomainException.invalid("lines");if(requested.size()!=oldLines.size()||!requested.keySet().containsAll(oldLines.stream().map(l->l.getFeedItem().getId()).toList()))throw DomainException.invalid("lines");
        Map<String,Object> before=snapshot(record,oldLines);List<FeedItem> locked=oldLines.stream().map(l->l.getFeedItem().getId()).distinct().sorted().map(id->feeds.lockByIdAndFarm(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08))).toList();
        for(FeedingRecordLine line:oldLines){FeedItem feed=locked.stream().filter(f->f.getId().equals(line.getFeedItem().getId())).findFirst().orElseThrow();BigDecimal oldActual=line.getActualKg();BigDecimal newActual=requested.get(feed.getId()).actualKg();BigDecimal delta=newActual.subtract(oldActual).setScale(3,RoundingMode.HALF_UP);BigDecimal oldCost=line.getCostPerKg();BigDecimal currentCost=feed.getAvgUnitCost();if(delta.signum()>0&&feed.getOnHandKg().compareTo(delta)<0)throw DomainException.unprocessable(MessageCodes.COM_10,"field","actualKg");
            if(delta.signum()>0){feed.setOnHandKg(feed.getOnHandKg().subtract(delta));}else if(delta.signum()<0){BigDecimal returned=delta.negate();BigDecimal value=feed.getOnHandKg().multiply(currentCost).add(returned.multiply(oldCost));feed.setOnHandKg(feed.getOnHandKg().add(returned));feed.setAvgUnitCost(value.divide(feed.getOnHandKg(),2,RoundingMode.HALF_UP));}
            feeds.saveAndFlush(feed);if(delta.signum()!=0)movement(ctx,feed,"FEEDING_CORRECTION",delta.negate(),delta.signum()>0?currentCost:oldCost,"FEEDING_RECORD",recordId);
            BigDecimal retainedCost=oldActual.min(newActual).multiply(oldCost);BigDecimal addedCost=newActual.compareTo(oldActual)>0?delta.multiply(currentCost):BigDecimal.ZERO;BigDecimal totalValue=retainedCost.add(addedCost);BigDecimal unitCost=newActual.signum()==0?BigDecimal.ZERO:totalValue.divide(newActual,2,RoundingMode.HALF_UP);line.setActualKg(newActual);line.setCostPerKg(unitCost);line.setTotalCost(totalValue.setScale(0,RoundingMode.HALF_UP).longValueExact());feedingLines.save(line);
        }
        record.setFedBy(trim(request.fedBy()));feedingRecords.saveAndFlush(record);List<FeedingRecordLine> now=feedingLines.findByFeedingRecord_Id(recordId);revisions.record(ctx,"FeedingRecord",recordId,RecordRevisionService.CORRECT,request.reason(),before,snapshot(record,now));outbox.enqueue(farmId,"FEEDING_CORRECTED","FeedingRecord",recordId,Map.of("recordId",recordId));return feedingView(record);
    }

    private void movement(FarmContext ctx,FeedItem feed,String type,BigDecimal qty,BigDecimal unitCost,String source,Long sourceId){
        FeedStockMovement m=new FeedStockMovement();m.setFarm(ctx.farm());m.setFeedItem(feed);m.setMovementType(type);m.setQuantityKg(qty);m.setUnitCost(unitCost);m.setBalanceAfterKg(feed.getOnHandKg());m.setSourceType(source);m.setSourceId(sourceId);m.setOccurredAt(clock.now());m.setRecordedBy(ctx.user());movements.save(m);
    }
    private RationView rationView(FeedRationVersion v){
        String state=v.getEffectiveFrom().isAfter(clock.today())?"SCHEDULED":v.getEffectiveTo()!=null&&v.getEffectiveTo().isBefore(clock.today())?"ENDED":"EFFECTIVE";
        List<Long> penIds=rationPens.findByRationVersion_Id(v.getId()).stream().map(link->link.getPen().getId()).sorted().toList();
        List<RationComponentView> components=rationComponents.findByRationVersion_Id(v.getId()).stream().map(c->{BigDecimal daily=c.getSession1().add(c.getSession2()).add(c.getSession3());BigDecimal cost=daily.multiply(c.getFeedItem().getAvgUnitCost()).setScale(0,RoundingMode.HALF_UP);return new RationComponentView(c.getFeedItem().getId(),c.getFeedCodeSnapshot(),c.getFeedNameSnapshot(),c.getSession1(),c.getSession2(),c.getSession3(),daily,cost);}).toList();
        return new RationView(v.getId(),v.getRationCode(),v.getVersionNo(),v.getName(),v.getHerdGroup(),v.getBasis(),v.getEffectiveFrom(),v.getEffectiveTo(),state,v.getSessionsPerDay(),penIds,components);
    }
    private FeedRationVersion effectiveRation(Long farmId,Long penId,LocalDate day){
        return rationPens.findByPen_Id(penId).stream().map(FeedRationPen::getRationVersion).filter(v->v.getFarm().getId().equals(farmId)&&!v.getEffectiveFrom().isAfter(day)&&(v.getEffectiveTo()==null||!v.getEffectiveTo().isBefore(day))).max(java.util.Comparator.comparing(FeedRationVersion::getEffectiveFrom).thenComparing(FeedRationVersion::getVersionNo)).orElse(null);
    }
    private FeedingView feedingView(FeedingRecord r){List<FeedingLineView> row=feedingLines.findByFeedingRecord_Id(r.getId()).stream().map(l->new FeedingLineView(l.getFeedItem().getId(),l.getFeedCodeSnapshot(),l.getPlannedKg(),l.getActualKg(),l.getCostPerKg(),l.getTotalCost())).toList();return new FeedingView(r.getId(),r.getPen().getId(),r.getFeedingDate(),r.getSessionNo(),r.getHeadCount(),r.getStatus(),r.getVersion(),r.getRationVersion()==null?null:r.getRationVersion().getId(),row);}
    private Map<String,Object> snapshot(FeedingRecord r,List<FeedingRecordLine> values){return Map.of("status",r.getStatus(),"fedBy",r.getFedBy()==null?"":r.getFedBy(),"lines",values.stream().map(l->Map.of("feedItemId",l.getFeedItem().getId(),"plannedKg",l.getPlannedKg(),"actualKg",l.getActualKg(),"unitCost",l.getCostPerKg(),"totalCost",l.getTotalCost())).toList());}
    private ReceiptView view(FeedReceipt r){List<ReceiptLineView> content=lines.findByReceipt_IdOrderByIdAsc(r.getId()).stream().map(l->new ReceiptLineView(l.getId(),l.getFeedItem().getId(),l.getFeedCodeSnapshot(),l.getFeedNameSnapshot(),l.getLotNumber(),l.getExpiryDate(),l.getQuantityPurchase(),l.getPurchaseUnit(),l.getKgReceived(),l.getUnitPrice(),l.getLineAmount())).toList();long goods=content.stream().mapToLong(ReceiptLineView::lineAmount).sum();return new ReceiptView(r.getId(),r.getCode(),r.getReceiptDate(),r.getSupplier().getId(),r.getSupplier().getName(),r.getStatus(),goods,r.getTransportFee(),r.getTotalPayable(),r.getVersion(),content);}
    private StockView stockProjection(Long farmId,FeedItem f){BigDecimal daily=averageDailyUse(farmId,f.getId());BigDecimal cover=daily.signum()==0?null:f.getOnHandKg().divide(daily,1,RoundingMode.HALF_UP);FeedReceiptLine lot=lines.findByFeedItem_IdOrderByExpiryDateAsc(f.getId()).stream().filter(l->l.getExpiryDate()!=null&&!l.getExpiryDate().isBefore(clock.today())&&!l.getExpiryDate().isAfter(clock.today().plusDays(30))&&"POSTED".equals(l.getReceipt().getStatus())).findFirst().orElse(null);String status=f.getOnHandKg().signum()==0?"OUT_OF_STOCK":f.getMinimumStockKg()!=null&&f.getOnHandKg().compareTo(f.getMinimumStockKg())<=0?"LOW":"SUFFICIENT";return new StockView(f.getId(),f.getCode(),f.getName(),f.getFeedGroup(),f.getOnHandKg(),f.getMinimumStockKg(),daily,cover,f.getOnHandKg().multiply(f.getAvgUnitCost()).setScale(0,RoundingMode.HALF_UP),status,f.getVersion(),lot==null?null:lot.getLotNumber(),lot==null?null:lot.getExpiryDate());}
    private BigDecimal averageDailyUse(Long farmId,Long feedId){LocalDate today=clock.today();List<FeedingRecord> recent=feedingRecords.findByFarm_IdAndFeedingDateBetweenOrderByFeedingDateDescSessionNoAsc(farmId,today.minusDays(6),today).stream().filter(r->"VALID".equals(r.getStatus())).toList();BigDecimal total=recent.stream().flatMap(r->feedingLines.findByFeedingRecord_Id(r.getId()).stream()).filter(l->l.getFeedItem().getId().equals(feedId)).map(FeedingRecordLine::getActualKg).reduce(BigDecimal.ZERO,BigDecimal::add);return total.divide(BigDecimal.valueOf(7),3,RoundingMode.HALF_UP);}
    private BigDecimal toKg(FeedItem f,ReceiptLineRequest l){String requested=trim(l.purchaseUnit());String unit=requested==null?f.getStockUnit():requested;BigDecimal conversion;if(unit.equalsIgnoreCase("kg")||unit.equalsIgnoreCase(f.getStockUnit()))conversion=BigDecimal.ONE;else if(f.getPurchaseUnit()!=null&&unit.equalsIgnoreCase(f.getPurchaseUnit())&&f.getKgPerPurchaseUnit()!=null)conversion=f.getKgPerPurchaseUnit();else throw DomainException.invalid("purchaseUnit");BigDecimal kg=l.quantityPurchase().multiply(conversion).setScale(3,RoundingMode.HALF_UP);if(kg.signum()<=0)throw DomainException.invalid("quantityPurchase");return kg;}
    private static String trim(String v){return v==null||v.isBlank()?null:v.trim();}
    private static void validatePurchaseUnit(String unit,BigDecimal kgPerUnit){if(unit==null||unit.isBlank()){if(kgPerUnit!=null)throw DomainException.invalid("kgPerPurchaseUnit");return;}if(unit.equalsIgnoreCase("kg")){if(kgPerUnit!=null&&kgPerUnit.compareTo(BigDecimal.ONE)!=0)throw DomainException.invalid("kgPerPurchaseUnit");return;}if(kgPerUnit==null||kgPerUnit.signum()<=0)throw DomainException.required("kgPerPurchaseUnit");}
    private static FeedItemView feedView(FeedItem f){return new FeedItemView(f.getId(),f.getCode(),f.getName(),f.getFeedGroup(),f.getPurchaseUnit(),f.getKgPerPurchaseUnit(),f.getStockUnit(),f.getOnHandKg(),f.getAvgUnitCost(),f.getMinimumStockKg(),f.getAvailable(),f.getVersion());}
}
