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
import vn.edu.fpt.beefcare.domain.ManagerPermission;
import vn.edu.fpt.beefcare.repository.ManagerPermissionRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.ManagerPermission}.
 */
@RestController
@RequestMapping("/api/manager-permissions")
@Transactional
public class ManagerPermissionResource {

    private static final Logger LOG = LoggerFactory.getLogger(ManagerPermissionResource.class);

    private static final String ENTITY_NAME = "managerPermission";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final ManagerPermissionRepository managerPermissionRepository;

    public ManagerPermissionResource(ManagerPermissionRepository managerPermissionRepository) {
        this.managerPermissionRepository = managerPermissionRepository;
    }

    /**
     * {@code POST  /manager-permissions} : Create a new managerPermission.
     *
     * @param managerPermission the managerPermission to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new managerPermission, or with status {@code 400 (Bad Request)} if the managerPermission has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<ManagerPermission> createManagerPermission(@Valid @RequestBody ManagerPermission managerPermission)
        throws URISyntaxException {
        LOG.debug("REST request to save ManagerPermission : {}", managerPermission);
        if (managerPermission.getId() != null) {
            throw new BadRequestAlertException("A new managerPermission cannot already have an ID", ENTITY_NAME, "idexists");
        }
        managerPermission = managerPermissionRepository.save(managerPermission);
        return ResponseEntity.created(new URI("/api/manager-permissions/" + managerPermission.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, managerPermission.getId().toString()))
            .body(managerPermission);
    }

    /**
     * {@code PUT  /manager-permissions/:id} : Updates an existing managerPermission.
     *
     * @param id the id of the managerPermission to save.
     * @param managerPermission the managerPermission to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated managerPermission,
     * or with status {@code 400 (Bad Request)} if the managerPermission is not valid,
     * or with status {@code 500 (Internal Server Error)} if the managerPermission couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ManagerPermission> updateManagerPermission(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody ManagerPermission managerPermission
    ) throws URISyntaxException {
        LOG.debug("REST request to update ManagerPermission : {}, {}", id, managerPermission);
        if (managerPermission.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, managerPermission.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!managerPermissionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        managerPermission = managerPermissionRepository.save(managerPermission);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, managerPermission.getId().toString()))
            .body(managerPermission);
    }

    /**
     * {@code PATCH  /manager-permissions/:id} : Partial updates given fields of an existing managerPermission, field will ignore if it is null
     *
     * @param id the id of the managerPermission to save.
     * @param managerPermission the managerPermission to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated managerPermission,
     * or with status {@code 400 (Bad Request)} if the managerPermission is not valid,
     * or with status {@code 404 (Not Found)} if the managerPermission is not found,
     * or with status {@code 500 (Internal Server Error)} if the managerPermission couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<ManagerPermission> partialUpdateManagerPermission(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody ManagerPermission managerPermission
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update ManagerPermission partially : {}, {}", id, managerPermission);
        if (managerPermission.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, managerPermission.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!managerPermissionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<ManagerPermission> result = managerPermissionRepository
            .findById(managerPermission.getId())
            .map(existingManagerPermission -> {
                updateIfPresent(existingManagerPermission::setPermissionCode, managerPermission.getPermissionCode());
                updateIfPresent(existingManagerPermission::setEnabled, managerPermission.getEnabled());

                return existingManagerPermission;
            })
            .map(managerPermissionRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, managerPermission.getId().toString())
        );
    }

    /**
     * {@code GET  /manager-permissions} : get all the Manager Permissions.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Manager Permissions in body.
     */
    @GetMapping("")
    public List<ManagerPermission> getAllManagerPermissions() {
        LOG.debug("REST request to get all ManagerPermissions");
        return managerPermissionRepository.findAll();
    }

    /**
     * {@code GET  /manager-permissions/:id} : get the "id" managerPermission.
     *
     * @param id the id of the managerPermission to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the managerPermission, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ManagerPermission> getManagerPermission(@PathVariable("id") Long id) {
        LOG.debug("REST request to get ManagerPermission : {}", id);
        Optional<ManagerPermission> managerPermission = managerPermissionRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(managerPermission);
    }

    /**
     * {@code DELETE  /manager-permissions/:id} : delete the "id" managerPermission.
     *
     * @param id the id of the managerPermission to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteManagerPermission(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete ManagerPermission : {}", id);
        managerPermissionRepository.deleteById(id);
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
