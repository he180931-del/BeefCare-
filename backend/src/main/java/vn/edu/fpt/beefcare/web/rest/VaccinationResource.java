package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.StreamSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tech.jhipster.web.util.HeaderUtil;
import tech.jhipster.web.util.ResponseUtil;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.repository.VaccinationRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Vaccination}.
 */
@RestController
@RequestMapping("/api/vaccinations")
@Transactional
public class VaccinationResource {

    private static final Logger LOG = LoggerFactory.getLogger(VaccinationResource.class);

    private static final String ENTITY_NAME = "vaccination";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final VaccinationRepository vaccinationRepository;

    public VaccinationResource(VaccinationRepository vaccinationRepository) {
        this.vaccinationRepository = vaccinationRepository;
    }

    /**
     * {@code POST  /vaccinations} : Create a new vaccination.
     *
     * @param vaccination the vaccination to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new vaccination, or with status {@code 400 (Bad Request)} if the vaccination has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Vaccination> createVaccination(@Valid @RequestBody Vaccination vaccination) throws URISyntaxException {
        LOG.debug("REST request to save Vaccination : {}", vaccination);
        if (vaccination.getId() != null) {
            throw new BadRequestAlertException("A new vaccination cannot already have an ID", ENTITY_NAME, "idexists");
        }
        vaccination = vaccinationRepository.save(vaccination);
        return ResponseEntity.created(new URI("/api/vaccinations/" + vaccination.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, vaccination.getId().toString()))
            .body(vaccination);
    }

    /**
     * {@code PUT  /vaccinations/:id} : Updates an existing vaccination.
     *
     * @param id the id of the vaccination to save.
     * @param vaccination the vaccination to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated vaccination,
     * or with status {@code 400 (Bad Request)} if the vaccination is not valid,
     * or with status {@code 500 (Internal Server Error)} if the vaccination couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Vaccination> updateVaccination(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Vaccination vaccination
    ) throws URISyntaxException {
        LOG.debug("REST request to update Vaccination : {}, {}", id, vaccination);
        if (vaccination.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, vaccination.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!vaccinationRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        vaccination = vaccinationRepository.save(vaccination);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, vaccination.getId().toString()))
            .body(vaccination);
    }

    /**
     * {@code PATCH  /vaccinations/:id} : Partial updates given fields of an existing vaccination, field will ignore if it is null
     *
     * @param id the id of the vaccination to save.
     * @param vaccination the vaccination to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated vaccination,
     * or with status {@code 400 (Bad Request)} if the vaccination is not valid,
     * or with status {@code 404 (Not Found)} if the vaccination is not found,
     * or with status {@code 500 (Internal Server Error)} if the vaccination couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Vaccination> partialUpdateVaccination(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Vaccination vaccination
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Vaccination partially : {}, {}", id, vaccination);
        if (vaccination.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, vaccination.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!vaccinationRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Vaccination> result = vaccinationRepository
            .findById(vaccination.getId())
            .map(existingVaccination -> {
                updateIfPresent(existingVaccination::setVaccinationDate, vaccination.getVaccinationDate());
                updateIfPresent(existingVaccination::setEntryTime, vaccination.getEntryTime());
                updateIfPresent(existingVaccination::setDose, vaccination.getDose());
                updateIfPresent(existingVaccination::setBatchNo, vaccination.getBatchNo());
                updateIfPresent(existingVaccination::setSource, vaccination.getSource());
                updateIfPresent(existingVaccination::setVaccinator, vaccination.getVaccinator());

                return existingVaccination;
            })
            .map(vaccinationRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, vaccination.getId().toString())
        );
    }

    /**
     * {@code GET  /vaccinations} : get all the Vaccinations.
     *
     * @param filter the filter of the request.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Vaccinations in body.
     */
    @GetMapping("")
    public List<Vaccination> getAllVaccinations(@RequestParam(name = "filter", required = false) String filter) {
        if ("scheduleddose-is-null".equals(filter)) {
            LOG.debug("REST request to get all Vaccinations where scheduledDose is null");
            return StreamSupport.stream(vaccinationRepository.findAll().spliterator(), false)
                .filter(vaccination -> vaccination.getScheduledDose() == null)
                .toList();
        }
        LOG.debug("REST request to get all Vaccinations");
        return vaccinationRepository.findAll();
    }

    /**
     * {@code GET  /vaccinations/:id} : get the "id" vaccination.
     *
     * @param id the id of the vaccination to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the vaccination, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Vaccination> getVaccination(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Vaccination : {}", id);
        Optional<Vaccination> vaccination = vaccinationRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(vaccination);
    }

    /**
     * {@code DELETE  /vaccinations/:id} : delete the "id" vaccination.
     *
     * @param id the id of the vaccination to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVaccination(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Vaccination : {}", id);
        vaccinationRepository.deleteById(id);
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
