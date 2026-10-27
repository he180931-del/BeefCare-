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
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.repository.CalvingEventRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.CalvingEvent}.
 */
@RestController
@RequestMapping("/api/calving-events")
@Transactional
public class CalvingEventResource {

    private static final Logger LOG = LoggerFactory.getLogger(CalvingEventResource.class);

    private static final String ENTITY_NAME = "calvingEvent";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final CalvingEventRepository calvingEventRepository;

    public CalvingEventResource(CalvingEventRepository calvingEventRepository) {
        this.calvingEventRepository = calvingEventRepository;
    }

    /**
     * {@code POST  /calving-events} : Create a new calvingEvent.
     *
     * @param calvingEvent the calvingEvent to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new calvingEvent, or with status {@code 400 (Bad Request)} if the calvingEvent has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<CalvingEvent> createCalvingEvent(@Valid @RequestBody CalvingEvent calvingEvent) throws URISyntaxException {
        LOG.debug("REST request to save CalvingEvent : {}", calvingEvent);
        if (calvingEvent.getId() != null) {
            throw new BadRequestAlertException("A new calvingEvent cannot already have an ID", ENTITY_NAME, "idexists");
        }
        calvingEvent = calvingEventRepository.save(calvingEvent);
        return ResponseEntity.created(new URI("/api/calving-events/" + calvingEvent.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, calvingEvent.getId().toString()))
            .body(calvingEvent);
    }

    /**
     * {@code PUT  /calving-events/:id} : Updates an existing calvingEvent.
     *
     * @param id the id of the calvingEvent to save.
     * @param calvingEvent the calvingEvent to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated calvingEvent,
     * or with status {@code 400 (Bad Request)} if the calvingEvent is not valid,
     * or with status {@code 500 (Internal Server Error)} if the calvingEvent couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<CalvingEvent> updateCalvingEvent(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody CalvingEvent calvingEvent
    ) throws URISyntaxException {
        LOG.debug("REST request to update CalvingEvent : {}, {}", id, calvingEvent);
        if (calvingEvent.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, calvingEvent.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!calvingEventRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        calvingEvent = calvingEventRepository.save(calvingEvent);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, calvingEvent.getId().toString()))
            .body(calvingEvent);
    }

    /**
     * {@code PATCH  /calving-events/:id} : Partial updates given fields of an existing calvingEvent, field will ignore if it is null
     *
     * @param id the id of the calvingEvent to save.
     * @param calvingEvent the calvingEvent to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated calvingEvent,
     * or with status {@code 400 (Bad Request)} if the calvingEvent is not valid,
     * or with status {@code 404 (Not Found)} if the calvingEvent is not found,
     * or with status {@code 500 (Internal Server Error)} if the calvingEvent couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<CalvingEvent> partialUpdateCalvingEvent(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody CalvingEvent calvingEvent
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update CalvingEvent partially : {}, {}", id, calvingEvent);
        if (calvingEvent.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, calvingEvent.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!calvingEventRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<CalvingEvent> result = calvingEventRepository
            .findById(calvingEvent.getId())
            .map(existingCalvingEvent -> {
                updateIfPresent(existingCalvingEvent::setBirthTime, calvingEvent.getBirthTime());
                updateIfPresent(existingCalvingEvent::setCourse, calvingEvent.getCourse());
                updateIfPresent(existingCalvingEvent::setDamCondition, calvingEvent.getDamCondition());

                return existingCalvingEvent;
            })
            .map(calvingEventRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, calvingEvent.getId().toString())
        );
    }

    /**
     * {@code GET  /calving-events} : get all the Calving Events.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Calving Events in body.
     */
    @GetMapping("")
    public List<CalvingEvent> getAllCalvingEvents() {
        LOG.debug("REST request to get all CalvingEvents");
        return calvingEventRepository.findAll();
    }

    /**
     * {@code GET  /calving-events/:id} : get the "id" calvingEvent.
     *
     * @param id the id of the calvingEvent to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the calvingEvent, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<CalvingEvent> getCalvingEvent(@PathVariable("id") Long id) {
        LOG.debug("REST request to get CalvingEvent : {}", id);
        Optional<CalvingEvent> calvingEvent = calvingEventRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(calvingEvent);
    }

    /**
     * {@code DELETE  /calving-events/:id} : delete the "id" calvingEvent.
     *
     * @param id the id of the calvingEvent to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCalvingEvent(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete CalvingEvent : {}", id);
        calvingEventRepository.deleteById(id);
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
