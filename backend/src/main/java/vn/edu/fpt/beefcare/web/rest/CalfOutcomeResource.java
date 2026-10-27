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
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.repository.CalfOutcomeRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.CalfOutcome}.
 */
@RestController
@RequestMapping("/api/calf-outcomes")
@Transactional
public class CalfOutcomeResource {

    private static final Logger LOG = LoggerFactory.getLogger(CalfOutcomeResource.class);

    private static final String ENTITY_NAME = "calfOutcome";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final CalfOutcomeRepository calfOutcomeRepository;

    public CalfOutcomeResource(CalfOutcomeRepository calfOutcomeRepository) {
        this.calfOutcomeRepository = calfOutcomeRepository;
    }

    /**
     * {@code POST  /calf-outcomes} : Create a new calfOutcome.
     *
     * @param calfOutcome the calfOutcome to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new calfOutcome, or with status {@code 400 (Bad Request)} if the calfOutcome has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<CalfOutcome> createCalfOutcome(@Valid @RequestBody CalfOutcome calfOutcome) throws URISyntaxException {
        LOG.debug("REST request to save CalfOutcome : {}", calfOutcome);
        if (calfOutcome.getId() != null) {
            throw new BadRequestAlertException("A new calfOutcome cannot already have an ID", ENTITY_NAME, "idexists");
        }
        calfOutcome = calfOutcomeRepository.save(calfOutcome);
        return ResponseEntity.created(new URI("/api/calf-outcomes/" + calfOutcome.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, calfOutcome.getId().toString()))
            .body(calfOutcome);
    }

    /**
     * {@code PUT  /calf-outcomes/:id} : Updates an existing calfOutcome.
     *
     * @param id the id of the calfOutcome to save.
     * @param calfOutcome the calfOutcome to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated calfOutcome,
     * or with status {@code 400 (Bad Request)} if the calfOutcome is not valid,
     * or with status {@code 500 (Internal Server Error)} if the calfOutcome couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<CalfOutcome> updateCalfOutcome(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody CalfOutcome calfOutcome
    ) throws URISyntaxException {
        LOG.debug("REST request to update CalfOutcome : {}, {}", id, calfOutcome);
        if (calfOutcome.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, calfOutcome.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!calfOutcomeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        calfOutcome = calfOutcomeRepository.save(calfOutcome);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, calfOutcome.getId().toString()))
            .body(calfOutcome);
    }

    /**
     * {@code PATCH  /calf-outcomes/:id} : Partial updates given fields of an existing calfOutcome, field will ignore if it is null
     *
     * @param id the id of the calfOutcome to save.
     * @param calfOutcome the calfOutcome to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated calfOutcome,
     * or with status {@code 400 (Bad Request)} if the calfOutcome is not valid,
     * or with status {@code 404 (Not Found)} if the calfOutcome is not found,
     * or with status {@code 500 (Internal Server Error)} if the calfOutcome couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<CalfOutcome> partialUpdateCalfOutcome(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody CalfOutcome calfOutcome
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update CalfOutcome partially : {}, {}", id, calfOutcome);
        if (calfOutcome.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, calfOutcome.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!calfOutcomeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<CalfOutcome> result = calfOutcomeRepository
            .findById(calfOutcome.getId())
            .map(existingCalfOutcome -> {
                updateIfPresent(existingCalfOutcome::setOutcome, calfOutcome.getOutcome());
                updateIfPresent(existingCalfOutcome::setSex, calfOutcome.getSex());
                updateIfPresent(existingCalfOutcome::setBirthWeight, calfOutcome.getBirthWeight());
                updateIfPresent(existingCalfOutcome::setRegistrationState, calfOutcome.getRegistrationState());

                return existingCalfOutcome;
            })
            .map(calfOutcomeRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, calfOutcome.getId().toString())
        );
    }

    /**
     * {@code GET  /calf-outcomes} : get all the Calf Outcomes.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Calf Outcomes in body.
     */
    @GetMapping("")
    public List<CalfOutcome> getAllCalfOutcomes() {
        LOG.debug("REST request to get all CalfOutcomes");
        return calfOutcomeRepository.findAll();
    }

    /**
     * {@code GET  /calf-outcomes/:id} : get the "id" calfOutcome.
     *
     * @param id the id of the calfOutcome to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the calfOutcome, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<CalfOutcome> getCalfOutcome(@PathVariable("id") Long id) {
        LOG.debug("REST request to get CalfOutcome : {}", id);
        Optional<CalfOutcome> calfOutcome = calfOutcomeRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(calfOutcome);
    }

    /**
     * {@code DELETE  /calf-outcomes/:id} : delete the "id" calfOutcome.
     *
     * @param id the id of the calfOutcome to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCalfOutcome(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete CalfOutcome : {}", id);
        calfOutcomeRepository.deleteById(id);
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
