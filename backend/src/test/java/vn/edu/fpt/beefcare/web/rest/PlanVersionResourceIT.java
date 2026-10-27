package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PlanVersionAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.sameNumber;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
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
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;

/**
 * Integration tests for the {@link PlanVersionResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PlanVersionResourceIT {

    private static final BigDecimal DEFAULT_PRICE_1_Y = new BigDecimal(1);
    private static final BigDecimal UPDATED_PRICE_1_Y = new BigDecimal(2);

    private static final BigDecimal DEFAULT_PRICE_2_Y = new BigDecimal(1);
    private static final BigDecimal UPDATED_PRICE_2_Y = new BigDecimal(2);

    private static final BigDecimal DEFAULT_PRICE_3_Y = new BigDecimal(1);
    private static final BigDecimal UPDATED_PRICE_3_Y = new BigDecimal(2);

    private static final String DEFAULT_TERMS = "AAAAAAAAAA";
    private static final String UPDATED_TERMS = "BBBBBBBBBB";

    private static final Instant DEFAULT_EFFECTIVE_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_EFFECTIVE_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/plan-versions";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PlanVersionRepository planVersionRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPlanVersionMockMvc;

    private PlanVersion planVersion;

    private PlanVersion insertedPlanVersion;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PlanVersion createEntity() {
        return new PlanVersion()
            .price1y(DEFAULT_PRICE_1_Y)
            .price2y(DEFAULT_PRICE_2_Y)
            .price3y(DEFAULT_PRICE_3_Y)
            .terms(DEFAULT_TERMS)
            .effectiveAt(DEFAULT_EFFECTIVE_AT);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PlanVersion createUpdatedEntity() {
        return new PlanVersion()
            .price1y(UPDATED_PRICE_1_Y)
            .price2y(UPDATED_PRICE_2_Y)
            .price3y(UPDATED_PRICE_3_Y)
            .terms(UPDATED_TERMS)
            .effectiveAt(UPDATED_EFFECTIVE_AT);
    }

    @BeforeEach
    void initTest() {
        planVersion = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedPlanVersion != null) {
            planVersionRepository.delete(insertedPlanVersion);
            insertedPlanVersion = null;
        }
    }

    @Test
    @Transactional
    void createPlanVersion() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PlanVersion
        var returnedPlanVersion = om.readValue(
            restPlanVersionMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PlanVersion.class
        );

        // Validate the PlanVersion in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPlanVersionUpdatableFieldsEquals(returnedPlanVersion, getPersistedPlanVersion(returnedPlanVersion));

        insertedPlanVersion = returnedPlanVersion;
    }

    @Test
    @Transactional
    void createPlanVersionWithExistingId() throws Exception {
        // Create the PlanVersion with an existing ID
        planVersion.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPlanVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isBadRequest());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkPrice1yIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        planVersion.setPrice1y(null);

        // Create the PlanVersion, which fails.

        restPlanVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkPrice2yIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        planVersion.setPrice2y(null);

        // Create the PlanVersion, which fails.

        restPlanVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkPrice3yIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        planVersion.setPrice3y(null);

        // Create the PlanVersion, which fails.

        restPlanVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEffectiveAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        planVersion.setEffectiveAt(null);

        // Create the PlanVersion, which fails.

        restPlanVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPlanVersions() throws Exception {
        // Initialize the database
        insertedPlanVersion = planVersionRepository.saveAndFlush(planVersion);

        // Get all the planVersionList
        restPlanVersionMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(planVersion.getId().intValue())))
            .andExpect(jsonPath("$.[*].price1y").value(hasItem(sameNumber(DEFAULT_PRICE_1_Y))))
            .andExpect(jsonPath("$.[*].price2y").value(hasItem(sameNumber(DEFAULT_PRICE_2_Y))))
            .andExpect(jsonPath("$.[*].price3y").value(hasItem(sameNumber(DEFAULT_PRICE_3_Y))))
            .andExpect(jsonPath("$.[*].terms").value(hasItem(DEFAULT_TERMS)))
            .andExpect(jsonPath("$.[*].effectiveAt").value(hasItem(DEFAULT_EFFECTIVE_AT.toString())));
    }

    @Test
    @Transactional
    void getPlanVersion() throws Exception {
        // Initialize the database
        insertedPlanVersion = planVersionRepository.saveAndFlush(planVersion);

        // Get the planVersion
        restPlanVersionMockMvc
            .perform(get(ENTITY_API_URL_ID, planVersion.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(planVersion.getId().intValue()))
            .andExpect(jsonPath("$.price1y").value(sameNumber(DEFAULT_PRICE_1_Y)))
            .andExpect(jsonPath("$.price2y").value(sameNumber(DEFAULT_PRICE_2_Y)))
            .andExpect(jsonPath("$.price3y").value(sameNumber(DEFAULT_PRICE_3_Y)))
            .andExpect(jsonPath("$.terms").value(DEFAULT_TERMS))
            .andExpect(jsonPath("$.effectiveAt").value(DEFAULT_EFFECTIVE_AT.toString()));
    }

    @Test
    @Transactional
    void getNonExistingPlanVersion() throws Exception {
        // Get the planVersion
        restPlanVersionMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPlanVersion() throws Exception {
        // Initialize the database
        insertedPlanVersion = planVersionRepository.saveAndFlush(planVersion);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the planVersion
        PlanVersion updatedPlanVersion = planVersionRepository.findById(planVersion.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPlanVersion are not directly saved in db
        em.detach(updatedPlanVersion);
        updatedPlanVersion
            .price1y(UPDATED_PRICE_1_Y)
            .price2y(UPDATED_PRICE_2_Y)
            .price3y(UPDATED_PRICE_3_Y)
            .terms(UPDATED_TERMS)
            .effectiveAt(UPDATED_EFFECTIVE_AT);

        restPlanVersionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPlanVersion.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedPlanVersion))
            )
            .andExpect(status().isOk());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPlanVersionToMatchAllProperties(updatedPlanVersion);
    }

    @Test
    @Transactional
    void putNonExistingPlanVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        planVersion.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPlanVersionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, planVersion.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(planVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPlanVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        planVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlanVersionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(planVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPlanVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        planVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlanVersionMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePlanVersionWithPatch() throws Exception {
        // Initialize the database
        insertedPlanVersion = planVersionRepository.saveAndFlush(planVersion);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the planVersion using partial update
        PlanVersion partialUpdatedPlanVersion = new PlanVersion();
        partialUpdatedPlanVersion.setId(planVersion.getId());

        partialUpdatedPlanVersion.price1y(UPDATED_PRICE_1_Y).terms(UPDATED_TERMS).effectiveAt(UPDATED_EFFECTIVE_AT);

        restPlanVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPlanVersion.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPlanVersion))
            )
            .andExpect(status().isOk());

        // Validate the PlanVersion in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPlanVersionUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPlanVersion, planVersion),
            getPersistedPlanVersion(planVersion)
        );
    }

    @Test
    @Transactional
    void fullUpdatePlanVersionWithPatch() throws Exception {
        // Initialize the database
        insertedPlanVersion = planVersionRepository.saveAndFlush(planVersion);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the planVersion using partial update
        PlanVersion partialUpdatedPlanVersion = new PlanVersion();
        partialUpdatedPlanVersion.setId(planVersion.getId());

        partialUpdatedPlanVersion
            .price1y(UPDATED_PRICE_1_Y)
            .price2y(UPDATED_PRICE_2_Y)
            .price3y(UPDATED_PRICE_3_Y)
            .terms(UPDATED_TERMS)
            .effectiveAt(UPDATED_EFFECTIVE_AT);

        restPlanVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPlanVersion.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPlanVersion))
            )
            .andExpect(status().isOk());

        // Validate the PlanVersion in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPlanVersionUpdatableFieldsEquals(partialUpdatedPlanVersion, getPersistedPlanVersion(partialUpdatedPlanVersion));
    }

    @Test
    @Transactional
    void patchNonExistingPlanVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        planVersion.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPlanVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, planVersion.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(planVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPlanVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        planVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlanVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(planVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPlanVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        planVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlanVersionMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(planVersion)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PlanVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePlanVersion() throws Exception {
        // Initialize the database
        insertedPlanVersion = planVersionRepository.saveAndFlush(planVersion);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the planVersion
        restPlanVersionMockMvc
            .perform(delete(ENTITY_API_URL_ID, planVersion.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return planVersionRepository.count();
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

    protected PlanVersion getPersistedPlanVersion(PlanVersion planVersion) {
        return planVersionRepository.findById(planVersion.getId()).orElseThrow();
    }

    protected void assertPersistedPlanVersionToMatchAllProperties(PlanVersion expectedPlanVersion) {
        assertPlanVersionAllPropertiesEquals(expectedPlanVersion, getPersistedPlanVersion(expectedPlanVersion));
    }

    protected void assertPersistedPlanVersionToMatchUpdatableProperties(PlanVersion expectedPlanVersion) {
        assertPlanVersionAllUpdatablePropertiesEquals(expectedPlanVersion, getPersistedPlanVersion(expectedPlanVersion));
    }
}
