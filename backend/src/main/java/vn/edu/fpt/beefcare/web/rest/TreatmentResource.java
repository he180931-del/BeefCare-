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
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.repository.TreatmentRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Treatment}.
 */
@RestController
@RequestMapping("/api/treatments")
@Transactional
public class TreatmentResource {

    private static final Logger LOG = LoggerFactory.getLogger(TreatmentResource.class);

    private static final String ENTITY_NAME = "treatment";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final TreatmentRepository treatmentRepository;

    public TreatmentResource(TreatmentRepository treatmentRepository) {
        this.treatmentRepository = treatmentRepository;
    }

    /**
     * {@code POST  /treatments} : Create a new treatment.
     *
     * @param treatment the treatment to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new treatment, or with status {@code 400 (Bad Request)} if the treatment has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Treatment> createTreatment(@Valid @RequestBody Treatment treatment) throws URISyntaxException {
        LOG.debug("REST request to save Treatment : {}", treatment);
        if (treatment.getId() != null) {
            throw new BadRequestAlertException("A new treatment cannot already have an ID", ENTITY_NAME, "idexists");
        }
        treatment = treatmentRepository.save(treatment);
        return ResponseEntity.created(new URI("/api/treatments/" + treatment.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, treatment.getId().toString()))
            .body(treatment);
    }

    /**
     * {@code PUT  /treatments/:id} : Updates an existing treatment.
     *
     * @param id the id of the treatment to save.
     * @param treatment the treatment to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated treatment,
     * or with status {@code 400 (Bad Request)} if the treatment is not valid,
     * or with status {@code 500 (Internal Server Error)} if the treatment couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Treatment> updateTreatment(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Treatment treatment
    ) throws URISyntaxException {
        LOG.debug("REST request to update Treatment : {}, {}", id, treatment);
        if (treatment.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, treatment.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!treatmentRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        treatment = treatmentRepository.save(treatment);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, treatment.getId().toString()))
            .body(treatment);
    }

    /**
     * {@code PATCH  /treatments/:id} : Partial updates given fields of an existing treatment, field will ignore if it is null
     *
     * @param id the id of the treatment to save.
     * @param treatment the treatment to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated treatment,
     * or with status {@code 400 (Bad Request)} if the treatment is not valid,
     * or with status {@code 404 (Not Found)} if the treatment is not found,
     * or with status {@code 500 (Internal Server Error)} if the treatment couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Treatment> partialUpdateTreatment(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Treatment treatment
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Treatment partially : {}, {}", id, treatment);
        if (treatment.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, treatment.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!treatmentRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Treatment> result = treatmentRepository
            .findById(treatment.getId())
            .map(existingTreatment -> {
                updateIfPresent(existingTreatment::setTreatmentTime, treatment.getTreatmentTime());
                updateIfPresent(existingTreatment::setEntryTime, treatment.getEntryTime());
                updateIfPresent(existingTreatment::setTreatmentDetail, treatment.getTreatmentDetail());
                updateIfPresent(existingTreatment::setDose, treatment.getDose());
                updateIfPresent(existingTreatment::setRoute, treatment.getRoute());
                updateIfPresent(existingTreatment::setWithdrawalPeriod, treatment.getWithdrawalPeriod());
                updateIfPresent(existingTreatment::setResult, treatment.getResult());

                return existingTreatment;
            })
            .map(treatmentRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, treatment.getId().toString())
        );
    }

    /**
     * {@code GET  /treatments} : get all the Treatments.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Treatments in body.
     */
    @GetMapping("")
    public List<Treatment> getAllTreatments() {
        LOG.debug("REST request to get all Treatments");
        return treatmentRepository.findAll();
    }

    /**
     * {@code GET  /treatments/:id} : get the "id" treatment.
     *
     * @param id the id of the treatment to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the treatment, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Treatment> getTreatment(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Treatment : {}", id);
        Optional<Treatment> treatment = treatmentRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(treatment);
    }

    /**
     * {@code DELETE  /treatments/:id} : delete the "id" treatment.
     *
     * @param id the id of the treatment to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTreatment(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Treatment : {}", id);
        treatmentRepository.deleteById(id);
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
