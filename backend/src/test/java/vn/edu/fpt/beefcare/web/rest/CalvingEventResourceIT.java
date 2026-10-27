package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.CalvingEventAsserts.*;
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
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.repository.CalvingEventRepository;

/**
 * Integration tests for the {@link CalvingEventResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class CalvingEventResourceIT {

    private static final Instant DEFAULT_BIRTH_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_BIRTH_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_COURSE = "AAAAAAAAAA";
    private static final String UPDATED_COURSE = "BBBBBBBBBB";

    private static final String DEFAULT_DAM_CONDITION = "AAAAAAAAAA";
    private static final String UPDATED_DAM_CONDITION = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/calving-events";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private CalvingEventRepository calvingEventRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restCalvingEventMockMvc;

    private CalvingEvent calvingEvent;

    private CalvingEvent insertedCalvingEvent;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CalvingEvent createEntity(EntityManager em) {
        CalvingEvent calvingEvent = new CalvingEvent()
            .birthTime(DEFAULT_BIRTH_TIME)
            .course(DEFAULT_COURSE)
            .damCondition(DEFAULT_DAM_CONDITION);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        calvingEvent.setDam(cattle);
        return calvingEvent;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CalvingEvent createUpdatedEntity(EntityManager em) {
        CalvingEvent updatedCalvingEvent = new CalvingEvent()
            .birthTime(UPDATED_BIRTH_TIME)
            .course(UPDATED_COURSE)
            .damCondition(UPDATED_DAM_CONDITION);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedCalvingEvent.setDam(cattle);
        return updatedCalvingEvent;
    }

    @BeforeEach
    void initTest() {
        calvingEvent = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedCalvingEvent != null) {
            calvingEventRepository.delete(insertedCalvingEvent);
            insertedCalvingEvent = null;
        }
    }

    @Test
    @Transactional
    void createCalvingEvent() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the CalvingEvent
        var returnedCalvingEvent = om.readValue(
            restCalvingEventMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calvingEvent)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            CalvingEvent.class
        );

        // Validate the CalvingEvent in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertCalvingEventUpdatableFieldsEquals(returnedCalvingEvent, getPersistedCalvingEvent(returnedCalvingEvent));

        insertedCalvingEvent = returnedCalvingEvent;
    }

    @Test
    @Transactional
    void createCalvingEventWithExistingId() throws Exception {
        // Create the CalvingEvent with an existing ID
        calvingEvent.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restCalvingEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calvingEvent)))
            .andExpect(status().isBadRequest());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkBirthTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        calvingEvent.setBirthTime(null);

        // Create the CalvingEvent, which fails.

        restCalvingEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calvingEvent)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkCourseIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        calvingEvent.setCourse(null);

        // Create the CalvingEvent, which fails.

        restCalvingEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calvingEvent)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDamConditionIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        calvingEvent.setDamCondition(null);

        // Create the CalvingEvent, which fails.

        restCalvingEventMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calvingEvent)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllCalvingEvents() throws Exception {
        // Initialize the database
        insertedCalvingEvent = calvingEventRepository.saveAndFlush(calvingEvent);

        // Get all the calvingEventList
        restCalvingEventMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(calvingEvent.getId().intValue())))
            .andExpect(jsonPath("$.[*].birthTime").value(hasItem(DEFAULT_BIRTH_TIME.toString())))
            .andExpect(jsonPath("$.[*].course").value(hasItem(DEFAULT_COURSE)))
            .andExpect(jsonPath("$.[*].damCondition").value(hasItem(DEFAULT_DAM_CONDITION)));
    }

    @Test
    @Transactional
    void getCalvingEvent() throws Exception {
        // Initialize the database
        insertedCalvingEvent = calvingEventRepository.saveAndFlush(calvingEvent);

        // Get the calvingEvent
        restCalvingEventMockMvc
            .perform(get(ENTITY_API_URL_ID, calvingEvent.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(calvingEvent.getId().intValue()))
            .andExpect(jsonPath("$.birthTime").value(DEFAULT_BIRTH_TIME.toString()))
            .andExpect(jsonPath("$.course").value(DEFAULT_COURSE))
            .andExpect(jsonPath("$.damCondition").value(DEFAULT_DAM_CONDITION));
    }

    @Test
    @Transactional
    void getNonExistingCalvingEvent() throws Exception {
        // Get the calvingEvent
        restCalvingEventMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingCalvingEvent() throws Exception {
        // Initialize the database
        insertedCalvingEvent = calvingEventRepository.saveAndFlush(calvingEvent);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the calvingEvent
        CalvingEvent updatedCalvingEvent = calvingEventRepository.findById(calvingEvent.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedCalvingEvent are not directly saved in db
        em.detach(updatedCalvingEvent);
        updatedCalvingEvent.birthTime(UPDATED_BIRTH_TIME).course(UPDATED_COURSE).damCondition(UPDATED_DAM_CONDITION);

        restCalvingEventMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedCalvingEvent.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedCalvingEvent))
            )
            .andExpect(status().isOk());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedCalvingEventToMatchAllProperties(updatedCalvingEvent);
    }

    @Test
    @Transactional
    void putNonExistingCalvingEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calvingEvent.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCalvingEventMockMvc
            .perform(
                put(ENTITY_API_URL_ID, calvingEvent.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(calvingEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchCalvingEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calvingEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalvingEventMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(calvingEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamCalvingEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calvingEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalvingEventMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calvingEvent)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateCalvingEventWithPatch() throws Exception {
        // Initialize the database
        insertedCalvingEvent = calvingEventRepository.saveAndFlush(calvingEvent);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the calvingEvent using partial update
        CalvingEvent partialUpdatedCalvingEvent = new CalvingEvent();
        partialUpdatedCalvingEvent.setId(calvingEvent.getId());

        partialUpdatedCalvingEvent.course(UPDATED_COURSE).damCondition(UPDATED_DAM_CONDITION);

        restCalvingEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCalvingEvent.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCalvingEvent))
            )
            .andExpect(status().isOk());

        // Validate the CalvingEvent in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCalvingEventUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedCalvingEvent, calvingEvent),
            getPersistedCalvingEvent(calvingEvent)
        );
    }

    @Test
    @Transactional
    void fullUpdateCalvingEventWithPatch() throws Exception {
        // Initialize the database
        insertedCalvingEvent = calvingEventRepository.saveAndFlush(calvingEvent);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the calvingEvent using partial update
        CalvingEvent partialUpdatedCalvingEvent = new CalvingEvent();
        partialUpdatedCalvingEvent.setId(calvingEvent.getId());

        partialUpdatedCalvingEvent.birthTime(UPDATED_BIRTH_TIME).course(UPDATED_COURSE).damCondition(UPDATED_DAM_CONDITION);

        restCalvingEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCalvingEvent.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCalvingEvent))
            )
            .andExpect(status().isOk());

        // Validate the CalvingEvent in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCalvingEventUpdatableFieldsEquals(partialUpdatedCalvingEvent, getPersistedCalvingEvent(partialUpdatedCalvingEvent));
    }

    @Test
    @Transactional
    void patchNonExistingCalvingEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calvingEvent.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCalvingEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, calvingEvent.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(calvingEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchCalvingEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calvingEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalvingEventMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(calvingEvent))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamCalvingEvent() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calvingEvent.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalvingEventMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(calvingEvent)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CalvingEvent in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteCalvingEvent() throws Exception {
        // Initialize the database
        insertedCalvingEvent = calvingEventRepository.saveAndFlush(calvingEvent);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the calvingEvent
        restCalvingEventMockMvc
            .perform(delete(ENTITY_API_URL_ID, calvingEvent.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return calvingEventRepository.count();
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

    protected CalvingEvent getPersistedCalvingEvent(CalvingEvent calvingEvent) {
        return calvingEventRepository.findById(calvingEvent.getId()).orElseThrow();
    }

    protected void assertPersistedCalvingEventToMatchAllProperties(CalvingEvent expectedCalvingEvent) {
        assertCalvingEventAllPropertiesEquals(expectedCalvingEvent, getPersistedCalvingEvent(expectedCalvingEvent));
    }

    protected void assertPersistedCalvingEventToMatchUpdatableProperties(CalvingEvent expectedCalvingEvent) {
        assertCalvingEventAllUpdatablePropertiesEquals(expectedCalvingEvent, getPersistedCalvingEvent(expectedCalvingEvent));
    }
}
