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
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.repository.HealthObservationRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.HealthObservation}.
 */
@RestController
@RequestMapping("/api/health-observations")
@Transactional
public class HealthObservationResource {

    private static final Logger LOG = LoggerFactory.getLogger(HealthObservationResource.class);

    private static final String ENTITY_NAME = "healthObservation";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final HealthObservationRepository healthObservationRepository;

    public HealthObservationResource(HealthObservationRepository healthObservationRepository) {
        this.healthObservationRepository = healthObservationRepository;
    }

    /**
     * {@code POST  /health-observations} : Create a new healthObservation.
     *
     * @param healthObservation the healthObservation to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new healthObservation, or with status {@code 400 (Bad Request)} if the healthObservation has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<HealthObservation> createHealthObservation(@Valid @RequestBody HealthObservation healthObservation)
        throws URISyntaxException {
        LOG.debug("REST request to save HealthObservation : {}", healthObservation);
        if (healthObservation.getId() != null) {
            throw new BadRequestAlertException("A new healthObservation cannot already have an ID", ENTITY_NAME, "idexists");
        }
        healthObservation = healthObservationRepository.save(healthObservation);
        return ResponseEntity.created(new URI("/api/health-observations/" + healthObservation.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, healthObservation.getId().toString()))
            .body(healthObservation);
    }

    /**
     * {@code PUT  /health-observations/:id} : Updates an existing healthObservation.
     *
     * @param id the id of the healthObservation to save.
     * @param healthObservation the healthObservation to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated healthObservation,
     * or with status {@code 400 (Bad Request)} if the healthObservation is not valid,
     * or with status {@code 500 (Internal Server Error)} if the healthObservation couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<HealthObservation> updateHealthObservation(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody HealthObservation healthObservation
    ) throws URISyntaxException {
        LOG.debug("REST request to update HealthObservation : {}, {}", id, healthObservation);
        if (healthObservation.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, healthObservation.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!healthObservationRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        healthObservation = healthObservationRepository.save(healthObservation);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, healthObservation.getId().toString()))
            .body(healthObservation);
    }

    /**
     * {@code PATCH  /health-observations/:id} : Partial updates given fields of an existing healthObservation, field will ignore if it is null
     *
     * @param id the id of the healthObservation to save.
     * @param healthObservation the healthObservation to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated healthObservation,
     * or with status {@code 400 (Bad Request)} if the healthObservation is not valid,
     * or with status {@code 404 (Not Found)} if the healthObservation is not found,
     * or with status {@code 500 (Internal Server Error)} if the healthObservation couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<HealthObservation> partialUpdateHealthObservation(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody HealthObservation healthObservation
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update HealthObservation partially : {}, {}", id, healthObservation);
        if (healthObservation.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, healthObservation.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!healthObservationRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<HealthObservation> result = healthObservationRepository
            .findById(healthObservation.getId())
            .map(existingHealthObservation -> {
                updateIfPresent(existingHealthObservation::setObservedTime, healthObservation.getObservedTime());
                updateIfPresent(existingHealthObservation::setEntryTime, healthObservation.getEntryTime());
                updateIfPresent(existingHealthObservation::setSignsProgress, healthObservation.getSignsProgress());
                updateIfPresent(existingHealthObservation::setSource, healthObservation.getSource());

                return existingHealthObservation;
            })
            .map(healthObservationRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, healthObservation.getId().toString())
        );
    }

    /**
     * {@code GET  /health-observations} : get all the Health Observations.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Health Observations in body.
     */
    @GetMapping("")
    public List<HealthObservation> getAllHealthObservations() {
        LOG.debug("REST request to get all HealthObservations");
        return healthObservationRepository.findAll();
    }

    /**
     * {@code GET  /health-observations/:id} : get the "id" healthObservation.
     *
     * @param id the id of the healthObservation to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the healthObservation, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<HealthObservation> getHealthObservation(@PathVariable("id") Long id) {
        LOG.debug("REST request to get HealthObservation : {}", id);
        Optional<HealthObservation> healthObservation = healthObservationRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(healthObservation);
    }

    /**
     * {@code DELETE  /health-observations/:id} : delete the "id" healthObservation.
     *
     * @param id the id of the healthObservation to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHealthObservation(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete HealthObservation : {}", id);
        healthObservationRepository.deleteById(id);
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
