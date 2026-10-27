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
import vn.edu.fpt.beefcare.domain.CattleProfileChange;
import vn.edu.fpt.beefcare.repository.CattleProfileChangeRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.CattleProfileChange}.
 */
@RestController
@RequestMapping("/api/cattle-profile-changes")
@Transactional
public class CattleProfileChangeResource {

    private static final Logger LOG = LoggerFactory.getLogger(CattleProfileChangeResource.class);

    private static final String ENTITY_NAME = "cattleProfileChange";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final CattleProfileChangeRepository cattleProfileChangeRepository;

    public CattleProfileChangeResource(CattleProfileChangeRepository cattleProfileChangeRepository) {
        this.cattleProfileChangeRepository = cattleProfileChangeRepository;
    }

    /**
     * {@code POST  /cattle-profile-changes} : Create a new cattleProfileChange.
     *
     * @param cattleProfileChange the cattleProfileChange to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new cattleProfileChange, or with status {@code 400 (Bad Request)} if the cattleProfileChange has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<CattleProfileChange> createCattleProfileChange(@Valid @RequestBody CattleProfileChange cattleProfileChange)
        throws URISyntaxException {
        LOG.debug("REST request to save CattleProfileChange : {}", cattleProfileChange);
        if (cattleProfileChange.getId() != null) {
            throw new BadRequestAlertException("A new cattleProfileChange cannot already have an ID", ENTITY_NAME, "idexists");
        }
        cattleProfileChange = cattleProfileChangeRepository.save(cattleProfileChange);
        return ResponseEntity.created(new URI("/api/cattle-profile-changes/" + cattleProfileChange.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, cattleProfileChange.getId().toString()))
            .body(cattleProfileChange);
    }

    /**
     * {@code PUT  /cattle-profile-changes/:id} : Updates an existing cattleProfileChange.
     *
     * @param id the id of the cattleProfileChange to save.
     * @param cattleProfileChange the cattleProfileChange to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cattleProfileChange,
     * or with status {@code 400 (Bad Request)} if the cattleProfileChange is not valid,
     * or with status {@code 500 (Internal Server Error)} if the cattleProfileChange couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<CattleProfileChange> updateCattleProfileChange(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody CattleProfileChange cattleProfileChange
    ) throws URISyntaxException {
        LOG.debug("REST request to update CattleProfileChange : {}, {}", id, cattleProfileChange);
        if (cattleProfileChange.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cattleProfileChange.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cattleProfileChangeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        cattleProfileChange = cattleProfileChangeRepository.save(cattleProfileChange);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cattleProfileChange.getId().toString()))
            .body(cattleProfileChange);
    }

    /**
     * {@code PATCH  /cattle-profile-changes/:id} : Partial updates given fields of an existing cattleProfileChange, field will ignore if it is null
     *
     * @param id the id of the cattleProfileChange to save.
     * @param cattleProfileChange the cattleProfileChange to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cattleProfileChange,
     * or with status {@code 400 (Bad Request)} if the cattleProfileChange is not valid,
     * or with status {@code 404 (Not Found)} if the cattleProfileChange is not found,
     * or with status {@code 500 (Internal Server Error)} if the cattleProfileChange couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<CattleProfileChange> partialUpdateCattleProfileChange(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody CattleProfileChange cattleProfileChange
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update CattleProfileChange partially : {}, {}", id, cattleProfileChange);
        if (cattleProfileChange.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cattleProfileChange.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cattleProfileChangeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<CattleProfileChange> result = cattleProfileChangeRepository
            .findById(cattleProfileChange.getId())
            .map(existingCattleProfileChange -> {
                updateIfPresent(existingCattleProfileChange::setFieldName, cattleProfileChange.getFieldName());
                updateIfPresent(existingCattleProfileChange::setOldValue, cattleProfileChange.getOldValue());
                updateIfPresent(existingCattleProfileChange::setNewValue, cattleProfileChange.getNewValue());
                updateIfPresent(existingCattleProfileChange::setEffectiveDate, cattleProfileChange.getEffectiveDate());
                updateIfPresent(existingCattleProfileChange::setReason, cattleProfileChange.getReason());

                return existingCattleProfileChange;
            })
            .map(cattleProfileChangeRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cattleProfileChange.getId().toString())
        );
    }

    /**
     * {@code GET  /cattle-profile-changes} : get all the Cattle Profile Changes.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Cattle Profile Changes in body.
     */
    @GetMapping("")
    public List<CattleProfileChange> getAllCattleProfileChanges() {
        LOG.debug("REST request to get all CattleProfileChanges");
        return cattleProfileChangeRepository.findAll();
    }

    /**
     * {@code GET  /cattle-profile-changes/:id} : get the "id" cattleProfileChange.
     *
     * @param id the id of the cattleProfileChange to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the cattleProfileChange, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<CattleProfileChange> getCattleProfileChange(@PathVariable("id") Long id) {
        LOG.debug("REST request to get CattleProfileChange : {}", id);
        Optional<CattleProfileChange> cattleProfileChange = cattleProfileChangeRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(cattleProfileChange);
    }

    /**
     * {@code DELETE  /cattle-profile-changes/:id} : delete the "id" cattleProfileChange.
     *
     * @param id the id of the cattleProfileChange to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCattleProfileChange(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete CattleProfileChange : {}", id);
        cattleProfileChangeRepository.deleteById(id);
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
