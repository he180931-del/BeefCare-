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
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.PlatformStaffAccess}.
 */
@RestController
@RequestMapping("/api/platform-staff-accesses")
@Transactional
public class PlatformStaffAccessResource {

    private static final Logger LOG = LoggerFactory.getLogger(PlatformStaffAccessResource.class);

    private static final String ENTITY_NAME = "platformStaffAccess";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final PlatformStaffAccessRepository platformStaffAccessRepository;

    public PlatformStaffAccessResource(PlatformStaffAccessRepository platformStaffAccessRepository) {
        this.platformStaffAccessRepository = platformStaffAccessRepository;
    }

    /**
     * {@code POST  /platform-staff-accesses} : Create a new platformStaffAccess.
     *
     * @param platformStaffAccess the platformStaffAccess to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new platformStaffAccess, or with status {@code 400 (Bad Request)} if the platformStaffAccess has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<PlatformStaffAccess> createPlatformStaffAccess(@Valid @RequestBody PlatformStaffAccess platformStaffAccess)
        throws URISyntaxException {
        LOG.debug("REST request to save PlatformStaffAccess : {}", platformStaffAccess);
        if (platformStaffAccess.getId() != null) {
            throw new BadRequestAlertException("A new platformStaffAccess cannot already have an ID", ENTITY_NAME, "idexists");
        }
        platformStaffAccess = platformStaffAccessRepository.save(platformStaffAccess);
        return ResponseEntity.created(new URI("/api/platform-staff-accesses/" + platformStaffAccess.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, platformStaffAccess.getId().toString()))
            .body(platformStaffAccess);
    }

    /**
     * {@code PUT  /platform-staff-accesses/:id} : Updates an existing platformStaffAccess.
     *
     * @param id the id of the platformStaffAccess to save.
     * @param platformStaffAccess the platformStaffAccess to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated platformStaffAccess,
     * or with status {@code 400 (Bad Request)} if the platformStaffAccess is not valid,
     * or with status {@code 500 (Internal Server Error)} if the platformStaffAccess couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PlatformStaffAccess> updatePlatformStaffAccess(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody PlatformStaffAccess platformStaffAccess
    ) throws URISyntaxException {
        LOG.debug("REST request to update PlatformStaffAccess : {}, {}", id, platformStaffAccess);
        if (platformStaffAccess.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, platformStaffAccess.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!platformStaffAccessRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        platformStaffAccess = platformStaffAccessRepository.save(platformStaffAccess);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, platformStaffAccess.getId().toString()))
            .body(platformStaffAccess);
    }

    /**
     * {@code PATCH  /platform-staff-accesses/:id} : Partial updates given fields of an existing platformStaffAccess, field will ignore if it is null
     *
     * @param id the id of the platformStaffAccess to save.
     * @param platformStaffAccess the platformStaffAccess to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated platformStaffAccess,
     * or with status {@code 400 (Bad Request)} if the platformStaffAccess is not valid,
     * or with status {@code 404 (Not Found)} if the platformStaffAccess is not found,
     * or with status {@code 500 (Internal Server Error)} if the platformStaffAccess couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<PlatformStaffAccess> partialUpdatePlatformStaffAccess(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody PlatformStaffAccess platformStaffAccess
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update PlatformStaffAccess partially : {}, {}", id, platformStaffAccess);
        if (platformStaffAccess.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, platformStaffAccess.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!platformStaffAccessRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<PlatformStaffAccess> result = platformStaffAccessRepository
            .findById(platformStaffAccess.getId())
            .map(existingPlatformStaffAccess -> {
                updateIfPresent(existingPlatformStaffAccess::setRole, platformStaffAccess.getRole());
                updateIfPresent(existingPlatformStaffAccess::setStatus, platformStaffAccess.getStatus());

                return existingPlatformStaffAccess;
            })
            .map(platformStaffAccessRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, platformStaffAccess.getId().toString())
        );
    }

    /**
     * {@code GET  /platform-staff-accesses} : get all the Platform Staff Accesses.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Platform Staff Accesses in body.
     */
    @GetMapping("")
    public List<PlatformStaffAccess> getAllPlatformStaffAccesses() {
        LOG.debug("REST request to get all PlatformStaffAccesses");
        return platformStaffAccessRepository.findAll();
    }

    /**
     * {@code GET  /platform-staff-accesses/:id} : get the "id" platformStaffAccess.
     *
     * @param id the id of the platformStaffAccess to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the platformStaffAccess, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PlatformStaffAccess> getPlatformStaffAccess(@PathVariable("id") Long id) {
        LOG.debug("REST request to get PlatformStaffAccess : {}", id);
        Optional<PlatformStaffAccess> platformStaffAccess = platformStaffAccessRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(platformStaffAccess);
    }

    /**
     * {@code DELETE  /platform-staff-accesses/:id} : delete the "id" platformStaffAccess.
     *
     * @param id the id of the platformStaffAccess to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlatformStaffAccess(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete PlatformStaffAccess : {}", id);
        platformStaffAccessRepository.deleteById(id);
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
