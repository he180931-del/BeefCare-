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
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.repository.ReproductionEventRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.ReproductionEvent}.
 */
@RestController
@RequestMapping("/api/reproduction-events")
@Transactional
public class ReproductionEventResource {

    private static final Logger LOG = LoggerFactory.getLogger(ReproductionEventResource.class);

    private static final String ENTITY_NAME = "reproductionEvent";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final ReproductionEventRepository reproductionEventRepository;

    public ReproductionEventResource(ReproductionEventRepository reproductionEventRepository) {
        this.reproductionEventRepository = reproductionEventRepository;
    }

    /**
     * {@code POST  /reproduction-events} : Create a new reproductionEvent.
     *
     * @param reproductionEvent the reproductionEvent to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new reproductionEvent, or with status {@code 400 (Bad Request)} if the reproductionEvent has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ReproductionEvent> createReproductionEvent(@Valid @RequestBody ReproductionEvent reproductionEvent)
        throws URISyntaxException {
        LOG.debug("REST request to save ReproductionEvent : {}", reproductionEvent);
        if (reproductionEvent.getId() != null) {
            throw new BadRequestAlertException("A new reproductionEvent cannot already have an ID", ENTITY_NAME, "idexists");
        }
        reproductionEvent = reproductionEventRepository.save(reproductionEvent);
        return ResponseEntity.created(new URI("/api/reproduction-events/" + reproductionEvent.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, reproductionEvent.getId().toString()))
            .body(reproductionEvent);
    }

    /**
     * {@code PUT  /reproduction-events/:id} : Updates an existing reproductionEvent.
     *
     * @param id the id of the reproductionEvent to save.
     * @param reproductionEvent the reproductionEvent to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated reproductionEvent,
     * or with status {@code 400 (Bad Request)} if the reproductionEvent is not valid,
     * or with status {@code 500 (Internal Server Error)} if the reproductionEvent couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ReproductionEvent> updateReproductionEvent(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ReproductionEvent reproductionEvent
    ) throws URISyntaxException {
        LOG.debug("REST request to update ReproductionEvent : {}, {}", id, reproductionEvent);
        if (reproductionEvent.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, reproductionEvent.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!reproductionEventRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        reproductionEvent = reproductionEventRepository.save(reproductionEvent);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, reproductionEvent.getId().toString()))
            .body(reproductionEvent);
    }

    /**
     * {@code PATCH  /reproduction-events/:id} : Partial updates given fields of an existing reproductionEvent, field will ignore if it is null
     *
     * @param id the id of the reproductionEvent to save.
     * @param reproductionEvent the reproductionEvent to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated reproductionEvent,
     * or with status {@code 400 (Bad Request)} if the reproductionEvent is not valid,
     * or with status {@code 404 (Not Found)} if the reproductionEvent is not found,
     * or with status {@code 500 (Internal Server Error)} if the reproductionEvent couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ReproductionEvent> partialUpdateReproductionEvent(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ReproductionEvent reproductionEvent
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update ReproductionEvent partially : {}, {}", id, reproductionEvent);
        if (reproductionEvent.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, reproductionEvent.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!reproductionEventRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<ReproductionEvent> result = reproductionEventRepository
            .findById(reproductionEvent.getId())
            .map(existingReproductionEvent -> {
                updateIfPresent(existingReproductionEvent::setType, reproductionEvent.getType());
                updateIfPresent(existingReproductionEvent::setEventTime, reproductionEvent.getEventTime());
                updateIfPresent(existingReproductionEvent::setMethod, reproductionEvent.getMethod());
                updateIfPresent(existingReproductionEvent::setResult, reproductionEvent.getResult());
                updateIfPresent(existingReproductionEvent::setSource, reproductionEvent.getSource());

                return existingReproductionEvent;
            })
            .map(reproductionEventRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, reproductionEvent.getId().toString())
        );
    }

    /**
     * {@code GET  /reproduction-events} : get all the Reproduction Events.
     *
     * @param filter the filter of the request.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Reproduction Events in body.
     */
    @GetMapping("")
    public List<ReproductionEvent> getAllReproductionEvents(@RequestParam(name = "filter", required = false) String filter) {
        if ("pregnancyepisode-is-null".equals(filter)) {
            LOG.debug("REST request to get all ReproductionEvents where pregnancyEpisode is null");
            return StreamSupport.stream(reproductionEventRepository.findAll().spliterator(), false)
                .filter(reproductionEvent -> reproductionEvent.getPregnancyEpisode() == null)
                .toList();
        }
        LOG.debug("REST request to get all ReproductionEvents");
        return reproductionEventRepository.findAll();
    }

    /**
     * {@code GET  /reproduction-events/:id} : get the "id" reproductionEvent.
     *
     * @param id the id of the reproductionEvent to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the reproductionEvent, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ReproductionEvent> getReproductionEvent(@PathVariable("id") Long id) {
        LOG.debug("REST request to get ReproductionEvent : {}", id);
        Optional<ReproductionEvent> reproductionEvent = reproductionEventRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(reproductionEvent);
    }

    /**
     * {@code DELETE  /reproduction-events/:id} : delete the "id" reproductionEvent.
     *
     * @param id the id of the reproductionEvent to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReproductionEvent(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete ReproductionEvent : {}", id);
        reproductionEventRepository.deleteById(id);
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
