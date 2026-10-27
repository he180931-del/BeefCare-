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
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Farm}.
 */
@RestController
@RequestMapping("/api/farms")
@Transactional
public class FarmResource {

    private static final Logger LOG = LoggerFactory.getLogger(FarmResource.class);

    private static final String ENTITY_NAME = "farm";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final FarmRepository farmRepository;

    public FarmResource(FarmRepository farmRepository) {
        this.farmRepository = farmRepository;
    }

    /**
     * {@code POST  /farms} : Create a new farm.
     *
     * @param farm the farm to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new farm, or with status {@code 400 (Bad Request)} if the farm has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Farm> createFarm(@Valid @RequestBody Farm farm) throws URISyntaxException {
        LOG.debug("REST request to save Farm : {}", farm);
        if (farm.getId() != null) {
            throw new BadRequestAlertException("A new farm cannot already have an ID", ENTITY_NAME, "idexists");
        }
        farm = farmRepository.save(farm);
        return ResponseEntity.created(new URI("/api/farms/" + farm.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, farm.getId().toString()))
            .body(farm);
    }

    /**
     * {@code PUT  /farms/:id} : Updates an existing farm.
     *
     * @param id the id of the farm to save.
     * @param farm the farm to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farm,
     * or with status {@code 400 (Bad Request)} if the farm is not valid,
     * or with status {@code 500 (Internal Server Error)} if the farm couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Farm> updateFarm(@PathVariable(value = "id", required = false) final Long id, @Valid @RequestBody Farm farm)
        throws URISyntaxException {
        LOG.debug("REST request to update Farm : {}, {}", id, farm);
        if (farm.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farm.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        farm = farmRepository.save(farm);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farm.getId().toString()))
            .body(farm);
    }

    /**
     * {@code PATCH  /farms/:id} : Partial updates given fields of an existing farm, field will ignore if it is null
     *
     * @param id the id of the farm to save.
     * @param farm the farm to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated farm,
     * or with status {@code 400 (Bad Request)} if the farm is not valid,
     * or with status {@code 404 (Not Found)} if the farm is not found,
     * or with status {@code 500 (Internal Server Error)} if the farm couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Farm> partialUpdateFarm(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Farm farm
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Farm partially : {}, {}", id, farm);
        if (farm.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, farm.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!farmRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Farm> result = farmRepository
            .findById(farm.getId())
            .map(existingFarm -> {
                updateIfPresent(existingFarm::setName, farm.getName());
                updateIfPresent(existingFarm::setLocation, farm.getLocation());
                updateIfPresent(existingFarm::setContact, farm.getContact());
                updateIfPresent(existingFarm::setServiceStatus, farm.getServiceStatus());

                return existingFarm;
            })
            .map(farmRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, farm.getId().toString())
        );
    }

    /**
     * {@code GET  /farms} : get all the Farms.
     *
     * @param filter the filter of the request.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Farms in body.
     */
    @GetMapping("")
    public List<Farm> getAllFarms(@RequestParam(name = "filter", required = false) String filter) {
        if ("subscription-is-null".equals(filter)) {
            LOG.debug("REST request to get all Farms where subscription is null");
            return StreamSupport.stream(farmRepository.findAll().spliterator(), false)
                .filter(farm -> farm.getSubscription() == null)
                .toList();
        }
        LOG.debug("REST request to get all Farms");
        return farmRepository.findAll();
    }

    /**
     * {@code GET  /farms/:id} : get the "id" farm.
     *
     * @param id the id of the farm to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the farm, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Farm> getFarm(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Farm : {}", id);
        Optional<Farm> farm = farmRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(farm);
    }

    /**
     * {@code DELETE  /farms/:id} : delete the "id" farm.
     *
     * @param id the id of the farm to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFarm(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Farm : {}", id);
        farmRepository.deleteById(id);
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
