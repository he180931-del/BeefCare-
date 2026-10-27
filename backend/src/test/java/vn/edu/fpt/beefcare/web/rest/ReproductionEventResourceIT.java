package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.ReproductionEventAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.repository.ReproductionEventRepository;

/**
 * Integration tests for the {@link ReproductionEventResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class ReproductionEventResourceIT {

    private static final String DEFAULT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_TYPE = "BBBBBBBBBB";

    private static final Instant DEFAULT_EVENT_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_EVENT_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_METHOD = "AAAAAAAAAA";
    private static final String UPDATED_METHOD = "BBBBBBBBBB";

    private static final String DEFAULT_RESULT = "AAAAAAAAAA";
    private static final String UPDATED_RESULT = "BBBBBBBBBB";

    private static final String DEFAULT_SOURCE = "AAAAAAAAAA";
    private static final String UPDATED_SOURCE = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/reproduction-events";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ReproductionEventRepository reproductionEventRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restReproductionEventMockMvc;

    private ReproductionEvent reproductionEvent;

    private ReproductionEvent insertedReproductionEvent;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ReproductionEvent createEntity(EntityManager em) {
        ReproductionEvent reproductionEvent = new ReproductionEvent()
            .type(DEFAULT_TYPE)
            .eventTime(DEFAULT_EVENT_TIME)
            .method(DEFAULT_METHOD)
            .result(DEFAULT_RESULT)
            .source(DEFAULT_SOURCE);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        reproductionEvent.setCattle(cattle);
        return reproductionEvent;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ReproductionEvent createUpdatedEntity(EntityManager em) {
        ReproductionEvent updatedReproductionEvent = new ReproductionEvent()
            .type(UPDATED_TYPE)
            .eventTime(UPDATED_EVENT_TIME)
            .method(UPDATED_METHOD)
            .result(UPDATED_RESULT)
            .source(UPDATED_SOURCE);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedReproductionEvent.setCattle(cattle);
        return updatedReproductionEvent;
    }

    @BeforeEach
    void initTest() {
        reproductionEvent = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedReproductionEvent != null) {
            reproductionEventRepository.delete(insertedReproductionEvent);
            insertedReproductionEvent = null;
        }
    }

    @Test
    @Transactional
    void createReproductionEvent() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the ReproductionEvent
        var returnedReproductionEvent = om.readValue(
            restReproductionEventMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reproductionEvent)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ReproductionEvent.class
        );

        // Validate the ReproductionEvent in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertReproductionEventUpdatableFieldsEquals(returnedReproductionEvent, getPersistedReproductionEvent(returnedReproductionEvent));

        insertedReproductionEvent = returnedReproductionEvent;
    }

    @Test
    @Transactional
    void createReproductionEventWithExistingId() throws Exception {
        // Create the ReproductionEvent with an existing ID
        reproductionEvent.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restReproductionEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reproductionEvent)))
            .andExpect(status().isBadRequest());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reproductionEvent.setType(null);

        // Create the ReproductionEvent, which fails.

        restReproductionEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reproductionEvent)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEventTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reproductionEvent.setEventTime(null);

        // Create the ReproductionEvent, which fails.

        restReproductionEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reproductionEvent)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkResultIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reproductionEvent.setResult(null);

        // Create the ReproductionEvent, which fails.

        restReproductionEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reproductionEvent)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllReproductionEvents() throws Exception {
        // Initialize the database
        insertedReproductionEvent = reproductionEventRepository.saveAndFlush(reproductionEvent);

        // Get all the reproductionEventList
        restReproductionEventMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(reproductionEvent.getId().intValue())))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE)))
            .andExpect(jsonPath("$.[*].eventTime").value(hasItem(DEFAULT_EVENT_TIME.toString())))
            .andExpect(jsonPath("$.[*].method").value(hasItem(DEFAULT_METHOD)))
            .andExpect(jsonPath("$.[*].result").value(hasItem(DEFAULT_RESULT)))
            .andExpect(jsonPath("$.[*].source").value(hasItem(DEFAULT_SOURCE)));
    }

    @Test
    @Transactional
    void getReproductionEvent() throws Exception {
        // Initialize the database
        insertedReproductionEvent = reproductionEventRepository.saveAndFlush(reproductionEvent);

        // Get the reproductionEvent
        restReproductionEventMockMvc
            .perform(get(ENTITY_API_URL_ID, reproductionEvent.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(reproductionEvent.getId().intValue()))
            .andExpect(jsonPath("$.type").value(DEFAULT_TYPE))
            .andExpect(jsonPath("$.eventTime").value(DEFAULT_EVENT_TIME.toString()))
            .andExpect(jsonPath("$.method").value(DEFAULT_METHOD))
            .andExpect(jsonPath("$.result").value(DEFAULT_RESULT))
            .andExpect(jsonPath("$.source").value(DEFAULT_SOURCE));
    }

    @Test
    @Transactional
    void getNonExistingReproductionEvent() throws Exception {
        // Get the reproductionEvent
        restReproductionEventMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingReproductionEvent() throws Exception {
        // Initialize the database
        insertedReproductionEvent = reproductionEventRepository.saveAndFlush(reproductionEvent);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the reproductionEvent
        ReproductionEvent updatedReproductionEvent = reproductionEventRepository.findById(reproductionEvent.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedReproductionEvent are not directly saved in db
        em.detach(updatedReproductionEvent);
        updatedReproductionEvent
            .type(UPDATED_TYPE)
            .eventTime(UPDATED_EVENT_TIME)
            .method(UPDATED_METHOD)
            .result(UPDATED_RESULT)
            .source(UPDATED_SOURCE);

        restReproductionEventMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedReproductionEvent.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedReproductionEvent))
            )
            .andExpect(status().isOk());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedReproductionEventToMatchAllProperties(updatedReproductionEvent);
    }

    @Test
    @Transactional
    void putNonExistingReproductionEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reproductionEvent.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restReproductionEventMockMvc
            .perform(
                put(ENTITY_API_URL_ID, reproductionEvent.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(reproductionEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchReproductionEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reproductionEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReproductionEventMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(reproductionEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamReproductionEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reproductionEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReproductionEventMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reproductionEvent)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateReproductionEventWithPatch() throws Exception {
        // Initialize the database
        insertedReproductionEvent = reproductionEventRepository.saveAndFlush(reproductionEvent);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the reproductionEvent using partial update
        ReproductionEvent partialUpdatedReproductionEvent = new ReproductionEvent();
        partialUpdatedReproductionEvent.setId(reproductionEvent.getId());

        partialUpdatedReproductionEvent.method(UPDATED_METHOD).source(UPDATED_SOURCE);

        restReproductionEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedReproductionEvent.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedReproductionEvent))
            )
            .andExpect(status().isOk());

        // Validate the ReproductionEvent in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertReproductionEventUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedReproductionEvent, reproductionEvent),
            getPersistedReproductionEvent(reproductionEvent)
        );
    }

    @Test
    @Transactional
    void fullUpdateReproductionEventWithPatch() throws Exception {
        // Initialize the database
        insertedReproductionEvent = reproductionEventRepository.saveAndFlush(reproductionEvent);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the reproductionEvent using partial update
        ReproductionEvent partialUpdatedReproductionEvent = new ReproductionEvent();
        partialUpdatedReproductionEvent.setId(reproductionEvent.getId());

        partialUpdatedReproductionEvent
            .type(UPDATED_TYPE)
            .eventTime(UPDATED_EVENT_TIME)
            .method(UPDATED_METHOD)
            .result(UPDATED_RESULT)
            .source(UPDATED_SOURCE);

        restReproductionEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedReproductionEvent.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedReproductionEvent))
            )
            .andExpect(status().isOk());

        // Validate the ReproductionEvent in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertReproductionEventUpdatableFieldsEquals(
            partialUpdatedReproductionEvent,
            getPersistedReproductionEvent(partialUpdatedReproductionEvent)
        );
    }

    @Test
    @Transactional
    void patchNonExistingReproductionEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reproductionEvent.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restReproductionEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, reproductionEvent.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(reproductionEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchReproductionEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reproductionEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReproductionEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(reproductionEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamReproductionEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reproductionEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReproductionEventMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(reproductionEvent)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ReproductionEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteReproductionEvent() throws Exception {
        // Initialize the database
        insertedReproductionEvent = reproductionEventRepository.saveAndFlush(reproductionEvent);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the reproductionEvent
        restReproductionEventMockMvc
            .perform(delete(ENTITY_API_URL_ID, reproductionEvent.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return reproductionEventRepository.count();
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

    protected ReproductionEvent getPersistedReproductionEvent(ReproductionEvent reproductionEvent) {
        return reproductionEventRepository.findById(reproductionEvent.getId()).orElseThrow();
    }

    protected void assertPersistedReproductionEventToMatchAllProperties(ReproductionEvent expectedReproductionEvent) {
        assertReproductionEventAllPropertiesEquals(expectedReproductionEvent, getPersistedReproductionEvent(expectedReproductionEvent));
    }

    protected void assertPersistedReproductionEventToMatchUpdatableProperties(ReproductionEvent expectedReproductionEvent) {
        assertReproductionEventAllUpdatablePropertiesEquals(
            expectedReproductionEvent,
            getPersistedReproductionEvent(expectedReproductionEvent)
        );
    }
}
