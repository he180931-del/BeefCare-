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
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.repository.VaccinationScheduleRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.VaccinationSchedule}.
 */
@RestController
@RequestMapping("/api/vaccination-schedules")
@Transactional
public class VaccinationScheduleResource {

    private static final Logger LOG = LoggerFactory.getLogger(VaccinationScheduleResource.class);

    private static final String ENTITY_NAME = "vaccinationSchedule";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final VaccinationScheduleRepository vaccinationScheduleRepository;

    public VaccinationScheduleResource(VaccinationScheduleRepository vaccinationScheduleRepository) {
        this.vaccinationScheduleRepository = vaccinationScheduleRepository;
    }

    /**
     * {@code POST  /vaccination-schedules} : Create a new vaccinationSchedule.
     *
     * @param vaccinationSchedule the vaccinationSchedule to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new vaccinationSchedule, or with status {@code 400 (Bad Request)} if the vaccinationSchedule has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<VaccinationSchedule> createVaccinationSchedule(@Valid @RequestBody VaccinationSchedule vaccinationSchedule)
        throws URISyntaxException {
        LOG.debug("REST request to save VaccinationSchedule : {}", vaccinationSchedule);
        if (vaccinationSchedule.getId() != null) {
            throw new BadRequestAlertException("A new vaccinationSchedule cannot already have an ID", ENTITY_NAME, "idexists");
        }
        vaccinationSchedule = vaccinationScheduleRepository.save(vaccinationSchedule);
        return ResponseEntity.created(new URI("/api/vaccination-schedules/" + vaccinationSchedule.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, vaccinationSchedule.getId().toString()))
            .body(vaccinationSchedule);
    }

    /**
     * {@code PUT  /vaccination-schedules/:id} : Updates an existing vaccinationSchedule.
     *
     * @param id the id of the vaccinationSchedule to save.
     * @param vaccinationSchedule the vaccinationSchedule to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated vaccinationSchedule,
     * or with status {@code 400 (Bad Request)} if the vaccinationSchedule is not valid,
     * or with status {@code 500 (Internal Server Error)} if the vaccinationSchedule couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<VaccinationSchedule> updateVaccinationSchedule(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody VaccinationSchedule vaccinationSchedule
    ) throws URISyntaxException {
        LOG.debug("REST request to update VaccinationSchedule : {}, {}", id, vaccinationSchedule);
        if (vaccinationSchedule.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, vaccinationSchedule.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!vaccinationScheduleRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        vaccinationSchedule = vaccinationScheduleRepository.save(vaccinationSchedule);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, vaccinationSchedule.getId().toString()))
            .body(vaccinationSchedule);
    }

    /**
     * {@code PATCH  /vaccination-schedules/:id} : Partial updates given fields of an existing vaccinationSchedule, field will ignore if it is null
     *
     * @param id the id of the vaccinationSchedule to save.
     * @param vaccinationSchedule the vaccinationSchedule to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated vaccinationSchedule,
     * or with status {@code 400 (Bad Request)} if the vaccinationSchedule is not valid,
     * or with status {@code 404 (Not Found)} if the vaccinationSchedule is not found,
     * or with status {@code 500 (Internal Server Error)} if the vaccinationSchedule couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<VaccinationSchedule> partialUpdateVaccinationSchedule(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody VaccinationSchedule vaccinationSchedule
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update VaccinationSchedule partially : {}, {}", id, vaccinationSchedule);
        if (vaccinationSchedule.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, vaccinationSchedule.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!vaccinationScheduleRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<VaccinationSchedule> result = vaccinationScheduleRepository
            .findById(vaccinationSchedule.getId())
            .map(existingVaccinationSchedule -> {
                updateIfPresent(existingVaccinationSchedule::setTargetGroup, vaccinationSchedule.getTargetGroup());
                updateIfPresent(existingVaccinationSchedule::setFirstDueDate, vaccinationSchedule.getFirstDueDate());
                updateIfPresent(existingVaccinationSchedule::setDoseCount, vaccinationSchedule.getDoseCount());
                updateIfPresent(existingVaccinationSchedule::setIntervalDays, vaccinationSchedule.getIntervalDays());
                updateIfPresent(existingVaccinationSchedule::setStatus, vaccinationSchedule.getStatus());

                return existingVaccinationSchedule;
            })
            .map(vaccinationScheduleRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, vaccinationSchedule.getId().toString())
        );
    }

    /**
     * {@code GET  /vaccination-schedules} : get all the Vaccination Schedules.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Vaccination Schedules in body.
     */
    @GetMapping("")
    public List<VaccinationSchedule> getAllVaccinationSchedules() {
        LOG.debug("REST request to get all VaccinationSchedules");
        return vaccinationScheduleRepository.findAll();
    }

    /**
     * {@code GET  /vaccination-schedules/:id} : get the "id" vaccinationSchedule.
     *
     * @param id the id of the vaccinationSchedule to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the vaccinationSchedule, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<VaccinationSchedule> getVaccinationSchedule(@PathVariable("id") Long id) {
        LOG.debug("REST request to get VaccinationSchedule : {}", id);
        Optional<VaccinationSchedule> vaccinationSchedule = vaccinationScheduleRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(vaccinationSchedule);
    }

    /**
     * {@code DELETE  /vaccination-schedules/:id} : delete the "id" vaccinationSchedule.
     *
     * @param id the id of the vaccinationSchedule to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVaccinationSchedule(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete VaccinationSchedule : {}", id);
        vaccinationScheduleRepository.deleteById(id);
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
