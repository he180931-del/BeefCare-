package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.TreatmentAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.repository.TreatmentRepository;

/**
 * Integration tests for the {@link TreatmentResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class TreatmentResourceIT {

    private static final Instant DEFAULT_TREATMENT_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_TREATMENT_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final Instant DEFAULT_ENTRY_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_ENTRY_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_TREATMENT_DETAIL = "AAAAAAAAAA";
    private static final String UPDATED_TREATMENT_DETAIL = "BBBBBBBBBB";

    private static final String DEFAULT_DOSE = "AAAAAAAAAA";
    private static final String UPDATED_DOSE = "BBBBBBBBBB";

    private static final String DEFAULT_ROUTE = "AAAAAAAAAA";
    private static final String UPDATED_ROUTE = "BBBBBBBBBB";

    private static final String DEFAULT_WITHDRAWAL_PERIOD = "AAAAAAAAAA";
    private static final String UPDATED_WITHDRAWAL_PERIOD = "BBBBBBBBBB";

    private static final String DEFAULT_RESULT = "AAAAAAAAAA";
    private static final String UPDATED_RESULT = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/treatments";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private TreatmentRepository treatmentRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restTreatmentMockMvc;

    private Treatment treatment;

    private Treatment insertedTreatment;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Treatment createEntity(EntityManager em) {
        Treatment treatment = new Treatment()
            .treatmentTime(DEFAULT_TREATMENT_TIME)
            .entryTime(DEFAULT_ENTRY_TIME)
            .treatmentDetail(DEFAULT_TREATMENT_DETAIL)
            .dose(DEFAULT_DOSE)
            .route(DEFAULT_ROUTE)
            .withdrawalPeriod(DEFAULT_WITHDRAWAL_PERIOD)
            .result(DEFAULT_RESULT);
        // Add required entity
        HealthCase healthCase;
        if (TestUtil.findAll(em, HealthCase.class).isEmpty()) {
            healthCase = HealthCaseResourceIT.createEntity(em);
            em.persist(healthCase);
            em.flush();
        } else {
            healthCase = TestUtil.findAll(em, HealthCase.class).get(0);
        }
        treatment.setHealthCase(healthCase);
        return treatment;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Treatment createUpdatedEntity(EntityManager em) {
        Treatment updatedTreatment = new Treatment()
            .treatmentTime(UPDATED_TREATMENT_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .treatmentDetail(UPDATED_TREATMENT_DETAIL)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .withdrawalPeriod(UPDATED_WITHDRAWAL_PERIOD)
            .result(UPDATED_RESULT);
        // Add required entity
        HealthCase healthCase;
        if (TestUtil.findAll(em, HealthCase.class).isEmpty()) {
            healthCase = HealthCaseResourceIT.createUpdatedEntity(em);
            em.persist(healthCase);
            em.flush();
        } else {
            healthCase = TestUtil.findAll(em, HealthCase.class).get(0);
        }
        updatedTreatment.setHealthCase(healthCase);
        return updatedTreatment;
    }

    @BeforeEach
    void initTest() {
        treatment = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedTreatment != null) {
            treatmentRepository.delete(insertedTreatment);
            insertedTreatment = null;
        }
    }

    @Test
    @Transactional
    void createTreatment() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Treatment
        var returnedTreatment = om.readValue(
            restTreatmentMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Treatment.class
        );

        // Validate the Treatment in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertTreatmentUpdatableFieldsEquals(returnedTreatment, getPersistedTreatment(returnedTreatment));

        insertedTreatment = returnedTreatment;
    }

    @Test
    @Transactional
    void createTreatmentWithExistingId() throws Exception {
        // Create the Treatment with an existing ID
        treatment.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTreatmentTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setTreatmentTime(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEntryTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setEntryTime(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkTreatmentDetailIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setTreatmentDetail(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDoseIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setDose(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkRouteIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setRoute(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkWithdrawalPeriodIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setWithdrawalPeriod(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkResultIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        treatment.setResult(null);

        // Create the Treatment, which fails.

        restTreatmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllTreatments() throws Exception {
        // Initialize the database
        insertedTreatment = treatmentRepository.saveAndFlush(treatment);

        // Get all the treatmentList
        restTreatmentMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(treatment.getId().intValue())))
            .andExpect(jsonPath("$.[*].treatmentTime").value(hasItem(DEFAULT_TREATMENT_TIME.toString())))
            .andExpect(jsonPath("$.[*].entryTime").value(hasItem(DEFAULT_ENTRY_TIME.toString())))
            .andExpect(jsonPath("$.[*].treatmentDetail").value(hasItem(DEFAULT_TREATMENT_DETAIL)))
            .andExpect(jsonPath("$.[*].dose").value(hasItem(DEFAULT_DOSE)))
            .andExpect(jsonPath("$.[*].route").value(hasItem(DEFAULT_ROUTE)))
            .andExpect(jsonPath("$.[*].withdrawalPeriod").value(hasItem(DEFAULT_WITHDRAWAL_PERIOD)))
            .andExpect(jsonPath("$.[*].result").value(hasItem(DEFAULT_RESULT)));
    }

    @Test
    @Transactional
    void getTreatment() throws Exception {
        // Initialize the database
        insertedTreatment = treatmentRepository.saveAndFlush(treatment);

        // Get the treatment
        restTreatmentMockMvc
            .perform(get(ENTITY_API_URL_ID, treatment.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(treatment.getId().intValue()))
            .andExpect(jsonPath("$.treatmentTime").value(DEFAULT_TREATMENT_TIME.toString()))
            .andExpect(jsonPath("$.entryTime").value(DEFAULT_ENTRY_TIME.toString()))
            .andExpect(jsonPath("$.treatmentDetail").value(DEFAULT_TREATMENT_DETAIL))
            .andExpect(jsonPath("$.dose").value(DEFAULT_DOSE))
            .andExpect(jsonPath("$.route").value(DEFAULT_ROUTE))
            .andExpect(jsonPath("$.withdrawalPeriod").value(DEFAULT_WITHDRAWAL_PERIOD))
            .andExpect(jsonPath("$.result").value(DEFAULT_RESULT));
    }

    @Test
    @Transactional
    void getNonExistingTreatment() throws Exception {
        // Get the treatment
        restTreatmentMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingTreatment() throws Exception {
        // Initialize the database
        insertedTreatment = treatmentRepository.saveAndFlush(treatment);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the treatment
        Treatment updatedTreatment = treatmentRepository.findById(treatment.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedTreatment are not directly saved in db
        em.detach(updatedTreatment);
        updatedTreatment
            .treatmentTime(UPDATED_TREATMENT_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .treatmentDetail(UPDATED_TREATMENT_DETAIL)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .withdrawalPeriod(UPDATED_WITHDRAWAL_PERIOD)
            .result(UPDATED_RESULT);

        restTreatmentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedTreatment.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedTreatment))
            )
            .andExpect(status().isOk());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedTreatmentToMatchAllProperties(updatedTreatment);
    }

    @Test
    @Transactional
    void putNonExistingTreatment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        treatment.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restTreatmentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, treatment.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment))
            )
            .andExpect(status().isBadRequest());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchTreatment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        treatment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTreatmentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(treatment))
            )
            .andExpect(status().isBadRequest());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamTreatment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        treatment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTreatmentMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateTreatmentWithPatch() throws Exception {
        // Initialize the database
        insertedTreatment = treatmentRepository.saveAndFlush(treatment);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the treatment using partial update
        Treatment partialUpdatedTreatment = new Treatment();
        partialUpdatedTreatment.setId(treatment.getId());

        partialUpdatedTreatment.route(UPDATED_ROUTE).result(UPDATED_RESULT);

        restTreatmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedTreatment.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedTreatment))
            )
            .andExpect(status().isOk());

        // Validate the Treatment in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertTreatmentUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedTreatment, treatment),
            getPersistedTreatment(treatment)
        );
    }

    @Test
    @Transactional
    void fullUpdateTreatmentWithPatch() throws Exception {
        // Initialize the database
        insertedTreatment = treatmentRepository.saveAndFlush(treatment);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the treatment using partial update
        Treatment partialUpdatedTreatment = new Treatment();
        partialUpdatedTreatment.setId(treatment.getId());

        partialUpdatedTreatment
            .treatmentTime(UPDATED_TREATMENT_TIME)
            .entryTime(UPDATED_ENTRY_TIME)
            .treatmentDetail(UPDATED_TREATMENT_DETAIL)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .withdrawalPeriod(UPDATED_WITHDRAWAL_PERIOD)
            .result(UPDATED_RESULT);

        restTreatmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedTreatment.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedTreatment))
            )
            .andExpect(status().isOk());

        // Validate the Treatment in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertTreatmentUpdatableFieldsEquals(partialUpdatedTreatment, getPersistedTreatment(partialUpdatedTreatment));
    }

    @Test
    @Transactional
    void patchNonExistingTreatment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        treatment.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restTreatmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, treatment.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(treatment))
            )
            .andExpect(status().isBadRequest());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchTreatment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        treatment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTreatmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(treatment))
            )
            .andExpect(status().isBadRequest());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamTreatment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        treatment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTreatmentMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(treatment)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Treatment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteTreatment() throws Exception {
        // Initialize the database
        insertedTreatment = treatmentRepository.saveAndFlush(treatment);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the treatment
        restTreatmentMockMvc
            .perform(delete(ENTITY_API_URL_ID, treatment.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return treatmentRepository.count();
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

    protected Treatment getPersistedTreatment(Treatment treatment) {
        return treatmentRepository.findById(treatment.getId()).orElseThrow();
    }

    protected void assertPersistedTreatmentToMatchAllProperties(Treatment expectedTreatment) {
        assertTreatmentAllPropertiesEquals(expectedTreatment, getPersistedTreatment(expectedTreatment));
    }

    protected void assertPersistedTreatmentToMatchUpdatableProperties(Treatment expectedTreatment) {
        assertTreatmentAllUpdatablePropertiesEquals(expectedTreatment, getPersistedTreatment(expectedTreatment));
    }
}
