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
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.repository.GrowthRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Growth}.
 */
@RestController
@RequestMapping("/api/growths")
@Transactional
public class GrowthResource {

    private static final Logger LOG = LoggerFactory.getLogger(GrowthResource.class);

    private static final String ENTITY_NAME = "growth";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final GrowthRepository growthRepository;

    public GrowthResource(GrowthRepository growthRepository) {
        this.growthRepository = growthRepository;
    }

    /**
     * {@code POST  /growths} : Create a new growth.
     *
     * @param growth the growth to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new growth, or with status {@code 400 (Bad Request)} if the growth has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Growth> createGrowth(@Valid @RequestBody Growth growth) throws URISyntaxException {
        LOG.debug("REST request to save Growth : {}", growth);
        if (growth.getId() != null) {
            throw new BadRequestAlertException("A new growth cannot already have an ID", ENTITY_NAME, "idexists");
        }
        growth = growthRepository.save(growth);
        return ResponseEntity.created(new URI("/api/growths/" + growth.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, growth.getId().toString()))
            .body(growth);
    }

    /**
     * {@code PUT  /growths/:id} : Updates an existing growth.
     *
     * @param id the id of the growth to save.
     * @param growth the growth to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated growth,
     * or with status {@code 400 (Bad Request)} if the growth is not valid,
     * or with status {@code 500 (Internal Server Error)} if the growth couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Growth> updateGrowth(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Growth growth
    ) throws URISyntaxException {
        LOG.debug("REST request to update Growth : {}, {}", id, growth);
        if (growth.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, growth.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!growthRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        growth = growthRepository.save(growth);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, growth.getId().toString()))
            .body(growth);
    }

    /**
     * {@code PATCH  /growths/:id} : Partial updates given fields of an existing growth, field will ignore if it is null
     *
     * @param id the id of the growth to save.
     * @param growth the growth to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated growth,
     * or with status {@code 400 (Bad Request)} if the growth is not valid,
     * or with status {@code 404 (Not Found)} if the growth is not found,
     * or with status {@code 500 (Internal Server Error)} if the growth couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Growth> partialUpdateGrowth(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Growth growth
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Growth partially : {}, {}", id, growth);
        if (growth.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, growth.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!growthRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Growth> result = growthRepository
            .findById(growth.getId())
            .map(existingGrowth -> {
                updateIfPresent(existingGrowth::setCheckDate, growth.getCheckDate());
                updateIfPresent(existingGrowth::setEntryTime, growth.getEntryTime());
                updateIfPresent(existingGrowth::setWeightKg, growth.getWeightKg());
                updateIfPresent(existingGrowth::setWeightType, growth.getWeightType());
                updateIfPresent(existingGrowth::setBcs, growth.getBcs());
                updateIfPresent(existingGrowth::setStatus, growth.getStatus());
                updateIfPresent(existingGrowth::setCorrectionReason, growth.getCorrectionReason());

                return existingGrowth;
            })
            .map(growthRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, growth.getId().toString())
        );
    }

    /**
     * {@code GET  /growths} : get all the Growths.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Growths in body.
     */
    @GetMapping("")
    public List<Growth> getAllGrowths() {
        LOG.debug("REST request to get all Growths");
        return growthRepository.findAll();
    }

    /**
     * {@code GET  /growths/:id} : get the "id" growth.
     *
     * @param id the id of the growth to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the growth, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Growth> getGrowth(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Growth : {}", id);
        Optional<Growth> growth = growthRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(growth);
    }

    /**
     * {@code DELETE  /growths/:id} : delete the "id" growth.
     *
     * @param id the id of the growth to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGrowth(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Growth : {}", id);
        growthRepository.deleteById(id);
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
