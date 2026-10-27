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
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.SupportTicketRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.SupportTicket}.
 */
@RestController
@RequestMapping("/api/support-tickets")
@Transactional
public class SupportTicketResource {

    private static final Logger LOG = LoggerFactory.getLogger(SupportTicketResource.class);

    private static final String ENTITY_NAME = "supportTicket";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final SupportTicketRepository supportTicketRepository;

    public SupportTicketResource(SupportTicketRepository supportTicketRepository) {
        this.supportTicketRepository = supportTicketRepository;
    }

    /**
     * {@code POST  /support-tickets} : Create a new supportTicket.
     *
     * @param supportTicket the supportTicket to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new supportTicket, or with status {@code 400 (Bad Request)} if the supportTicket has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<SupportTicket> createSupportTicket(@Valid @RequestBody SupportTicket supportTicket) throws URISyntaxException {
        LOG.debug("REST request to save SupportTicket : {}", supportTicket);
        if (supportTicket.getId() != null) {
            throw new BadRequestAlertException("A new supportTicket cannot already have an ID", ENTITY_NAME, "idexists");
        }
        supportTicket = supportTicketRepository.save(supportTicket);
        return ResponseEntity.created(new URI("/api/support-tickets/" + supportTicket.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, supportTicket.getId().toString()))
            .body(supportTicket);
    }

    /**
     * {@code PUT  /support-tickets/:id} : Updates an existing supportTicket.
     *
     * @param id the id of the supportTicket to save.
     * @param supportTicket the supportTicket to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated supportTicket,
     * or with status {@code 400 (Bad Request)} if the supportTicket is not valid,
     * or with status {@code 500 (Internal Server Error)} if the supportTicket couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<SupportTicket> updateSupportTicket(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody SupportTicket supportTicket
    ) throws URISyntaxException {
        LOG.debug("REST request to update SupportTicket : {}, {}", id, supportTicket);
        if (supportTicket.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, supportTicket.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!supportTicketRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        supportTicket = supportTicketRepository.save(supportTicket);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, supportTicket.getId().toString()))
            .body(supportTicket);
    }

    /**
     * {@code PATCH  /support-tickets/:id} : Partial updates given fields of an existing supportTicket, field will ignore if it is null
     *
     * @param id the id of the supportTicket to save.
     * @param supportTicket the supportTicket to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated supportTicket,
     * or with status {@code 400 (Bad Request)} if the supportTicket is not valid,
     * or with status {@code 404 (Not Found)} if the supportTicket is not found,
     * or with status {@code 500 (Internal Server Error)} if the supportTicket couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<SupportTicket> partialUpdateSupportTicket(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody SupportTicket supportTicket
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update SupportTicket partially : {}, {}", id, supportTicket);
        if (supportTicket.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, supportTicket.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!supportTicketRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<SupportTicket> result = supportTicketRepository
            .findById(supportTicket.getId())
            .map(existingSupportTicket -> {
                updateIfPresent(existingSupportTicket::setCategory, supportTicket.getCategory());
                updateIfPresent(existingSupportTicket::setPriority, supportTicket.getPriority());
                updateIfPresent(existingSupportTicket::setStatus, supportTicket.getStatus());

                return existingSupportTicket;
            })
            .map(supportTicketRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, supportTicket.getId().toString())
        );
    }

    /**
     * {@code GET  /support-tickets} : get all the Support Tickets.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Support Tickets in body.
     */
    @GetMapping("")
    public List<SupportTicket> getAllSupportTickets() {
        LOG.debug("REST request to get all SupportTickets");
        return supportTicketRepository.findAll();
    }

    /**
     * {@code GET  /support-tickets/:id} : get the "id" supportTicket.
     *
     * @param id the id of the supportTicket to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the supportTicket, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<SupportTicket> getSupportTicket(@PathVariable("id") Long id) {
        LOG.debug("REST request to get SupportTicket : {}", id);
        Optional<SupportTicket> supportTicket = supportTicketRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(supportTicket);
    }

    /**
     * {@code DELETE  /support-tickets/:id} : delete the "id" supportTicket.
     *
     * @param id the id of the supportTicket to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSupportTicket(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete SupportTicket : {}", id);
        supportTicketRepository.deleteById(id);
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
