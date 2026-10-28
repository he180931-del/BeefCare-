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
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.repository.HealthCaseRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.HealthCase}.
 */
@RestController
@RequestMapping("/api/health-cases")
@Transactional
public class HealthCaseResource {

    private static final Logger LOG = LoggerFactory.getLogger(HealthCaseResource.class);

    private static final String ENTITY_NAME = "healthCase";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final HealthCaseRepository healthCaseRepository;

    public HealthCaseResource(HealthCaseRepository healthCaseRepository) {
        this.healthCaseRepository = healthCaseRepository;
    }

    /**
     * {@code POST  /health-cases} : Create a new healthCase.
     *
     * @param healthCase the healthCase to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new healthCase, or with status {@code 400 (Bad Request)} if the healthCase has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<HealthCase> createHealthCase(@Valid @RequestBody HealthCase healthCase) throws URISyntaxException {
        LOG.debug("REST request to save HealthCase : {}", healthCase);
        if (healthCase.getId() != null) {
            throw new BadRequestAlertException("A new healthCase cannot already have an ID", ENTITY_NAME, "idexists");
        }
        healthCase = healthCaseRepository.save(healthCase);
        return ResponseEntity.created(new URI("/api/health-cases/" + healthCase.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, healthCase.getId().toString()))
            .body(healthCase);
    }

    /**
     * {@code PUT  /health-cases/:id} : Updates an existing healthCase.
     *
     * @param id the id of the healthCase to save.
     * @param healthCase the healthCase to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated healthCase,
     * or with status {@code 400 (Bad Request)} if the healthCase is not valid,
     * or with status {@code 500 (Internal Server Error)} if the healthCase couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<HealthCase> updateHealthCase(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody HealthCase healthCase
    ) throws URISyntaxException {
        LOG.debug("REST request to update HealthCase : {}, {}", id, healthCase);
        if (healthCase.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, healthCase.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!healthCaseRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        healthCase = healthCaseRepository.save(healthCase);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, healthCase.getId().toString()))
            .body(healthCase);
    }

    /**
     * {@code PATCH  /health-cases/:id} : Partial updates given fields of an existing healthCase, field will ignore if it is null
     *
     * @param id the id of the healthCase to save.
     * @param healthCase the healthCase to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated healthCase,
     * or with status {@code 400 (Bad Request)} if the healthCase is not valid,
     * or with status {@code 404 (Not Found)} if the healthCase is not found,
     * or with status {@code 500 (Internal Server Error)} if the healthCase couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<HealthCase> partialUpdateHealthCase(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody HealthCase healthCase
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update HealthCase partially : {}, {}", id, healthCase);
        if (healthCase.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, healthCase.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!healthCaseRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<HealthCase> result = healthCaseRepository
            .findById(healthCase.getId())
            .map(existingHealthCase -> {
                updateIfPresent(existingHealthCase::setOpenedDate, healthCase.getOpenedDate());
                updateIfPresent(existingHealthCase::setStatus, healthCase.getStatus());
                updateIfPresent(existingHealthCase::setOutcome, healthCase.getOutcome());
                updateIfPresent(existingHealthCase::setClosedDate, healthCase.getClosedDate());

                return existingHealthCase;
            })
            .map(healthCaseRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, healthCase.getId().toString())
        );
    }

    /**
     * {@code GET  /health-cases} : get all the Health Cases.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Health Cases in body.
     */
    @GetMapping("")
    public List<HealthCase> getAllHealthCases() {
        LOG.debug("REST request to get all HealthCases");
        return healthCaseRepository.findAll();
    }

    /**
     * {@code GET  /health-cases/:id} : get the "id" healthCase.
     *
     * @param id the id of the healthCase to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the healthCase, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<HealthCase> getHealthCase(@PathVariable("id") Long id) {
        LOG.debug("REST request to get HealthCase : {}", id);
        Optional<HealthCase> healthCase = healthCaseRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(healthCase);
    }

    /**
     * {@code DELETE  /health-cases/:id} : delete the "id" healthCase.
     *
     * @param id the id of the healthCase to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHealthCase(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete HealthCase : {}", id);
        healthCaseRepository.deleteById(id);
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
