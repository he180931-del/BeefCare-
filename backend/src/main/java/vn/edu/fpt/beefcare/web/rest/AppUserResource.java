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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.AppUser}.
 */
@RestController
@RequestMapping("/api/app-users")
@Transactional
public class AppUserResource {

    private static final Logger LOG = LoggerFactory.getLogger(AppUserResource.class);

    private static final String ENTITY_NAME = "appUser";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final AppUserRepository appUserRepository;

    public AppUserResource(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    /**
     * {@code POST  /app-users} : Create a new appUser.
     *
     * @param appUser the appUser to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new appUser, or with status {@code 400 (Bad Request)} if the appUser has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<AppUser> createAppUser(@Valid @RequestBody AppUser appUser) throws URISyntaxException {
        LOG.debug("REST request to save AppUser : {}", appUser);
        if (appUser.getId() != null) {
            throw new BadRequestAlertException("A new appUser cannot already have an ID", ENTITY_NAME, "idexists");
        }
        appUser = appUserRepository.save(appUser);
        return ResponseEntity.created(new URI("/api/app-users/" + appUser.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, appUser.getId().toString()))
            .body(appUser);
    }

    /**
     * {@code PUT  /app-users/:id} : Updates an existing appUser.
     *
     * @param id the id of the appUser to save.
     * @param appUser the appUser to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated appUser,
     * or with status {@code 400 (Bad Request)} if the appUser is not valid,
     * or with status {@code 500 (Internal Server Error)} if the appUser couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<AppUser> updateAppUser(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody AppUser appUser
    ) throws URISyntaxException {
        LOG.debug("REST request to update AppUser : {}, {}", id, appUser);
        if (appUser.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, appUser.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!appUserRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        appUser = appUserRepository.save(appUser);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, appUser.getId().toString()))
            .body(appUser);
    }

    /**
     * {@code PATCH  /app-users/:id} : Partial updates given fields of an existing appUser, field will ignore if it is null
     *
     * @param id the id of the appUser to save.
     * @param appUser the appUser to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated appUser,
     * or with status {@code 400 (Bad Request)} if the appUser is not valid,
     * or with status {@code 404 (Not Found)} if the appUser is not found,
     * or with status {@code 500 (Internal Server Error)} if the appUser couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<AppUser> partialUpdateAppUser(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody AppUser appUser
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update AppUser partially : {}, {}", id, appUser);
        if (appUser.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, appUser.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!appUserRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<AppUser> result = appUserRepository
            .findById(appUser.getId())
            .map(existingAppUser -> {
                updateIfPresent(existingAppUser::setEmail, appUser.getEmail());
                updateIfPresent(existingAppUser::setFullName, appUser.getFullName());
                updateIfPresent(existingAppUser::setPhone, appUser.getPhone());
                updateIfPresent(existingAppUser::setAccountStatus, appUser.getAccountStatus());
                updateIfPresent(existingAppUser::setGoogleSubject, appUser.getGoogleSubject());
                updateIfPresent(existingAppUser::setPasswordHash, appUser.getPasswordHash());

                return existingAppUser;
            })
            .map(appUserRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, appUser.getId().toString())
        );
    }

    /**
     * {@code GET  /app-users} : get all the App Users.
     *
     * @param filter the filter of the request.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of App Users in body.
     */
    @GetMapping("")
    public List<AppUser> getAllAppUsers(@RequestParam(name = "filter", required = false) String filter) {
        if ("platformstaffaccess-is-null".equals(filter)) {
            LOG.debug("REST request to get all AppUsers where platformStaffAccess is null");
            return StreamSupport.stream(appUserRepository.findAll().spliterator(), false)
                .filter(appUser -> appUser.getPlatformStaffAccess() == null)
                .toList();
        }
        LOG.debug("REST request to get all AppUsers");
        return appUserRepository.findAll();
    }

    /**
     * {@code GET  /app-users/:id} : get the "id" appUser.
     *
     * @param id the id of the appUser to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the appUser, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AppUser> getAppUser(@PathVariable("id") Long id) {
        LOG.debug("REST request to get AppUser : {}", id);
        Optional<AppUser> appUser = appUserRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(appUser);
    }

    /**
     * {@code DELETE  /app-users/:id} : delete the "id" appUser.
     *
     * @param id the id of the appUser to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAppUser(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete AppUser : {}", id);
        appUserRepository.deleteById(id);
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
