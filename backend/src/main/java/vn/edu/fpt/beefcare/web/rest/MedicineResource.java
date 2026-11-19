package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.ResponseUtil;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.repository.MedicineRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Medicine}.
 */
@RestController
@RequestMapping("/api/medicines")
@Transactional
public class MedicineResource {

    private static final Logger LOG = LoggerFactory.getLogger(MedicineResource.class);

    private static final String ENTITY_NAME = "medicine";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final MedicineRepository medicineRepository;

    public MedicineResource(MedicineRepository medicineRepository) {
        this.medicineRepository = medicineRepository;
    }

    /**
     * {@code POST  /medicines} : Create a new medicine.
     *
     * @param medicine the medicine to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new medicine, or with status {@code 400 (Bad Request)} if the medicine has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Medicine> createMedicine(@Valid @RequestBody Medicine medicine) throws URISyntaxException {
        LOG.debug("REST request to save Medicine : {}", medicine);
        if (medicine.getId() != null) {
            throw new BadRequestAlertException("A new medicine cannot already have an ID", ENTITY_NAME, "idexists");
        }
        medicine = medicineRepository.save(medicine);
        return ResponseEntity.created(new URI("/api/medicines/" + medicine.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, medicine.getId().toString()))
            .body(medicine);
    }

    /**
     * {@code PUT  /medicines/:id} : Updates an existing medicine.
     *
     * @param id the id of the medicine to save.
     * @param medicine the medicine to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated medicine,
     * or with status {@code 400 (Bad Request)} if the medicine is not valid,
     * or with status {@code 500 (Internal Server Error)} if the medicine couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Medicine> updateMedicine(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Medicine medicine
    ) throws URISyntaxException {
        LOG.debug("REST request to update Medicine : {}, {}", id, medicine);
        if (medicine.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, medicine.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!medicineRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        medicine = medicineRepository.save(medicine);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, medicine.getId().toString()))
            .body(medicine);
    }

    /**
     * {@code PATCH  /medicines/:id} : Partial updates given fields of an existing medicine, field will ignore if it is null
     *
     * @param id the id of the medicine to save.
     * @param medicine the medicine to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated medicine,
     * or with status {@code 400 (Bad Request)} if the medicine is not valid,
     * or with status {@code 404 (Not Found)} if the medicine is not found,
     * or with status {@code 500 (Internal Server Error)} if the medicine couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Medicine> partialUpdateMedicine(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Medicine medicine
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Medicine partially : {}, {}", id, medicine);
        if (medicine.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, medicine.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!medicineRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Medicine> result = medicineRepository
            .findById(medicine.getId())
            .map(existingMedicine -> {
                updateIfPresent(existingMedicine::setCode, medicine.getCode());
                updateIfPresent(existingMedicine::setName, medicine.getName());
                updateIfPresent(existingMedicine::setDescription, medicine.getDescription());
                updateIfPresent(existingMedicine::setDose, medicine.getDose());
                updateIfPresent(existingMedicine::setRoute, medicine.getRoute());
                updateIfPresent(existingMedicine::setWithdrawalInfo, medicine.getWithdrawalInfo());
                updateIfPresent(existingMedicine::setAvailable, medicine.getAvailable());

                return existingMedicine;
            })
            .map(medicineRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, medicine.getId().toString())
        );
    }

    /**
     * {@code GET  /medicines} : get all the Medicines.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Medicines in body.
     */
    @GetMapping("")
    public List<Medicine> getAllMedicines() {
        LOG.debug("REST request to get all Medicines");
        return medicineRepository.findAll();
    }

    /**
     * {@code GET  /medicines/:id} : get the "id" medicine.
     *
     * @param id the id of the medicine to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the medicine, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Medicine> getMedicine(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Medicine : {}", id);
        Optional<Medicine> medicine = medicineRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(medicine);
    }

    /**
     * {@code DELETE  /medicines/:id} : delete the "id" medicine.
     *
     * @param id the id of the medicine to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMedicine(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Medicine : {}", id);
        medicineRepository.deleteById(id);
        return ResponseEntity.noContent()
            .headers(HeaderUtil.createEntityDeletionAlert(applicationName, false, ENTITY_NAME, id.toString()))
            .build();
    }

    private <T> void updateIfPresent(Consumer<T> setter, T value) {
        if (value != null) {
            setter.accept(value);
        }
    }
}
