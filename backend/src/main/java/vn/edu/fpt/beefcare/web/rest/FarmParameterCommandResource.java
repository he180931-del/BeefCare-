package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.FarmParameterCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** FE-18 immutable farm-parameter version command. */
@RestController
@RequestMapping("/api/farms/{farmId}/parameters")
public class FarmParameterCommandResource {
    private final FarmParameterCommandService commands;
    public FarmParameterCommandResource(FarmParameterCommandService commands) { this.commands = commands; }

    @PostMapping("/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.ParameterVersionResult create(@PathVariable Long farmId,
                                                   @RequestHeader("Idempotency-Key") String key,
                                                   @Valid @RequestBody CareDtos.ParameterVersionCommand request) {
        return commands.create(farmId, key, request);
    }

    @GetMapping("/effective")
    public Map<String, Object> effective(@PathVariable Long farmId, @RequestParam(required = false) LocalDate date) {
        return commands.effective(farmId, date);
    }

    @GetMapping("/versions")
    public List<CareDtos.ParameterVersionResult> list(@PathVariable Long farmId) {
        return commands.list(farmId);
    }
}
