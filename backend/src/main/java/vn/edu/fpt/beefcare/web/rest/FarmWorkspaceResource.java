package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.FarmWorkspaceService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.*;

@RestController
@RequestMapping("/api/farms")
public class FarmWorkspaceResource {
    private final FarmWorkspaceService service;
    private final IdempotencyCommandService commands;
    public FarmWorkspaceResource(FarmWorkspaceService service,IdempotencyCommandService commands) { this.service=service;this.commands=commands; }
    @GetMapping public List<Summary> list() { return service.list(); }
    @PostMapping public ResponseEntity<Details> register(@Valid @RequestBody Registration request,@RequestHeader("Idempotency-Key") String key) {
        Details created=commands.execute(null,null,"FARM_REGISTER",key,request,Details.class,()->service.register(request));
        return ResponseEntity.created(URI.create("/api/farms/"+created.id())).body(created);
    }
    @GetMapping("/{farmId}") public Details get(@PathVariable Long farmId) { return service.get(farmId); }
    @PutMapping("/{farmId}") public Details update(@PathVariable Long farmId,@Valid @RequestBody Update request,@RequestHeader("Idempotency-Key") String key) {
        return commands.execute(farmId,FarmAction.MANAGE_FARM_INFORMATION,"FARM_UPDATE",key,request,Details.class,()->service.update(farmId,request));
    }
    @GetMapping("/{farmId}/context") public Summary context(@PathVariable Long farmId) { return service.context(farmId); }
    @GetMapping("/{farmId}/catalogues") public Catalogues catalogues(@PathVariable Long farmId) { return service.catalogues(farmId); }
}
