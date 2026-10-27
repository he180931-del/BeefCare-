package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.GrowthAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.sameNumber;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.repository.GrowthRepository;

/**
 * Integration tests for the {@link GrowthResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class GrowthResourceIT {

    private static final LocalDate DEFAULT_CHECK_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_CHECK_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final Instant DEFAULT_ENTRY_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_ENTRY_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final BigDecimal DEFAULT_WEIGHT_KG = new BigDecimal(1);
    private static final BigDecimal UPDATED_WEIGHT_KG = new BigDecimal(2);

    private static final String DEFAULT_WEIGHT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_WEIGHT_TYPE = "BBBBBBBBBB";

    private static final Integer DEFAULT_BCS = 1;
    private static final Integer UPDATED_BCS = 2;

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String DEFAULT_CORRECTION_REASON = "AAAAAAAAAA";
    private static final String UPDATED_CORRECTION_REASON = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/growths";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private GrowthRepository growthRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restGrowthMockMvc;

    private Growth growth;

    private Growth insertedGrowth;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Growth createEntity(EntityManager em) {
        Growth growth = new Growth()
            .checkDate(DEFAULT_CHECK_DATE)
            .entryTime(DEFAULT_ENTRY_TIME)
            .weightKg(DEFAULT_WEIGHT_KG)
            .weightType(DEFAULT_WEIGHT_TYPE)
            .bcs(DEFAULT_BCS)
            .status(DEFAULT_STATUS)
            .correctionReason(DEFAULT_CORRECTION_REASON);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        growth.setCattle(cattle);
        return growth;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Growth createUpdatedEntity(EntityManager em) {
        Growth updatedGrowth = new Growth()
            .checkDate(UPDATED_CHECK_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .weightKg(UPDATED_WEIGHT_KG)
            .weightType(UPDATED_WEIGHT_TYPE)
            .bcs(UPDATED_BCS)
            .status(UPDATED_STATUS)
            .correctionReason(UPDATED_CORRECTION_REASON);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedGrowth.setCattle(cattle);
        return updatedGrowth;
    }

    @BeforeEach
    void initTest() {
        growth = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedGrowth != null) {
            growthRepository.delete(insertedGrowth);
            insertedGrowth = null;
        }
    }

    @Test
    @Transactional
    void createGrowth() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Growth
        var returnedGrowth = om.readValue(
            restGrowthMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Growth.class
        );

        // Validate the Growth in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertGrowthUpdatableFieldsEquals(returnedGrowth, getPersistedGrowth(returnedGrowth));

        insertedGrowth = returnedGrowth;
    }

    @Test
    @Transactional
    void createGrowthWithExistingId() throws Exception {
        // Create the Growth with an existing ID
        growth.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCheckDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        growth.setCheckDate(null);

        // Create the Growth, which fails.

        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEntryTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        growth.setEntryTime(null);

        // Create the Growth, which fails.

        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkWeightKgIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        growth.setWeightKg(null);

        // Create the Growth, which fails.

        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkWeightTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        growth.setWeightType(null);

        // Create the Growth, which fails.

        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkBcsIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        growth.setBcs(null);

        // Create the Growth, which fails.

        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        growth.setStatus(null);

        // Create the Growth, which fails.

        restGrowthMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllGrowths() throws Exception {
        // Initialize the database
        insertedGrowth = growthRepository.saveAndFlush(growth);

        // Get all the growthList
        restGrowthMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(growth.getId().intValue())))
            .andExpect(jsonPath("$.[*].checkDate").value(hasItem(DEFAULT_CHECK_DATE.toString())))
            .andExpect(jsonPath("$.[*].entryTime").value(hasItem(DEFAULT_ENTRY_TIME.toString())))
            .andExpect(jsonPath("$.[*].weightKg").value(hasItem(sameNumber(DEFAULT_WEIGHT_KG))))
            .andExpect(jsonPath("$.[*].weightType").value(hasItem(DEFAULT_WEIGHT_TYPE)))
            .andExpect(jsonPath("$.[*].bcs").value(hasItem(DEFAULT_BCS)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)))
            .andExpect(jsonPath("$.[*].correctionReason").value(hasItem(DEFAULT_CORRECTION_REASON)));
    }

    @Test
    @Transactional
    void getGrowth() throws Exception {
        // Initialize the database
        insertedGrowth = growthRepository.saveAndFlush(growth);

        // Get the growth
        restGrowthMockMvc
            .perform(get(ENTITY_API_URL_ID, growth.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(growth.getId().intValue()))
            .andExpect(jsonPath("$.checkDate").value(DEFAULT_CHECK_DATE.toString()))
            .andExpect(jsonPath("$.entryTime").value(DEFAULT_ENTRY_TIME.toString()))
            .andExpect(jsonPath("$.weightKg").value(sameNumber(DEFAULT_WEIGHT_KG)))
            .andExpect(jsonPath("$.weightType").value(DEFAULT_WEIGHT_TYPE))
            .andExpect(jsonPath("$.bcs").value(DEFAULT_BCS))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS))
            .andExpect(jsonPath("$.correctionReason").value(DEFAULT_CORRECTION_REASON));
    }

    @Test
    @Transactional
    void getNonExistingGrowth() throws Exception {
        // Get the growth
        restGrowthMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingGrowth() throws Exception {
        // Initialize the database
        insertedGrowth = growthRepository.saveAndFlush(growth);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the growth
        Growth updatedGrowth = growthRepository.findById(growth.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedGrowth are not directly saved in db
        em.detach(updatedGrowth);
        updatedGrowth
            .checkDate(UPDATED_CHECK_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .weightKg(UPDATED_WEIGHT_KG)
            .weightType(UPDATED_WEIGHT_TYPE)
            .bcs(UPDATED_BCS)
            .status(UPDATED_STATUS)
            .correctionReason(UPDATED_CORRECTION_REASON);

        restGrowthMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedGrowth.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedGrowth))
            )
            .andExpect(status().isOk());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedGrowthToMatchAllProperties(updatedGrowth);
    }

    @Test
    @Transactional
    void putNonExistingGrowth() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        growth.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restGrowthMockMvc
            .perform(put(ENTITY_API_URL_ID, growth.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isBadRequest());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchGrowth() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        growth.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restGrowthMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(growth))
            )
            .andExpect(status().isBadRequest());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamGrowth() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        growth.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restGrowthMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(growth)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateGrowthWithPatch() throws Exception {
        // Initialize the database
        insertedGrowth = growthRepository.saveAndFlush(growth);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the growth using partial update
        Growth partialUpdatedGrowth = new Growth();
        partialUpdatedGrowth.setId(growth.getId());

        partialUpdatedGrowth
            .checkDate(UPDATED_CHECK_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .weightKg(UPDATED_WEIGHT_KG)
            .weightType(UPDATED_WEIGHT_TYPE);

        restGrowthMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedGrowth.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedGrowth))
            )
            .andExpect(status().isOk());

        // Validate the Growth in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertGrowthUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedGrowth, growth), getPersistedGrowth(growth));
    }

    @Test
    @Transactional
    void fullUpdateGrowthWithPatch() throws Exception {
        // Initialize the database
        insertedGrowth = growthRepository.saveAndFlush(growth);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the growth using partial update
        Growth partialUpdatedGrowth = new Growth();
        partialUpdatedGrowth.setId(growth.getId());

        partialUpdatedGrowth
            .checkDate(UPDATED_CHECK_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .weightKg(UPDATED_WEIGHT_KG)
            .weightType(UPDATED_WEIGHT_TYPE)
            .bcs(UPDATED_BCS)
            .status(UPDATED_STATUS)
            .correctionReason(UPDATED_CORRECTION_REASON);

        restGrowthMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedGrowth.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedGrowth))
            )
            .andExpect(status().isOk());

        // Validate the Growth in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertGrowthUpdatableFieldsEquals(partialUpdatedGrowth, getPersistedGrowth(partialUpdatedGrowth));
    }

    @Test
    @Transactional
    void patchNonExistingGrowth() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        growth.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restGrowthMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, growth.getId()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(growth))
            )
            .andExpect(status().isBadRequest());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchGrowth() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        growth.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restGrowthMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(growth))
            )
            .andExpect(status().isBadRequest());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamGrowth() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        growth.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restGrowthMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(growth)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Growth in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteGrowth() throws Exception {
        // Initialize the database
        insertedGrowth = growthRepository.saveAndFlush(growth);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the growth
        restGrowthMockMvc
            .perform(delete(ENTITY_API_URL_ID, growth.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return growthRepository.count();
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

    protected Growth getPersistedGrowth(Growth growth) {
        return growthRepository.findById(growth.getId()).orElseThrow();
    }

    protected void assertPersistedGrowthToMatchAllProperties(Growth expectedGrowth) {
        assertGrowthAllPropertiesEquals(expectedGrowth, getPersistedGrowth(expectedGrowth));
    }

    protected void assertPersistedGrowthToMatchUpdatableProperties(Growth expectedGrowth) {
        assertGrowthAllUpdatablePropertiesEquals(expectedGrowth, getPersistedGrowth(expectedGrowth));
    }
}
