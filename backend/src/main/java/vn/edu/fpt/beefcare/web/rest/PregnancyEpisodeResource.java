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
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.repository.PregnancyEpisodeRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.PregnancyEpisode}.
 */
@RestController
@RequestMapping("/api/pregnancy-episodes")
@Transactional
public class PregnancyEpisodeResource {

    private static final Logger LOG = LoggerFactory.getLogger(PregnancyEpisodeResource.class);

    private static final String ENTITY_NAME = "pregnancyEpisode";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PregnancyEpisodeRepository pregnancyEpisodeRepository;

    public PregnancyEpisodeResource(PregnancyEpisodeRepository pregnancyEpisodeRepository) {
        this.pregnancyEpisodeRepository = pregnancyEpisodeRepository;
    }

    /**
     * {@code POST  /pregnancy-episodes} : Create a new pregnancyEpisode.
     *
     * @param pregnancyEpisode the pregnancyEpisode to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new pregnancyEpisode, or with status {@code 400 (Bad Request)} if the pregnancyEpisode has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PregnancyEpisode> createPregnancyEpisode(@Valid @RequestBody PregnancyEpisode pregnancyEpisode)
        throws URISyntaxException {
        LOG.debug("REST request to save PregnancyEpisode : {}", pregnancyEpisode);
        if (pregnancyEpisode.getId() != null) {
            throw new BadRequestAlertException("A new pregnancyEpisode cannot already have an ID", ENTITY_NAME, "idexists");
        }
        pregnancyEpisode = pregnancyEpisodeRepository.save(pregnancyEpisode);
        return ResponseEntity.created(new URI("/api/pregnancy-episodes/" + pregnancyEpisode.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, pregnancyEpisode.getId().toString()))
            .body(pregnancyEpisode);
    }

    /**
     * {@code PUT  /pregnancy-episodes/:id} : Updates an existing pregnancyEpisode.
     *
     * @param id the id of the pregnancyEpisode to save.
     * @param pregnancyEpisode the pregnancyEpisode to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated pregnancyEpisode,
     * or with status {@code 400 (Bad Request)} if the pregnancyEpisode is not valid,
     * or with status {@code 500 (Internal Server Error)} if the pregnancyEpisode couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PregnancyEpisode> updatePregnancyEpisode(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PregnancyEpisode pregnancyEpisode
    ) throws URISyntaxException {
        LOG.debug("REST request to update PregnancyEpisode : {}, {}", id, pregnancyEpisode);
        if (pregnancyEpisode.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, pregnancyEpisode.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!pregnancyEpisodeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        pregnancyEpisode = pregnancyEpisodeRepository.save(pregnancyEpisode);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, pregnancyEpisode.getId().toString()))
            .body(pregnancyEpisode);
    }

    /**
     * {@code PATCH  /pregnancy-episodes/:id} : Partial updates given fields of an existing pregnancyEpisode, field will ignore if it is null
     *
     * @param id the id of the pregnancyEpisode to save.
     * @param pregnancyEpisode the pregnancyEpisode to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated pregnancyEpisode,
     * or with status {@code 400 (Bad Request)} if the pregnancyEpisode is not valid,
     * or with status {@code 404 (Not Found)} if the pregnancyEpisode is not found,
     * or with status {@code 500 (Internal Server Error)} if the pregnancyEpisode couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PregnancyEpisode> partialUpdatePregnancyEpisode(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PregnancyEpisode pregnancyEpisode
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update PregnancyEpisode partially : {}, {}", id, pregnancyEpisode);
        if (pregnancyEpisode.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, pregnancyEpisode.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!pregnancyEpisodeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PregnancyEpisode> result = pregnancyEpisodeRepository
            .findById(pregnancyEpisode.getId())
            .map(existingPregnancyEpisode -> {
                updateIfPresent(existingPregnancyEpisode::setExpectedCalvingDate, pregnancyEpisode.getExpectedCalvingDate());
                updateIfPresent(existingPregnancyEpisode::setParity, pregnancyEpisode.getParity());
                updateIfPresent(existingPregnancyEpisode::setStatus, pregnancyEpisode.getStatus());

                return existingPregnancyEpisode;
            })
            .map(pregnancyEpisodeRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, pregnancyEpisode.getId().toString())
        );
    }

    /**
     * {@code GET  /pregnancy-episodes} : get all the Pregnancy Episodes.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Pregnancy Episodes in body.
     */
    @GetMapping("")
    public List<PregnancyEpisode> getAllPregnancyEpisodes() {
        LOG.debug("REST request to get all PregnancyEpisodes");
        return pregnancyEpisodeRepository.findAll();
    }

    /**
     * {@code GET  /pregnancy-episodes/:id} : get the "id" pregnancyEpisode.
     *
     * @param id the id of the pregnancyEpisode to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the pregnancyEpisode, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PregnancyEpisode> getPregnancyEpisode(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PregnancyEpisode : {}", id);
        Optional<PregnancyEpisode> pregnancyEpisode = pregnancyEpisodeRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(pregnancyEpisode);
    }

    /**
     * {@code DELETE  /pregnancy-episodes/:id} : delete the "id" pregnancyEpisode.
     *
     * @param id the id of the pregnancyEpisode to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePregnancyEpisode(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PregnancyEpisode : {}", id);
        pregnancyEpisodeRepository.deleteById(id);
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
