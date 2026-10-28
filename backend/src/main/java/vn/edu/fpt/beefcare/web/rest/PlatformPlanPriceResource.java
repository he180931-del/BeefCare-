package vn.edu.fpt.beefcare.web.rest;

import java.util.List;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.PlanPriceService;
import vn.edu.fpt.beefcare.service.PlanPriceService.PriceVersion;
import vn.edu.fpt.beefcare.service.PlanPriceService.PublishPriceRequest;

@RestController
@RequestMapping("/api/platform/plan-prices")
public class PlatformPlanPriceResource {
    private final PlanPriceService prices;
    public PlatformPlanPriceResource(PlanPriceService prices) { this.prices = prices; }

    @GetMapping
    public List<PriceVersion> history() { return prices.history(); }

    @PostMapping
    public PriceVersion publish(@RequestBody PublishPriceRequest request) { return prices.publish(request); }
}
