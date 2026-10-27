package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.CattleAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.repository.CattleRepository;

/**
 * Integration tests for the {@link CattleResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class CattleResourceIT {

    private static final String DEFAULT_DISPLAY_CODE = "AAAAAAAAAA";
    private static final String UPDATED_DISPLAY_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_EAR_TAG = "AAAAAAAAAA";
    private static final String UPDATED_EAR_TAG = "BBBBBBBBBB";

    private static final String DEFAULT_SEX = "AAAAAAAAAA";
    private static final String UPDATED_SEX = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_BIRTH_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_BIRTH_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_LIFE_STAGE = "AAAAAAAAAA";
    private static final String UPDATED_LIFE_STAGE = "BBBBBBBBBB";

    private static final String DEFAULT_HERD_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_HERD_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/cattles";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private CattleRepository cattleRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restCattleMockMvc;

    private Cattle cattle;

    private Cattle insertedCattle;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Cattle createEntity(EntityManager em) {
        Cattle cattle = new Cattle()
            .displayCode(DEFAULT_DISPLAY_CODE)
            .earTag(DEFAULT_EAR_TAG)
            .sex(DEFAULT_SEX)
            .birthDate(DEFAULT_BIRTH_DATE)
            .lifeStage(DEFAULT_LIFE_STAGE)
            .herdStatus(DEFAULT_HERD_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        cattle.setFarm(farm);
        // Add required entity
        Breed breed;
        if (TestUtil.findAll(em, Breed.class).isEmpty()) {
            breed = BreedResourceIT.createEntity(em);
            em.persist(breed);
            em.flush();
        } else {
            breed = TestUtil.findAll(em, Breed.class).get(0);
        }
        cattle.setBreed(breed);
        // Add required entity
        ProductionPurpose productionPurpose;
        if (TestUtil.findAll(em, ProductionPurpose.class).isEmpty()) {
            productionPurpose = ProductionPurposeResourceIT.createEntity(em);
            em.persist(productionPurpose);
            em.flush();
        } else {
            productionPurpose = TestUtil.findAll(em, ProductionPurpose.class).get(0);
        }
        cattle.setPurpose(productionPurpose);
        return cattle;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Cattle createUpdatedEntity(EntityManager em) {
        Cattle updatedCattle = new Cattle()
            .displayCode(UPDATED_DISPLAY_CODE)
            .earTag(UPDATED_EAR_TAG)
            .sex(UPDATED_SEX)
            .birthDate(UPDATED_BIRTH_DATE)
            .lifeStage(UPDATED_LIFE_STAGE)
            .herdStatus(UPDATED_HERD_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedCattle.setFarm(farm);
        // Add required entity
        Breed breed;
        if (TestUtil.findAll(em, Breed.class).isEmpty()) {
            breed = BreedResourceIT.createUpdatedEntity(em);
            em.persist(breed);
            em.flush();
        } else {
            breed = TestUtil.findAll(em, Breed.class).get(0);
        }
        updatedCattle.setBreed(breed);
        // Add required entity
        ProductionPurpose productionPurpose;
        if (TestUtil.findAll(em, ProductionPurpose.class).isEmpty()) {
            productionPurpose = ProductionPurposeResourceIT.createUpdatedEntity(em);
            em.persist(productionPurpose);
            em.flush();
        } else {
            productionPurpose = TestUtil.findAll(em, ProductionPurpose.class).get(0);
        }
        updatedCattle.setPurpose(productionPurpose);
        return updatedCattle;
    }

    @BeforeEach
    void initTest() {
        cattle = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedCattle != null) {
            cattleRepository.delete(insertedCattle);
            insertedCattle = null;
        }
    }

    @Test
    @Transactional
    void createCattle() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Cattle
        var returnedCattle = om.readValue(
            restCattleMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Cattle.class
        );

        // Validate the Cattle in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertCattleUpdatableFieldsEquals(returnedCattle, getPersistedCattle(returnedCattle));

        insertedCattle = returnedCattle;
    }

    @Test
    @Transactional
    void createCattleWithExistingId() throws Exception {
        // Create the Cattle with an existing ID
        cattle.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restCattleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isBadRequest());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkDisplayCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattle.setDisplayCode(null);

        // Create the Cattle, which fails.

        restCattleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEarTagIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattle.setEarTag(null);

        // Create the Cattle, which fails.

        restCattleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkLifeStageIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattle.setLifeStage(null);

        // Create the Cattle, which fails.

        restCattleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkHerdStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattle.setHerdStatus(null);

        // Create the Cattle, which fails.

        restCattleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllCattles() throws Exception {
        // Initialize the database
        insertedCattle = cattleRepository.saveAndFlush(cattle);

        // Get all the cattleList
        restCattleMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(cattle.getId().intValue())))
            .andExpect(jsonPath("$.[*].displayCode").value(hasItem(DEFAULT_DISPLAY_CODE)))
            .andExpect(jsonPath("$.[*].earTag").value(hasItem(DEFAULT_EAR_TAG)))
            .andExpect(jsonPath("$.[*].sex").value(hasItem(DEFAULT_SEX)))
            .andExpect(jsonPath("$.[*].birthDate").value(hasItem(DEFAULT_BIRTH_DATE.toString())))
            .andExpect(jsonPath("$.[*].lifeStage").value(hasItem(DEFAULT_LIFE_STAGE)))
            .andExpect(jsonPath("$.[*].herdStatus").value(hasItem(DEFAULT_HERD_STATUS)));
    }

    @Test
    @Transactional
    void getCattle() throws Exception {
        // Initialize the database
        insertedCattle = cattleRepository.saveAndFlush(cattle);

        // Get the cattle
        restCattleMockMvc
            .perform(get(ENTITY_API_URL_ID, cattle.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(cattle.getId().intValue()))
            .andExpect(jsonPath("$.displayCode").value(DEFAULT_DISPLAY_CODE))
            .andExpect(jsonPath("$.earTag").value(DEFAULT_EAR_TAG))
            .andExpect(jsonPath("$.sex").value(DEFAULT_SEX))
            .andExpect(jsonPath("$.birthDate").value(DEFAULT_BIRTH_DATE.toString()))
            .andExpect(jsonPath("$.lifeStage").value(DEFAULT_LIFE_STAGE))
            .andExpect(jsonPath("$.herdStatus").value(DEFAULT_HERD_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingCattle() throws Exception {
        // Get the cattle
        restCattleMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingCattle() throws Exception {
        // Initialize the database
        insertedCattle = cattleRepository.saveAndFlush(cattle);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattle
        Cattle updatedCattle = cattleRepository.findById(cattle.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedCattle are not directly saved in db
        em.detach(updatedCattle);
        updatedCattle
            .displayCode(UPDATED_DISPLAY_CODE)
            .earTag(UPDATED_EAR_TAG)
            .sex(UPDATED_SEX)
            .birthDate(UPDATED_BIRTH_DATE)
            .lifeStage(UPDATED_LIFE_STAGE)
            .herdStatus(UPDATED_HERD_STATUS);

        restCattleMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedCattle.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedCattle))
            )
            .andExpect(status().isOk());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedCattleToMatchAllProperties(updatedCattle);
    }

    @Test
    @Transactional
    void putNonExistingCattle() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattle.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCattleMockMvc
            .perform(put(ENTITY_API_URL_ID, cattle.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isBadRequest());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchCattle() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattle.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cattle))
            )
            .andExpect(status().isBadRequest());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamCattle() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattle.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateCattleWithPatch() throws Exception {
        // Initialize the database
        insertedCattle = cattleRepository.saveAndFlush(cattle);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattle using partial update
        Cattle partialUpdatedCattle = new Cattle();
        partialUpdatedCattle.setId(cattle.getId());

        partialUpdatedCattle.displayCode(UPDATED_DISPLAY_CODE).earTag(UPDATED_EAR_TAG).lifeStage(UPDATED_LIFE_STAGE);

        restCattleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCattle.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCattle))
            )
            .andExpect(status().isOk());

        // Validate the Cattle in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCattleUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedCattle, cattle), getPersistedCattle(cattle));
    }

    @Test
    @Transactional
    void fullUpdateCattleWithPatch() throws Exception {
        // Initialize the database
        insertedCattle = cattleRepository.saveAndFlush(cattle);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattle using partial update
        Cattle partialUpdatedCattle = new Cattle();
        partialUpdatedCattle.setId(cattle.getId());

        partialUpdatedCattle
            .displayCode(UPDATED_DISPLAY_CODE)
            .earTag(UPDATED_EAR_TAG)
            .sex(UPDATED_SEX)
            .birthDate(UPDATED_BIRTH_DATE)
            .lifeStage(UPDATED_LIFE_STAGE)
            .herdStatus(UPDATED_HERD_STATUS);

        restCattleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCattle.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCattle))
            )
            .andExpect(status().isOk());

        // Validate the Cattle in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCattleUpdatableFieldsEquals(partialUpdatedCattle, getPersistedCattle(partialUpdatedCattle));
    }

    @Test
    @Transactional
    void patchNonExistingCattle() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattle.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCattleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, cattle.getId()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(cattle))
            )
            .andExpect(status().isBadRequest());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchCattle() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattle.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cattle))
            )
            .andExpect(status().isBadRequest());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamCattle() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattle.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(cattle)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Cattle in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteCattle() throws Exception {
        // Initialize the database
        insertedCattle = cattleRepository.saveAndFlush(cattle);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the cattle
        restCattleMockMvc
            .perform(delete(ENTITY_API_URL_ID, cattle.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return cattleRepository.count();
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

    protected Cattle getPersistedCattle(Cattle cattle) {
        return cattleRepository.findById(cattle.getId()).orElseThrow();
    }

    protected void assertPersistedCattleToMatchAllProperties(Cattle expectedCattle) {
        assertCattleAllPropertiesEquals(expectedCattle, getPersistedCattle(expectedCattle));
    }

    protected void assertPersistedCattleToMatchUpdatableProperties(Cattle expectedCattle) {
        assertCattleAllUpdatablePropertiesEquals(expectedCattle, getPersistedCattle(expectedCattle));
    }
}
