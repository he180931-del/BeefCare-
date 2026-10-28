package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FeedManagementService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.*;

/** FE-23's durable feed stock, receipt and stock-adjustment APIs. */
@RestController
@RequestMapping("/api/farms/{farmId}/feed")
public class FeedManagementResource {
    private final FeedManagementService service;
    private final IdempotencyCommandService commands;

    public FeedManagementResource(FeedManagementService service, IdempotencyCommandService commands) { this.service=service; this.commands=commands; }

    @GetMapping("/stock")
    public List<StockView> stock(@PathVariable Long farmId) { return service.stock(farmId); }

    @GetMapping("/catalogue")
    public List<FeedItemView> catalogue(@PathVariable Long farmId){return service.catalogue(farmId);}

    @PostMapping("/catalogue")
    public ResponseEntity<FeedItemView> createFeedItem(@PathVariable Long farmId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody FeedItemRequest request){
        return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_ITEM_CREATE",key,request,FeedItemView.class,()->service.createFeedItem(farmId,request)));
    }

    @PutMapping("/catalogue/{feedId}")
    public ResponseEntity<FeedItemView> updateFeedItem(@PathVariable Long farmId,@PathVariable Long feedId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody FeedItemRequest request){
        record Command(Long feedId,FeedItemRequest body){}
        return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_ITEM_UPDATE:"+feedId,key,new Command(feedId,request),FeedItemView.class,()->service.updateFeedItem(farmId,feedId,request)));
    }

    @GetMapping("/stock/{feedId}/movements")
    public List<MovementView> movements(@PathVariable Long farmId,@PathVariable Long feedId) { return service.movements(farmId,feedId); }

    @GetMapping("/receipts")
    public List<ReceiptView> receipts(@PathVariable Long farmId) { return service.receipts(farmId); }

    @PostMapping("/receipts")
    public ResponseEntity<ReceiptView> createReceipt(@PathVariable Long farmId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody CreateReceiptRequest request) {
        ReceiptView result=commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_RECEIPT_CREATE",key,request,ReceiptView.class,()->service.createReceipt(farmId,request,request.postNow()));
        return ResponseEntity.ok(result);
    }

    @PutMapping("/receipts/{receiptId}/draft")
    public ResponseEntity<ReceiptView> updateDraftReceipt(@PathVariable Long farmId,@PathVariable Long receiptId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody UpdateDraftReceiptRequest request) {
        record Command(Long receiptId,UpdateDraftReceiptRequest body) {}
        ReceiptView result=commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_RECEIPT_DRAFT_UPDATE:"+receiptId,key,new Command(receiptId,request),ReceiptView.class,()->service.updateDraftReceipt(farmId,receiptId,request));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/receipts/{receiptId}/post")
    public ResponseEntity<ReceiptView> postReceipt(@PathVariable Long farmId,@PathVariable Long receiptId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody VersionRequest request) {
        record Command(Long receiptId,Integer expectedVersion) {}
        ReceiptView result=commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_RECEIPT_POST",key,new Command(receiptId,request.expectedVersion()),ReceiptView.class,()->service.postReceipt(farmId,receiptId,request.expectedVersion()));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/receipts/{receiptId}/void")
    public ResponseEntity<ReceiptView> voidReceipt(@PathVariable Long farmId,@PathVariable Long receiptId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody VoidReceiptRequest request) {
        record Command(Long receiptId,VoidReceiptRequest body) {}
        ReceiptView result=commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_RECEIPT_VOID",key,new Command(receiptId,request),ReceiptView.class,()->service.voidReceipt(farmId,receiptId,request));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/adjustments")
    public ResponseEntity<StockAdjustmentResult> adjust(@PathVariable Long farmId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody StockAdjustmentRequest request) {
        StockAdjustmentResult result=commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_STOCK_ADJUST",key,request,StockAdjustmentResult.class,()->new StockAdjustmentResult(service.adjust(farmId,request)));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/rations")
    public List<RationView> rations(@PathVariable Long farmId){return service.rations(farmId);}

    @PostMapping("/rations")
    public ResponseEntity<RationView> saveRation(@PathVariable Long farmId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody SaveRationRequest request){
        return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_RATION_SAVE",key,request,RationView.class,()->service.saveRation(farmId,request)));
    }

    @PostMapping("/feeding-records")
    public ResponseEntity<FeedingView> recordFeeding(@PathVariable Long farmId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody RecordFeedingRequest request){
        return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_FEEDING,"FEEDING_RECORD_CREATE",key,request,FeedingView.class,()->service.recordFeeding(farmId,request)));
    }

    @GetMapping("/feeding-records")
    public List<FeedingView> feedingLog(@PathVariable Long farmId,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return service.feedingLog(farmId,from,to);}

    @GetMapping("/reminders")
    public List<FeedReminderView> feedReminders(@PathVariable Long farmId){return service.feedReminders(farmId);}

    @PostMapping("/reports/consumption")
    public ResponseEntity<ConsumptionReport> consumptionReport(@PathVariable Long farmId,@Valid @RequestBody ConsumptionReportRequest request){return ResponseEntity.ok(service.consumptionReport(farmId,request));}

    @PostMapping("/feeding-records/{recordId}/void")
    public ResponseEntity<FeedingView> voidFeeding(@PathVariable Long farmId,@PathVariable Long recordId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody FeedingVoidRequest request){
        record Command(Long recordId,FeedingVoidRequest body){}
        return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_FEEDING,"FEEDING_RECORD_VOID:"+recordId,key,new Command(recordId,request),FeedingView.class,()->service.voidFeeding(farmId,recordId,request)));
    }

    @PostMapping("/feeding-records/{recordId}/correct")
    public ResponseEntity<FeedingView> correctFeeding(@PathVariable Long farmId,@PathVariable Long recordId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody FeedingCorrectionRequest request){
        record Command(Long recordId,FeedingCorrectionRequest body){}
        return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_FEEDING,"FEEDING_RECORD_CORRECT:"+recordId,key,new Command(recordId,request),FeedingView.class,()->service.correctFeeding(farmId,recordId,request)));
    }
}
