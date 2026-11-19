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
import vn.edu.fpt.beefcare.domain.ReminderParameter;
import vn.edu.fpt.beefcare.repository.ReminderParameterRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.ReminderParameter}.
 */
@RestController
@RequestMapping("/api/reminder-parameters")
@Transactional
public class ReminderParameterResource {

    private static final Logger LOG = LoggerFactory.getLogger(ReminderParameterResource.class);

    private static final String ENTITY_NAME = "reminderParameter";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final ReminderParameterRepository reminderParameterRepository;

    public ReminderParameterResource(ReminderParameterRepository reminderParameterRepository) {
        this.reminderParameterRepository = reminderParameterRepository;
    }

    /**
     * {@code POST  /reminder-parameters} : Create a new reminderParameter.
     *
     * @param reminderParameter the reminderParameter to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new reminderParameter, or with status {@code 400 (Bad Request)} if the reminderParameter has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ReminderParameter> createReminderParameter(@Valid @RequestBody ReminderParameter reminderParameter)
        throws URISyntaxException {
        LOG.debug("REST request to save ReminderParameter : {}", reminderParameter);
        if (reminderParameter.getId() != null) {
            throw new BadRequestAlertException("A new reminderParameter cannot already have an ID", ENTITY_NAME, "idexists");
        }
        reminderParameter = reminderParameterRepository.save(reminderParameter);
        return ResponseEntity.created(new URI("/api/reminder-parameters/" + reminderParameter.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, reminderParameter.getId().toString()))
            .body(reminderParameter);
    }

    /**
     * {@code PUT  /reminder-parameters/:id} : Updates an existing reminderParameter.
     *
     * @param id the id of the reminderParameter to save.
     * @param reminderParameter the reminderParameter to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated reminderParameter,
     * or with status {@code 400 (Bad Request)} if the reminderParameter is not valid,
     * or with status {@code 500 (Internal Server Error)} if the reminderParameter couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ReminderParameter> updateReminderParameter(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ReminderParameter reminderParameter
    ) throws URISyntaxException {
        LOG.debug("REST request to update ReminderParameter : {}, {}", id, reminderParameter);
        if (reminderParameter.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, reminderParameter.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!reminderParameterRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        reminderParameter = reminderParameterRepository.save(reminderParameter);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, reminderParameter.getId().toString()))
            .body(reminderParameter);
    }

    /**
     * {@code PATCH  /reminder-parameters/:id} : Partial updates given fields of an existing reminderParameter, field will ignore if it is null
     *
     * @param id the id of the reminderParameter to save.
     * @param reminderParameter the reminderParameter to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated reminderParameter,
     * or with status {@code 400 (Bad Request)} if the reminderParameter is not valid,
     * or with status {@code 404 (Not Found)} if the reminderParameter is not found,
     * or with status {@code 500 (Internal Server Error)} if the reminderParameter couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ReminderParameter> partialUpdateReminderParameter(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ReminderParameter reminderParameter
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update ReminderParameter partially : {}, {}", id, reminderParameter);
        if (reminderParameter.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, reminderParameter.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!reminderParameterRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<ReminderParameter> result = reminderParameterRepository
            .findById(reminderParameter.getId())
            .map(existingReminderParameter -> {
                updateIfPresent(existingReminderParameter::setParameterType, reminderParameter.getParameterType());
                updateIfPresent(existingReminderParameter::setParamValue, reminderParameter.getParamValue());
                updateIfPresent(existingReminderParameter::setVersionNo, reminderParameter.getVersionNo());
                updateIfPresent(existingReminderParameter::setEffectiveFrom, reminderParameter.getEffectiveFrom());

                return existingReminderParameter;
            })
            .map(reminderParameterRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, reminderParameter.getId().toString())
        );
    }

    /**
     * {@code GET  /reminder-parameters} : get all the Reminder Parameters.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Reminder Parameters in body.
     */
    @GetMapping("")
    public List<ReminderParameter> getAllReminderParameters() {
        LOG.debug("REST request to get all ReminderParameters");
        return reminderParameterRepository.findAll();
    }

    /**
     * {@code GET  /reminder-parameters/:id} : get the "id" reminderParameter.
     *
     * @param id the id of the reminderParameter to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the reminderParameter, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ReminderParameter> getReminderParameter(@PathVariable("id") Long id) {
        LOG.debug("REST request to get ReminderParameter : {}", id);
        Optional<ReminderParameter> reminderParameter = reminderParameterRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(reminderParameter);
    }

    /**
     * {@code DELETE  /reminder-parameters/:id} : delete the "id" reminderParameter.
     *
     * @param id the id of the reminderParameter to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReminderParameter(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete ReminderParameter : {}", id);
        reminderParameterRepository.deleteById(id);
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
