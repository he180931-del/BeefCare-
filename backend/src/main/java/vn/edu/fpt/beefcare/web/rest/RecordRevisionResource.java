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
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.RecordRevision}.
 */
@RestController
@RequestMapping("/api/record-revisions")
@Transactional
public class RecordRevisionResource {

    private static final Logger LOG = LoggerFactory.getLogger(RecordRevisionResource.class);

    private static final String ENTITY_NAME = "recordRevision";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final RecordRevisionRepository recordRevisionRepository;

    public RecordRevisionResource(RecordRevisionRepository recordRevisionRepository) {
        this.recordRevisionRepository = recordRevisionRepository;
    }

    /**
     * {@code POST  /record-revisions} : Create a new recordRevision.
     *
     * @param recordRevision the recordRevision to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new recordRevision, or with status {@code 400 (Bad Request)} if the recordRevision has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<RecordRevision> createRecordRevision(@Valid @RequestBody RecordRevision recordRevision)
        throws URISyntaxException {
        LOG.debug("REST request to save RecordRevision : {}", recordRevision);
        if (recordRevision.getId() != null) {
            throw new BadRequestAlertException("A new recordRevision cannot already have an ID", ENTITY_NAME, "idexists");
        }
        recordRevision = recordRevisionRepository.save(recordRevision);
        return ResponseEntity.created(new URI("/api/record-revisions/" + recordRevision.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, recordRevision.getId().toString()))
            .body(recordRevision);
    }

    /**
     * {@code PUT  /record-revisions/:id} : Updates an existing recordRevision.
     *
     * @param id the id of the recordRevision to save.
     * @param recordRevision the recordRevision to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated recordRevision,
     * or with status {@code 400 (Bad Request)} if the recordRevision is not valid,
     * or with status {@code 500 (Internal Server Error)} if the recordRevision couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<RecordRevision> updateRecordRevision(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody RecordRevision recordRevision
    ) throws URISyntaxException {
        LOG.debug("REST request to update RecordRevision : {}, {}", id, recordRevision);
        if (recordRevision.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, recordRevision.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!recordRevisionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        recordRevision = recordRevisionRepository.save(recordRevision);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, recordRevision.getId().toString()))
            .body(recordRevision);
    }

    /**
     * {@code PATCH  /record-revisions/:id} : Partial updates given fields of an existing recordRevision, field will ignore if it is null
     *
     * @param id the id of the recordRevision to save.
     * @param recordRevision the recordRevision to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated recordRevision,
     * or with status {@code 400 (Bad Request)} if the recordRevision is not valid,
     * or with status {@code 404 (Not Found)} if the recordRevision is not found,
     * or with status {@code 500 (Internal Server Error)} if the recordRevision couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<RecordRevision> partialUpdateRecordRevision(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody RecordRevision recordRevision
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update RecordRevision partially : {}, {}", id, recordRevision);
        if (recordRevision.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, recordRevision.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!recordRevisionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<RecordRevision> result = recordRevisionRepository
            .findById(recordRevision.getId())
            .map(existingRecordRevision -> {
                updateIfPresent(existingRecordRevision::setSourceType, recordRevision.getSourceType());
                updateIfPresent(existingRecordRevision::setSourceId, recordRevision.getSourceId());
                updateIfPresent(existingRecordRevision::setAction, recordRevision.getAction());
                updateIfPresent(existingRecordRevision::setReason, recordRevision.getReason());
                updateIfPresent(existingRecordRevision::setBeforeSnapshot, recordRevision.getBeforeSnapshot());
                updateIfPresent(existingRecordRevision::setAfterSnapshot, recordRevision.getAfterSnapshot());
                updateIfPresent(existingRecordRevision::setChangedAt, recordRevision.getChangedAt());

                return existingRecordRevision;
            })
            .map(recordRevisionRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, recordRevision.getId().toString())
        );
    }

    /**
     * {@code GET  /record-revisions} : get all the Record Revisions.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Record Revisions in body.
     */
    @GetMapping("")
    public List<RecordRevision> getAllRecordRevisions() {
        LOG.debug("REST request to get all RecordRevisions");
        return recordRevisionRepository.findAll();
    }

    /**
     * {@code GET  /record-revisions/:id} : get the "id" recordRevision.
     *
     * @param id the id of the recordRevision to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the recordRevision, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<RecordRevision> getRecordRevision(@PathVariable("id") Long id) {
        LOG.debug("REST request to get RecordRevision : {}", id);
        Optional<RecordRevision> recordRevision = recordRevisionRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(recordRevision);
    }

    /**
     * {@code DELETE  /record-revisions/:id} : delete the "id" recordRevision.
     *
     * @param id the id of the recordRevision to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecordRevision(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete RecordRevision : {}", id);
        recordRevisionRepository.deleteById(id);
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
