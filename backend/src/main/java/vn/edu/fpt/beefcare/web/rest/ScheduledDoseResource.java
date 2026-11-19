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
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.repository.ScheduledDoseRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.ScheduledDose}.
 */
@RestController
@RequestMapping("/api/scheduled-doses")
@Transactional
public class ScheduledDoseResource {

    private static final Logger LOG = LoggerFactory.getLogger(ScheduledDoseResource.class);

    private static final String ENTITY_NAME = "scheduledDose";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final ScheduledDoseRepository scheduledDoseRepository;

    public ScheduledDoseResource(ScheduledDoseRepository scheduledDoseRepository) {
        this.scheduledDoseRepository = scheduledDoseRepository;
    }

    /**
     * {@code POST  /scheduled-doses} : Create a new scheduledDose.
     *
     * @param scheduledDose the scheduledDose to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new scheduledDose, or with status {@code 400 (Bad Request)} if the scheduledDose has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ScheduledDose> createScheduledDose(@Valid @RequestBody ScheduledDose scheduledDose) throws URISyntaxException {
        LOG.debug("REST request to save ScheduledDose : {}", scheduledDose);
        if (scheduledDose.getId() != null) {
            throw new BadRequestAlertException("A new scheduledDose cannot already have an ID", ENTITY_NAME, "idexists");
        }
        scheduledDose = scheduledDoseRepository.save(scheduledDose);
        return ResponseEntity.created(new URI("/api/scheduled-doses/" + scheduledDose.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, scheduledDose.getId().toString()))
            .body(scheduledDose);
    }

    /**
     * {@code PUT  /scheduled-doses/:id} : Updates an existing scheduledDose.
     *
     * @param id the id of the scheduledDose to save.
     * @param scheduledDose the scheduledDose to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated scheduledDose,
     * or with status {@code 400 (Bad Request)} if the scheduledDose is not valid,
     * or with status {@code 500 (Internal Server Error)} if the scheduledDose couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ScheduledDose> updateScheduledDose(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ScheduledDose scheduledDose
    ) throws URISyntaxException {
        LOG.debug("REST request to update ScheduledDose : {}, {}", id, scheduledDose);
        if (scheduledDose.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, scheduledDose.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!scheduledDoseRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        scheduledDose = scheduledDoseRepository.save(scheduledDose);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, scheduledDose.getId().toString()))
            .body(scheduledDose);
    }

    /**
     * {@code PATCH  /scheduled-doses/:id} : Partial updates given fields of an existing scheduledDose, field will ignore if it is null
     *
     * @param id the id of the scheduledDose to save.
     * @param scheduledDose the scheduledDose to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated scheduledDose,
     * or with status {@code 400 (Bad Request)} if the scheduledDose is not valid,
     * or with status {@code 404 (Not Found)} if the scheduledDose is not found,
     * or with status {@code 500 (Internal Server Error)} if the scheduledDose couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ScheduledDose> partialUpdateScheduledDose(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ScheduledDose scheduledDose
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update ScheduledDose partially : {}, {}", id, scheduledDose);
        if (scheduledDose.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, scheduledDose.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!scheduledDoseRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<ScheduledDose> result = scheduledDoseRepository
            .findById(scheduledDose.getId())
            .map(existingScheduledDose -> {
                updateIfPresent(existingScheduledDose::setDoseNo, scheduledDose.getDoseNo());
                updateIfPresent(existingScheduledDose::setDueDate, scheduledDose.getDueDate());
                updateIfPresent(existingScheduledDose::setStatus, scheduledDose.getStatus());
                updateIfPresent(existingScheduledDose::setDeferralReason, scheduledDose.getDeferralReason());
                updateIfPresent(existingScheduledDose::setNewExpectedDate, scheduledDose.getNewExpectedDate());

                return existingScheduledDose;
            })
            .map(scheduledDoseRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, scheduledDose.getId().toString())
        );
    }

    /**
     * {@code GET  /scheduled-doses} : get all the Scheduled Doses.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Scheduled Doses in body.
     */
    @GetMapping("")
    public List<ScheduledDose> getAllScheduledDoses() {
        LOG.debug("REST request to get all ScheduledDoses");
        return scheduledDoseRepository.findAll();
    }

    /**
     * {@code GET  /scheduled-doses/:id} : get the "id" scheduledDose.
     *
     * @param id the id of the scheduledDose to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the scheduledDose, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ScheduledDose> getScheduledDose(@PathVariable("id") Long id) {
        LOG.debug("REST request to get ScheduledDose : {}", id);
        Optional<ScheduledDose> scheduledDose = scheduledDoseRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(scheduledDose);
    }

    /**
     * {@code DELETE  /scheduled-doses/:id} : delete the "id" scheduledDose.
     *
     * @param id the id of the scheduledDose to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScheduledDose(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete ScheduledDose : {}", id);
        scheduledDoseRepository.deleteById(id);
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
