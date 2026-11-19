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
import vn.edu.fpt.beefcare.domain.PregnancyUpdate;
import vn.edu.fpt.beefcare.repository.PregnancyUpdateRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.PregnancyUpdate}.
 */
@RestController
@RequestMapping("/api/pregnancy-updates")
@Transactional
public class PregnancyUpdateResource {

    private static final Logger LOG = LoggerFactory.getLogger(PregnancyUpdateResource.class);

    private static final String ENTITY_NAME = "pregnancyUpdate";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PregnancyUpdateRepository pregnancyUpdateRepository;

    public PregnancyUpdateResource(PregnancyUpdateRepository pregnancyUpdateRepository) {
        this.pregnancyUpdateRepository = pregnancyUpdateRepository;
    }

    /**
     * {@code POST  /pregnancy-updates} : Create a new pregnancyUpdate.
     *
     * @param pregnancyUpdate the pregnancyUpdate to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new pregnancyUpdate, or with status {@code 400 (Bad Request)} if the pregnancyUpdate has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PregnancyUpdate> createPregnancyUpdate(@Valid @RequestBody PregnancyUpdate pregnancyUpdate)
        throws URISyntaxException {
        LOG.debug("REST request to save PregnancyUpdate : {}", pregnancyUpdate);
        if (pregnancyUpdate.getId() != null) {
            throw new BadRequestAlertException("A new pregnancyUpdate cannot already have an ID", ENTITY_NAME, "idexists");
        }
        pregnancyUpdate = pregnancyUpdateRepository.save(pregnancyUpdate);
        return ResponseEntity.created(new URI("/api/pregnancy-updates/" + pregnancyUpdate.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, pregnancyUpdate.getId().toString()))
            .body(pregnancyUpdate);
    }

    /**
     * {@code PUT  /pregnancy-updates/:id} : Updates an existing pregnancyUpdate.
     *
     * @param id the id of the pregnancyUpdate to save.
     * @param pregnancyUpdate the pregnancyUpdate to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated pregnancyUpdate,
     * or with status {@code 400 (Bad Request)} if the pregnancyUpdate is not valid,
     * or with status {@code 500 (Internal Server Error)} if the pregnancyUpdate couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PregnancyUpdate> updatePregnancyUpdate(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PregnancyUpdate pregnancyUpdate
    ) throws URISyntaxException {
        LOG.debug("REST request to update PregnancyUpdate : {}, {}", id, pregnancyUpdate);
        if (pregnancyUpdate.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, pregnancyUpdate.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!pregnancyUpdateRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        pregnancyUpdate = pregnancyUpdateRepository.save(pregnancyUpdate);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, pregnancyUpdate.getId().toString()))
            .body(pregnancyUpdate);
    }

    /**
     * {@code PATCH  /pregnancy-updates/:id} : Partial updates given fields of an existing pregnancyUpdate, field will ignore if it is null
     *
     * @param id the id of the pregnancyUpdate to save.
     * @param pregnancyUpdate the pregnancyUpdate to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated pregnancyUpdate,
     * or with status {@code 400 (Bad Request)} if the pregnancyUpdate is not valid,
     * or with status {@code 404 (Not Found)} if the pregnancyUpdate is not found,
     * or with status {@code 500 (Internal Server Error)} if the pregnancyUpdate couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PregnancyUpdate> partialUpdatePregnancyUpdate(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PregnancyUpdate pregnancyUpdate
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update PregnancyUpdate partially : {}, {}", id, pregnancyUpdate);
        if (pregnancyUpdate.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, pregnancyUpdate.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!pregnancyUpdateRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PregnancyUpdate> result = pregnancyUpdateRepository
            .findById(pregnancyUpdate.getId())
            .map(existingPregnancyUpdate -> {
                updateIfPresent(existingPregnancyUpdate::setType, pregnancyUpdate.getType());
                updateIfPresent(existingPregnancyUpdate::setOccurredTime, pregnancyUpdate.getOccurredTime());
                updateIfPresent(existingPregnancyUpdate::setDetails, pregnancyUpdate.getDetails());

                return existingPregnancyUpdate;
            })
            .map(pregnancyUpdateRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, pregnancyUpdate.getId().toString())
        );
    }

    /**
     * {@code GET  /pregnancy-updates} : get all the Pregnancy Updates.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Pregnancy Updates in body.
     */
    @GetMapping("")
    public List<PregnancyUpdate> getAllPregnancyUpdates() {
        LOG.debug("REST request to get all PregnancyUpdates");
        return pregnancyUpdateRepository.findAll();
    }

    /**
     * {@code GET  /pregnancy-updates/:id} : get the "id" pregnancyUpdate.
     *
     * @param id the id of the pregnancyUpdate to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the pregnancyUpdate, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PregnancyUpdate> getPregnancyUpdate(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PregnancyUpdate : {}", id);
        Optional<PregnancyUpdate> pregnancyUpdate = pregnancyUpdateRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(pregnancyUpdate);
    }

    /**
     * {@code DELETE  /pregnancy-updates/:id} : delete the "id" pregnancyUpdate.
     *
     * @param id the id of the pregnancyUpdate to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePregnancyUpdate(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PregnancyUpdate : {}", id);
        pregnancyUpdateRepository.deleteById(id);
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
