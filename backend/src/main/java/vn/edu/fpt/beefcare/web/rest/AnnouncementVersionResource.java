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
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.AnnouncementVersion}.
 */
@RestController
@RequestMapping("/api/announcement-versions")
@Transactional
public class AnnouncementVersionResource {

    private static final Logger LOG = LoggerFactory.getLogger(AnnouncementVersionResource.class);

    private static final String ENTITY_NAME = "announcementVersion";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final AnnouncementVersionRepository announcementVersionRepository;

    public AnnouncementVersionResource(AnnouncementVersionRepository announcementVersionRepository) {
        this.announcementVersionRepository = announcementVersionRepository;
    }

    /**
     * {@code POST  /announcement-versions} : Create a new announcementVersion.
     *
     * @param announcementVersion the announcementVersion to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new announcementVersion, or with status {@code 400 (Bad Request)} if the announcementVersion has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<AnnouncementVersion> createAnnouncementVersion(@Valid @RequestBody AnnouncementVersion announcementVersion)
        throws URISyntaxException {
        LOG.debug("REST request to save AnnouncementVersion : {}", announcementVersion);
        if (announcementVersion.getId() != null) {
            throw new BadRequestAlertException("A new announcementVersion cannot already have an ID", ENTITY_NAME, "idexists");
        }
        announcementVersion = announcementVersionRepository.save(announcementVersion);
        return ResponseEntity.created(new URI("/api/announcement-versions/" + announcementVersion.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, announcementVersion.getId().toString()))
            .body(announcementVersion);
    }

    /**
     * {@code PUT  /announcement-versions/:id} : Updates an existing announcementVersion.
     *
     * @param id the id of the announcementVersion to save.
     * @param announcementVersion the announcementVersion to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated announcementVersion,
     * or with status {@code 400 (Bad Request)} if the announcementVersion is not valid,
     * or with status {@code 500 (Internal Server Error)} if the announcementVersion couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<AnnouncementVersion> updateAnnouncementVersion(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody AnnouncementVersion announcementVersion
    ) throws URISyntaxException {
        LOG.debug("REST request to update AnnouncementVersion : {}, {}", id, announcementVersion);
        if (announcementVersion.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, announcementVersion.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!announcementVersionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        announcementVersion = announcementVersionRepository.save(announcementVersion);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, announcementVersion.getId().toString()))
            .body(announcementVersion);
    }

    /**
     * {@code PATCH  /announcement-versions/:id} : Partial updates given fields of an existing announcementVersion, field will ignore if it is null
     *
     * @param id the id of the announcementVersion to save.
     * @param announcementVersion the announcementVersion to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated announcementVersion,
     * or with status {@code 400 (Bad Request)} if the announcementVersion is not valid,
     * or with status {@code 404 (Not Found)} if the announcementVersion is not found,
     * or with status {@code 500 (Internal Server Error)} if the announcementVersion couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<AnnouncementVersion> partialUpdateAnnouncementVersion(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody AnnouncementVersion announcementVersion
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update AnnouncementVersion partially : {}, {}", id, announcementVersion);
        if (announcementVersion.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, announcementVersion.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!announcementVersionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<AnnouncementVersion> result = announcementVersionRepository
            .findById(announcementVersion.getId())
            .map(existingAnnouncementVersion -> {
                updateIfPresent(existingAnnouncementVersion::setVersionNo, announcementVersion.getVersionNo());
                updateIfPresent(existingAnnouncementVersion::setTitle, announcementVersion.getTitle());
                updateIfPresent(existingAnnouncementVersion::setBody, announcementVersion.getBody());
                updateIfPresent(existingAnnouncementVersion::setPublishedTime, announcementVersion.getPublishedTime());

                return existingAnnouncementVersion;
            })
            .map(announcementVersionRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, announcementVersion.getId().toString())
        );
    }

    /**
     * {@code GET  /announcement-versions} : get all the Announcement Versions.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Announcement Versions in body.
     */
    @GetMapping("")
    public List<AnnouncementVersion> getAllAnnouncementVersions() {
        LOG.debug("REST request to get all AnnouncementVersions");
        return announcementVersionRepository.findAll();
    }

    /**
     * {@code GET  /announcement-versions/:id} : get the "id" announcementVersion.
     *
     * @param id the id of the announcementVersion to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the announcementVersion, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AnnouncementVersion> getAnnouncementVersion(@PathVariable("id") Long id) {
        LOG.debug("REST request to get AnnouncementVersion : {}", id);
        Optional<AnnouncementVersion> announcementVersion = announcementVersionRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(announcementVersion);
    }

    /**
     * {@code DELETE  /announcement-versions/:id} : delete the "id" announcementVersion.
     *
     * @param id the id of the announcementVersion to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncementVersion(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete AnnouncementVersion : {}", id);
        announcementVersionRepository.deleteById(id);
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
