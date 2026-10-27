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
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.HerdExit}.
 */
@RestController
@RequestMapping("/api/herd-exits")
@Transactional
public class HerdExitResource {

    private static final Logger LOG = LoggerFactory.getLogger(HerdExitResource.class);

    private static final String ENTITY_NAME = "herdExit";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final HerdExitRepository herdExitRepository;

    public HerdExitResource(HerdExitRepository herdExitRepository) {
        this.herdExitRepository = herdExitRepository;
    }

    /**
     * {@code POST  /herd-exits} : Create a new herdExit.
     *
     * @param herdExit the herdExit to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new herdExit, or with status {@code 400 (Bad Request)} if the herdExit has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<HerdExit> createHerdExit(@Valid @RequestBody HerdExit herdExit) throws URISyntaxException {
        LOG.debug("REST request to save HerdExit : {}", herdExit);
        if (herdExit.getId() != null) {
            throw new BadRequestAlertException("A new herdExit cannot already have an ID", ENTITY_NAME, "idexists");
        }
        herdExit = herdExitRepository.save(herdExit);
        return ResponseEntity.created(new URI("/api/herd-exits/" + herdExit.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, herdExit.getId().toString()))
            .body(herdExit);
    }

    /**
     * {@code PUT  /herd-exits/:id} : Updates an existing herdExit.
     *
     * @param id the id of the herdExit to save.
     * @param herdExit the herdExit to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated herdExit,
     * or with status {@code 400 (Bad Request)} if the herdExit is not valid,
     * or with status {@code 500 (Internal Server Error)} if the herdExit couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<HerdExit> updateHerdExit(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody HerdExit herdExit
    ) throws URISyntaxException {
        LOG.debug("REST request to update HerdExit : {}, {}", id, herdExit);
        if (herdExit.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, herdExit.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!herdExitRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        herdExit = herdExitRepository.save(herdExit);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, herdExit.getId().toString()))
            .body(herdExit);
    }

    /**
     * {@code PATCH  /herd-exits/:id} : Partial updates given fields of an existing herdExit, field will ignore if it is null
     *
     * @param id the id of the herdExit to save.
     * @param herdExit the herdExit to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated herdExit,
     * or with status {@code 400 (Bad Request)} if the herdExit is not valid,
     * or with status {@code 404 (Not Found)} if the herdExit is not found,
     * or with status {@code 500 (Internal Server Error)} if the herdExit couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<HerdExit> partialUpdateHerdExit(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody HerdExit herdExit
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update HerdExit partially : {}, {}", id, herdExit);
        if (herdExit.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, herdExit.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!herdExitRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<HerdExit> result = herdExitRepository
            .findById(herdExit.getId())
            .map(existingHerdExit -> {
                updateIfPresent(existingHerdExit::setType, herdExit.getType());
                updateIfPresent(existingHerdExit::setExitDate, herdExit.getExitDate());
                updateIfPresent(existingHerdExit::setReason, herdExit.getReason());

                return existingHerdExit;
            })
            .map(herdExitRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, herdExit.getId().toString())
        );
    }

    /**
     * {@code GET  /herd-exits} : get all the Herd Exits.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Herd Exits in body.
     */
    @GetMapping("")
    public List<HerdExit> getAllHerdExits() {
        LOG.debug("REST request to get all HerdExits");
        return herdExitRepository.findAll();
    }

    /**
     * {@code GET  /herd-exits/:id} : get the "id" herdExit.
     *
     * @param id the id of the herdExit to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the herdExit, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<HerdExit> getHerdExit(@PathVariable("id") Long id) {
        LOG.debug("REST request to get HerdExit : {}", id);
        Optional<HerdExit> herdExit = herdExitRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(herdExit);
    }

    /**
     * {@code DELETE  /herd-exits/:id} : delete the "id" herdExit.
     *
     * @param id the id of the herdExit to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHerdExit(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete HerdExit : {}", id);
        herdExitRepository.deleteById(id);
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
