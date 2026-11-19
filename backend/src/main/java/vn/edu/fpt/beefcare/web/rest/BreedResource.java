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
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.repository.BreedRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Breed}.
 */
@RestController
@RequestMapping("/api/breeds")
@Transactional
public class BreedResource {

    private static final Logger LOG = LoggerFactory.getLogger(BreedResource.class);

    private static final String ENTITY_NAME = "breed";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final BreedRepository breedRepository;

    public BreedResource(BreedRepository breedRepository) {
        this.breedRepository = breedRepository;
    }

    /**
     * {@code POST  /breeds} : Create a new breed.
     *
     * @param breed the breed to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new breed, or with status {@code 400 (Bad Request)} if the breed has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Breed> createBreed(@Valid @RequestBody Breed breed) throws URISyntaxException {
        LOG.debug("REST request to save Breed : {}", breed);
        if (breed.getId() != null) {
            throw new BadRequestAlertException("A new breed cannot already have an ID", ENTITY_NAME, "idexists");
        }
        breed = breedRepository.save(breed);
        return ResponseEntity.created(new URI("/api/breeds/" + breed.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, breed.getId().toString()))
            .body(breed);
    }

    /**
     * {@code PUT  /breeds/:id} : Updates an existing breed.
     *
     * @param id the id of the breed to save.
     * @param breed the breed to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated breed,
     * or with status {@code 400 (Bad Request)} if the breed is not valid,
     * or with status {@code 500 (Internal Server Error)} if the breed couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Breed> updateBreed(@PathVariable(value = "id", required = false) final Long id, @Valid @RequestBody Breed breed)
        throws URISyntaxException {
        LOG.debug("REST request to update Breed : {}, {}", id, breed);
        if (breed.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, breed.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!breedRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        breed = breedRepository.save(breed);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, breed.getId().toString()))
            .body(breed);
    }

    /**
     * {@code PATCH  /breeds/:id} : Partial updates given fields of an existing breed, field will ignore if it is null
     *
     * @param id the id of the breed to save.
     * @param breed the breed to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated breed,
     * or with status {@code 400 (Bad Request)} if the breed is not valid,
     * or with status {@code 404 (Not Found)} if the breed is not found,
     * or with status {@code 500 (Internal Server Error)} if the breed couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Breed> partialUpdateBreed(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Breed breed
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Breed partially : {}, {}", id, breed);
        if (breed.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, breed.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!breedRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Breed> result = breedRepository
            .findById(breed.getId())
            .map(existingBreed -> {
                updateIfPresent(existingBreed::setCode, breed.getCode());
                updateIfPresent(existingBreed::setName, breed.getName());
                updateIfPresent(existingBreed::setDescription, breed.getDescription());
                updateIfPresent(existingBreed::setAvailable, breed.getAvailable());

                return existingBreed;
            })
            .map(breedRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, breed.getId().toString())
        );
    }

    /**
     * {@code GET  /breeds} : get all the Breeds.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Breeds in body.
     */
    @GetMapping("")
    public List<Breed> getAllBreeds() {
        LOG.debug("REST request to get all Breeds");
        return breedRepository.findAll();
    }

    /**
     * {@code GET  /breeds/:id} : get the "id" breed.
     *
     * @param id the id of the breed to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the breed, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Breed> getBreed(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Breed : {}", id);
        Optional<Breed> breed = breedRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(breed);
    }

    /**
     * {@code DELETE  /breeds/:id} : delete the "id" breed.
     *
     * @param id the id of the breed to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBreed(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Breed : {}", id);
        breedRepository.deleteById(id);
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
