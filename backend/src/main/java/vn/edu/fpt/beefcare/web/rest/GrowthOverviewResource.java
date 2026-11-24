package vn.edu.fpt.beefcare.web.rest;

import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.service.GrowthOverviewService;

@RestController
@RequestMapping("/api/farms/{farmId}/growth")
public class GrowthOverviewResource {
    private final GrowthOverviewService service;
    public GrowthOverviewResource(GrowthOverviewService service){this.service=service;}
    /**
     * Danh sách tăng trưởng cấp đàn (SCR-23).
     *
     * @param flag lọc theo tình trạng: {@code WEIGHING_OVERDUE}, {@code LOW_ADG} hoặc {@code LOW_BCS} (D74); bỏ trống là tất cả
     */
    @GetMapping
    public GrowthOverviewService.Page list(
        @PathVariable Long farmId,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Long penId,
        @RequestParam(required = false) String herdGroup,
        @RequestParam(required = false) LifeStage lifeStage,
        @RequestParam(required = false) String flag,
        @RequestParam(defaultValue = "90") int windowDays,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size,
        @RequestParam(required = false) String sort
    ) {
        return service.list(farmId, q, penId, herdGroup, lifeStage, flag, windowDays, page, size, sort);
    }
}
