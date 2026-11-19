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
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.repository.InternalRequestRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.InternalRequest}.
 */
@RestController
@RequestMapping("/api/internal-requests")
@Transactional
public class InternalRequestResource {

    private static final Logger LOG = LoggerFactory.getLogger(InternalRequestResource.class);

    private static final String ENTITY_NAME = "internalRequest";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final InternalRequestRepository internalRequestRepository;

    public InternalRequestResource(InternalRequestRepository internalRequestRepository) {
        this.internalRequestRepository = internalRequestRepository;
    }

    /**
     * {@code POST  /internal-requests} : Create a new internalRequest.
     *
     * @param internalRequest the internalRequest to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new internalRequest, or with status {@code 400 (Bad Request)} if the internalRequest has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<InternalRequest> createInternalRequest(@Valid @RequestBody InternalRequest internalRequest)
        throws URISyntaxException {
        LOG.debug("REST request to save InternalRequest : {}", internalRequest);
        if (internalRequest.getId() != null) {
            throw new BadRequestAlertException("A new internalRequest cannot already have an ID", ENTITY_NAME, "idexists");
        }
        internalRequest = internalRequestRepository.save(internalRequest);
        return ResponseEntity.created(new URI("/api/internal-requests/" + internalRequest.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, internalRequest.getId().toString()))
            .body(internalRequest);
    }

    /**
     * {@code PUT  /internal-requests/:id} : Updates an existing internalRequest.
     *
     * @param id the id of the internalRequest to save.
     * @param internalRequest the internalRequest to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated internalRequest,
     * or with status {@code 400 (Bad Request)} if the internalRequest is not valid,
     * or with status {@code 500 (Internal Server Error)} if the internalRequest couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<InternalRequest> updateInternalRequest(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody InternalRequest internalRequest
    ) throws URISyntaxException {
        LOG.debug("REST request to update InternalRequest : {}, {}", id, internalRequest);
        if (internalRequest.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, internalRequest.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!internalRequestRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        internalRequest = internalRequestRepository.save(internalRequest);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, internalRequest.getId().toString()))
            .body(internalRequest);
    }

    /**
     * {@code PATCH  /internal-requests/:id} : Partial updates given fields of an existing internalRequest, field will ignore if it is null
     *
     * @param id the id of the internalRequest to save.
     * @param internalRequest the internalRequest to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated internalRequest,
     * or with status {@code 400 (Bad Request)} if the internalRequest is not valid,
     * or with status {@code 404 (Not Found)} if the internalRequest is not found,
     * or with status {@code 500 (Internal Server Error)} if the internalRequest couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<InternalRequest> partialUpdateInternalRequest(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody InternalRequest internalRequest
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update InternalRequest partially : {}, {}", id, internalRequest);
        if (internalRequest.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, internalRequest.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!internalRequestRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<InternalRequest> result = internalRequestRepository
            .findById(internalRequest.getId())
            .map(existingInternalRequest -> {
                updateIfPresent(existingInternalRequest::setTargetRole, internalRequest.getTargetRole());
                updateIfPresent(existingInternalRequest::setState, internalRequest.getState());
                updateIfPresent(existingInternalRequest::setOutcome, internalRequest.getOutcome());

                return existingInternalRequest;
            })
            .map(internalRequestRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, internalRequest.getId().toString())
        );
    }

    /**
     * {@code GET  /internal-requests} : get all the Internal Requests.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Internal Requests in body.
     */
    @GetMapping("")
    public List<InternalRequest> getAllInternalRequests() {
        LOG.debug("REST request to get all InternalRequests");
        return internalRequestRepository.findAll();
    }

    /**
     * {@code GET  /internal-requests/:id} : get the "id" internalRequest.
     *
     * @param id the id of the internalRequest to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the internalRequest, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<InternalRequest> getInternalRequest(@PathVariable("id") Long id) {
        LOG.debug("REST request to get InternalRequest : {}", id);
        Optional<InternalRequest> internalRequest = internalRequestRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(internalRequest);
    }

    /**
     * {@code DELETE  /internal-requests/:id} : delete the "id" internalRequest.
     *
     * @param id the id of the internalRequest to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInternalRequest(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete InternalRequest : {}", id);
        internalRequestRepository.deleteById(id);
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
