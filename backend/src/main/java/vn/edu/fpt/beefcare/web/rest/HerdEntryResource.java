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
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.HerdEntry}.
 */
@RestController
@RequestMapping("/api/herd-entries")
@Transactional
public class HerdEntryResource {

    private static final Logger LOG = LoggerFactory.getLogger(HerdEntryResource.class);

    private static final String ENTITY_NAME = "herdEntry";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final HerdEntryRepository herdEntryRepository;

    public HerdEntryResource(HerdEntryRepository herdEntryRepository) {
        this.herdEntryRepository = herdEntryRepository;
    }

    /**
     * {@code POST  /herd-entries} : Create a new herdEntry.
     *
     * @param herdEntry the herdEntry to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new herdEntry, or with status {@code 400 (Bad Request)} if the herdEntry has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<HerdEntry> createHerdEntry(@Valid @RequestBody HerdEntry herdEntry) throws URISyntaxException {
        LOG.debug("REST request to save HerdEntry : {}", herdEntry);
        if (herdEntry.getId() != null) {
            throw new BadRequestAlertException("A new herdEntry cannot already have an ID", ENTITY_NAME, "idexists");
        }
        herdEntry = herdEntryRepository.save(herdEntry);
        return ResponseEntity.created(new URI("/api/herd-entries/" + herdEntry.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, herdEntry.getId().toString()))
            .body(herdEntry);
    }

    /**
     * {@code PUT  /herd-entries/:id} : Updates an existing herdEntry.
     *
     * @param id the id of the herdEntry to save.
     * @param herdEntry the herdEntry to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated herdEntry,
     * or with status {@code 400 (Bad Request)} if the herdEntry is not valid,
     * or with status {@code 500 (Internal Server Error)} if the herdEntry couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<HerdEntry> updateHerdEntry(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody HerdEntry herdEntry
    ) throws URISyntaxException {
        LOG.debug("REST request to update HerdEntry : {}, {}", id, herdEntry);
        if (herdEntry.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, herdEntry.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!herdEntryRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        herdEntry = herdEntryRepository.save(herdEntry);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, herdEntry.getId().toString()))
            .body(herdEntry);
    }

    /**
     * {@code PATCH  /herd-entries/:id} : Partial updates given fields of an existing herdEntry, field will ignore if it is null
     *
     * @param id the id of the herdEntry to save.
     * @param herdEntry the herdEntry to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated herdEntry,
     * or with status {@code 400 (Bad Request)} if the herdEntry is not valid,
     * or with status {@code 404 (Not Found)} if the herdEntry is not found,
     * or with status {@code 500 (Internal Server Error)} if the herdEntry couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<HerdEntry> partialUpdateHerdEntry(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody HerdEntry herdEntry
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update HerdEntry partially : {}, {}", id, herdEntry);
        if (herdEntry.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, herdEntry.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!herdEntryRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<HerdEntry> result = herdEntryRepository
            .findById(herdEntry.getId())
            .map(existingHerdEntry -> {
                updateIfPresent(existingHerdEntry::setSource, herdEntry.getSource());
                updateIfPresent(existingHerdEntry::setEntryDate, herdEntry.getEntryDate());
                updateIfPresent(existingHerdEntry::setHistoryDeclarations, herdEntry.getHistoryDeclarations());

                return existingHerdEntry;
            })
            .map(herdEntryRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, herdEntry.getId().toString())
        );
    }

    /**
     * {@code GET  /herd-entries} : get all the Herd Entries.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Herd Entries in body.
     */
    @GetMapping("")
    public List<HerdEntry> getAllHerdEntries() {
        LOG.debug("REST request to get all HerdEntries");
        return herdEntryRepository.findAll();
    }

    /**
     * {@code GET  /herd-entries/:id} : get the "id" herdEntry.
     *
     * @param id the id of the herdEntry to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the herdEntry, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<HerdEntry> getHerdEntry(@PathVariable("id") Long id) {
        LOG.debug("REST request to get HerdEntry : {}", id);
        Optional<HerdEntry> herdEntry = herdEntryRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(herdEntry);
    }

    /**
     * {@code DELETE  /herd-entries/:id} : delete the "id" herdEntry.
     *
     * @param id the id of the herdEntry to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHerdEntry(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete HerdEntry : {}", id);
        herdEntryRepository.deleteById(id);
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
