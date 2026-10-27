package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.FarmAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import vn.edu.fpt.beefcare.repository.FarmRepository;

/**
 * Integration tests for the {@link FarmResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class FarmResourceIT {

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_LOCATION = "AAAAAAAAAA";
    private static final String UPDATED_LOCATION = "BBBBBBBBBB";

    private static final String DEFAULT_CONTACT = "AAAAAAAAAA";
    private static final String UPDATED_CONTACT = "BBBBBBBBBB";

    private static final String DEFAULT_SERVICE_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_SERVICE_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/farms";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restFarmMockMvc;

    private Farm farm;

    private Farm insertedFarm;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Farm createEntity() {
        return new Farm().name(DEFAULT_NAME).location(DEFAULT_LOCATION).contact(DEFAULT_CONTACT).serviceStatus(DEFAULT_SERVICE_STATUS);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Farm createUpdatedEntity() {
        return new Farm().name(UPDATED_NAME).location(UPDATED_LOCATION).contact(UPDATED_CONTACT).serviceStatus(UPDATED_SERVICE_STATUS);
    }

    @BeforeEach
    void initTest() {
        farm = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedFarm != null) {
            farmRepository.delete(insertedFarm);
            insertedFarm = null;
        }
    }

    @Test
    @Transactional
    void createFarm() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Farm
        var returnedFarm = om.readValue(
            restFarmMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Farm.class
        );

        // Validate the Farm in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertFarmUpdatableFieldsEquals(returnedFarm, getPersistedFarm(returnedFarm));

        insertedFarm = returnedFarm;
    }

    @Test
    @Transactional
    void createFarmWithExistingId() throws Exception {
        // Create the Farm with an existing ID
        farm.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restFarmMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farm.setName(null);

        // Create the Farm, which fails.

        restFarmMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkLocationIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farm.setLocation(null);

        // Create the Farm, which fails.

        restFarmMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkContactIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farm.setContact(null);

        // Create the Farm, which fails.

        restFarmMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkServiceStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farm.setServiceStatus(null);

        // Create the Farm, which fails.

        restFarmMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllFarms() throws Exception {
        // Initialize the database
        insertedFarm = farmRepository.saveAndFlush(farm);

        // Get all the farmList
        restFarmMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(farm.getId().intValue())))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].location").value(hasItem(DEFAULT_LOCATION)))
            .andExpect(jsonPath("$.[*].contact").value(hasItem(DEFAULT_CONTACT)))
            .andExpect(jsonPath("$.[*].serviceStatus").value(hasItem(DEFAULT_SERVICE_STATUS)));
    }

    @Test
    @Transactional
    void getFarm() throws Exception {
        // Initialize the database
        insertedFarm = farmRepository.saveAndFlush(farm);

        // Get the farm
        restFarmMockMvc
            .perform(get(ENTITY_API_URL_ID, farm.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(farm.getId().intValue()))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.location").value(DEFAULT_LOCATION))
            .andExpect(jsonPath("$.contact").value(DEFAULT_CONTACT))
            .andExpect(jsonPath("$.serviceStatus").value(DEFAULT_SERVICE_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingFarm() throws Exception {
        // Get the farm
        restFarmMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingFarm() throws Exception {
        // Initialize the database
        insertedFarm = farmRepository.saveAndFlush(farm);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farm
        Farm updatedFarm = farmRepository.findById(farm.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedFarm are not directly saved in db
        em.detach(updatedFarm);
        updatedFarm.name(UPDATED_NAME).location(UPDATED_LOCATION).contact(UPDATED_CONTACT).serviceStatus(UPDATED_SERVICE_STATUS);

        restFarmMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedFarm.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedFarm))
            )
            .andExpect(status().isOk());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedFarmToMatchAllProperties(updatedFarm);
    }

    @Test
    @Transactional
    void putNonExistingFarm() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farm.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmMockMvc
            .perform(put(ENTITY_API_URL_ID, farm.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchFarm() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farm.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farm))
            )
            .andExpect(status().isBadRequest());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamFarm() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farm.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farm)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateFarmWithPatch() throws Exception {
        // Initialize the database
        insertedFarm = farmRepository.saveAndFlush(farm);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farm using partial update
        Farm partialUpdatedFarm = new Farm();
        partialUpdatedFarm.setId(farm.getId());

        partialUpdatedFarm.name(UPDATED_NAME).location(UPDATED_LOCATION).contact(UPDATED_CONTACT).serviceStatus(UPDATED_SERVICE_STATUS);

        restFarmMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarm.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarm))
            )
            .andExpect(status().isOk());

        // Validate the Farm in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedFarm, farm), getPersistedFarm(farm));
    }

    @Test
    @Transactional
    void fullUpdateFarmWithPatch() throws Exception {
        // Initialize the database
        insertedFarm = farmRepository.saveAndFlush(farm);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farm using partial update
        Farm partialUpdatedFarm = new Farm();
        partialUpdatedFarm.setId(farm.getId());

        partialUpdatedFarm.name(UPDATED_NAME).location(UPDATED_LOCATION).contact(UPDATED_CONTACT).serviceStatus(UPDATED_SERVICE_STATUS);

        restFarmMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarm.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarm))
            )
            .andExpect(status().isOk());

        // Validate the Farm in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmUpdatableFieldsEquals(partialUpdatedFarm, getPersistedFarm(partialUpdatedFarm));
    }

    @Test
    @Transactional
    void patchNonExistingFarm() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farm.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmMockMvc
            .perform(patch(ENTITY_API_URL_ID, farm.getId()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(farm)))
            .andExpect(status().isBadRequest());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchFarm() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farm.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farm))
            )
            .andExpect(status().isBadRequest());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamFarm() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farm.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(farm)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Farm in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteFarm() throws Exception {
        // Initialize the database
        insertedFarm = farmRepository.saveAndFlush(farm);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the farm
        restFarmMockMvc
            .perform(delete(ENTITY_API_URL_ID, farm.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return farmRepository.count();
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

    protected Farm getPersistedFarm(Farm farm) {
        return farmRepository.findById(farm.getId()).orElseThrow();
    }

    protected void assertPersistedFarmToMatchAllProperties(Farm expectedFarm) {
        assertFarmAllPropertiesEquals(expectedFarm, getPersistedFarm(expectedFarm));
    }

    protected void assertPersistedFarmToMatchUpdatableProperties(Farm expectedFarm) {
        assertFarmAllUpdatablePropertiesEquals(expectedFarm, getPersistedFarm(expectedFarm));
    }
}
