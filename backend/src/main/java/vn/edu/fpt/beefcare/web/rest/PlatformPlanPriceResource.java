package vn.edu.fpt.beefcare.web.rest;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.PlanPriceService;
import vn.edu.fpt.beefcare.service.PlanPriceService.*;

@RestController
@RequestMapping("/api/platform/plan-prices")
public class PlatformPlanPriceResource {
    private final PlanPriceService prices;
    private final IdempotencyCommandService commands;
    public PlatformPlanPriceResource(PlanPriceService prices, IdempotencyCommandService commands) { this.prices = prices; this.commands = commands; }
    @GetMapping
    public PricePage history(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return prices.history(page, size); }
    @PostMapping
    public PublishedPrice publish(@RequestBody PublishPriceRequest request,
        @Parameter(required = true, in = ParameterIn.HEADER) @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return commands.executePlatform(PlatformRole.PM, "PLAN_PRICE_PUBLISH", key, request, PublishedPrice.class, () -> prices.publish(request));
    }
    @PostMapping("/{version}/withdraw")
    public PublishedPrice withdraw(@PathVariable Long version, @RequestBody WithdrawPriceRequest request,
        @Parameter(required = true, in = ParameterIn.HEADER) @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        record Command(Long id, WithdrawPriceRequest request) {}
        return commands.executePlatform(PlatformRole.PM, "PLAN_PRICE_WITHDRAW", key, new Command(version, request), PublishedPrice.class, () -> prices.withdraw(version, request));
    }
}
