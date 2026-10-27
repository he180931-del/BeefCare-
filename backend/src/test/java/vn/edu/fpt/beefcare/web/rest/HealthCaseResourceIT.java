package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.HealthCaseAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.repository.HealthCaseRepository;

/**
 * Integration tests for the {@link HealthCaseResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class HealthCaseResourceIT {

    private static final LocalDate DEFAULT_OPENED_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_OPENED_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String DEFAULT_OUTCOME = "AAAAAAAAAA";
    private static final String UPDATED_OUTCOME = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_CLOSED_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_CLOSED_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String ENTITY_API_URL = "/api/health-cases";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private HealthCaseRepository healthCaseRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restHealthCaseMockMvc;

    private HealthCase healthCase;

    private HealthCase insertedHealthCase;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HealthCase createEntity(EntityManager em) {
        HealthCase healthCase = new HealthCase()
            .openedDate(DEFAULT_OPENED_DATE)
            .status(DEFAULT_STATUS)
            .outcome(DEFAULT_OUTCOME)
            .closedDate(DEFAULT_CLOSED_DATE);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        healthCase.setCattle(cattle);
        return healthCase;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HealthCase createUpdatedEntity(EntityManager em) {
        HealthCase updatedHealthCase = new HealthCase()
            .openedDate(UPDATED_OPENED_DATE)
            .status(UPDATED_STATUS)
            .outcome(UPDATED_OUTCOME)
            .closedDate(UPDATED_CLOSED_DATE);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedHealthCase.setCattle(cattle);
        return updatedHealthCase;
    }

    @BeforeEach
    void initTest() {
        healthCase = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedHealthCase != null) {
            healthCaseRepository.delete(insertedHealthCase);
            insertedHealthCase = null;
        }
    }

    @Test
    @Transactional
    void createHealthCase() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the HealthCase
        var returnedHealthCase = om.readValue(
            restHealthCaseMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthCase)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            HealthCase.class
        );

        // Validate the HealthCase in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertHealthCaseUpdatableFieldsEquals(returnedHealthCase, getPersistedHealthCase(returnedHealthCase));

        insertedHealthCase = returnedHealthCase;
    }

    @Test
    @Transactional
    void createHealthCaseWithExistingId() throws Exception {
        // Create the HealthCase with an existing ID
        healthCase.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restHealthCaseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthCase)))
            .andExpect(status().isBadRequest());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkOpenedDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        healthCase.setOpenedDate(null);

        // Create the HealthCase, which fails.

        restHealthCaseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthCase)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        healthCase.setStatus(null);

        // Create the HealthCase, which fails.

        restHealthCaseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthCase)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllHealthCases() throws Exception {
        // Initialize the database
        insertedHealthCase = healthCaseRepository.saveAndFlush(healthCase);

        // Get all the healthCaseList
        restHealthCaseMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(healthCase.getId().intValue())))
            .andExpect(jsonPath("$.[*].openedDate").value(hasItem(DEFAULT_OPENED_DATE.toString())))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)))
            .andExpect(jsonPath("$.[*].outcome").value(hasItem(DEFAULT_OUTCOME)))
            .andExpect(jsonPath("$.[*].closedDate").value(hasItem(DEFAULT_CLOSED_DATE.toString())));
    }

    @Test
    @Transactional
    void getHealthCase() throws Exception {
        // Initialize the database
        insertedHealthCase = healthCaseRepository.saveAndFlush(healthCase);

        // Get the healthCase
        restHealthCaseMockMvc
            .perform(get(ENTITY_API_URL_ID, healthCase.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(healthCase.getId().intValue()))
            .andExpect(jsonPath("$.openedDate").value(DEFAULT_OPENED_DATE.toString()))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS))
            .andExpect(jsonPath("$.outcome").value(DEFAULT_OUTCOME))
            .andExpect(jsonPath("$.closedDate").value(DEFAULT_CLOSED_DATE.toString()));
    }

    @Test
    @Transactional
    void getNonExistingHealthCase() throws Exception {
        // Get the healthCase
        restHealthCaseMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingHealthCase() throws Exception {
        // Initialize the database
        insertedHealthCase = healthCaseRepository.saveAndFlush(healthCase);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the healthCase
        HealthCase updatedHealthCase = healthCaseRepository.findById(healthCase.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedHealthCase are not directly saved in db
        em.detach(updatedHealthCase);
        updatedHealthCase.openedDate(UPDATED_OPENED_DATE).status(UPDATED_STATUS).outcome(UPDATED_OUTCOME).closedDate(UPDATED_CLOSED_DATE);

        restHealthCaseMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedHealthCase.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedHealthCase))
            )
            .andExpect(status().isOk());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedHealthCaseToMatchAllProperties(updatedHealthCase);
    }

    @Test
    @Transactional
    void putNonExistingHealthCase() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthCase.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHealthCaseMockMvc
            .perform(
                put(ENTITY_API_URL_ID, healthCase.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthCase))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchHealthCase() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthCase.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthCaseMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(healthCase))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamHealthCase() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthCase.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthCaseMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(healthCase)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateHealthCaseWithPatch() throws Exception {
        // Initialize the database
        insertedHealthCase = healthCaseRepository.saveAndFlush(healthCase);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the healthCase using partial update
        HealthCase partialUpdatedHealthCase = new HealthCase();
        partialUpdatedHealthCase.setId(healthCase.getId());

        partialUpdatedHealthCase.openedDate(UPDATED_OPENED_DATE);

        restHealthCaseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHealthCase.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHealthCase))
            )
            .andExpect(status().isOk());

        // Validate the HealthCase in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHealthCaseUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedHealthCase, healthCase),
            getPersistedHealthCase(healthCase)
        );
    }

    @Test
    @Transactional
    void fullUpdateHealthCaseWithPatch() throws Exception {
        // Initialize the database
        insertedHealthCase = healthCaseRepository.saveAndFlush(healthCase);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the healthCase using partial update
        HealthCase partialUpdatedHealthCase = new HealthCase();
        partialUpdatedHealthCase.setId(healthCase.getId());

        partialUpdatedHealthCase
            .openedDate(UPDATED_OPENED_DATE)
            .status(UPDATED_STATUS)
            .outcome(UPDATED_OUTCOME)
            .closedDate(UPDATED_CLOSED_DATE);

        restHealthCaseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHealthCase.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHealthCase))
            )
            .andExpect(status().isOk());

        // Validate the HealthCase in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHealthCaseUpdatableFieldsEquals(partialUpdatedHealthCase, getPersistedHealthCase(partialUpdatedHealthCase));
    }

    @Test
    @Transactional
    void patchNonExistingHealthCase() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthCase.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHealthCaseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, healthCase.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(healthCase))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchHealthCase() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthCase.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthCaseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(healthCase))
            )
            .andExpect(status().isBadRequest());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamHealthCase() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        healthCase.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHealthCaseMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(healthCase)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HealthCase in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteHealthCase() throws Exception {
        // Initialize the database
        insertedHealthCase = healthCaseRepository.saveAndFlush(healthCase);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the healthCase
        restHealthCaseMockMvc
            .perform(delete(ENTITY_API_URL_ID, healthCase.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return healthCaseRepository.count();
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

    protected HealthCase getPersistedHealthCase(HealthCase healthCase) {
        return healthCaseRepository.findById(healthCase.getId()).orElseThrow();
    }

    protected void assertPersistedHealthCaseToMatchAllProperties(HealthCase expectedHealthCase) {
        assertHealthCaseAllPropertiesEquals(expectedHealthCase, getPersistedHealthCase(expectedHealthCase));
    }

    protected void assertPersistedHealthCaseToMatchUpdatableProperties(HealthCase expectedHealthCase) {
        assertHealthCaseAllUpdatablePropertiesEquals(expectedHealthCase, getPersistedHealthCase(expectedHealthCase));
    }
}
