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
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.PlanVersion}.
 */
@RestController
@RequestMapping("/api/plan-versions")
@Transactional
public class PlanVersionResource {

    private static final Logger LOG = LoggerFactory.getLogger(PlanVersionResource.class);

    private static final String ENTITY_NAME = "planVersion";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PlanVersionRepository planVersionRepository;

    public PlanVersionResource(PlanVersionRepository planVersionRepository) {
        this.planVersionRepository = planVersionRepository;
    }

    /**
     * {@code POST  /plan-versions} : Create a new planVersion.
     *
     * @param planVersion the planVersion to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new planVersion, or with status {@code 400 (Bad Request)} if the planVersion has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PlanVersion> createPlanVersion(@Valid @RequestBody PlanVersion planVersion) throws URISyntaxException {
        LOG.debug("REST request to save PlanVersion : {}", planVersion);
        if (planVersion.getId() != null) {
            throw new BadRequestAlertException("A new planVersion cannot already have an ID", ENTITY_NAME, "idexists");
        }
        planVersion = planVersionRepository.save(planVersion);
        return ResponseEntity.created(new URI("/api/plan-versions/" + planVersion.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, planVersion.getId().toString()))
            .body(planVersion);
    }

    /**
     * {@code PUT  /plan-versions/:id} : Updates an existing planVersion.
     *
     * @param id the id of the planVersion to save.
     * @param planVersion the planVersion to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated planVersion,
     * or with status {@code 400 (Bad Request)} if the planVersion is not valid,
     * or with status {@code 500 (Internal Server Error)} if the planVersion couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PlanVersion> updatePlanVersion(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PlanVersion planVersion
    ) throws URISyntaxException {
        LOG.debug("REST request to update PlanVersion : {}, {}", id, planVersion);
        if (planVersion.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, planVersion.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!planVersionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        planVersion = planVersionRepository.save(planVersion);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, planVersion.getId().toString()))
            .body(planVersion);
    }

    /**
     * {@code PATCH  /plan-versions/:id} : Partial updates given fields of an existing planVersion, field will ignore if it is null
     *
     * @param id the id of the planVersion to save.
     * @param planVersion the planVersion to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated planVersion,
     * or with status {@code 400 (Bad Request)} if the planVersion is not valid,
     * or with status {@code 404 (Not Found)} if the planVersion is not found,
     * or with status {@code 500 (Internal Server Error)} if the planVersion couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PlanVersion> partialUpdatePlanVersion(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PlanVersion planVersion
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update PlanVersion partially : {}, {}", id, planVersion);
        if (planVersion.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, planVersion.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!planVersionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PlanVersion> result = planVersionRepository
            .findById(planVersion.getId())
            .map(existingPlanVersion -> {
                updateIfPresent(existingPlanVersion::setPrice1y, planVersion.getPrice1y());
                updateIfPresent(existingPlanVersion::setPrice2y, planVersion.getPrice2y());
                updateIfPresent(existingPlanVersion::setPrice3y, planVersion.getPrice3y());
                updateIfPresent(existingPlanVersion::setTerms, planVersion.getTerms());
                updateIfPresent(existingPlanVersion::setEffectiveAt, planVersion.getEffectiveAt());

                return existingPlanVersion;
            })
            .map(planVersionRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, planVersion.getId().toString())
        );
    }

    /**
     * {@code GET  /plan-versions} : get all the Plan Versions.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Plan Versions in body.
     */
    @GetMapping("")
    public List<PlanVersion> getAllPlanVersions() {
        LOG.debug("REST request to get all PlanVersions");
        return planVersionRepository.findAll();
    }

    /**
     * {@code GET  /plan-versions/:id} : get the "id" planVersion.
     *
     * @param id the id of the planVersion to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the planVersion, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PlanVersion> getPlanVersion(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PlanVersion : {}", id);
        Optional<PlanVersion> planVersion = planVersionRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(planVersion);
    }

    /**
     * {@code DELETE  /plan-versions/:id} : delete the "id" planVersion.
     *
     * @param id the id of the planVersion to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlanVersion(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PlanVersion : {}", id);
        planVersionRepository.deleteById(id);
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
