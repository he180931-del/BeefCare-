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
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Pen}.
 */
@RestController
@RequestMapping("/api/pens")
@Transactional
public class PenResource {

    private static final Logger LOG = LoggerFactory.getLogger(PenResource.class);

    private static final String ENTITY_NAME = "pen";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PenRepository penRepository;

    public PenResource(PenRepository penRepository) {
        this.penRepository = penRepository;
    }

    /**
     * {@code POST  /pens} : Create a new pen.
     *
     * @param pen the pen to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new pen, or with status {@code 400 (Bad Request)} if the pen has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Pen> createPen(@Valid @RequestBody Pen pen) throws URISyntaxException {
        LOG.debug("REST request to save Pen : {}", pen);
        if (pen.getId() != null) {
            throw new BadRequestAlertException("A new pen cannot already have an ID", ENTITY_NAME, "idexists");
        }
        pen = penRepository.save(pen);
        return ResponseEntity.created(new URI("/api/pens/" + pen.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, pen.getId().toString()))
            .body(pen);
    }

    /**
     * {@code PUT  /pens/:id} : Updates an existing pen.
     *
     * @param id the id of the pen to save.
     * @param pen the pen to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated pen,
     * or with status {@code 400 (Bad Request)} if the pen is not valid,
     * or with status {@code 500 (Internal Server Error)} if the pen couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Pen> updatePen(@PathVariable(value = "id", required = false) final Long id, @Valid @RequestBody Pen pen)
        throws URISyntaxException {
        LOG.debug("REST request to update Pen : {}, {}", id, pen);
        if (pen.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, pen.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!penRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        pen = penRepository.save(pen);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, pen.getId().toString()))
            .body(pen);
    }

    /**
     * {@code PATCH  /pens/:id} : Partial updates given fields of an existing pen, field will ignore if it is null
     *
     * @param id the id of the pen to save.
     * @param pen the pen to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated pen,
     * or with status {@code 400 (Bad Request)} if the pen is not valid,
     * or with status {@code 404 (Not Found)} if the pen is not found,
     * or with status {@code 500 (Internal Server Error)} if the pen couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Pen> partialUpdatePen(@PathVariable(value = "id", required = false) final Long id, @NotNull @RequestBody Pen pen)
        throws URISyntaxException {
        LOG.debug("REST request to partial update Pen partially : {}, {}", id, pen);
        if (pen.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, pen.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!penRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Pen> result = penRepository
            .findById(pen.getId())
            .map(existingPen -> {
                updateIfPresent(existingPen::setCode, pen.getCode());
                updateIfPresent(existingPen::setName, pen.getName());
                updateIfPresent(existingPen::setCapacity, pen.getCapacity());
                updateIfPresent(existingPen::setStatus, pen.getStatus());

                return existingPen;
            })
            .map(penRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, pen.getId().toString())
        );
    }

    /**
     * {@code GET  /pens} : get all the Pens.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Pens in body.
     */
    @GetMapping("")
    public List<Pen> getAllPens() {
        LOG.debug("REST request to get all Pens");
        return penRepository.findAll();
    }

    /**
     * {@code GET  /pens/:id} : get the "id" pen.
     *
     * @param id the id of the pen to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the pen, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Pen> getPen(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Pen : {}", id);
        Optional<Pen> pen = penRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(pen);
    }

    /**
     * {@code DELETE  /pens/:id} : delete the "id" pen.
     *
     * @param id the id of the pen to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePen(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Pen : {}", id);
        penRepository.deleteById(id);
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
