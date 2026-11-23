package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.CareCatalogueCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Farm-scoped, versioned vaccine and medicine catalogue API (FE-18). */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class CareCatalogueCommandResource {
    private final CareCatalogueCommandService commands;
    public CareCatalogueCommandResource(CareCatalogueCommandService commands) { this.commands = commands; }

    @GetMapping("/vaccines")
    public List<CareDtos.CatalogueItem> vaccines(@PathVariable Long farmId) { return commands.vaccines(farmId); }

    @PostMapping("/vaccines")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.CatalogueItem createVaccine(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key,
                                                @Valid @RequestBody CareDtos.VaccineCommand request) {
        return commands.saveVaccine(farmId, null, key, request);
    }

    @PutMapping("/vaccines/{vaccineId}")
    public CareDtos.CatalogueItem updateVaccine(@PathVariable Long farmId, @PathVariable Long vaccineId,
                                                 @RequestHeader("Idempotency-Key") String key,
                                                 @Valid @RequestBody CareDtos.VaccineCommand request) {
        return commands.saveVaccine(farmId, vaccineId, key, request);
    }

    @DeleteMapping("/vaccines/{vaccineId}")
    public Boolean deleteVaccine(@PathVariable Long farmId, @PathVariable Long vaccineId,
                                 @RequestHeader("Idempotency-Key") String key,
                                 @RequestHeader("If-Match") Integer expectedVersion) {
        return commands.deleteUnusedVaccine(farmId, vaccineId, key, expectedVersion);
    }

    @GetMapping("/medicines")
    public List<CareDtos.CatalogueItem> medicines(@PathVariable Long farmId) { return commands.medicines(farmId); }

    @PostMapping("/medicines")
    @ResponseStatus(HttpStatus.CREATED)
    public CareDtos.CatalogueItem createMedicine(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key,
                                                  @Valid @RequestBody CareDtos.MedicineCommand request) {
        return commands.saveMedicine(farmId, null, key, request);
    }

    @PutMapping("/medicines/{medicineId}")
    public CareDtos.CatalogueItem updateMedicine(@PathVariable Long farmId, @PathVariable Long medicineId,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  @Valid @RequestBody CareDtos.MedicineCommand request) {
        return commands.saveMedicine(farmId, medicineId, key, request);
    }
}
