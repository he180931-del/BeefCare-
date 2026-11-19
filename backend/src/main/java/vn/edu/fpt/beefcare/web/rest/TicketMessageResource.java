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
import vn.edu.fpt.beefcare.domain.TicketMessage;
import vn.edu.fpt.beefcare.repository.TicketMessageRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.TicketMessage}.
 */
@RestController
@RequestMapping("/api/ticket-messages")
@Transactional
public class TicketMessageResource {

    private static final Logger LOG = LoggerFactory.getLogger(TicketMessageResource.class);

    private static final String ENTITY_NAME = "ticketMessage";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final TicketMessageRepository ticketMessageRepository;

    public TicketMessageResource(TicketMessageRepository ticketMessageRepository) {
        this.ticketMessageRepository = ticketMessageRepository;
    }

    /**
     * {@code POST  /ticket-messages} : Create a new ticketMessage.
     *
     * @param ticketMessage the ticketMessage to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new ticketMessage, or with status {@code 400 (Bad Request)} if the ticketMessage has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<TicketMessage> createTicketMessage(@Valid @RequestBody TicketMessage ticketMessage) throws URISyntaxException {
        LOG.debug("REST request to save TicketMessage : {}", ticketMessage);
        if (ticketMessage.getId() != null) {
            throw new BadRequestAlertException("A new ticketMessage cannot already have an ID", ENTITY_NAME, "idexists");
        }
        ticketMessage = ticketMessageRepository.save(ticketMessage);
        return ResponseEntity.created(new URI("/api/ticket-messages/" + ticketMessage.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, ticketMessage.getId().toString()))
            .body(ticketMessage);
    }

    /**
     * {@code PUT  /ticket-messages/:id} : Updates an existing ticketMessage.
     *
     * @param id the id of the ticketMessage to save.
     * @param ticketMessage the ticketMessage to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated ticketMessage,
     * or with status {@code 400 (Bad Request)} if the ticketMessage is not valid,
     * or with status {@code 500 (Internal Server Error)} if the ticketMessage couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<TicketMessage> updateTicketMessage(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody TicketMessage ticketMessage
    ) throws URISyntaxException {
        LOG.debug("REST request to update TicketMessage : {}, {}", id, ticketMessage);
        if (ticketMessage.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, ticketMessage.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!ticketMessageRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        ticketMessage = ticketMessageRepository.save(ticketMessage);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, ticketMessage.getId().toString()))
            .body(ticketMessage);
    }

    /**
     * {@code PATCH  /ticket-messages/:id} : Partial updates given fields of an existing ticketMessage, field will ignore if it is null
     *
     * @param id the id of the ticketMessage to save.
     * @param ticketMessage the ticketMessage to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated ticketMessage,
     * or with status {@code 400 (Bad Request)} if the ticketMessage is not valid,
     * or with status {@code 404 (Not Found)} if the ticketMessage is not found,
     * or with status {@code 500 (Internal Server Error)} if the ticketMessage couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<TicketMessage> partialUpdateTicketMessage(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody TicketMessage ticketMessage
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update TicketMessage partially : {}, {}", id, ticketMessage);
        if (ticketMessage.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, ticketMessage.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!ticketMessageRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<TicketMessage> result = ticketMessageRepository
            .findById(ticketMessage.getId())
            .map(existingTicketMessage -> {
                updateIfPresent(existingTicketMessage::setType, ticketMessage.getType());
                updateIfPresent(existingTicketMessage::setAudience, ticketMessage.getAudience());
                updateIfPresent(existingTicketMessage::setContent, ticketMessage.getContent());

                return existingTicketMessage;
            })
            .map(ticketMessageRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, ticketMessage.getId().toString())
        );
    }

    /**
     * {@code GET  /ticket-messages} : get all the Ticket Messages.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Ticket Messages in body.
     */
    @GetMapping("")
    public List<TicketMessage> getAllTicketMessages() {
        LOG.debug("REST request to get all TicketMessages");
        return ticketMessageRepository.findAll();
    }

    /**
     * {@code GET  /ticket-messages/:id} : get the "id" ticketMessage.
     *
     * @param id the id of the ticketMessage to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the ticketMessage, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<TicketMessage> getTicketMessage(@PathVariable("id") Long id) {
        LOG.debug("REST request to get TicketMessage : {}", id);
        Optional<TicketMessage> ticketMessage = ticketMessageRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(ticketMessage);
    }

    /**
     * {@code DELETE  /ticket-messages/:id} : delete the "id" ticketMessage.
     *
     * @param id the id of the ticketMessage to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicketMessage(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete TicketMessage : {}", id);
        ticketMessageRepository.deleteById(id);
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
