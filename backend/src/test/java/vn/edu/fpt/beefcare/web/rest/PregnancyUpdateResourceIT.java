package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PregnancyUpdateAsserts.*;
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
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.PregnancyUpdate;
import vn.edu.fpt.beefcare.repository.PregnancyUpdateRepository;

/**
 * Integration tests for the {@link PregnancyUpdateResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PregnancyUpdateResourceIT {

    private static final String DEFAULT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_TYPE = "BBBBBBBBBB";

    private static final Instant DEFAULT_OCCURRED_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_OCCURRED_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_DETAILS = "AAAAAAAAAA";
    private static final String UPDATED_DETAILS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/pregnancy-updates";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PregnancyUpdateRepository pregnancyUpdateRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPregnancyUpdateMockMvc;

    private PregnancyUpdate pregnancyUpdate;

    private PregnancyUpdate insertedPregnancyUpdate;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PregnancyUpdate createEntity(EntityManager em) {
        PregnancyUpdate pregnancyUpdate = new PregnancyUpdate()
            .type(DEFAULT_TYPE)
            .occurredTime(DEFAULT_OCCURRED_TIME)
            .details(DEFAULT_DETAILS);
        // Add required entity
        PregnancyEpisode pregnancyEpisode;
        if (TestUtil.findAll(em, PregnancyEpisode.class).isEmpty()) {
            pregnancyEpisode = PregnancyEpisodeResourceIT.createEntity(em);
            em.persist(pregnancyEpisode);
            em.flush();
        } else {
            pregnancyEpisode = TestUtil.findAll(em, PregnancyEpisode.class).get(0);
        }
        pregnancyUpdate.setEpisode(pregnancyEpisode);
        return pregnancyUpdate;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PregnancyUpdate createUpdatedEntity(EntityManager em) {
        PregnancyUpdate updatedPregnancyUpdate = new PregnancyUpdate()
            .type(UPDATED_TYPE)
            .occurredTime(UPDATED_OCCURRED_TIME)
            .details(UPDATED_DETAILS);
        // Add required entity
        PregnancyEpisode pregnancyEpisode;
        if (TestUtil.findAll(em, PregnancyEpisode.class).isEmpty()) {
            pregnancyEpisode = PregnancyEpisodeResourceIT.createUpdatedEntity(em);
            em.persist(pregnancyEpisode);
            em.flush();
        } else {
            pregnancyEpisode = TestUtil.findAll(em, PregnancyEpisode.class).get(0);
        }
        updatedPregnancyUpdate.setEpisode(pregnancyEpisode);
        return updatedPregnancyUpdate;
    }

    @BeforeEach
    void initTest() {
        pregnancyUpdate = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedPregnancyUpdate != null) {
            pregnancyUpdateRepository.delete(insertedPregnancyUpdate);
            insertedPregnancyUpdate = null;
        }
    }

    @Test
    @Transactional
    void createPregnancyUpdate() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PregnancyUpdate
        var returnedPregnancyUpdate = om.readValue(
            restPregnancyUpdateMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyUpdate)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PregnancyUpdate.class
        );

        // Validate the PregnancyUpdate in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPregnancyUpdateUpdatableFieldsEquals(returnedPregnancyUpdate, getPersistedPregnancyUpdate(returnedPregnancyUpdate));

        insertedPregnancyUpdate = returnedPregnancyUpdate;
    }

    @Test
    @Transactional
    void createPregnancyUpdateWithExistingId() throws Exception {
        // Create the PregnancyUpdate with an existing ID
        pregnancyUpdate.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPregnancyUpdateMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyUpdate)))
            .andExpect(status().isBadRequest());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pregnancyUpdate.setType(null);

        // Create the PregnancyUpdate, which fails.

        restPregnancyUpdateMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyUpdate)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOccurredTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pregnancyUpdate.setOccurredTime(null);

        // Create the PregnancyUpdate, which fails.

        restPregnancyUpdateMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyUpdate)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPregnancyUpdates() throws Exception {
        // Initialize the database
        insertedPregnancyUpdate = pregnancyUpdateRepository.saveAndFlush(pregnancyUpdate);

        // Get all the pregnancyUpdateList
        restPregnancyUpdateMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(pregnancyUpdate.getId().intValue())))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE)))
            .andExpect(jsonPath("$.[*].occurredTime").value(hasItem(DEFAULT_OCCURRED_TIME.toString())))
            .andExpect(jsonPath("$.[*].details").value(hasItem(DEFAULT_DETAILS)));
    }

    @Test
    @Transactional
    void getPregnancyUpdate() throws Exception {
        // Initialize the database
        insertedPregnancyUpdate = pregnancyUpdateRepository.saveAndFlush(pregnancyUpdate);

        // Get the pregnancyUpdate
        restPregnancyUpdateMockMvc
            .perform(get(ENTITY_API_URL_ID, pregnancyUpdate.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(pregnancyUpdate.getId().intValue()))
            .andExpect(jsonPath("$.type").value(DEFAULT_TYPE))
            .andExpect(jsonPath("$.occurredTime").value(DEFAULT_OCCURRED_TIME.toString()))
            .andExpect(jsonPath("$.details").value(DEFAULT_DETAILS));
    }

    @Test
    @Transactional
    void getNonExistingPregnancyUpdate() throws Exception {
        // Get the pregnancyUpdate
        restPregnancyUpdateMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPregnancyUpdate() throws Exception {
        // Initialize the database
        insertedPregnancyUpdate = pregnancyUpdateRepository.saveAndFlush(pregnancyUpdate);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pregnancyUpdate
        PregnancyUpdate updatedPregnancyUpdate = pregnancyUpdateRepository.findById(pregnancyUpdate.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPregnancyUpdate are not directly saved in db
        em.detach(updatedPregnancyUpdate);
        updatedPregnancyUpdate.type(UPDATED_TYPE).occurredTime(UPDATED_OCCURRED_TIME).details(UPDATED_DETAILS);

        restPregnancyUpdateMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPregnancyUpdate.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedPregnancyUpdate))
            )
            .andExpect(status().isOk());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPregnancyUpdateToMatchAllProperties(updatedPregnancyUpdate);
    }

    @Test
    @Transactional
    void putNonExistingPregnancyUpdate() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyUpdate.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPregnancyUpdateMockMvc
            .perform(
                put(ENTITY_API_URL_ID, pregnancyUpdate.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(pregnancyUpdate))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPregnancyUpdate() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyUpdate.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyUpdateMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(pregnancyUpdate))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPregnancyUpdate() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyUpdate.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyUpdateMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyUpdate)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePregnancyUpdateWithPatch() throws Exception {
        // Initialize the database
        insertedPregnancyUpdate = pregnancyUpdateRepository.saveAndFlush(pregnancyUpdate);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pregnancyUpdate using partial update
        PregnancyUpdate partialUpdatedPregnancyUpdate = new PregnancyUpdate();
        partialUpdatedPregnancyUpdate.setId(pregnancyUpdate.getId());

        partialUpdatedPregnancyUpdate.type(UPDATED_TYPE).details(UPDATED_DETAILS);

        restPregnancyUpdateMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPregnancyUpdate.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPregnancyUpdate))
            )
            .andExpect(status().isOk());

        // Validate the PregnancyUpdate in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPregnancyUpdateUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPregnancyUpdate, pregnancyUpdate),
            getPersistedPregnancyUpdate(pregnancyUpdate)
        );
    }

    @Test
    @Transactional
    void fullUpdatePregnancyUpdateWithPatch() throws Exception {
        // Initialize the database
        insertedPregnancyUpdate = pregnancyUpdateRepository.saveAndFlush(pregnancyUpdate);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pregnancyUpdate using partial update
        PregnancyUpdate partialUpdatedPregnancyUpdate = new PregnancyUpdate();
        partialUpdatedPregnancyUpdate.setId(pregnancyUpdate.getId());

        partialUpdatedPregnancyUpdate.type(UPDATED_TYPE).occurredTime(UPDATED_OCCURRED_TIME).details(UPDATED_DETAILS);

        restPregnancyUpdateMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPregnancyUpdate.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPregnancyUpdate))
            )
            .andExpect(status().isOk());

        // Validate the PregnancyUpdate in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPregnancyUpdateUpdatableFieldsEquals(
            partialUpdatedPregnancyUpdate,
            getPersistedPregnancyUpdate(partialUpdatedPregnancyUpdate)
        );
    }

    @Test
    @Transactional
    void patchNonExistingPregnancyUpdate() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyUpdate.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPregnancyUpdateMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, pregnancyUpdate.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(pregnancyUpdate))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPregnancyUpdate() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyUpdate.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyUpdateMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(pregnancyUpdate))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPregnancyUpdate() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyUpdate.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyUpdateMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(pregnancyUpdate)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PregnancyUpdate in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePregnancyUpdate() throws Exception {
        // Initialize the database
        insertedPregnancyUpdate = pregnancyUpdateRepository.saveAndFlush(pregnancyUpdate);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the pregnancyUpdate
        restPregnancyUpdateMockMvc
            .perform(delete(ENTITY_API_URL_ID, pregnancyUpdate.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return pregnancyUpdateRepository.count();
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

    protected PregnancyUpdate getPersistedPregnancyUpdate(PregnancyUpdate pregnancyUpdate) {
        return pregnancyUpdateRepository.findById(pregnancyUpdate.getId()).orElseThrow();
    }

    protected void assertPersistedPregnancyUpdateToMatchAllProperties(PregnancyUpdate expectedPregnancyUpdate) {
        assertPregnancyUpdateAllPropertiesEquals(expectedPregnancyUpdate, getPersistedPregnancyUpdate(expectedPregnancyUpdate));
    }

    protected void assertPersistedPregnancyUpdateToMatchUpdatableProperties(PregnancyUpdate expectedPregnancyUpdate) {
        assertPregnancyUpdateAllUpdatablePropertiesEquals(expectedPregnancyUpdate, getPersistedPregnancyUpdate(expectedPregnancyUpdate));
    }
}
