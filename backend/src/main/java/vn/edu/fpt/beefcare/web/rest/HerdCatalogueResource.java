package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.*;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.*;

@RestController
@RequestMapping("/api/farms/{farmId}/catalogues")
public class HerdCatalogueResource {
    private final HerdCatalogueCommandService service;private final IdempotencyCommandService commands;
    public HerdCatalogueResource(HerdCatalogueCommandService service,IdempotencyCommandService commands){this.service=service;this.commands=commands;}
    @GetMapping("/breeds") public List<BreedView> breeds(@PathVariable Long farmId,@RequestParam(required=false) String q,@RequestParam(required=false) String status){return service.breeds(farmId,q,status);}
    @GetMapping("/production-purposes") public List<PurposeView> purposes(@PathVariable Long farmId,@RequestParam(required=false) String q,@RequestParam(required=false) String status){return service.purposes(farmId,q,status);}
    @PostMapping("/breeds") public BreedView createBreed(@PathVariable Long farmId,@Valid @RequestBody BreedWrite r,@RequestHeader("Idempotency-Key") String key){return commands.execute(farmId,FarmAction.MANAGE_CATALOGUES,"BREED_CREATE",key,r,BreedView.class,()->service.saveBreed(farmId,null,r));}
    @PutMapping("/breeds/{id}") public BreedView updateBreed(@PathVariable Long farmId,@PathVariable Long id,@Valid @RequestBody BreedWrite r,@RequestHeader("Idempotency-Key") String key){return commands.execute(farmId,FarmAction.MANAGE_CATALOGUES,"BREED_UPDATE:"+id,key,r,BreedView.class,()->service.saveBreed(farmId,id,r));}
    @PostMapping("/production-purposes") public PurposeView createPurpose(@PathVariable Long farmId,@Valid @RequestBody PurposeWrite r,@RequestHeader("Idempotency-Key") String key){return commands.execute(farmId,FarmAction.MANAGE_CATALOGUES,"PURPOSE_CREATE",key,r,PurposeView.class,()->service.savePurpose(farmId,null,r));}
    @PutMapping("/production-purposes/{id}") public PurposeView updatePurpose(@PathVariable Long farmId,@PathVariable Long id,@Valid @RequestBody PurposeWrite r,@RequestHeader("Idempotency-Key") String key){return commands.execute(farmId,FarmAction.MANAGE_CATALOGUES,"PURPOSE_UPDATE:"+id,key,r,PurposeView.class,()->service.savePurpose(farmId,id,r));}
}
