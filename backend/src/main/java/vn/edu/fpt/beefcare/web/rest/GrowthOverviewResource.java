package vn.edu.fpt.beefcare.web.rest;

import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.service.GrowthOverviewService;

@RestController
@RequestMapping("/api/farms/{farmId}/growth")
public class GrowthOverviewResource {
    private final GrowthOverviewService service;
    public GrowthOverviewResource(GrowthOverviewService service){this.service=service;}
    @GetMapping public GrowthOverviewService.Page list(@PathVariable Long farmId,@RequestParam(required=false) String q,
        @RequestParam(required=false) Long penId,@RequestParam(required=false) String herdGroup,@RequestParam(required=false) LifeStage lifeStage,
        @RequestParam(defaultValue="90") int windowDays,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size,@RequestParam(required=false) String sort) {
        return service.list(farmId,q,penId,herdGroup,lifeStage,windowDays,page,size,sort);
    }
}
