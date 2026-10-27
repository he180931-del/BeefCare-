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
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.AnnouncementRecipient}.
 */
@RestController
@RequestMapping("/api/announcement-recipients")
@Transactional
public class AnnouncementRecipientResource {

    private static final Logger LOG = LoggerFactory.getLogger(AnnouncementRecipientResource.class);

    private static final String ENTITY_NAME = "announcementRecipient";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final AnnouncementRecipientRepository announcementRecipientRepository;

    public AnnouncementRecipientResource(AnnouncementRecipientRepository announcementRecipientRepository) {
        this.announcementRecipientRepository = announcementRecipientRepository;
    }

    /**
     * {@code POST  /announcement-recipients} : Create a new announcementRecipient.
     *
     * @param announcementRecipient the announcementRecipient to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new announcementRecipient, or with status {@code 400 (Bad Request)} if the announcementRecipient has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<AnnouncementRecipient> createAnnouncementRecipient(
        @Valid @RequestBody AnnouncementRecipient announcementRecipient
    ) throws URISyntaxException {
        LOG.debug("REST request to save AnnouncementRecipient : {}", announcementRecipient);
        if (announcementRecipient.getId() != null) {
            throw new BadRequestAlertException("A new announcementRecipient cannot already have an ID", ENTITY_NAME, "idexists");
        }
        announcementRecipient = announcementRecipientRepository.save(announcementRecipient);
        return ResponseEntity.created(new URI("/api/announcement-recipients/" + announcementRecipient.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, announcementRecipient.getId().toString()))
            .body(announcementRecipient);
    }

    /**
     * {@code PUT  /announcement-recipients/:id} : Updates an existing announcementRecipient.
     *
     * @param id the id of the announcementRecipient to save.
     * @param announcementRecipient the announcementRecipient to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated announcementRecipient,
     * or with status {@code 400 (Bad Request)} if the announcementRecipient is not valid,
     * or with status {@code 500 (Internal Server Error)} if the announcementRecipient couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<AnnouncementRecipient> updateAnnouncementRecipient(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody AnnouncementRecipient announcementRecipient
    ) throws URISyntaxException {
        LOG.debug("REST request to update AnnouncementRecipient : {}, {}", id, announcementRecipient);
        if (announcementRecipient.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, announcementRecipient.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!announcementRecipientRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        announcementRecipient = announcementRecipientRepository.save(announcementRecipient);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, announcementRecipient.getId().toString()))
            .body(announcementRecipient);
    }

    /**
     * {@code PATCH  /announcement-recipients/:id} : Partial updates given fields of an existing announcementRecipient, field will ignore if it is null
     *
     * @param id the id of the announcementRecipient to save.
     * @param announcementRecipient the announcementRecipient to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated announcementRecipient,
     * or with status {@code 400 (Bad Request)} if the announcementRecipient is not valid,
     * or with status {@code 404 (Not Found)} if the announcementRecipient is not found,
     * or with status {@code 500 (Internal Server Error)} if the announcementRecipient couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<AnnouncementRecipient> partialUpdateAnnouncementRecipient(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody AnnouncementRecipient announcementRecipient
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update AnnouncementRecipient partially : {}, {}", id, announcementRecipient);
        if (announcementRecipient.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, announcementRecipient.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!announcementRecipientRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<AnnouncementRecipient> result = announcementRecipientRepository
            .findById(announcementRecipient.getId())
            .map(existingAnnouncementRecipient -> {
                updateIfPresent(existingAnnouncementRecipient::setDeliveredTime, announcementRecipient.getDeliveredTime());
                updateIfPresent(existingAnnouncementRecipient::setReadTime, announcementRecipient.getReadTime());

                return existingAnnouncementRecipient;
            })
            .map(announcementRecipientRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, announcementRecipient.getId().toString())
        );
    }

    /**
     * {@code GET  /announcement-recipients} : get all the Announcement Recipients.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Announcement Recipients in body.
     */
    @GetMapping("")
    public List<AnnouncementRecipient> getAllAnnouncementRecipients() {
        LOG.debug("REST request to get all AnnouncementRecipients");
        return announcementRecipientRepository.findAll();
    }

    /**
     * {@code GET  /announcement-recipients/:id} : get the "id" announcementRecipient.
     *
     * @param id the id of the announcementRecipient to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the announcementRecipient, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AnnouncementRecipient> getAnnouncementRecipient(@PathVariable("id") Long id) {
        LOG.debug("REST request to get AnnouncementRecipient : {}", id);
        Optional<AnnouncementRecipient> announcementRecipient = announcementRecipientRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(announcementRecipient);
    }

    /**
     * {@code DELETE  /announcement-recipients/:id} : delete the "id" announcementRecipient.
     *
     * @param id the id of the announcementRecipient to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncementRecipient(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete AnnouncementRecipient : {}", id);
        announcementRecipientRepository.deleteById(id);
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
