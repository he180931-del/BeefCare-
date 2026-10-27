package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.ProductionPurposeAsserts.*;
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
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.repository.ProductionPurposeRepository;

/**
 * Integration tests for the {@link ProductionPurposeResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class ProductionPurposeResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_DESCRIPTION = "AAAAAAAAAA";
    private static final String UPDATED_DESCRIPTION = "BBBBBBBBBB";

    private static final Boolean DEFAULT_AVAILABLE = false;
    private static final Boolean UPDATED_AVAILABLE = true;

    private static final String ENTITY_API_URL = "/api/production-purposes";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ProductionPurposeRepository productionPurposeRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restProductionPurposeMockMvc;

    private ProductionPurpose productionPurpose;

    private ProductionPurpose insertedProductionPurpose;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ProductionPurpose createEntity(EntityManager em) {
        ProductionPurpose productionPurpose = new ProductionPurpose()
            .code(DEFAULT_CODE)
            .name(DEFAULT_NAME)
            .description(DEFAULT_DESCRIPTION)
            .available(DEFAULT_AVAILABLE);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        productionPurpose.setFarm(farm);
        return productionPurpose;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ProductionPurpose createUpdatedEntity(EntityManager em) {
        ProductionPurpose updatedProductionPurpose = new ProductionPurpose()
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .description(UPDATED_DESCRIPTION)
            .available(UPDATED_AVAILABLE);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedProductionPurpose.setFarm(farm);
        return updatedProductionPurpose;
    }

    @BeforeEach
    void initTest() {
        productionPurpose = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedProductionPurpose != null) {
            productionPurposeRepository.delete(insertedProductionPurpose);
            insertedProductionPurpose = null;
        }
    }

    @Test
    @Transactional
    void createProductionPurpose() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the ProductionPurpose
        var returnedProductionPurpose = om.readValue(
            restProductionPurposeMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(productionPurpose)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ProductionPurpose.class
        );

        // Validate the ProductionPurpose in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertProductionPurposeUpdatableFieldsEquals(returnedProductionPurpose, getPersistedProductionPurpose(returnedProductionPurpose));

        insertedProductionPurpose = returnedProductionPurpose;
    }

    @Test
    @Transactional
    void createProductionPurposeWithExistingId() throws Exception {
        // Create the ProductionPurpose with an existing ID
        productionPurpose.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restProductionPurposeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(productionPurpose)))
            .andExpect(status().isBadRequest());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        productionPurpose.setCode(null);

        // Create the ProductionPurpose, which fails.

        restProductionPurposeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(productionPurpose)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        productionPurpose.setName(null);

        // Create the ProductionPurpose, which fails.

        restProductionPurposeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(productionPurpose)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAvailableIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        productionPurpose.setAvailable(null);

        // Create the ProductionPurpose, which fails.

        restProductionPurposeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(productionPurpose)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllProductionPurposes() throws Exception {
        // Initialize the database
        insertedProductionPurpose = productionPurposeRepository.saveAndFlush(productionPurpose);

        // Get all the productionPurposeList
        restProductionPurposeMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(productionPurpose.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].description").value(hasItem(DEFAULT_DESCRIPTION)))
            .andExpect(jsonPath("$.[*].available").value(hasItem(DEFAULT_AVAILABLE)));
    }

    @Test
    @Transactional
    void getProductionPurpose() throws Exception {
        // Initialize the database
        insertedProductionPurpose = productionPurposeRepository.saveAndFlush(productionPurpose);

        // Get the productionPurpose
        restProductionPurposeMockMvc
            .perform(get(ENTITY_API_URL_ID, productionPurpose.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(productionPurpose.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.description").value(DEFAULT_DESCRIPTION))
            .andExpect(jsonPath("$.available").value(DEFAULT_AVAILABLE));
    }

    @Test
    @Transactional
    void getNonExistingProductionPurpose() throws Exception {
        // Get the productionPurpose
        restProductionPurposeMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingProductionPurpose() throws Exception {
        // Initialize the database
        insertedProductionPurpose = productionPurposeRepository.saveAndFlush(productionPurpose);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the productionPurpose
        ProductionPurpose updatedProductionPurpose = productionPurposeRepository.findById(productionPurpose.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedProductionPurpose are not directly saved in db
        em.detach(updatedProductionPurpose);
        updatedProductionPurpose.code(UPDATED_CODE).name(UPDATED_NAME).description(UPDATED_DESCRIPTION).available(UPDATED_AVAILABLE);

        restProductionPurposeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedProductionPurpose.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedProductionPurpose))
            )
            .andExpect(status().isOk());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedProductionPurposeToMatchAllProperties(updatedProductionPurpose);
    }

    @Test
    @Transactional
    void putNonExistingProductionPurpose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        productionPurpose.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restProductionPurposeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, productionPurpose.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(productionPurpose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchProductionPurpose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        productionPurpose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restProductionPurposeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(productionPurpose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamProductionPurpose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        productionPurpose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restProductionPurposeMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(productionPurpose)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateProductionPurposeWithPatch() throws Exception {
        // Initialize the database
        insertedProductionPurpose = productionPurposeRepository.saveAndFlush(productionPurpose);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the productionPurpose using partial update
        ProductionPurpose partialUpdatedProductionPurpose = new ProductionPurpose();
        partialUpdatedProductionPurpose.setId(productionPurpose.getId());

        partialUpdatedProductionPurpose.name(UPDATED_NAME).description(UPDATED_DESCRIPTION);

        restProductionPurposeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedProductionPurpose.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedProductionPurpose))
            )
            .andExpect(status().isOk());

        // Validate the ProductionPurpose in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertProductionPurposeUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedProductionPurpose, productionPurpose),
            getPersistedProductionPurpose(productionPurpose)
        );
    }

    @Test
    @Transactional
    void fullUpdateProductionPurposeWithPatch() throws Exception {
        // Initialize the database
        insertedProductionPurpose = productionPurposeRepository.saveAndFlush(productionPurpose);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the productionPurpose using partial update
        ProductionPurpose partialUpdatedProductionPurpose = new ProductionPurpose();
        partialUpdatedProductionPurpose.setId(productionPurpose.getId());

        partialUpdatedProductionPurpose.code(UPDATED_CODE).name(UPDATED_NAME).description(UPDATED_DESCRIPTION).available(UPDATED_AVAILABLE);

        restProductionPurposeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedProductionPurpose.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedProductionPurpose))
            )
            .andExpect(status().isOk());

        // Validate the ProductionPurpose in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertProductionPurposeUpdatableFieldsEquals(
            partialUpdatedProductionPurpose,
            getPersistedProductionPurpose(partialUpdatedProductionPurpose)
        );
    }

    @Test
    @Transactional
    void patchNonExistingProductionPurpose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        productionPurpose.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restProductionPurposeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, productionPurpose.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(productionPurpose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchProductionPurpose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        productionPurpose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restProductionPurposeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(productionPurpose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamProductionPurpose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        productionPurpose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restProductionPurposeMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(productionPurpose)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ProductionPurpose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteProductionPurpose() throws Exception {
        // Initialize the database
        insertedProductionPurpose = productionPurposeRepository.saveAndFlush(productionPurpose);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the productionPurpose
        restProductionPurposeMockMvc
            .perform(delete(ENTITY_API_URL_ID, productionPurpose.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return productionPurposeRepository.count();
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

    protected ProductionPurpose getPersistedProductionPurpose(ProductionPurpose productionPurpose) {
        return productionPurposeRepository.findById(productionPurpose.getId()).orElseThrow();
    }

    protected void assertPersistedProductionPurposeToMatchAllProperties(ProductionPurpose expectedProductionPurpose) {
        assertProductionPurposeAllPropertiesEquals(expectedProductionPurpose, getPersistedProductionPurpose(expectedProductionPurpose));
    }

    protected void assertPersistedProductionPurposeToMatchUpdatableProperties(ProductionPurpose expectedProductionPurpose) {
        assertProductionPurposeAllUpdatablePropertiesEquals(
            expectedProductionPurpose,
            getPersistedProductionPurpose(expectedProductionPurpose)
        );
    }
}
