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
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.repository.FarmAnnouncementRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.FarmAnnouncement}.
 */
@RestController
@RequestMapping("/api/farm-announcements")
@Transactional
public class FarmAnnouncementResource {

    private static final Logger LOG = LoggerFactory.getLogger(FarmAnnouncementResource.class);

    private static final String ENTITY_NAME = "farmAnnouncement";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final FarmAnnouncementRepository farmAnnouncementRepository;

    public FarmAnnouncementResource(FarmAnnouncementRepository farmAnnouncementRepository) {
        this.farmAnnouncementRepository = farmAnnouncementRepository;
    }

    /**
     * {@code POST  /farm-announcements} : Create a new farmAnnouncement.
     *
     * @param farmAnnouncement the farmAnnouncement to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new farmAnnouncement, or with status {@code 400 (Bad Request)} if the farmAnnouncement has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<FarmAnnouncement> createFarmAnnouncement(@Valid @RequestBody FarmAnnouncement farmAnnouncement)
        throws URISyntaxException {
        LOG.debug("REST request to save FarmAnnouncement : {}", farmAnnouncement);
        if (farmAnnouncement.getId() != null) {
            throw new BadRequestAlertException("A new farmAnnouncement cannot already have an ID", ENTITY_NAME, "idexists");
        }
        farmAnnouncement = farmAnnouncementRepository.save(farmAnnouncement);
        return ResponseEntity.created(new URI("/api/farm-announcements/" + farmAnnouncement.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, farmAnnouncement.getId().toString()))
            .body(farmAnnouncement);
    }

    /**
     * {@code PUT  /farm-announcements/:id} : Updates an existing farmAnnouncement.
     *
     * @param id the id of the farmAnnouncement to save.
     * @param farmAnnouncement the farmAnnouncement to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farmAnnouncement,
     * or with status {@code 400 (Bad Request)} if the farmAnnouncement is not valid,
     * or with status {@code 500 (Internal Server Error)} if the farmAnnouncement couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<FarmAnnouncement> updateFarmAnnouncement(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody FarmAnnouncement farmAnnouncement
    ) throws URISyntaxException {
        LOG.debug("REST request to update FarmAnnouncement : {}, {}", id, farmAnnouncement);
        if (farmAnnouncement.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farmAnnouncement.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmAnnouncementRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        farmAnnouncement = farmAnnouncementRepository.save(farmAnnouncement);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farmAnnouncement.getId().toString()))
            .body(farmAnnouncement);
    }

    /**
     * {@code PATCH  /farm-announcements/:id} : Partial updates given fields of an existing farmAnnouncement, field will ignore if it is null
     *
     * @param id the id of the farmAnnouncement to save.
     * @param farmAnnouncement the farmAnnouncement to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farmAnnouncement,
     * or with status {@code 400 (Bad Request)} if the farmAnnouncement is not valid,
     * or with status {@code 404 (Not Found)} if the farmAnnouncement is not found,
     * or with status {@code 500 (Internal Server Error)} if the farmAnnouncement couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<FarmAnnouncement> partialUpdateFarmAnnouncement(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody FarmAnnouncement farmAnnouncement
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update FarmAnnouncement partially : {}, {}", id, farmAnnouncement);
        if (farmAnnouncement.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farmAnnouncement.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmAnnouncementRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<FarmAnnouncement> result = farmAnnouncementRepository
            .findById(farmAnnouncement.getId())
            .map(existingFarmAnnouncement -> {
                updateIfPresent(existingFarmAnnouncement::setState, farmAnnouncement.getState());

                return existingFarmAnnouncement;
            })
            .map(farmAnnouncementRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farmAnnouncement.getId().toString())
        );
    }

    /**
     * {@code GET  /farm-announcements} : get all the Farm Announcements.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Farm Announcements in body.
     */
    @GetMapping("")
    public List<FarmAnnouncement> getAllFarmAnnouncements() {
        LOG.debug("REST request to get all FarmAnnouncements");
        return farmAnnouncementRepository.findAll();
    }

    /**
     * {@code GET  /farm-announcements/:id} : get the "id" farmAnnouncement.
     *
     * @param id the id of the farmAnnouncement to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the farmAnnouncement, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<FarmAnnouncement> getFarmAnnouncement(@PathVariable("id") Long id) {
        LOG.debug("REST request to get FarmAnnouncement : {}", id);
        Optional<FarmAnnouncement> farmAnnouncement = farmAnnouncementRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(farmAnnouncement);
    }

    /**
     * {@code DELETE  /farm-announcements/:id} : delete the "id" farmAnnouncement.
     *
     * @param id the id of the farmAnnouncement to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFarmAnnouncement(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete FarmAnnouncement : {}", id);
        farmAnnouncementRepository.deleteById(id);
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
