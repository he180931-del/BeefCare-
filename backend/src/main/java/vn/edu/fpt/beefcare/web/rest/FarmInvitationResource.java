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
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.FarmInvitation}.
 */
@RestController
@RequestMapping("/api/farm-invitations")
@Transactional
public class FarmInvitationResource {

    private static final Logger LOG = LoggerFactory.getLogger(FarmInvitationResource.class);

    private static final String ENTITY_NAME = "farmInvitation";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final FarmInvitationRepository farmInvitationRepository;

    public FarmInvitationResource(FarmInvitationRepository farmInvitationRepository) {
        this.farmInvitationRepository = farmInvitationRepository;
    }

    /**
     * {@code POST  /farm-invitations} : Create a new farmInvitation.
     *
     * @param farmInvitation the farmInvitation to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new farmInvitation, or with status {@code 400 (Bad Request)} if the farmInvitation has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<FarmInvitation> createFarmInvitation(@Valid @RequestBody FarmInvitation farmInvitation)
        throws URISyntaxException {
        LOG.debug("REST request to save FarmInvitation : {}", farmInvitation);
        if (farmInvitation.getId() != null) {
            throw new BadRequestAlertException("A new farmInvitation cannot already have an ID", ENTITY_NAME, "idexists");
        }
        farmInvitation = farmInvitationRepository.save(farmInvitation);
        return ResponseEntity.created(new URI("/api/farm-invitations/" + farmInvitation.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, farmInvitation.getId().toString()))
            .body(farmInvitation);
    }

    /**
     * {@code PUT  /farm-invitations/:id} : Updates an existing farmInvitation.
     *
     * @param id the id of the farmInvitation to save.
     * @param farmInvitation the farmInvitation to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farmInvitation,
     * or with status {@code 400 (Bad Request)} if the farmInvitation is not valid,
     * or with status {@code 500 (Internal Server Error)} if the farmInvitation couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<FarmInvitation> updateFarmInvitation(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody FarmInvitation farmInvitation
    ) throws URISyntaxException {
        LOG.debug("REST request to update FarmInvitation : {}, {}", id, farmInvitation);
        if (farmInvitation.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farmInvitation.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmInvitationRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        farmInvitation = farmInvitationRepository.save(farmInvitation);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farmInvitation.getId().toString()))
            .body(farmInvitation);
    }

    /**
     * {@code PATCH  /farm-invitations/:id} : Partial updates given fields of an existing farmInvitation, field will ignore if it is null
     *
     * @param id the id of the farmInvitation to save.
     * @param farmInvitation the farmInvitation to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farmInvitation,
     * or with status {@code 400 (Bad Request)} if the farmInvitation is not valid,
     * or with status {@code 404 (Not Found)} if the farmInvitation is not found,
     * or with status {@code 500 (Internal Server Error)} if the farmInvitation couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<FarmInvitation> partialUpdateFarmInvitation(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody FarmInvitation farmInvitation
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update FarmInvitation partially : {}, {}", id, farmInvitation);
        if (farmInvitation.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farmInvitation.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmInvitationRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<FarmInvitation> result = farmInvitationRepository
            .findById(farmInvitation.getId())
            .map(existingFarmInvitation -> {
                updateIfPresent(existingFarmInvitation::setInvitedEmail, farmInvitation.getInvitedEmail());
                updateIfPresent(existingFarmInvitation::setProposedRole, farmInvitation.getProposedRole());
                updateIfPresent(existingFarmInvitation::setProposedPermissions, farmInvitation.getProposedPermissions());
                updateIfPresent(existingFarmInvitation::setStatus, farmInvitation.getStatus());
                updateIfPresent(existingFarmInvitation::setExpiresAt, farmInvitation.getExpiresAt());

                return existingFarmInvitation;
            })
            .map(farmInvitationRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farmInvitation.getId().toString())
        );
    }

    /**
     * {@code GET  /farm-invitations} : get all the Farm Invitations.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Farm Invitations in body.
     */
    @GetMapping("")
    public List<FarmInvitation> getAllFarmInvitations() {
        LOG.debug("REST request to get all FarmInvitations");
        return farmInvitationRepository.findAll();
    }

    /**
     * {@code GET  /farm-invitations/:id} : get the "id" farmInvitation.
     *
     * @param id the id of the farmInvitation to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the farmInvitation, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<FarmInvitation> getFarmInvitation(@PathVariable("id") Long id) {
        LOG.debug("REST request to get FarmInvitation : {}", id);
        Optional<FarmInvitation> farmInvitation = farmInvitationRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(farmInvitation);
    }

    /**
     * {@code DELETE  /farm-invitations/:id} : delete the "id" farmInvitation.
     *
     * @param id the id of the farmInvitation to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFarmInvitation(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete FarmInvitation : {}", id);
        farmInvitationRepository.deleteById(id);
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
