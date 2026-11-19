package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.*;
import vn.edu.fpt.beefcare.service.dto.CattleDtos;

@RestController
@RequestMapping("/api/farms/{farmId}/cattle")
public class CattleProfileResource {
    private final CattleProfileService service;private final IdempotencyCommandService commands;private final CattleTimelineService timelines;
    public CattleProfileResource(CattleProfileService service,IdempotencyCommandService commands,CattleTimelineService timelines){this.service=service;this.commands=commands;this.timelines=timelines;}
    @GetMapping public CattleDtos.Page list(@PathVariable Long farmId,@RequestParam(required=false) String q,@RequestParam(required=false) String herdStatus,
        @RequestParam(required=false) Long breedId,@RequestParam(required=false) Sex sex,@RequestParam(required=false) Long penId,
        @RequestParam(required=false) Long purposeId,@RequestParam(required=false) LifeStage lifeStage,@RequestParam(required=false) String health,
        @RequestParam(required=false) String herdGroup,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size,@RequestParam(required=false) String sort){
        return service.list(farmId,q,herdStatus,breedId,sex,penId,purposeId,lifeStage,health,herdGroup,page,size,sort);
    }
    @GetMapping("/{id}") public CattleDtos.Profile get(@PathVariable Long farmId,@PathVariable Long id){return service.get(farmId,id);}
    @PutMapping("/{id}/profile") public CattleDtos.Profile update(@PathVariable Long farmId,@PathVariable Long id,@Valid @RequestBody CattleDtos.ProfileUpdate request,@RequestHeader("Idempotency-Key") String key){
        return commands.execute(farmId,FarmAction.MANAGE_CATTLE,"CATTLE_UPDATE:"+id,key,request,CattleDtos.Profile.class,()->service.update(farmId,id,request));
    }
    @GetMapping("/{id}/qr-tags") public List<CattleDtos.Tag> tags(@PathVariable Long farmId,@PathVariable Long id){return service.tags(farmId,id);}
    @GetMapping("/{id}/timeline") public List<CattleTimelineService.Event> timeline(@PathVariable Long farmId,@PathVariable Long id,@RequestParam(required=false) String category,@RequestParam(defaultValue="false") boolean showCorrections){return timelines.timeline(farmId,id,category,showCorrections);}
    @PostMapping("/{id}/qr-tags") public CattleDtos.Tag issue(@PathVariable Long farmId,@PathVariable Long id,@Valid @RequestBody CattleDtos.TagRequest request,@RequestHeader("Idempotency-Key") String key){
        return commands.execute(farmId,FarmAction.MANAGE_CATTLE,"CATTLE_TAG:"+id,key,request,CattleDtos.Tag.class,()->service.issueTag(farmId,id,request));
    }
    @GetMapping("/resolve") public CattleDtos.Resolved resolve(@PathVariable Long farmId,@RequestParam String code){return service.resolve(farmId,code);}
}
