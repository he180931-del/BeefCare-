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
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.PenAssignment}.
 */
@RestController
@RequestMapping("/api/pen-assignments")
@Transactional
public class PenAssignmentResource {

    private static final Logger LOG = LoggerFactory.getLogger(PenAssignmentResource.class);

    private static final String ENTITY_NAME = "penAssignment";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PenAssignmentRepository penAssignmentRepository;

    public PenAssignmentResource(PenAssignmentRepository penAssignmentRepository) {
        this.penAssignmentRepository = penAssignmentRepository;
    }

    /**
     * {@code POST  /pen-assignments} : Create a new penAssignment.
     *
     * @param penAssignment the penAssignment to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new penAssignment, or with status {@code 400 (Bad Request)} if the penAssignment has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PenAssignment> createPenAssignment(@Valid @RequestBody PenAssignment penAssignment) throws URISyntaxException {
        LOG.debug("REST request to save PenAssignment : {}", penAssignment);
        if (penAssignment.getId() != null) {
            throw new BadRequestAlertException("A new penAssignment cannot already have an ID", ENTITY_NAME, "idexists");
        }
        penAssignment = penAssignmentRepository.save(penAssignment);
        return ResponseEntity.created(new URI("/api/pen-assignments/" + penAssignment.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, penAssignment.getId().toString()))
            .body(penAssignment);
    }

    /**
     * {@code PUT  /pen-assignments/:id} : Updates an existing penAssignment.
     *
     * @param id the id of the penAssignment to save.
     * @param penAssignment the penAssignment to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated penAssignment,
     * or with status {@code 400 (Bad Request)} if the penAssignment is not valid,
     * or with status {@code 500 (Internal Server Error)} if the penAssignment couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PenAssignment> updatePenAssignment(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PenAssignment penAssignment
    ) throws URISyntaxException {
        LOG.debug("REST request to update PenAssignment : {}, {}", id, penAssignment);
        if (penAssignment.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, penAssignment.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!penAssignmentRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        penAssignment = penAssignmentRepository.save(penAssignment);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, penAssignment.getId().toString()))
            .body(penAssignment);
    }

    /**
     * {@code PATCH  /pen-assignments/:id} : Partial updates given fields of an existing penAssignment, field will ignore if it is null
     *
     * @param id the id of the penAssignment to save.
     * @param penAssignment the penAssignment to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated penAssignment,
     * or with status {@code 400 (Bad Request)} if the penAssignment is not valid,
     * or with status {@code 404 (Not Found)} if the penAssignment is not found,
     * or with status {@code 500 (Internal Server Error)} if the penAssignment couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PenAssignment> partialUpdatePenAssignment(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PenAssignment penAssignment
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update PenAssignment partially : {}, {}", id, penAssignment);
        if (penAssignment.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, penAssignment.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!penAssignmentRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PenAssignment> result = penAssignmentRepository
            .findById(penAssignment.getId())
            .map(existingPenAssignment -> {
                updateIfPresent(existingPenAssignment::setEffectiveFrom, penAssignment.getEffectiveFrom());
                updateIfPresent(existingPenAssignment::setEffectiveTo, penAssignment.getEffectiveTo());
                updateIfPresent(existingPenAssignment::setSource, penAssignment.getSource());
                updateIfPresent(existingPenAssignment::setReason, penAssignment.getReason());

                return existingPenAssignment;
            })
            .map(penAssignmentRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, penAssignment.getId().toString())
        );
    }

    /**
     * {@code GET  /pen-assignments} : get all the Pen Assignments.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Pen Assignments in body.
     */
    @GetMapping("")
    public List<PenAssignment> getAllPenAssignments() {
        LOG.debug("REST request to get all PenAssignments");
        return penAssignmentRepository.findAll();
    }

    /**
     * {@code GET  /pen-assignments/:id} : get the "id" penAssignment.
     *
     * @param id the id of the penAssignment to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the penAssignment, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PenAssignment> getPenAssignment(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PenAssignment : {}", id);
        Optional<PenAssignment> penAssignment = penAssignmentRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(penAssignment);
    }

    /**
     * {@code DELETE  /pen-assignments/:id} : delete the "id" penAssignment.
     *
     * @param id the id of the penAssignment to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePenAssignment(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PenAssignment : {}", id);
        penAssignmentRepository.deleteById(id);
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
