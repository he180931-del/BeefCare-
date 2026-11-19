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
import vn.edu.fpt.beefcare.domain.EvidenceReview;
import vn.edu.fpt.beefcare.repository.EvidenceReviewRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.EvidenceReview}.
 */
@RestController
@RequestMapping("/api/evidence-reviews")
@Transactional
public class EvidenceReviewResource {

    private static final Logger LOG = LoggerFactory.getLogger(EvidenceReviewResource.class);

    private static final String ENTITY_NAME = "evidenceReview";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final EvidenceReviewRepository evidenceReviewRepository;

    public EvidenceReviewResource(EvidenceReviewRepository evidenceReviewRepository) {
        this.evidenceReviewRepository = evidenceReviewRepository;
    }

    /**
     * {@code POST  /evidence-reviews} : Create a new evidenceReview.
     *
     * @param evidenceReview the evidenceReview to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new evidenceReview, or with status {@code 400 (Bad Request)} if the evidenceReview has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<EvidenceReview> createEvidenceReview(@Valid @RequestBody EvidenceReview evidenceReview)
        throws URISyntaxException {
        LOG.debug("REST request to save EvidenceReview : {}", evidenceReview);
        if (evidenceReview.getId() != null) {
            throw new BadRequestAlertException("A new evidenceReview cannot already have an ID", ENTITY_NAME, "idexists");
        }
        evidenceReview = evidenceReviewRepository.save(evidenceReview);
        return ResponseEntity.created(new URI("/api/evidence-reviews/" + evidenceReview.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, evidenceReview.getId().toString()))
            .body(evidenceReview);
    }

    /**
     * {@code PUT  /evidence-reviews/:id} : Updates an existing evidenceReview.
     *
     * @param id the id of the evidenceReview to save.
     * @param evidenceReview the evidenceReview to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated evidenceReview,
     * or with status {@code 400 (Bad Request)} if the evidenceReview is not valid,
     * or with status {@code 500 (Internal Server Error)} if the evidenceReview couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<EvidenceReview> updateEvidenceReview(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody EvidenceReview evidenceReview
    ) throws URISyntaxException {
        LOG.debug("REST request to update EvidenceReview : {}, {}", id, evidenceReview);
        if (evidenceReview.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, evidenceReview.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!evidenceReviewRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        evidenceReview = evidenceReviewRepository.save(evidenceReview);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, evidenceReview.getId().toString()))
            .body(evidenceReview);
    }

    /**
     * {@code PATCH  /evidence-reviews/:id} : Partial updates given fields of an existing evidenceReview, field will ignore if it is null
     *
     * @param id the id of the evidenceReview to save.
     * @param evidenceReview the evidenceReview to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated evidenceReview,
     * or with status {@code 400 (Bad Request)} if the evidenceReview is not valid,
     * or with status {@code 404 (Not Found)} if the evidenceReview is not found,
     * or with status {@code 500 (Internal Server Error)} if the evidenceReview couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<EvidenceReview> partialUpdateEvidenceReview(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody EvidenceReview evidenceReview
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update EvidenceReview partially : {}, {}", id, evidenceReview);
        if (evidenceReview.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, evidenceReview.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!evidenceReviewRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<EvidenceReview> result = evidenceReviewRepository
            .findById(evidenceReview.getId())
            .map(existingEvidenceReview -> {
                updateIfPresent(existingEvidenceReview::setDecision, evidenceReview.getDecision());
                updateIfPresent(existingEvidenceReview::setReason, evidenceReview.getReason());
                updateIfPresent(existingEvidenceReview::setReviewedAt, evidenceReview.getReviewedAt());

                return existingEvidenceReview;
            })
            .map(evidenceReviewRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, evidenceReview.getId().toString())
        );
    }

    /**
     * {@code GET  /evidence-reviews} : get all the Evidence Reviews.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Evidence Reviews in body.
     */
    @GetMapping("")
    public List<EvidenceReview> getAllEvidenceReviews() {
        LOG.debug("REST request to get all EvidenceReviews");
        return evidenceReviewRepository.findAll();
    }

    /**
     * {@code GET  /evidence-reviews/:id} : get the "id" evidenceReview.
     *
     * @param id the id of the evidenceReview to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the evidenceReview, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<EvidenceReview> getEvidenceReview(@PathVariable("id") Long id) {
        LOG.debug("REST request to get EvidenceReview : {}", id);
        Optional<EvidenceReview> evidenceReview = evidenceReviewRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(evidenceReview);
    }

    /**
     * {@code DELETE  /evidence-reviews/:id} : delete the "id" evidenceReview.
     *
     * @param id the id of the evidenceReview to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvidenceReview(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete EvidenceReview : {}", id);
        evidenceReviewRepository.deleteById(id);
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
