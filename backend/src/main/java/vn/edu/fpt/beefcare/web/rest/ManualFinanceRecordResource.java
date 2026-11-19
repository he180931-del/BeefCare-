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
import vn.edu.fpt.beefcare.domain.ManualFinanceRecord;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.ManualFinanceRecord}.
 */
@RestController
@RequestMapping("/api/manual-finance-records")
@Transactional
public class ManualFinanceRecordResource {

    private static final Logger LOG = LoggerFactory.getLogger(ManualFinanceRecordResource.class);

    private static final String ENTITY_NAME = "manualFinanceRecord";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final ManualFinanceRecordRepository manualFinanceRecordRepository;

    public ManualFinanceRecordResource(ManualFinanceRecordRepository manualFinanceRecordRepository) {
        this.manualFinanceRecordRepository = manualFinanceRecordRepository;
    }

    /**
     * {@code POST  /manual-finance-records} : Create a new manualFinanceRecord.
     *
     * @param manualFinanceRecord the manualFinanceRecord to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new manualFinanceRecord, or with status {@code 400 (Bad Request)} if the manualFinanceRecord has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ManualFinanceRecord> createManualFinanceRecord(@Valid @RequestBody ManualFinanceRecord manualFinanceRecord)
        throws URISyntaxException {
        LOG.debug("REST request to save ManualFinanceRecord : {}", manualFinanceRecord);
        if (manualFinanceRecord.getId() != null) {
            throw new BadRequestAlertException("A new manualFinanceRecord cannot already have an ID", ENTITY_NAME, "idexists");
        }
        manualFinanceRecord = manualFinanceRecordRepository.save(manualFinanceRecord);
        return ResponseEntity.created(new URI("/api/manual-finance-records/" + manualFinanceRecord.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, manualFinanceRecord.getId().toString()))
            .body(manualFinanceRecord);
    }

    /**
     * {@code PUT  /manual-finance-records/:id} : Updates an existing manualFinanceRecord.
     *
     * @param id the id of the manualFinanceRecord to save.
     * @param manualFinanceRecord the manualFinanceRecord to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated manualFinanceRecord,
     * or with status {@code 400 (Bad Request)} if the manualFinanceRecord is not valid,
     * or with status {@code 500 (Internal Server Error)} if the manualFinanceRecord couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ManualFinanceRecord> updateManualFinanceRecord(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ManualFinanceRecord manualFinanceRecord
    ) throws URISyntaxException {
        LOG.debug("REST request to update ManualFinanceRecord : {}, {}", id, manualFinanceRecord);
        if (manualFinanceRecord.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, manualFinanceRecord.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!manualFinanceRecordRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        manualFinanceRecord = manualFinanceRecordRepository.save(manualFinanceRecord);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, manualFinanceRecord.getId().toString()))
            .body(manualFinanceRecord);
    }

    /**
     * {@code PATCH  /manual-finance-records/:id} : Partial updates given fields of an existing manualFinanceRecord, field will ignore if it is null
     *
     * @param id the id of the manualFinanceRecord to save.
     * @param manualFinanceRecord the manualFinanceRecord to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated manualFinanceRecord,
     * or with status {@code 400 (Bad Request)} if the manualFinanceRecord is not valid,
     * or with status {@code 404 (Not Found)} if the manualFinanceRecord is not found,
     * or with status {@code 500 (Internal Server Error)} if the manualFinanceRecord couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ManualFinanceRecord> partialUpdateManualFinanceRecord(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ManualFinanceRecord manualFinanceRecord
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update ManualFinanceRecord partially : {}, {}", id, manualFinanceRecord);
        if (manualFinanceRecord.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, manualFinanceRecord.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!manualFinanceRecordRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<ManualFinanceRecord> result = manualFinanceRecordRepository
            .findById(manualFinanceRecord.getId())
            .map(existingManualFinanceRecord -> {
                updateIfPresent(existingManualFinanceRecord::setType, manualFinanceRecord.getType());
                updateIfPresent(existingManualFinanceRecord::setCategory, manualFinanceRecord.getCategory());
                updateIfPresent(existingManualFinanceRecord::setAmountVnd, manualFinanceRecord.getAmountVnd());
                updateIfPresent(existingManualFinanceRecord::setOccurredOn, manualFinanceRecord.getOccurredOn());
                updateIfPresent(existingManualFinanceRecord::setState, manualFinanceRecord.getState());

                return existingManualFinanceRecord;
            })
            .map(manualFinanceRecordRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, manualFinanceRecord.getId().toString())
        );
    }

    /**
     * {@code GET  /manual-finance-records} : get all the Manual Finance Records.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Manual Finance Records in body.
     */
    @GetMapping("")
    public List<ManualFinanceRecord> getAllManualFinanceRecords() {
        LOG.debug("REST request to get all ManualFinanceRecords");
        return manualFinanceRecordRepository.findAll();
    }

    /**
     * {@code GET  /manual-finance-records/:id} : get the "id" manualFinanceRecord.
     *
     * @param id the id of the manualFinanceRecord to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the manualFinanceRecord, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ManualFinanceRecord> getManualFinanceRecord(@PathVariable("id") Long id) {
        LOG.debug("REST request to get ManualFinanceRecord : {}", id);
        Optional<ManualFinanceRecord> manualFinanceRecord = manualFinanceRecordRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(manualFinanceRecord);
    }

    /**
     * {@code DELETE  /manual-finance-records/:id} : delete the "id" manualFinanceRecord.
     *
     * @param id the id of the manualFinanceRecord to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteManualFinanceRecord(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete ManualFinanceRecord : {}", id);
        manualFinanceRecordRepository.deleteById(id);
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
