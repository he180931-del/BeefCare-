package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.SupportHistoryAsserts.*;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.SupportHistory;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.SupportHistoryRepository;

/**
 * Integration tests for the {@link SupportHistoryResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class SupportHistoryResourceIT {

    private static final String DEFAULT_EVENT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_EVENT_TYPE = "BBBBBBBBBB";

    private static final String DEFAULT_PRIOR_STATE = "AAAAAAAAAA";
    private static final String UPDATED_PRIOR_STATE = "BBBBBBBBBB";

    private static final String DEFAULT_NEW_STATE = "AAAAAAAAAA";
    private static final String UPDATED_NEW_STATE = "BBBBBBBBBB";

    private static final Instant DEFAULT_OCCURRED_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_OCCURRED_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/support-histories";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private SupportHistoryRepository supportHistoryRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restSupportHistoryMockMvc;

    private SupportHistory supportHistory;

    private SupportHistory insertedSupportHistory;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static SupportHistory createEntity(EntityManager em) {
        SupportHistory supportHistory = new SupportHistory()
            .eventType(DEFAULT_EVENT_TYPE)
            .priorState(DEFAULT_PRIOR_STATE)
            .newState(DEFAULT_NEW_STATE)
            .occurredAt(DEFAULT_OCCURRED_AT);
        // Add required entity
        SupportTicket supportTicket;
        if (TestUtil.findAll(em, SupportTicket.class).isEmpty()) {
            supportTicket = SupportTicketResourceIT.createEntity(em);
            em.persist(supportTicket);
            em.flush();
        } else {
            supportTicket = TestUtil.findAll(em, SupportTicket.class).get(0);
        }
        supportHistory.setTicket(supportTicket);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        supportHistory.setActor(appUser);
        return supportHistory;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static SupportHistory createUpdatedEntity(EntityManager em) {
        SupportHistory updatedSupportHistory = new SupportHistory()
            .eventType(UPDATED_EVENT_TYPE)
            .priorState(UPDATED_PRIOR_STATE)
            .newState(UPDATED_NEW_STATE)
            .occurredAt(UPDATED_OCCURRED_AT);
        // Add required entity
        SupportTicket supportTicket;
        if (TestUtil.findAll(em, SupportTicket.class).isEmpty()) {
            supportTicket = SupportTicketResourceIT.createUpdatedEntity(em);
            em.persist(supportTicket);
            em.flush();
        } else {
            supportTicket = TestUtil.findAll(em, SupportTicket.class).get(0);
        }
        updatedSupportHistory.setTicket(supportTicket);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedSupportHistory.setActor(appUser);
        return updatedSupportHistory;
    }

    @BeforeEach
    void initTest() {
        supportHistory = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedSupportHistory != null) {
            supportHistoryRepository.delete(insertedSupportHistory);
            insertedSupportHistory = null;
        }
    }

    @Test
    @Transactional
    void createSupportHistory() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the SupportHistory
        var returnedSupportHistory = om.readValue(
            restSupportHistoryMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportHistory)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            SupportHistory.class
        );

        // Validate the SupportHistory in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertSupportHistoryUpdatableFieldsEquals(returnedSupportHistory, getPersistedSupportHistory(returnedSupportHistory));

        insertedSupportHistory = returnedSupportHistory;
    }

    @Test
    @Transactional
    void createSupportHistoryWithExistingId() throws Exception {
        // Create the SupportHistory with an existing ID
        supportHistory.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restSupportHistoryMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportHistory)))
            .andExpect(status().isBadRequest());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkEventTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        supportHistory.setEventType(null);

        // Create the SupportHistory, which fails.

        restSupportHistoryMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportHistory)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNewStateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        supportHistory.setNewState(null);

        // Create the SupportHistory, which fails.

        restSupportHistoryMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportHistory)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOccurredAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        supportHistory.setOccurredAt(null);

        // Create the SupportHistory, which fails.

        restSupportHistoryMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportHistory)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllSupportHistories() throws Exception {
        // Initialize the database
        insertedSupportHistory = supportHistoryRepository.saveAndFlush(supportHistory);

        // Get all the supportHistoryList
        restSupportHistoryMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(supportHistory.getId().intValue())))
            .andExpect(jsonPath("$.[*].eventType").value(hasItem(DEFAULT_EVENT_TYPE)))
            .andExpect(jsonPath("$.[*].priorState").value(hasItem(DEFAULT_PRIOR_STATE)))
            .andExpect(jsonPath("$.[*].newState").value(hasItem(DEFAULT_NEW_STATE)))
            .andExpect(jsonPath("$.[*].occurredAt").value(hasItem(DEFAULT_OCCURRED_AT.toString())));
    }

    @Test
    @Transactional
    void getSupportHistory() throws Exception {
        // Initialize the database
        insertedSupportHistory = supportHistoryRepository.saveAndFlush(supportHistory);

        // Get the supportHistory
        restSupportHistoryMockMvc
            .perform(get(ENTITY_API_URL_ID, supportHistory.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(supportHistory.getId().intValue()))
            .andExpect(jsonPath("$.eventType").value(DEFAULT_EVENT_TYPE))
            .andExpect(jsonPath("$.priorState").value(DEFAULT_PRIOR_STATE))
            .andExpect(jsonPath("$.newState").value(DEFAULT_NEW_STATE))
            .andExpect(jsonPath("$.occurredAt").value(DEFAULT_OCCURRED_AT.toString()));
    }

    @Test
    @Transactional
    void getNonExistingSupportHistory() throws Exception {
        // Get the supportHistory
        restSupportHistoryMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingSupportHistory() throws Exception {
        // Initialize the database
        insertedSupportHistory = supportHistoryRepository.saveAndFlush(supportHistory);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the supportHistory
        SupportHistory updatedSupportHistory = supportHistoryRepository.findById(supportHistory.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedSupportHistory are not directly saved in db
        em.detach(updatedSupportHistory);
        updatedSupportHistory
            .eventType(UPDATED_EVENT_TYPE)
            .priorState(UPDATED_PRIOR_STATE)
            .newState(UPDATED_NEW_STATE)
            .occurredAt(UPDATED_OCCURRED_AT);

        restSupportHistoryMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedSupportHistory.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedSupportHistory))
            )
            .andExpect(status().isOk());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedSupportHistoryToMatchAllProperties(updatedSupportHistory);
    }

    @Test
    @Transactional
    void putNonExistingSupportHistory() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportHistory.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSupportHistoryMockMvc
            .perform(
                put(ENTITY_API_URL_ID, supportHistory.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(supportHistory))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchSupportHistory() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportHistory.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportHistoryMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(supportHistory))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamSupportHistory() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportHistory.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportHistoryMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportHistory)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateSupportHistoryWithPatch() throws Exception {
        // Initialize the database
        insertedSupportHistory = supportHistoryRepository.saveAndFlush(supportHistory);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the supportHistory using partial update
        SupportHistory partialUpdatedSupportHistory = new SupportHistory();
        partialUpdatedSupportHistory.setId(supportHistory.getId());

        partialUpdatedSupportHistory.eventType(UPDATED_EVENT_TYPE).priorState(UPDATED_PRIOR_STATE).newState(UPDATED_NEW_STATE);

        restSupportHistoryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSupportHistory.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSupportHistory))
            )
            .andExpect(status().isOk());

        // Validate the SupportHistory in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSupportHistoryUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedSupportHistory, supportHistory),
            getPersistedSupportHistory(supportHistory)
        );
    }

    @Test
    @Transactional
    void fullUpdateSupportHistoryWithPatch() throws Exception {
        // Initialize the database
        insertedSupportHistory = supportHistoryRepository.saveAndFlush(supportHistory);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the supportHistory using partial update
        SupportHistory partialUpdatedSupportHistory = new SupportHistory();
        partialUpdatedSupportHistory.setId(supportHistory.getId());

        partialUpdatedSupportHistory
            .eventType(UPDATED_EVENT_TYPE)
            .priorState(UPDATED_PRIOR_STATE)
            .newState(UPDATED_NEW_STATE)
            .occurredAt(UPDATED_OCCURRED_AT);

        restSupportHistoryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSupportHistory.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSupportHistory))
            )
            .andExpect(status().isOk());

        // Validate the SupportHistory in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSupportHistoryUpdatableFieldsEquals(partialUpdatedSupportHistory, getPersistedSupportHistory(partialUpdatedSupportHistory));
    }

    @Test
    @Transactional
    void patchNonExistingSupportHistory() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportHistory.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSupportHistoryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, supportHistory.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(supportHistory))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchSupportHistory() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportHistory.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportHistoryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(supportHistory))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamSupportHistory() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportHistory.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportHistoryMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(supportHistory)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the SupportHistory in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteSupportHistory() throws Exception {
        // Initialize the database
        insertedSupportHistory = supportHistoryRepository.saveAndFlush(supportHistory);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the supportHistory
        restSupportHistoryMockMvc
            .perform(delete(ENTITY_API_URL_ID, supportHistory.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return supportHistoryRepository.count();
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

    protected SupportHistory getPersistedSupportHistory(SupportHistory supportHistory) {
        return supportHistoryRepository.findById(supportHistory.getId()).orElseThrow();
    }

    protected void assertPersistedSupportHistoryToMatchAllProperties(SupportHistory expectedSupportHistory) {
        assertSupportHistoryAllPropertiesEquals(expectedSupportHistory, getPersistedSupportHistory(expectedSupportHistory));
    }

    protected void assertPersistedSupportHistoryToMatchUpdatableProperties(SupportHistory expectedSupportHistory) {
        assertSupportHistoryAllUpdatablePropertiesEquals(expectedSupportHistory, getPersistedSupportHistory(expectedSupportHistory));
    }
}
