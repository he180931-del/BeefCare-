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
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.CattleQrTag}.
 */
@RestController
@RequestMapping("/api/cattle-qr-tags")
@Transactional
public class CattleQrTagResource {

    private static final Logger LOG = LoggerFactory.getLogger(CattleQrTagResource.class);

    private static final String ENTITY_NAME = "cattleQrTag";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final CattleQrTagRepository cattleQrTagRepository;

    public CattleQrTagResource(CattleQrTagRepository cattleQrTagRepository) {
        this.cattleQrTagRepository = cattleQrTagRepository;
    }

    /**
     * {@code POST  /cattle-qr-tags} : Create a new cattleQrTag.
     *
     * @param cattleQrTag the cattleQrTag to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new cattleQrTag, or with status {@code 400 (Bad Request)} if the cattleQrTag has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<CattleQrTag> createCattleQrTag(@Valid @RequestBody CattleQrTag cattleQrTag) throws URISyntaxException {
        LOG.debug("REST request to save CattleQrTag : {}", cattleQrTag);
        if (cattleQrTag.getId() != null) {
            throw new BadRequestAlertException("A new cattleQrTag cannot already have an ID", ENTITY_NAME, "idexists");
        }
        cattleQrTag = cattleQrTagRepository.save(cattleQrTag);
        return ResponseEntity.created(new URI("/api/cattle-qr-tags/" + cattleQrTag.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, cattleQrTag.getId().toString()))
            .body(cattleQrTag);
    }

    /**
     * {@code PUT  /cattle-qr-tags/:id} : Updates an existing cattleQrTag.
     *
     * @param id the id of the cattleQrTag to save.
     * @param cattleQrTag the cattleQrTag to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cattleQrTag,
     * or with status {@code 400 (Bad Request)} if the cattleQrTag is not valid,
     * or with status {@code 500 (Internal Server Error)} if the cattleQrTag couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<CattleQrTag> updateCattleQrTag(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody CattleQrTag cattleQrTag
    ) throws URISyntaxException {
        LOG.debug("REST request to update CattleQrTag : {}, {}", id, cattleQrTag);
        if (cattleQrTag.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cattleQrTag.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cattleQrTagRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        cattleQrTag = cattleQrTagRepository.save(cattleQrTag);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cattleQrTag.getId().toString()))
            .body(cattleQrTag);
    }

    /**
     * {@code PATCH  /cattle-qr-tags/:id} : Partial updates given fields of an existing cattleQrTag, field will ignore if it is null
     *
     * @param id the id of the cattleQrTag to save.
     * @param cattleQrTag the cattleQrTag to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated cattleQrTag,
     * or with status {@code 400 (Bad Request)} if the cattleQrTag is not valid,
     * or with status {@code 404 (Not Found)} if the cattleQrTag is not found,
     * or with status {@code 500 (Internal Server Error)} if the cattleQrTag couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<CattleQrTag> partialUpdateCattleQrTag(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody CattleQrTag cattleQrTag
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update CattleQrTag partially : {}, {}", id, cattleQrTag);
        if (cattleQrTag.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, cattleQrTag.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!cattleQrTagRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<CattleQrTag> result = cattleQrTagRepository
            .findById(cattleQrTag.getId())
            .map(existingCattleQrTag -> {
                updateIfPresent(existingCattleQrTag::setTagCode, cattleQrTag.getTagCode());
                updateIfPresent(existingCattleQrTag::setStatus, cattleQrTag.getStatus());

                return existingCattleQrTag;
            })
            .map(cattleQrTagRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, cattleQrTag.getId().toString())
        );
    }

    /**
     * {@code GET  /cattle-qr-tags} : get all the Cattle Qr Tags.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Cattle Qr Tags in body.
     */
    @GetMapping("")
    public List<CattleQrTag> getAllCattleQrTags() {
        LOG.debug("REST request to get all CattleQrTags");
        return cattleQrTagRepository.findAll();
    }

    /**
     * {@code GET  /cattle-qr-tags/:id} : get the "id" cattleQrTag.
     *
     * @param id the id of the cattleQrTag to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the cattleQrTag, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<CattleQrTag> getCattleQrTag(@PathVariable("id") Long id) {
        LOG.debug("REST request to get CattleQrTag : {}", id);
        Optional<CattleQrTag> cattleQrTag = cattleQrTagRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(cattleQrTag);
    }

    /**
     * {@code DELETE  /cattle-qr-tags/:id} : delete the "id" cattleQrTag.
     *
     * @param id the id of the cattleQrTag to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCattleQrTag(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete CattleQrTag : {}", id);
        cattleQrTagRepository.deleteById(id);
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
