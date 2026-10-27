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
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.AuditLog}.
 */
@RestController
@RequestMapping("/api/audit-logs")
@Transactional
public class AuditLogResource {

    private static final Logger LOG = LoggerFactory.getLogger(AuditLogResource.class);

    private static final String ENTITY_NAME = "auditLog";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final AuditLogRepository auditLogRepository;

    public AuditLogResource(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * {@code POST  /audit-logs} : Create a new auditLog.
     *
     * @param auditLog the auditLog to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new auditLog, or with status {@code 400 (Bad Request)} if the auditLog has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<AuditLog> createAuditLog(@Valid @RequestBody AuditLog auditLog) throws URISyntaxException {
        LOG.debug("REST request to save AuditLog : {}", auditLog);
        if (auditLog.getId() != null) {
            throw new BadRequestAlertException("A new auditLog cannot already have an ID", ENTITY_NAME, "idexists");
        }
        auditLog = auditLogRepository.save(auditLog);
        return ResponseEntity.created(new URI("/api/audit-logs/" + auditLog.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, auditLog.getId().toString()))
            .body(auditLog);
    }

    /**
     * {@code PUT  /audit-logs/:id} : Updates an existing auditLog.
     *
     * @param id the id of the auditLog to save.
     * @param auditLog the auditLog to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated auditLog,
     * or with status {@code 400 (Bad Request)} if the auditLog is not valid,
     * or with status {@code 500 (Internal Server Error)} if the auditLog couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<AuditLog> updateAuditLog(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody AuditLog auditLog
    ) throws URISyntaxException {
        LOG.debug("REST request to update AuditLog : {}, {}", id, auditLog);
        if (auditLog.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, auditLog.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!auditLogRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        auditLog = auditLogRepository.save(auditLog);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, auditLog.getId().toString()))
            .body(auditLog);
    }

    /**
     * {@code PATCH  /audit-logs/:id} : Partial updates given fields of an existing auditLog, field will ignore if it is null
     *
     * @param id the id of the auditLog to save.
     * @param auditLog the auditLog to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated auditLog,
     * or with status {@code 400 (Bad Request)} if the auditLog is not valid,
     * or with status {@code 404 (Not Found)} if the auditLog is not found,
     * or with status {@code 500 (Internal Server Error)} if the auditLog couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<AuditLog> partialUpdateAuditLog(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody AuditLog auditLog
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update AuditLog partially : {}, {}", id, auditLog);
        if (auditLog.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, auditLog.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!auditLogRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<AuditLog> result = auditLogRepository
            .findById(auditLog.getId())
            .map(existingAuditLog -> {
                updateIfPresent(existingAuditLog::setAction, auditLog.getAction());
                updateIfPresent(existingAuditLog::setTargetType, auditLog.getTargetType());
                updateIfPresent(existingAuditLog::setTargetId, auditLog.getTargetId());
                updateIfPresent(existingAuditLog::setLoggedAt, auditLog.getLoggedAt());

                return existingAuditLog;
            })
            .map(auditLogRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, auditLog.getId().toString())
        );
    }

    /**
     * {@code GET  /audit-logs} : get all the Audit Logs.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Audit Logs in body.
     */
    @GetMapping("")
    public List<AuditLog> getAllAuditLogs() {
        LOG.debug("REST request to get all AuditLogs");
        return auditLogRepository.findAll();
    }

    /**
     * {@code GET  /audit-logs/:id} : get the "id" auditLog.
     *
     * @param id the id of the auditLog to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the auditLog, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AuditLog> getAuditLog(@PathVariable("id") Long id) {
        LOG.debug("REST request to get AuditLog : {}", id);
        Optional<AuditLog> auditLog = auditLogRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(auditLog);
    }

    /**
     * {@code DELETE  /audit-logs/:id} : delete the "id" auditLog.
     *
     * @param id the id of the auditLog to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAuditLog(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete AuditLog : {}", id);
        auditLogRepository.deleteById(id);
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
