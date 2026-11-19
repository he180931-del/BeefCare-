package vn.edu.fpt.beefcare.web.rest;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.PublicLandingService;
import vn.edu.fpt.beefcare.service.PublicLandingService.LandingContent;
import vn.edu.fpt.beefcare.service.PlanPriceService.PriceVersion;

@RestController
@RequestMapping("/api/public")
public class PublicLandingResource {
    private final PublicLandingService landing;
    public PublicLandingResource(PublicLandingService landing) { this.landing = landing; }

    @GetMapping("/prices")
    public PriceVersion prices() { return landing.prices(); }

    @GetMapping("/landing")
    public LandingContent landing() { return landing.get(); }
}
