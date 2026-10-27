package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.HealthObservationAsserts.*;
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
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.repository.HealthObservationRepository;

/**
 * Integration tests for the {@link HealthObservationResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class HealthObservationResourceIT {

    private static final Instant DEFAULT_OBSERVED_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_OBSERVED_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final Instant DEFAULT_ENTRY_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_ENTRY_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_SIGNS_PROGRESS = "AAAAAAAAAA";
    private static final String UPDATED_SIGNS_PROGRESS = "BBBBBBBBBB";

    private static final String DEFAULT_SOURCE = "AAAAAAAAAA";
    private static final String UPDATED_SOURCE = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/health-observations";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private HealthObservationRepository healthObservationRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restHealthObservationMockMvc;

    private HealthObservation healthObservation;

    private HealthObservation insertedHealthObservation;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HealthObservation createEntity(EntityManager em) {
        HealthObservation healthObservation = new HealthObservation()
            .observedTime(DEFAULT_OBSERVED_TIME)
            .entryTime(DEFAULT_ENTRY_TIME)
            .signsProgress(DEFAULT_SIGNS_PROGRESS)
            .source(DEFAULT_SOURCE);
        // Add required entity
        HealthCase healthCase;
        if (TestUtil.findAll(em, HealthCase.class).isEmpty()) {
            healthCase = HealthCaseResourceIT.createEntity(em);
            em.persist(healthCase);
            em.flush();
        } else {
            healthCase = TestUtil.findAll(em, HealthCase.class).get(0);
        }
        healthObservation.setHealthCase(healthCase);
        return healthObservation;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HealthObservation createUpdatedEntity(EntityManager em) {
        HealthObservation updatedHealthObservation = new HealthObservation()
            .observedTime(UPDATED_OBSERVED_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .signsProgress(UPDATED_SIGNS_PROGRESS)
            .source(UPDATED_SOURCE);
        // Add required entity
        HealthCase healthCase;
        if (TestUtil.findAll(em, HealthCase.class).isEmpty()) {
            healthCase = HealthCaseResourceIT.createUpdatedEntity(em);
            em.persist(healthCase);
            em.flush();
        } else {
            healthCase = TestUtil.findAll(em, HealthCase.class).get(0);
        }
        updatedHealthObservation.setHealthCase(healthCase);
        return updatedHealthObservation;
    }

    @BeforeEach
    void initTest() {
        healthObservation = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedHealthObservation != null) {
            healthObservationRepository.delete(insertedHealthObservation);
            insertedHealthObservation = null;
        }
    }

    @Test
    @Transactional
    void createHealthObservation() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the HealthObservation
        var returnedHealthObservation = om.readValue(
            restHealthObservationMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthObservation)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            HealthObservation.class
        );

        // Validate the HealthObservation in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertHealthObservationUpdatableFieldsEquals(returnedHealthObservation, getPersistedHealthObservation(returnedHealthObservation));

        insertedHealthObservation = returnedHealthObservation;
    }

    @Test
    @Transactional
    void createHealthObservationWithExistingId() throws Exception {
        // Create the HealthObservation with an existing ID
        healthObservation.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restHealthObservationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthObservation)))
            .andExpect(status().isBadRequest());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkObservedTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        healthObservation.setObservedTime(null);

        // Create the HealthObservation, which fails.

        restHealthObservationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthObservation)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEntryTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        healthObservation.setEntryTime(null);

        // Create the HealthObservation, which fails.

        restHealthObservationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthObservation)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllHealthObservations() throws Exception {
        // Initialize the database
        insertedHealthObservation = healthObservationRepository.saveAndFlush(healthObservation);

        // Get all the healthObservationList
        restHealthObservationMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(healthObservation.getId().intValue())))
            .andExpect(jsonPath("$.[*].observedTime").value(hasItem(DEFAULT_OBSERVED_TIME.toString())))
            .andExpect(jsonPath("$.[*].entryTime").value(hasItem(DEFAULT_ENTRY_TIME.toString())))
            .andExpect(jsonPath("$.[*].signsProgress").value(hasItem(DEFAULT_SIGNS_PROGRESS)))
            .andExpect(jsonPath("$.[*].source").value(hasItem(DEFAULT_SOURCE)));
    }

    @Test
    @Transactional
    void getHealthObservation() throws Exception {
        // Initialize the database
        insertedHealthObservation = healthObservationRepository.saveAndFlush(healthObservation);

        // Get the healthObservation
        restHealthObservationMockMvc
            .perform(get(ENTITY_API_URL_ID, healthObservation.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(healthObservation.getId().intValue()))
            .andExpect(jsonPath("$.observedTime").value(DEFAULT_OBSERVED_TIME.toString()))
            .andExpect(jsonPath("$.entryTime").value(DEFAULT_ENTRY_TIME.toString()))
            .andExpect(jsonPath("$.signsProgress").value(DEFAULT_SIGNS_PROGRESS))
            .andExpect(jsonPath("$.source").value(DEFAULT_SOURCE));
    }

    @Test
    @Transactional
    void getNonExistingHealthObservation() throws Exception {
        // Get the healthObservation
        restHealthObservationMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingHealthObservation() throws Exception {
        // Initialize the database
        insertedHealthObservation = healthObservationRepository.saveAndFlush(healthObservation);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the healthObservation
        HealthObservation updatedHealthObservation = healthObservationRepository.findById(healthObservation.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedHealthObservation are not directly saved in db
        em.detach(updatedHealthObservation);
        updatedHealthObservation
            .observedTime(UPDATED_OBSERVED_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .signsProgress(UPDATED_SIGNS_PROGRESS)
            .source(UPDATED_SOURCE);

        restHealthObservationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedHealthObservation.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedHealthObservation))
            )
            .andExpect(status().isOk());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedHealthObservationToMatchAllProperties(updatedHealthObservation);
    }

    @Test
    @Transactional
    void putNonExistingHealthObservation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthObservation.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHealthObservationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, healthObservation.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(healthObservation))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchHealthObservation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthObservation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthObservationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(healthObservation))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamHealthObservation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthObservation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthObservationMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthObservation)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateHealthObservationWithPatch() throws Exception {
        // Initialize the database
        insertedHealthObservation = healthObservationRepository.saveAndFlush(healthObservation);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the healthObservation using partial update
        HealthObservation partialUpdatedHealthObservation = new HealthObservation();
        partialUpdatedHealthObservation.setId(healthObservation.getId());

        partialUpdatedHealthObservation
            .observedTime(UPDATED_OBSERVED_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .signsProgress(UPDATED_SIGNS_PROGRESS)
            .source(UPDATED_SOURCE);

        restHealthObservationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHealthObservation.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHealthObservation))
            )
            .andExpect(status().isOk());

        // Validate the HealthObservation in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHealthObservationUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedHealthObservation, healthObservation),
            getPersistedHealthObservation(healthObservation)
        );
    }

    @Test
    @Transactional
    void fullUpdateHealthObservationWithPatch() throws Exception {
        // Initialize the database
        insertedHealthObservation = healthObservationRepository.saveAndFlush(healthObservation);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the healthObservation using partial update
        HealthObservation partialUpdatedHealthObservation = new HealthObservation();
        partialUpdatedHealthObservation.setId(healthObservation.getId());

        partialUpdatedHealthObservation
            .observedTime(UPDATED_OBSERVED_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .signsProgress(UPDATED_SIGNS_PROGRESS)
            .source(UPDATED_SOURCE);

        restHealthObservationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHealthObservation.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHealthObservation))
            )
            .andExpect(status().isOk());

        // Validate the HealthObservation in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHealthObservationUpdatableFieldsEquals(
            partialUpdatedHealthObservation,
            getPersistedHealthObservation(partialUpdatedHealthObservation)
        );
    }

    @Test
    @Transactional
    void patchNonExistingHealthObservation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthObservation.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHealthObservationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, healthObservation.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(healthObservation))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchHealthObservation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthObservation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthObservationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(healthObservation))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamHealthObservation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthObservation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthObservationMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(healthObservation)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HealthObservation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteHealthObservation() throws Exception {
        // Initialize the database
        insertedHealthObservation = healthObservationRepository.saveAndFlush(healthObservation);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the healthObservation
        restHealthObservationMockMvc
            .perform(delete(ENTITY_API_URL_ID, healthObservation.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return healthObservationRepository.count();
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

    protected HealthObservation getPersistedHealthObservation(HealthObservation healthObservation) {
        return healthObservationRepository.findById(healthObservation.getId()).orElseThrow();
    }

    protected void assertPersistedHealthObservationToMatchAllProperties(HealthObservation expectedHealthObservation) {
        assertHealthObservationAllPropertiesEquals(expectedHealthObservation, getPersistedHealthObservation(expectedHealthObservation));
    }

    protected void assertPersistedHealthObservationToMatchUpdatableProperties(HealthObservation expectedHealthObservation) {
        assertHealthObservationAllUpdatablePropertiesEquals(
            expectedHealthObservation,
            getPersistedHealthObservation(expectedHealthObservation)
        );
    }
}
