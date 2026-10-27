package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.CalfOutcomeAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.sameNumber;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
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
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.repository.CalfOutcomeRepository;

/**
 * Integration tests for the {@link CalfOutcomeResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class CalfOutcomeResourceIT {

    private static final String DEFAULT_OUTCOME = "AAAAAAAAAA";
    private static final String UPDATED_OUTCOME = "BBBBBBBBBB";

    private static final String DEFAULT_SEX = "AAAAAAAAAA";
    private static final String UPDATED_SEX = "BBBBBBBBBB";

    private static final BigDecimal DEFAULT_BIRTH_WEIGHT = new BigDecimal(1);
    private static final BigDecimal UPDATED_BIRTH_WEIGHT = new BigDecimal(2);

    private static final String DEFAULT_REGISTRATION_STATE = "AAAAAAAAAA";
    private static final String UPDATED_REGISTRATION_STATE = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/calf-outcomes";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private CalfOutcomeRepository calfOutcomeRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restCalfOutcomeMockMvc;

    private CalfOutcome calfOutcome;

    private CalfOutcome insertedCalfOutcome;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CalfOutcome createEntity(EntityManager em) {
        CalfOutcome calfOutcome = new CalfOutcome()
            .outcome(DEFAULT_OUTCOME)
            .sex(DEFAULT_SEX)
            .birthWeight(DEFAULT_BIRTH_WEIGHT)
            .registrationState(DEFAULT_REGISTRATION_STATE);
        // Add required entity
        CalvingEvent calvingEvent;
        if (TestUtil.findAll(em, CalvingEvent.class).isEmpty()) {
            calvingEvent = CalvingEventResourceIT.createEntity(em);
            em.persist(calvingEvent);
            em.flush();
        } else {
            calvingEvent = TestUtil.findAll(em, CalvingEvent.class).get(0);
        }
        calfOutcome.setCalving(calvingEvent);
        return calfOutcome;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CalfOutcome createUpdatedEntity(EntityManager em) {
        CalfOutcome updatedCalfOutcome = new CalfOutcome()
            .outcome(UPDATED_OUTCOME)
            .sex(UPDATED_SEX)
            .birthWeight(UPDATED_BIRTH_WEIGHT)
            .registrationState(UPDATED_REGISTRATION_STATE);
        // Add required entity
        CalvingEvent calvingEvent;
        if (TestUtil.findAll(em, CalvingEvent.class).isEmpty()) {
            calvingEvent = CalvingEventResourceIT.createUpdatedEntity(em);
            em.persist(calvingEvent);
            em.flush();
        } else {
            calvingEvent = TestUtil.findAll(em, CalvingEvent.class).get(0);
        }
        updatedCalfOutcome.setCalving(calvingEvent);
        return updatedCalfOutcome;
    }

    @BeforeEach
    void initTest() {
        calfOutcome = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedCalfOutcome != null) {
            calfOutcomeRepository.delete(insertedCalfOutcome);
            insertedCalfOutcome = null;
        }
    }

    @Test
    @Transactional
    void createCalfOutcome() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the CalfOutcome
        var returnedCalfOutcome = om.readValue(
            restCalfOutcomeMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calfOutcome)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            CalfOutcome.class
        );

        // Validate the CalfOutcome in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertCalfOutcomeUpdatableFieldsEquals(returnedCalfOutcome, getPersistedCalfOutcome(returnedCalfOutcome));

        insertedCalfOutcome = returnedCalfOutcome;
    }

    @Test
    @Transactional
    void createCalfOutcomeWithExistingId() throws Exception {
        // Create the CalfOutcome with an existing ID
        calfOutcome.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restCalfOutcomeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calfOutcome)))
            .andExpect(status().isBadRequest());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkRegistrationStateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        calfOutcome.setRegistrationState(null);

        // Create the CalfOutcome, which fails.

        restCalfOutcomeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calfOutcome)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllCalfOutcomes() throws Exception {
        // Initialize the database
        insertedCalfOutcome = calfOutcomeRepository.saveAndFlush(calfOutcome);

        // Get all the calfOutcomeList
        restCalfOutcomeMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(calfOutcome.getId().intValue())))
            .andExpect(jsonPath("$.[*].outcome").value(hasItem(DEFAULT_OUTCOME)))
            .andExpect(jsonPath("$.[*].sex").value(hasItem(DEFAULT_SEX)))
            .andExpect(jsonPath("$.[*].birthWeight").value(hasItem(sameNumber(DEFAULT_BIRTH_WEIGHT))))
            .andExpect(jsonPath("$.[*].registrationState").value(hasItem(DEFAULT_REGISTRATION_STATE)));
    }

    @Test
    @Transactional
    void getCalfOutcome() throws Exception {
        // Initialize the database
        insertedCalfOutcome = calfOutcomeRepository.saveAndFlush(calfOutcome);

        // Get the calfOutcome
        restCalfOutcomeMockMvc
            .perform(get(ENTITY_API_URL_ID, calfOutcome.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(calfOutcome.getId().intValue()))
            .andExpect(jsonPath("$.outcome").value(DEFAULT_OUTCOME))
            .andExpect(jsonPath("$.sex").value(DEFAULT_SEX))
            .andExpect(jsonPath("$.birthWeight").value(sameNumber(DEFAULT_BIRTH_WEIGHT)))
            .andExpect(jsonPath("$.registrationState").value(DEFAULT_REGISTRATION_STATE));
    }

    @Test
    @Transactional
    void getNonExistingCalfOutcome() throws Exception {
        // Get the calfOutcome
        restCalfOutcomeMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingCalfOutcome() throws Exception {
        // Initialize the database
        insertedCalfOutcome = calfOutcomeRepository.saveAndFlush(calfOutcome);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the calfOutcome
        CalfOutcome updatedCalfOutcome = calfOutcomeRepository.findById(calfOutcome.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedCalfOutcome are not directly saved in db
        em.detach(updatedCalfOutcome);
        updatedCalfOutcome
            .outcome(UPDATED_OUTCOME)
            .sex(UPDATED_SEX)
            .birthWeight(UPDATED_BIRTH_WEIGHT)
            .registrationState(UPDATED_REGISTRATION_STATE);

        restCalfOutcomeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedCalfOutcome.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedCalfOutcome))
            )
            .andExpect(status().isOk());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedCalfOutcomeToMatchAllProperties(updatedCalfOutcome);
    }

    @Test
    @Transactional
    void putNonExistingCalfOutcome() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calfOutcome.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCalfOutcomeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, calfOutcome.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(calfOutcome))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchCalfOutcome() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calfOutcome.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalfOutcomeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(calfOutcome))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamCalfOutcome() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calfOutcome.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalfOutcomeMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(calfOutcome)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateCalfOutcomeWithPatch() throws Exception {
        // Initialize the database
        insertedCalfOutcome = calfOutcomeRepository.saveAndFlush(calfOutcome);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the calfOutcome using partial update
        CalfOutcome partialUpdatedCalfOutcome = new CalfOutcome();
        partialUpdatedCalfOutcome.setId(calfOutcome.getId());

        partialUpdatedCalfOutcome.birthWeight(UPDATED_BIRTH_WEIGHT).registrationState(UPDATED_REGISTRATION_STATE);

        restCalfOutcomeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCalfOutcome.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCalfOutcome))
            )
            .andExpect(status().isOk());

        // Validate the CalfOutcome in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCalfOutcomeUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedCalfOutcome, calfOutcome),
            getPersistedCalfOutcome(calfOutcome)
        );
    }

    @Test
    @Transactional
    void fullUpdateCalfOutcomeWithPatch() throws Exception {
        // Initialize the database
        insertedCalfOutcome = calfOutcomeRepository.saveAndFlush(calfOutcome);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the calfOutcome using partial update
        CalfOutcome partialUpdatedCalfOutcome = new CalfOutcome();
        partialUpdatedCalfOutcome.setId(calfOutcome.getId());

        partialUpdatedCalfOutcome
            .outcome(UPDATED_OUTCOME)
            .sex(UPDATED_SEX)
            .birthWeight(UPDATED_BIRTH_WEIGHT)
            .registrationState(UPDATED_REGISTRATION_STATE);

        restCalfOutcomeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCalfOutcome.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCalfOutcome))
            )
            .andExpect(status().isOk());

        // Validate the CalfOutcome in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCalfOutcomeUpdatableFieldsEquals(partialUpdatedCalfOutcome, getPersistedCalfOutcome(partialUpdatedCalfOutcome));
    }

    @Test
    @Transactional
    void patchNonExistingCalfOutcome() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calfOutcome.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCalfOutcomeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, calfOutcome.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(calfOutcome))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchCalfOutcome() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calfOutcome.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalfOutcomeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(calfOutcome))
            )
            .andExpect(status().isBadRequest());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamCalfOutcome() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        calfOutcome.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCalfOutcomeMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(calfOutcome)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CalfOutcome in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteCalfOutcome() throws Exception {
        // Initialize the database
        insertedCalfOutcome = calfOutcomeRepository.saveAndFlush(calfOutcome);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the calfOutcome
        restCalfOutcomeMockMvc
            .perform(delete(ENTITY_API_URL_ID, calfOutcome.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return calfOutcomeRepository.count();
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

    protected CalfOutcome getPersistedCalfOutcome(CalfOutcome calfOutcome) {
        return calfOutcomeRepository.findById(calfOutcome.getId()).orElseThrow();
    }

    protected void assertPersistedCalfOutcomeToMatchAllProperties(CalfOutcome expectedCalfOutcome) {
        assertCalfOutcomeAllPropertiesEquals(expectedCalfOutcome, getPersistedCalfOutcome(expectedCalfOutcome));
    }

    protected void assertPersistedCalfOutcomeToMatchUpdatableProperties(CalfOutcome expectedCalfOutcome) {
        assertCalfOutcomeAllUpdatablePropertiesEquals(expectedCalfOutcome, getPersistedCalfOutcome(expectedCalfOutcome));
    }
}
