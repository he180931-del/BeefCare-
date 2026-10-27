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
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.web.rest.errors.BadRequestAlertException;

/**
 * REST controller for managing {@link vn.edu.fpt.beefcare.domain.Subscription}.
 */
@RestController
@RequestMapping("/api/subscriptions")
@Transactional
public class SubscriptionResource {

    private static final Logger LOG = LoggerFactory.getLogger(SubscriptionResource.class);

    private static final String ENTITY_NAME = "subscription";

    @Value("${jhipster.clientApp.name:beefcare}")
    private String applicationName;

    private final SubscriptionRepository subscriptionRepository;

    public SubscriptionResource(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    /**
     * {@code POST  /subscriptions} : Create a new subscription.
     *
     * @param subscription the subscription to create.
     * @return the {@link ResponseEntity} with status {@code 201 (Created)} and with body the new subscription, or with status {@code 400 (Bad Request)} if the subscription has already an ID.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PostMapping("")
    public ResponseEntity<Subscription> createSubscription(@Valid @RequestBody Subscription subscription) throws URISyntaxException {
        LOG.debug("REST request to save Subscription : {}", subscription);
        if (subscription.getId() != null) {
            throw new BadRequestAlertException("A new subscription cannot already have an ID", ENTITY_NAME, "idexists");
        }
        subscription = subscriptionRepository.save(subscription);
        return ResponseEntity.created(new URI("/api/subscriptions/" + subscription.getId()))
            .headers(HeaderUtil.createEntityCreationAlert(applicationName, false, ENTITY_NAME, subscription.getId().toString()))
            .body(subscription);
    }

    /**
     * {@code PUT  /subscriptions/:id} : Updates an existing subscription.
     *
     * @param id the id of the subscription to save.
     * @param subscription the subscription to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated subscription,
     * or with status {@code 400 (Bad Request)} if the subscription is not valid,
     * or with status {@code 500 (Internal Server Error)} if the subscription couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PutMapping("/{id}")
    public ResponseEntity<Subscription> updateSubscription(
        @PathVariable(value = "id", required = false) final Long id,
        @Valid @RequestBody Subscription subscription
    ) throws URISyntaxException {
        LOG.debug("REST request to update Subscription : {}, {}", id, subscription);
        if (subscription.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, subscription.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!subscriptionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        subscription = subscriptionRepository.save(subscription);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, subscription.getId().toString()))
            .body(subscription);
    }

    /**
     * {@code PATCH  /subscriptions/:id} : Partial updates given fields of an existing subscription, field will ignore if it is null
     *
     * @param id the id of the subscription to save.
     * @param subscription the subscription to update.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the updated subscription,
     * or with status {@code 400 (Bad Request)} if the subscription is not valid,
     * or with status {@code 404 (Not Found)} if the subscription is not found,
     * or with status {@code 500 (Internal Server Error)} if the subscription couldn't be updated.
     * @throws URISyntaxException if the Location URI syntax is incorrect.
     */
    @PatchMapping(value = "/{id}", consumes = { "application/json", "application/merge-patch+json" })
    public ResponseEntity<Subscription> partialUpdateSubscription(
        @PathVariable(value = "id", required = false) final Long id,
        @NotNull @RequestBody Subscription subscription
    ) throws URISyntaxException {
        LOG.debug("REST request to partial update Subscription partially : {}, {}", id, subscription);
        if (subscription.getId() == null) {
            throw new BadRequestAlertException("Invalid id", ENTITY_NAME, "idnull");
        }
        if (!Objects.equals(id, subscription.getId())) {
            throw new BadRequestAlertException("Invalid ID", ENTITY_NAME, "idinvalid");
        }

        if (!subscriptionRepository.existsById(id)) {
            throw new BadRequestAlertException("Entity not found", ENTITY_NAME, "idnotfound");
        }

        Optional<Subscription> result = subscriptionRepository
            .findById(subscription.getId())
            .map(existingSubscription -> {
                updateIfPresent(existingSubscription::setEntitlementStatus, subscription.getEntitlementStatus());
                updateIfPresent(existingSubscription::setLatestEnd, subscription.getLatestEnd());

                return existingSubscription;
            })
            .map(subscriptionRepository::save);

        return ResponseUtil.wrapOrNotFound(
            result,
            HeaderUtil.createEntityUpdateAlert(applicationName, false, ENTITY_NAME, subscription.getId().toString())
        );
    }

    /**
     * {@code GET  /subscriptions} : get all the Subscriptions.
     *
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and the list of Subscriptions in body.
     */
    @GetMapping("")
    public List<Subscription> getAllSubscriptions() {
        LOG.debug("REST request to get all Subscriptions");
        return subscriptionRepository.findAll();
    }

    /**
     * {@code GET  /subscriptions/:id} : get the "id" subscription.
     *
     * @param id the id of the subscription to retrieve.
     * @return the {@link ResponseEntity} with status {@code 200 (OK)} and with body the subscription, or with status {@code 404 (Not Found)}.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Subscription> getSubscription(@PathVariable("id") Long id) {
        LOG.debug("REST request to get Subscription : {}", id);
        Optional<Subscription> subscription = subscriptionRepository.findById(id);
        return ResponseUtil.wrapOrNotFound(subscription);
    }

    /**
     * {@code DELETE  /subscriptions/:id} : delete the "id" subscription.
     *
     * @param id the id of the subscription to delete.
     * @return the {@link ResponseEntity} with status {@code 204 (NO_CONTENT)}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSubscription(@PathVariable("id") Long id) {
        LOG.debug("REST request to delete Subscription : {}", id);
        subscriptionRepository.deleteById(id);
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
