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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Cattle}.
 */
@RestController
@RequestMapping("/api/cattles")
@Transactional
public class CattleResource {

    private static final Logger LOG = LoggerFactory.getLogger(CattleResource.class);

    private static final String ENTITY_NAME = "cattle";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final CattleRepository cattleRepository;

    public CattleResource(CattleRepository cattleRepository) {
        this.cattleRepository = cattleRepository;
    }

    /**
     * {@code POST  /cattles} : Create a new cattle.
     *
     * @param cattle the cattle to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new cattle, or with status {@code 400 (Bad Request)} if the cattle has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Cattle> createCattle(@Valid @RequestBody Cattle cattle) throws URISyntaxException {
        LOG.debug("REST request to save Cattle : {}", cattle);
        if (cattle.getId() != null) {
            throw new BadRequestAlertException("A new cattle cannot already have an ID", ENTITY_NAME, "idexists");
        }
        cattle = cattleRepository.save(cattle);
        return ResponseEntity.created(new URI("/api/cattles/" + cattle.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, cattle.getId().toString()))
            .body(cattle);
    }

    /**
     * {@code PUT  /cattles/:id} : Updates an existing cattle.
     *
     * @param id the id of the cattle to save.
     * @param cattle the cattle to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cattle,
     * or with status {@code 400 (Bad Request)} if the cattle is not valid,
     * or with status {@code 500 (Internal Server Error)} if the cattle couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Cattle> updateCattle(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Cattle cattle
    ) throws URISyntaxException {
        LOG.debug("REST request to update Cattle : {}, {}", id, cattle);
        if (cattle.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cattle.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cattleRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        cattle = cattleRepository.save(cattle);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cattle.getId().toString()))
            .body(cattle);
    }

    /**
     * {@code PATCH  /cattles/:id} : Partial updates given fields of an existing cattle, field will ignore if it is null
     *
     * @param id the id of the cattle to save.
     * @param cattle the cattle to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cattle,
     * or with status {@code 400 (Bad Request)} if the cattle is not valid,
     * or with status {@code 404 (Not Found)} if the cattle is not found,
     * or with status {@code 500 (Internal Server Error)} if the cattle couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Cattle> partialUpdateCattle(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Cattle cattle
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Cattle partially : {}, {}", id, cattle);
        if (cattle.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cattle.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cattleRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Cattle> result = cattleRepository
            .findById(cattle.getId())
            .map(existingCattle -> {
                updateIfPresent(existingCattle::setDisplayCode, cattle.getDisplayCode());
                updateIfPresent(existingCattle::setEarTag, cattle.getEarTag());
                updateIfPresent(existingCattle::setSex, cattle.getSex());
                updateIfPresent(existingCattle::setBirthDate, cattle.getBirthDate());
                updateIfPresent(existingCattle::setLifeStage, cattle.getLifeStage());
                updateIfPresent(existingCattle::setHerdStatus, cattle.getHerdStatus());

                return existingCattle;
            })
            .map(cattleRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cattle.getId().toString())
        );
    }

    /**
     * {@code GET  /cattles} : get all the Cattles.
     *
     * @param filter the filter of the request.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Cattles in body.
     */
    @GetMapping("")
    public List<Cattle> getAllCattles(@RequestParam(name = "filter", required = false) String filter) {
        if ("herdentry-is-null".equals(filter)) {
            LOG.debug("REST request to get all Cattles where herdEntry is null");
            return StreamSupport.stream(cattleRepository.findAll().spliterator(), false)
                .filter(cattle -> cattle.getHerdEntry() == null)
                .toList();
        }

        if ("herdexit-is-null".equals(filter)) {
            LOG.debug("REST request to get all Cattles where herdExit is null");
            return StreamSupport.stream(cattleRepository.findAll().spliterator(), false)
                .filter(cattle -> cattle.getHerdExit() == null)
                .toList();
        }
        LOG.debug("REST request to get all Cattles");
        return cattleRepository.findAll();
    }

    /**
     * {@code GET  /cattles/:id} : get the "id" cattle.
     *
     * @param id the id of the cattle to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the cattle, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Cattle> getCattle(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Cattle : {}", id);
        Optional<Cattle> cattle = cattleRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(cattle);
    }

    /**
     * {@code DELETE  /cattles/:id} : delete the "id" cattle.
     *
     * @param id the id of the cattle to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCattle(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Cattle : {}", id);
        cattleRepository.deleteById(id);
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
