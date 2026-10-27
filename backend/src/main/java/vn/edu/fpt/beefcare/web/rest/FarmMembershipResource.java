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
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.FarmMembership}.
 */
@RestController
@RequestMapping("/api/farm-memberships")
@Transactional
public class FarmMembershipResource {

    private static final Logger LOG = LoggerFactory.getLogger(FarmMembershipResource.class);

    private static final String ENTITY_NAME = "farmMembership";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final FarmMembershipRepository farmMembershipRepository;

    public FarmMembershipResource(FarmMembershipRepository farmMembershipRepository) {
        this.farmMembershipRepository = farmMembershipRepository;
    }

    /**
     * {@code POST  /farm-memberships} : Create a new farmMembership.
     *
     * @param farmMembership the farmMembership to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new farmMembership, or with status {@code 400 (Bad Request)} if the farmMembership has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<FarmMembership> createFarmMembership(@Valid @RequestBody FarmMembership farmMembership)
        throws URISyntaxException {
        LOG.debug("REST request to save FarmMembership : {}", farmMembership);
        if (farmMembership.getId() != null) {
            throw new BadRequestAlertException("A new farmMembership cannot already have an ID", ENTITY_NAME, "idexists");
        }
        farmMembership = farmMembershipRepository.save(farmMembership);
        return ResponseEntity.created(new URI("/api/farm-memberships/" + farmMembership.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, farmMembership.getId().toString()))
            .body(farmMembership);
    }

    /**
     * {@code PUT  /farm-memberships/:id} : Updates an existing farmMembership.
     *
     * @param id the id of the farmMembership to save.
     * @param farmMembership the farmMembership to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farmMembership,
     * or with status {@code 400 (Bad Request)} if the farmMembership is not valid,
     * or with status {@code 500 (Internal Server Error)} if the farmMembership couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<FarmMembership> updateFarmMembership(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody FarmMembership farmMembership
    ) throws URISyntaxException {
        LOG.debug("REST request to update FarmMembership : {}, {}", id, farmMembership);
        if (farmMembership.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farmMembership.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmMembershipRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        farmMembership = farmMembershipRepository.save(farmMembership);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farmMembership.getId().toString()))
            .body(farmMembership);
    }

    /**
     * {@code PATCH  /farm-memberships/:id} : Partial updates given fields of an existing farmMembership, field will ignore if it is null
     *
     * @param id the id of the farmMembership to save.
     * @param farmMembership the farmMembership to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farmMembership,
     * or with status {@code 400 (Bad Request)} if the farmMembership is not valid,
     * or with status {@code 404 (Not Found)} if the farmMembership is not found,
     * or with status {@code 500 (Internal Server Error)} if the farmMembership couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<FarmMembership> partialUpdateFarmMembership(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody FarmMembership farmMembership
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update FarmMembership partially : {}, {}", id, farmMembership);
        if (farmMembership.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farmMembership.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmMembershipRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<FarmMembership> result = farmMembershipRepository
            .findById(farmMembership.getId())
            .map(existingFarmMembership -> {
                updateIfPresent(existingFarmMembership::setRole, farmMembership.getRole());
                updateIfPresent(existingFarmMembership::setStatus, farmMembership.getStatus());

                return existingFarmMembership;
            })
            .map(farmMembershipRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farmMembership.getId().toString())
        );
    }

    /**
     * {@code GET  /farm-memberships} : get all the Farm Memberships.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Farm Memberships in body.
     */
    @GetMapping("")
    public List<FarmMembership> getAllFarmMemberships() {
        LOG.debug("REST request to get all FarmMemberships");
        return farmMembershipRepository.findAll();
    }

    /**
     * {@code GET  /farm-memberships/:id} : get the "id" farmMembership.
     *
     * @param id the id of the farmMembership to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the farmMembership, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<FarmMembership> getFarmMembership(@PathVariable("id") Long id) {
        LOG.debug("REST request to get FarmMembership : {}", id);
        Optional<FarmMembership> farmMembership = farmMembershipRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(farmMembership);
    }

    /**
     * {@code DELETE  /farm-memberships/:id} : delete the "id" farmMembership.
     *
     * @param id the id of the farmMembership to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFarmMembership(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete FarmMembership : {}", id);
        farmMembershipRepository.deleteById(id);
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
