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
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.repository.ProductionPurposeRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.ProductionPurpose}.
 */
@RestController
@RequestMapping("/api/production-purposes")
@Transactional
public class ProductionPurposeResource {

    private static final Logger LOG = LoggerFactory.getLogger(ProductionPurposeResource.class);

    private static final String ENTITY_NAME = "productionPurpose";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final ProductionPurposeRepository productionPurposeRepository;

    public ProductionPurposeResource(ProductionPurposeRepository productionPurposeRepository) {
        this.productionPurposeRepository = productionPurposeRepository;
    }

    /**
     * {@code POST  /production-purposes} : Create a new productionPurpose.
     *
     * @param productionPurpose the productionPurpose to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new productionPurpose, or with status {@code 400 (Bad Request)} if the productionPurpose has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ProductionPurpose> createProductionPurpose(@Valid @RequestBody ProductionPurpose productionPurpose)
        throws URISyntaxException {
        LOG.debug("REST request to save ProductionPurpose : {}", productionPurpose);
        if (productionPurpose.getId() != null) {
            throw new BadRequestAlertException("A new productionPurpose cannot already have an ID", ENTITY_NAME, "idexists");
        }
        productionPurpose = productionPurposeRepository.save(productionPurpose);
        return ResponseEntity.created(new URI("/api/production-purposes/" + productionPurpose.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, productionPurpose.getId().toString()))
            .body(productionPurpose);
    }

    /**
     * {@code PUT  /production-purposes/:id} : Updates an existing productionPurpose.
     *
     * @param id the id of the productionPurpose to save.
     * @param productionPurpose the productionPurpose to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated productionPurpose,
     * or with status {@code 400 (Bad Request)} if the productionPurpose is not valid,
     * or with status {@code 500 (Internal Server Error)} if the productionPurpose couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ProductionPurpose> updateProductionPurpose(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ProductionPurpose productionPurpose
    ) throws URISyntaxException {
        LOG.debug("REST request to update ProductionPurpose : {}, {}", id, productionPurpose);
        if (productionPurpose.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, productionPurpose.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!productionPurposeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        productionPurpose = productionPurposeRepository.save(productionPurpose);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, productionPurpose.getId().toString()))
            .body(productionPurpose);
    }

    /**
     * {@code PATCH  /production-purposes/:id} : Partial updates given fields of an existing productionPurpose, field will ignore if it is null
     *
     * @param id the id of the productionPurpose to save.
     * @param productionPurpose the productionPurpose to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated productionPurpose,
     * or with status {@code 400 (Bad Request)} if the productionPurpose is not valid,
     * or with status {@code 404 (Not Found)} if the productionPurpose is not found,
     * or with status {@code 500 (Internal Server Error)} if the productionPurpose couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ProductionPurpose> partialUpdateProductionPurpose(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ProductionPurpose productionPurpose
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update ProductionPurpose partially : {}, {}", id, productionPurpose);
        if (productionPurpose.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, productionPurpose.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!productionPurposeRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<ProductionPurpose> result = productionPurposeRepository
            .findById(productionPurpose.getId())
            .map(existingProductionPurpose -> {
                updateIfPresent(existingProductionPurpose::setCode, productionPurpose.getCode());
                updateIfPresent(existingProductionPurpose::setName, productionPurpose.getName());
                updateIfPresent(existingProductionPurpose::setDescription, productionPurpose.getDescription());
                updateIfPresent(existingProductionPurpose::setAvailable, productionPurpose.getAvailable());

                return existingProductionPurpose;
            })
            .map(productionPurposeRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, productionPurpose.getId().toString())
        );
    }

    /**
     * {@code GET  /production-purposes} : get all the Production Purposes.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Production Purposes in body.
     */
    @GetMapping("")
    public List<ProductionPurpose> getAllProductionPurposes() {
        LOG.debug("REST request to get all ProductionPurposes");
        return productionPurposeRepository.findAll();
    }

    /**
     * {@code GET  /production-purposes/:id} : get the "id" productionPurpose.
     *
     * @param id the id of the productionPurpose to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the productionPurpose, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ProductionPurpose> getProductionPurpose(@PathVariable("id") Long id) {
        LOG.debug("REST request to get ProductionPurpose : {}", id);
        Optional<ProductionPurpose> productionPurpose = productionPurposeRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(productionPurpose);
    }

    /**
     * {@code DELETE  /production-purposes/:id} : delete the "id" productionPurpose.
     *
     * @param id the id of the productionPurpose to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProductionPurpose(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete ProductionPurpose : {}", id);
        productionPurposeRepository.deleteById(id);
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
