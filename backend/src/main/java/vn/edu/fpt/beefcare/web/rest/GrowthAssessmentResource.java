package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.*;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

@RestController
@RequestMapping("/api/farms/{farmId}/cattle/{cattleId}/growth")
public class GrowthAssessmentResource {
    private final GrowthAssessmentService service;private final IdempotencyCommandService commands;
    public GrowthAssessmentResource(GrowthAssessmentService service,IdempotencyCommandService commands){this.service=service;this.commands=commands;}
    @GetMapping public GrowthDtos.Summary history(@PathVariable Long farmId,@PathVariable Long cattleId,@RequestParam(defaultValue="90") int windowDays){return service.history(farmId,cattleId,windowDays);}
    @PostMapping public GrowthDtos.Record record(@PathVariable Long farmId,@PathVariable Long cattleId,@Valid @RequestBody GrowthDtos.Measurement request,@RequestHeader("Idempotency-Key") String key){
        return commands.execute(farmId,FarmAction.MANAGE_GROWTH,"GROWTH_CREATE:"+cattleId,key,request,GrowthDtos.Record.class,()->service.record(farmId,cattleId,request));
    }
    @PostMapping("/{id}/correction") public GrowthDtos.Record correct(@PathVariable Long farmId,@PathVariable Long cattleId,@PathVariable Long id,@Valid @RequestBody GrowthDtos.Correction request,@RequestHeader("Idempotency-Key") String key){
        return commands.execute(farmId,FarmAction.MANAGE_GROWTH,"GROWTH_CORRECT:"+id,key,request,GrowthDtos.Record.class,()->service.correct(farmId,cattleId,id,request));
    }
}
