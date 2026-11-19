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
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.repository.VaccineRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Vaccine}.
 */
@RestController
@RequestMapping("/api/vaccines")
@Transactional
public class VaccineResource {

    private static final Logger LOG = LoggerFactory.getLogger(VaccineResource.class);

    private static final String ENTITY_NAME = "vaccine";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final VaccineRepository vaccineRepository;

    public VaccineResource(VaccineRepository vaccineRepository) {
        this.vaccineRepository = vaccineRepository;
    }

    /**
     * {@code POST  /vaccines} : Create a new vaccine.
     *
     * @param vaccine the vaccine to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new vaccine, or with status {@code 400 (Bad Request)} if the vaccine has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Vaccine> createVaccine(@Valid @RequestBody Vaccine vaccine) throws URISyntaxException {
        LOG.debug("REST request to save Vaccine : {}", vaccine);
        if (vaccine.getId() != null) {
            throw new BadRequestAlertException("A new vaccine cannot already have an ID", ENTITY_NAME, "idexists");
        }
        vaccine = vaccineRepository.save(vaccine);
        return ResponseEntity.created(new URI("/api/vaccines/" + vaccine.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, vaccine.getId().toString()))
            .body(vaccine);
    }

    /**
     * {@code PUT  /vaccines/:id} : Updates an existing vaccine.
     *
     * @param id the id of the vaccine to save.
     * @param vaccine the vaccine to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated vaccine,
     * or with status {@code 400 (Bad Request)} if the vaccine is not valid,
     * or with status {@code 500 (Internal Server Error)} if the vaccine couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Vaccine> updateVaccine(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Vaccine vaccine
    ) throws URISyntaxException {
        LOG.debug("REST request to update Vaccine : {}, {}", id, vaccine);
        if (vaccine.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, vaccine.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!vaccineRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        vaccine = vaccineRepository.save(vaccine);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, vaccine.getId().toString()))
            .body(vaccine);
    }

    /**
     * {@code PATCH  /vaccines/:id} : Partial updates given fields of an existing vaccine, field will ignore if it is null
     *
     * @param id the id of the vaccine to save.
     * @param vaccine the vaccine to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated vaccine,
     * or with status {@code 400 (Bad Request)} if the vaccine is not valid,
     * or with status {@code 404 (Not Found)} if the vaccine is not found,
     * or with status {@code 500 (Internal Server Error)} if the vaccine couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Vaccine> partialUpdateVaccine(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Vaccine vaccine
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Vaccine partially : {}, {}", id, vaccine);
        if (vaccine.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, vaccine.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!vaccineRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Vaccine> result = vaccineRepository
            .findById(vaccine.getId())
            .map(existingVaccine -> {
                updateIfPresent(existingVaccine::setCode, vaccine.getCode());
                updateIfPresent(existingVaccine::setName, vaccine.getName());
                updateIfPresent(existingVaccine::setDiseasePrevented, vaccine.getDiseasePrevented());
                updateIfPresent(existingVaccine::setManufacturer, vaccine.getManufacturer());
                updateIfPresent(existingVaccine::setDose, vaccine.getDose());
                updateIfPresent(existingVaccine::setRoute, vaccine.getRoute());
                updateIfPresent(existingVaccine::setBoosterInterval, vaccine.getBoosterInterval());
                updateIfPresent(existingVaccine::setWithdrawalInfo, vaccine.getWithdrawalInfo());
                updateIfPresent(existingVaccine::setAvailable, vaccine.getAvailable());

                return existingVaccine;
            })
            .map(vaccineRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, vaccine.getId().toString())
        );
    }

    /**
     * {@code GET  /vaccines} : get all the Vaccines.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Vaccines in body.
     */
    @GetMapping("")
    public List<Vaccine> getAllVaccines() {
        LOG.debug("REST request to get all Vaccines");
        return vaccineRepository.findAll();
    }

    /**
     * {@code GET  /vaccines/:id} : get the "id" vaccine.
     *
     * @param id the id of the vaccine to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the vaccine, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Vaccine> getVaccine(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Vaccine : {}", id);
        Optional<Vaccine> vaccine = vaccineRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(vaccine);
    }

    /**
     * {@code DELETE  /vaccines/:id} : delete the "id" vaccine.
     *
     * @param id the id of the vaccine to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVaccine(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Vaccine : {}", id);
        vaccineRepository.deleteById(id);
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
