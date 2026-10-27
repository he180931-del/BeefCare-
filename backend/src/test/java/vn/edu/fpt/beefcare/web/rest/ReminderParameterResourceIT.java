package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.ReminderParameterAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.ZoneId;
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
import vn.edu.fpt.beefcare.domain.ReminderParameter;
import vn.edu.fpt.beefcare.repository.ReminderParameterRepository;

/**
 * Integration tests for the {@link ReminderParameterResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class ReminderParameterResourceIT {

    private static final String DEFAULT_PARAMETER_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_PARAMETER_TYPE = "BBBBBBBBBB";

    private static final String DEFAULT_PARAM_VALUE = "AAAAAAAAAA";
    private static final String UPDATED_PARAM_VALUE = "BBBBBBBBBB";

    private static final Integer DEFAULT_VERSION_NO = 1;
    private static final Integer UPDATED_VERSION_NO = 2;

    private static final LocalDate DEFAULT_EFFECTIVE_FROM = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EFFECTIVE_FROM = LocalDate.now(ZoneId.systemDefault());

    private static final String ENTITY_API_URL = "/api/reminder-parameters";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ReminderParameterRepository reminderParameterRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restReminderParameterMockMvc;

    private ReminderParameter reminderParameter;

    private ReminderParameter insertedReminderParameter;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ReminderParameter createEntity(EntityManager em) {
        ReminderParameter reminderParameter = new ReminderParameter()
            .parameterType(DEFAULT_PARAMETER_TYPE)
            .paramValue(DEFAULT_PARAM_VALUE)
            .versionNo(DEFAULT_VERSION_NO)
            .effectiveFrom(DEFAULT_EFFECTIVE_FROM);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        reminderParameter.setFarm(farm);
        return reminderParameter;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ReminderParameter createUpdatedEntity(EntityManager em) {
        ReminderParameter updatedReminderParameter = new ReminderParameter()
            .parameterType(UPDATED_PARAMETER_TYPE)
            .paramValue(UPDATED_PARAM_VALUE)
            .versionNo(UPDATED_VERSION_NO)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedReminderParameter.setFarm(farm);
        return updatedReminderParameter;
    }

    @BeforeEach
    void initTest() {
        reminderParameter = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedReminderParameter != null) {
            reminderParameterRepository.delete(insertedReminderParameter);
            insertedReminderParameter = null;
        }
    }

    @Test
    @Transactional
    void createReminderParameter() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the ReminderParameter
        var returnedReminderParameter = om.readValue(
            restReminderParameterMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ReminderParameter.class
        );

        // Validate the ReminderParameter in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertReminderParameterUpdatableFieldsEquals(returnedReminderParameter, getPersistedReminderParameter(returnedReminderParameter));

        insertedReminderParameter = returnedReminderParameter;
    }

    @Test
    @Transactional
    void createReminderParameterWithExistingId() throws Exception {
        // Create the ReminderParameter with an existing ID
        reminderParameter.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restReminderParameterMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isBadRequest());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkParameterTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reminderParameter.setParameterType(null);

        // Create the ReminderParameter, which fails.

        restReminderParameterMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkParamValueIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reminderParameter.setParamValue(null);

        // Create the ReminderParameter, which fails.

        restReminderParameterMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkVersionNoIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reminderParameter.setVersionNo(null);

        // Create the ReminderParameter, which fails.

        restReminderParameterMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEffectiveFromIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        reminderParameter.setEffectiveFrom(null);

        // Create the ReminderParameter, which fails.

        restReminderParameterMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllReminderParameters() throws Exception {
        // Initialize the database
        insertedReminderParameter = reminderParameterRepository.saveAndFlush(reminderParameter);

        // Get all the reminderParameterList
        restReminderParameterMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(reminderParameter.getId().intValue())))
            .andExpect(jsonPath("$.[*].parameterType").value(hasItem(DEFAULT_PARAMETER_TYPE)))
            .andExpect(jsonPath("$.[*].paramValue").value(hasItem(DEFAULT_PARAM_VALUE)))
            .andExpect(jsonPath("$.[*].versionNo").value(hasItem(DEFAULT_VERSION_NO)))
            .andExpect(jsonPath("$.[*].effectiveFrom").value(hasItem(DEFAULT_EFFECTIVE_FROM.toString())));
    }

    @Test
    @Transactional
    void getReminderParameter() throws Exception {
        // Initialize the database
        insertedReminderParameter = reminderParameterRepository.saveAndFlush(reminderParameter);

        // Get the reminderParameter
        restReminderParameterMockMvc
            .perform(get(ENTITY_API_URL_ID, reminderParameter.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(reminderParameter.getId().intValue()))
            .andExpect(jsonPath("$.parameterType").value(DEFAULT_PARAMETER_TYPE))
            .andExpect(jsonPath("$.paramValue").value(DEFAULT_PARAM_VALUE))
            .andExpect(jsonPath("$.versionNo").value(DEFAULT_VERSION_NO))
            .andExpect(jsonPath("$.effectiveFrom").value(DEFAULT_EFFECTIVE_FROM.toString()));
    }

    @Test
    @Transactional
    void getNonExistingReminderParameter() throws Exception {
        // Get the reminderParameter
        restReminderParameterMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingReminderParameter() throws Exception {
        // Initialize the database
        insertedReminderParameter = reminderParameterRepository.saveAndFlush(reminderParameter);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the reminderParameter
        ReminderParameter updatedReminderParameter = reminderParameterRepository.findById(reminderParameter.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedReminderParameter are not directly saved in db
        em.detach(updatedReminderParameter);
        updatedReminderParameter
            .parameterType(UPDATED_PARAMETER_TYPE)
            .paramValue(UPDATED_PARAM_VALUE)
            .versionNo(UPDATED_VERSION_NO)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);

        restReminderParameterMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedReminderParameter.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedReminderParameter))
            )
            .andExpect(status().isOk());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedReminderParameterToMatchAllProperties(updatedReminderParameter);
    }

    @Test
    @Transactional
    void putNonExistingReminderParameter() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reminderParameter.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restReminderParameterMockMvc
            .perform(
                put(ENTITY_API_URL_ID, reminderParameter.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(reminderParameter))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchReminderParameter() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reminderParameter.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReminderParameterMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(reminderParameter))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamReminderParameter() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reminderParameter.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReminderParameterMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateReminderParameterWithPatch() throws Exception {
        // Initialize the database
        insertedReminderParameter = reminderParameterRepository.saveAndFlush(reminderParameter);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the reminderParameter using partial update
        ReminderParameter partialUpdatedReminderParameter = new ReminderParameter();
        partialUpdatedReminderParameter.setId(reminderParameter.getId());

        partialUpdatedReminderParameter.paramValue(UPDATED_PARAM_VALUE).versionNo(UPDATED_VERSION_NO);

        restReminderParameterMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedReminderParameter.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedReminderParameter))
            )
            .andExpect(status().isOk());

        // Validate the ReminderParameter in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertReminderParameterUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedReminderParameter, reminderParameter),
            getPersistedReminderParameter(reminderParameter)
        );
    }

    @Test
    @Transactional
    void fullUpdateReminderParameterWithPatch() throws Exception {
        // Initialize the database
        insertedReminderParameter = reminderParameterRepository.saveAndFlush(reminderParameter);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the reminderParameter using partial update
        ReminderParameter partialUpdatedReminderParameter = new ReminderParameter();
        partialUpdatedReminderParameter.setId(reminderParameter.getId());

        partialUpdatedReminderParameter
            .parameterType(UPDATED_PARAMETER_TYPE)
            .paramValue(UPDATED_PARAM_VALUE)
            .versionNo(UPDATED_VERSION_NO)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);

        restReminderParameterMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedReminderParameter.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedReminderParameter))
            )
            .andExpect(status().isOk());

        // Validate the ReminderParameter in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertReminderParameterUpdatableFieldsEquals(
            partialUpdatedReminderParameter,
            getPersistedReminderParameter(partialUpdatedReminderParameter)
        );
    }

    @Test
    @Transactional
    void patchNonExistingReminderParameter() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reminderParameter.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restReminderParameterMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, reminderParameter.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(reminderParameter))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchReminderParameter() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reminderParameter.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReminderParameterMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(reminderParameter))
            )
            .andExpect(status().isBadRequest());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamReminderParameter() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        reminderParameter.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restReminderParameterMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(reminderParameter)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ReminderParameter in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteReminderParameter() throws Exception {
        // Initialize the database
        insertedReminderParameter = reminderParameterRepository.saveAndFlush(reminderParameter);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the reminderParameter
        restReminderParameterMockMvc
            .perform(delete(ENTITY_API_URL_ID, reminderParameter.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return reminderParameterRepository.count();
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

    protected ReminderParameter getPersistedReminderParameter(ReminderParameter reminderParameter) {
        return reminderParameterRepository.findById(reminderParameter.getId()).orElseThrow();
    }

    protected void assertPersistedReminderParameterToMatchAllProperties(ReminderParameter expectedReminderParameter) {
        assertReminderParameterAllPropertiesEquals(expectedReminderParameter, getPersistedReminderParameter(expectedReminderParameter));
    }

    protected void assertPersistedReminderParameterToMatchUpdatableProperties(ReminderParameter expectedReminderParameter) {
        assertReminderParameterAllUpdatablePropertiesEquals(
            expectedReminderParameter,
            getPersistedReminderParameter(expectedReminderParameter)
        );
    }
}
