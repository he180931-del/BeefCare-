package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.SubscriptionAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;

/**
 * Integration tests for the {@link SubscriptionResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class SubscriptionResourceIT {

    private static final String DEFAULT_ENTITLEMENT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_ENTITLEMENT_STATUS = "BBBBBBBBBB";

    private static final Instant DEFAULT_LATEST_END = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_LATEST_END = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/subscriptions";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restSubscriptionMockMvc;

    private Subscription subscription;

    private Subscription insertedSubscription;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Subscription createEntity(EntityManager em) {
        Subscription subscription = new Subscription().entitlementStatus(DEFAULT_ENTITLEMENT_STATUS).latestEnd(DEFAULT_LATEST_END);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        subscription.setFarm(farm);
        // Add required entity
        PlanVersion planVersion;
        if (TestUtil.findAll(em, PlanVersion.class).isEmpty()) {
            planVersion = PlanVersionResourceIT.createEntity();
            em.persist(planVersion);
            em.flush();
        } else {
            planVersion = TestUtil.findAll(em, PlanVersion.class).get(0);
        }
        subscription.setPlanVersion(planVersion);
        return subscription;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Subscription createUpdatedEntity(EntityManager em) {
        Subscription updatedSubscription = new Subscription().entitlementStatus(UPDATED_ENTITLEMENT_STATUS).latestEnd(UPDATED_LATEST_END);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedSubscription.setFarm(farm);
        // Add required entity
        PlanVersion planVersion;
        if (TestUtil.findAll(em, PlanVersion.class).isEmpty()) {
            planVersion = PlanVersionResourceIT.createUpdatedEntity();
            em.persist(planVersion);
            em.flush();
        } else {
            planVersion = TestUtil.findAll(em, PlanVersion.class).get(0);
        }
        updatedSubscription.setPlanVersion(planVersion);
        return updatedSubscription;
    }

    @BeforeEach
    void initTest() {
        subscription = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedSubscription != null) {
            subscriptionRepository.delete(insertedSubscription);
            insertedSubscription = null;
        }
    }

    @Test
    @Transactional
    void createSubscription() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Subscription
        var returnedSubscription = om.readValue(
            restSubscriptionMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(subscription)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Subscription.class
        );

        // Validate the Subscription in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertSubscriptionUpdatableFieldsEquals(returnedSubscription, getPersistedSubscription(returnedSubscription));

        insertedSubscription = returnedSubscription;
    }

    @Test
    @Transactional
    void createSubscriptionWithExistingId() throws Exception {
        // Create the Subscription with an existing ID
        subscription.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restSubscriptionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(subscription)))
            .andExpect(status().isBadRequest());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkEntitlementStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        subscription.setEntitlementStatus(null);

        // Create the Subscription, which fails.

        restSubscriptionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(subscription)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllSubscriptions() throws Exception {
        // Initialize the database
        insertedSubscription = subscriptionRepository.saveAndFlush(subscription);

        // Get all the subscriptionList
        restSubscriptionMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(subscription.getId().intValue())))
            .andExpect(jsonPath("$.[*].entitlementStatus").value(hasItem(DEFAULT_ENTITLEMENT_STATUS)))
            .andExpect(jsonPath("$.[*].latestEnd").value(hasItem(DEFAULT_LATEST_END.toString())));
    }

    @Test
    @Transactional
    void getSubscription() throws Exception {
        // Initialize the database
        insertedSubscription = subscriptionRepository.saveAndFlush(subscription);

        // Get the subscription
        restSubscriptionMockMvc
            .perform(get(ENTITY_API_URL_ID, subscription.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(subscription.getId().intValue()))
            .andExpect(jsonPath("$.entitlementStatus").value(DEFAULT_ENTITLEMENT_STATUS))
            .andExpect(jsonPath("$.latestEnd").value(DEFAULT_LATEST_END.toString()));
    }

    @Test
    @Transactional
    void getNonExistingSubscription() throws Exception {
        // Get the subscription
        restSubscriptionMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingSubscription() throws Exception {
        // Initialize the database
        insertedSubscription = subscriptionRepository.saveAndFlush(subscription);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the subscription
        Subscription updatedSubscription = subscriptionRepository.findById(subscription.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedSubscription are not directly saved in db
        em.detach(updatedSubscription);
        updatedSubscription.entitlementStatus(UPDATED_ENTITLEMENT_STATUS).latestEnd(UPDATED_LATEST_END);

        restSubscriptionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedSubscription.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedSubscription))
            )
            .andExpect(status().isOk());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedSubscriptionToMatchAllProperties(updatedSubscription);
    }

    @Test
    @Transactional
    void putNonExistingSubscription() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        subscription.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSubscriptionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, subscription.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(subscription))
            )
            .andExpect(status().isBadRequest());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchSubscription() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        subscription.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSubscriptionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(subscription))
            )
            .andExpect(status().isBadRequest());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamSubscription() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        subscription.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSubscriptionMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(subscription)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateSubscriptionWithPatch() throws Exception {
        // Initialize the database
        insertedSubscription = subscriptionRepository.saveAndFlush(subscription);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the subscription using partial update
        Subscription partialUpdatedSubscription = new Subscription();
        partialUpdatedSubscription.setId(subscription.getId());

        partialUpdatedSubscription.latestEnd(UPDATED_LATEST_END);

        restSubscriptionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSubscription.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSubscription))
            )
            .andExpect(status().isOk());

        // Validate the Subscription in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSubscriptionUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedSubscription, subscription),
            getPersistedSubscription(subscription)
        );
    }

    @Test
    @Transactional
    void fullUpdateSubscriptionWithPatch() throws Exception {
        // Initialize the database
        insertedSubscription = subscriptionRepository.saveAndFlush(subscription);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the subscription using partial update
        Subscription partialUpdatedSubscription = new Subscription();
        partialUpdatedSubscription.setId(subscription.getId());

        partialUpdatedSubscription.entitlementStatus(UPDATED_ENTITLEMENT_STATUS).latestEnd(UPDATED_LATEST_END);

        restSubscriptionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSubscription.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSubscription))
            )
            .andExpect(status().isOk());

        // Validate the Subscription in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSubscriptionUpdatableFieldsEquals(partialUpdatedSubscription, getPersistedSubscription(partialUpdatedSubscription));
    }

    @Test
    @Transactional
    void patchNonExistingSubscription() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        subscription.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSubscriptionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, subscription.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(subscription))
            )
            .andExpect(status().isBadRequest());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchSubscription() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        subscription.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSubscriptionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(subscription))
            )
            .andExpect(status().isBadRequest());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamSubscription() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        subscription.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSubscriptionMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(subscription)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Subscription in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteSubscription() throws Exception {
        // Initialize the database
        insertedSubscription = subscriptionRepository.saveAndFlush(subscription);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the subscription
        restSubscriptionMockMvc
            .perform(delete(ENTITY_API_URL_ID, subscription.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return subscriptionRepository.count();
    }

    protected void assertIncrementedRepositoryCount(long countBefore) {
        assertThat(countBefore + 1).isEqualTo(getRepositoryCount());
    }

    protected void assertDecrementedRepositoryCount(long countBefore) {
        assertThat(countBefore - 1).isEqualTo(getRepositoryCount());
    }

    protected void assertSameRepositoryCount(long countBefore) {
        assertThat(countBefore).isEqualTo(getRepositoryCount());
    }

    protected Subscription getPersistedSubscription(Subscription subscription) {
        return subscriptionRepository.findById(subscription.getId()).orElseThrow();
    }

    protected void assertPersistedSubscriptionToMatchAllProperties(Subscription expectedSubscription) {
        assertSubscriptionAllPropertiesEquals(expectedSubscription, getPersistedSubscription(expectedSubscription));
    }

    protected void assertPersistedSubscriptionToMatchUpdatableProperties(Subscription expectedSubscription) {
        assertSubscriptionAllUpdatablePropertiesEquals(expectedSubscription, getPersistedSubscription(expectedSubscription));
    }
}
