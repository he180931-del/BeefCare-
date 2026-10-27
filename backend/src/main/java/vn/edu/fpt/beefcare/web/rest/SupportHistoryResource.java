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
import vn.edu.fpt.beefcare.domain.SupportHistory;
import vn.edu.fpt.beefcare.repository.SupportHistoryRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.SupportHistory}.
 */
@RestController
@RequestMapping("/api/support-histories")
@Transactional
public class SupportHistoryResource {

    private static final Logger LOG = LoggerFactory.getLogger(SupportHistoryResource.class);

    private static final String ENTITY_NAME = "supportHistory";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final SupportHistoryRepository supportHistoryRepository;

    public SupportHistoryResource(SupportHistoryRepository supportHistoryRepository) {
        this.supportHistoryRepository = supportHistoryRepository;
    }

    /**
     * {@code POST  /support-histories} : Create a new supportHistory.
     *
     * @param supportHistory the supportHistory to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new supportHistory, or with status {@code 400 (Bad Request)} if the supportHistory has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<SupportHistory> createSupportHistory(@Valid @RequestBody SupportHistory supportHistory)
        throws URISyntaxException {
        LOG.debug("REST request to save SupportHistory : {}", supportHistory);
        if (supportHistory.getId() != null) {
            throw new BadRequestAlertException("A new supportHistory cannot already have an ID", ENTITY_NAME, "idexists");
        }
        supportHistory = supportHistoryRepository.save(supportHistory);
        return ResponseEntity.created(new URI("/api/support-histories/" + supportHistory.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, supportHistory.getId().toString()))
            .body(supportHistory);
    }

    /**
     * {@code PUT  /support-histories/:id} : Updates an existing supportHistory.
     *
     * @param id the id of the supportHistory to save.
     * @param supportHistory the supportHistory to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated supportHistory,
     * or with status {@code 400 (Bad Request)} if the supportHistory is not valid,
     * or with status {@code 500 (Internal Server Error)} if the supportHistory couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<SupportHistory> updateSupportHistory(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody SupportHistory supportHistory
    ) throws URISyntaxException {
        LOG.debug("REST request to update SupportHistory : {}, {}", id, supportHistory);
        if (supportHistory.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, supportHistory.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!supportHistoryRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        supportHistory = supportHistoryRepository.save(supportHistory);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, supportHistory.getId().toString()))
            .body(supportHistory);
    }

    /**
     * {@code PATCH  /support-histories/:id} : Partial updates given fields of an existing supportHistory, field will ignore if it is null
     *
     * @param id the id of the supportHistory to save.
     * @param supportHistory the supportHistory to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated supportHistory,
     * or with status {@code 400 (Bad Request)} if the supportHistory is not valid,
     * or with status {@code 404 (Not Found)} if the supportHistory is not found,
     * or with status {@code 500 (Internal Server Error)} if the supportHistory couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<SupportHistory> partialUpdateSupportHistory(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody SupportHistory supportHistory
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update SupportHistory partially : {}, {}", id, supportHistory);
        if (supportHistory.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, supportHistory.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!supportHistoryRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<SupportHistory> result = supportHistoryRepository
            .findById(supportHistory.getId())
            .map(existingSupportHistory -> {
                updateIfPresent(existingSupportHistory::setEventType, supportHistory.getEventType());
                updateIfPresent(existingSupportHistory::setPriorState, supportHistory.getPriorState());
                updateIfPresent(existingSupportHistory::setNewState, supportHistory.getNewState());
                updateIfPresent(existingSupportHistory::setOccurredAt, supportHistory.getOccurredAt());

                return existingSupportHistory;
            })
            .map(supportHistoryRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, supportHistory.getId().toString())
        );
    }

    /**
     * {@code GET  /support-histories} : get all the Support Histories.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Support Histories in body.
     */
    @GetMapping("")
    public List<SupportHistory> getAllSupportHistories() {
        LOG.debug("REST request to get all SupportHistories");
        return supportHistoryRepository.findAll();
    }

    /**
     * {@code GET  /support-histories/:id} : get the "id" supportHistory.
     *
     * @param id the id of the supportHistory to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the supportHistory, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<SupportHistory> getSupportHistory(@PathVariable("id") Long id) {
        LOG.debug("REST request to get SupportHistory : {}", id);
        Optional<SupportHistory> supportHistory = supportHistoryRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(supportHistory);
    }

    /**
     * {@code DELETE  /support-histories/:id} : delete the "id" supportHistory.
     *
     * @param id the id of the supportHistory to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSupportHistory(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete SupportHistory : {}", id);
        supportHistoryRepository.deleteById(id);
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
