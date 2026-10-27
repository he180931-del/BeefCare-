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
import vn.edu.fpt.beefcare.domain.PenReceptionCriteria;
import vn.edu.fpt.beefcare.repository.PenReceptionCriteriaRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.PenReceptionCriteria}.
 */
@RestController
@RequestMapping("/api/pen-reception-criteria")
@Transactional
public class PenReceptionCriteriaResource {

    private static final Logger LOG = LoggerFactory.getLogger(PenReceptionCriteriaResource.class);

    private static final String ENTITY_NAME = "penReceptionCriteria";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PenReceptionCriteriaRepository penReceptionCriteriaRepository;

    public PenReceptionCriteriaResource(PenReceptionCriteriaRepository penReceptionCriteriaRepository) {
        this.penReceptionCriteriaRepository = penReceptionCriteriaRepository;
    }

    /**
     * {@code POST  /pen-reception-criteria} : Create a new penReceptionCriteria.
     *
     * @param penReceptionCriteria the penReceptionCriteria to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new penReceptionCriteria, or with status {@code 400 (Bad Request)} if the penReceptionCriteria has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PenReceptionCriteria> createPenReceptionCriteria(@Valid @RequestBody PenReceptionCriteria penReceptionCriteria)
        throws URISyntaxException {
        LOG.debug("REST request to save PenReceptionCriteria : {}", penReceptionCriteria);
        if (penReceptionCriteria.getId() != null) {
            throw new BadRequestAlertException("A new penReceptionCriteria cannot already have an ID", ENTITY_NAME, "idexists");
        }
        penReceptionCriteria = penReceptionCriteriaRepository.save(penReceptionCriteria);
        return ResponseEntity.created(new URI("/api/pen-reception-criteria/" + penReceptionCriteria.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, penReceptionCriteria.getId().toString()))
            .body(penReceptionCriteria);
    }

    /**
     * {@code PUT  /pen-reception-criteria/:id} : Updates an existing penReceptionCriteria.
     *
     * @param id the id of the penReceptionCriteria to save.
     * @param penReceptionCriteria the penReceptionCriteria to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated penReceptionCriteria,
     * or with status {@code 400 (Bad Request)} if the penReceptionCriteria is not valid,
     * or with status {@code 500 (Internal Server Error)} if the penReceptionCriteria couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PenReceptionCriteria> updatePenReceptionCriteria(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PenReceptionCriteria penReceptionCriteria
    ) throws URISyntaxException {
        LOG.debug("REST request to update PenReceptionCriteria : {}, {}", id, penReceptionCriteria);
        if (penReceptionCriteria.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, penReceptionCriteria.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!penReceptionCriteriaRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        penReceptionCriteria = penReceptionCriteriaRepository.save(penReceptionCriteria);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, penReceptionCriteria.getId().toString()))
            .body(penReceptionCriteria);
    }

    /**
     * {@code PATCH  /pen-reception-criteria/:id} : Partial updates given fields of an existing penReceptionCriteria, field will ignore if it is null
     *
     * @param id the id of the penReceptionCriteria to save.
     * @param penReceptionCriteria the penReceptionCriteria to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated penReceptionCriteria,
     * or with status {@code 400 (Bad Request)} if the penReceptionCriteria is not valid,
     * or with status {@code 404 (Not Found)} if the penReceptionCriteria is not found,
     * or with status {@code 500 (Internal Server Error)} if the penReceptionCriteria couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PenReceptionCriteria> partialUpdatePenReceptionCriteria(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PenReceptionCriteria penReceptionCriteria
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update PenReceptionCriteria partially : {}, {}", id, penReceptionCriteria);
        if (penReceptionCriteria.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, penReceptionCriteria.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!penReceptionCriteriaRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PenReceptionCriteria> result = penReceptionCriteriaRepository
            .findById(penReceptionCriteria.getId())
            .map(existingPenReceptionCriteria -> {
                updateIfPresent(existingPenReceptionCriteria::setVersionNo, penReceptionCriteria.getVersionNo());
                updateIfPresent(existingPenReceptionCriteria::setAcceptedPurposes, penReceptionCriteria.getAcceptedPurposes());
                updateIfPresent(existingPenReceptionCriteria::setAcceptedStages, penReceptionCriteria.getAcceptedStages());
                updateIfPresent(existingPenReceptionCriteria::setThresholds, penReceptionCriteria.getThresholds());
                updateIfPresent(existingPenReceptionCriteria::setEffectiveFrom, penReceptionCriteria.getEffectiveFrom());

                return existingPenReceptionCriteria;
            })
            .map(penReceptionCriteriaRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, penReceptionCriteria.getId().toString())
        );
    }

    /**
     * {@code GET  /pen-reception-criteria} : get all the Pen Reception Criteria.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Pen Reception Criteria in body.
     */
    @GetMapping("")
    public List<PenReceptionCriteria> getAllPenReceptionCriterias() {
        LOG.debug("REST request to get all PenReceptionCriterias");
        return penReceptionCriteriaRepository.findAll();
    }

    /**
     * {@code GET  /pen-reception-criteria/:id} : get the "id" penReceptionCriteria.
     *
     * @param id the id of the penReceptionCriteria to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the penReceptionCriteria, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PenReceptionCriteria> getPenReceptionCriteria(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PenReceptionCriteria : {}", id);
        Optional<PenReceptionCriteria> penReceptionCriteria = penReceptionCriteriaRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(penReceptionCriteria);
    }

    /**
     * {@code DELETE  /pen-reception-criteria/:id} : delete the "id" penReceptionCriteria.
     *
     * @param id the id of the penReceptionCriteria to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePenReceptionCriteria(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PenReceptionCriteria : {}", id);
        penReceptionCriteriaRepository.deleteById(id);
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
