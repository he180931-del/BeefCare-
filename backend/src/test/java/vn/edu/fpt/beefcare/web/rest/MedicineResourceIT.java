package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.MedicineAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.repository.MedicineRepository;

/**
 * Integration tests for the {@link MedicineResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class MedicineResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_DESCRIPTION = "AAAAAAAAAA";
    private static final String UPDATED_DESCRIPTION = "BBBBBBBBBB";

    private static final String DEFAULT_DOSE = "AAAAAAAAAA";
    private static final String UPDATED_DOSE = "BBBBBBBBBB";

    private static final String DEFAULT_ROUTE = "AAAAAAAAAA";
    private static final String UPDATED_ROUTE = "BBBBBBBBBB";

    private static final String DEFAULT_WITHDRAWAL_INFO = "AAAAAAAAAA";
    private static final String UPDATED_WITHDRAWAL_INFO = "BBBBBBBBBB";

    private static final Boolean DEFAULT_AVAILABLE = false;
    private static final Boolean UPDATED_AVAILABLE = true;

    private static final String ENTITY_API_URL = "/api/medicines";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private MedicineRepository medicineRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restMedicineMockMvc;

    private Medicine medicine;

    private Medicine insertedMedicine;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Medicine createEntity(EntityManager em) {
        Medicine medicine = new Medicine()
            .code(DEFAULT_CODE)
            .name(DEFAULT_NAME)
            .description(DEFAULT_DESCRIPTION)
            .dose(DEFAULT_DOSE)
            .route(DEFAULT_ROUTE)
            .withdrawalInfo(DEFAULT_WITHDRAWAL_INFO)
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
        medicine.setFarm(farm);
        return medicine;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Medicine createUpdatedEntity(EntityManager em) {
        Medicine updatedMedicine = new Medicine()
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .description(UPDATED_DESCRIPTION)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .withdrawalInfo(UPDATED_WITHDRAWAL_INFO)
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
        updatedMedicine.setFarm(farm);
        return updatedMedicine;
    }

    @BeforeEach
    void initTest() {
        medicine = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedMedicine != null) {
            medicineRepository.delete(insertedMedicine);
            insertedMedicine = null;
        }
    }

    @Test
    @Transactional
    void createMedicine() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Medicine
        var returnedMedicine = om.readValue(
            restMedicineMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Medicine.class
        );

        // Validate the Medicine in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertMedicineUpdatableFieldsEquals(returnedMedicine, getPersistedMedicine(returnedMedicine));

        insertedMedicine = returnedMedicine;
    }

    @Test
    @Transactional
    void createMedicineWithExistingId() throws Exception {
        // Create the Medicine with an existing ID
        medicine.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        medicine.setCode(null);

        // Create the Medicine, which fails.

        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        medicine.setName(null);

        // Create the Medicine, which fails.

        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDoseIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        medicine.setDose(null);

        // Create the Medicine, which fails.

        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkRouteIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        medicine.setRoute(null);

        // Create the Medicine, which fails.

        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkWithdrawalInfoIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        medicine.setWithdrawalInfo(null);

        // Create the Medicine, which fails.

        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAvailableIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        medicine.setAvailable(null);

        // Create the Medicine, which fails.

        restMedicineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllMedicines() throws Exception {
        // Initialize the database
        insertedMedicine = medicineRepository.saveAndFlush(medicine);

        // Get all the medicineList
        restMedicineMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(medicine.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].description").value(hasItem(DEFAULT_DESCRIPTION)))
            .andExpect(jsonPath("$.[*].dose").value(hasItem(DEFAULT_DOSE)))
            .andExpect(jsonPath("$.[*].route").value(hasItem(DEFAULT_ROUTE)))
            .andExpect(jsonPath("$.[*].withdrawalInfo").value(hasItem(DEFAULT_WITHDRAWAL_INFO)))
            .andExpect(jsonPath("$.[*].available").value(hasItem(DEFAULT_AVAILABLE)));
    }

    @Test
    @Transactional
    void getMedicine() throws Exception {
        // Initialize the database
        insertedMedicine = medicineRepository.saveAndFlush(medicine);

        // Get the medicine
        restMedicineMockMvc
            .perform(get(ENTITY_API_URL_ID, medicine.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(medicine.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.description").value(DEFAULT_DESCRIPTION))
            .andExpect(jsonPath("$.dose").value(DEFAULT_DOSE))
            .andExpect(jsonPath("$.route").value(DEFAULT_ROUTE))
            .andExpect(jsonPath("$.withdrawalInfo").value(DEFAULT_WITHDRAWAL_INFO))
            .andExpect(jsonPath("$.available").value(DEFAULT_AVAILABLE));
    }

    @Test
    @Transactional
    void getNonExistingMedicine() throws Exception {
        // Get the medicine
        restMedicineMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingMedicine() throws Exception {
        // Initialize the database
        insertedMedicine = medicineRepository.saveAndFlush(medicine);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the medicine
        Medicine updatedMedicine = medicineRepository.findById(medicine.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedMedicine are not directly saved in db
        em.detach(updatedMedicine);
        updatedMedicine
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .description(UPDATED_DESCRIPTION)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .withdrawalInfo(UPDATED_WITHDRAWAL_INFO)
            .available(UPDATED_AVAILABLE);

        restMedicineMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedMedicine.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedMedicine))
            )
            .andExpect(status().isOk());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedMedicineToMatchAllProperties(updatedMedicine);
    }

    @Test
    @Transactional
    void putNonExistingMedicine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        medicine.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restMedicineMockMvc
            .perform(
                put(ENTITY_API_URL_ID, medicine.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchMedicine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        medicine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restMedicineMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(medicine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamMedicine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        medicine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restMedicineMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateMedicineWithPatch() throws Exception {
        // Initialize the database
        insertedMedicine = medicineRepository.saveAndFlush(medicine);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the medicine using partial update
        Medicine partialUpdatedMedicine = new Medicine();
        partialUpdatedMedicine.setId(medicine.getId());

        partialUpdatedMedicine
            .name(UPDATED_NAME)
            .description(UPDATED_DESCRIPTION)
            .withdrawalInfo(UPDATED_WITHDRAWAL_INFO)
            .available(UPDATED_AVAILABLE);

        restMedicineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedMedicine.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedMedicine))
            )
            .andExpect(status().isOk());

        // Validate the Medicine in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertMedicineUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedMedicine, medicine), getPersistedMedicine(medicine));
    }

    @Test
    @Transactional
    void fullUpdateMedicineWithPatch() throws Exception {
        // Initialize the database
        insertedMedicine = medicineRepository.saveAndFlush(medicine);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the medicine using partial update
        Medicine partialUpdatedMedicine = new Medicine();
        partialUpdatedMedicine.setId(medicine.getId());

        partialUpdatedMedicine
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .description(UPDATED_DESCRIPTION)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .withdrawalInfo(UPDATED_WITHDRAWAL_INFO)
            .available(UPDATED_AVAILABLE);

        restMedicineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedMedicine.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedMedicine))
            )
            .andExpect(status().isOk());

        // Validate the Medicine in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertMedicineUpdatableFieldsEquals(partialUpdatedMedicine, getPersistedMedicine(partialUpdatedMedicine));
    }

    @Test
    @Transactional
    void patchNonExistingMedicine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        medicine.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restMedicineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, medicine.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(medicine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchMedicine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        medicine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restMedicineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(medicine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamMedicine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        medicine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restMedicineMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(medicine)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Medicine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteMedicine() throws Exception {
        // Initialize the database
        insertedMedicine = medicineRepository.saveAndFlush(medicine);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the medicine
        restMedicineMockMvc
            .perform(delete(ENTITY_API_URL_ID, medicine.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return medicineRepository.count();
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

    protected Medicine getPersistedMedicine(Medicine medicine) {
        return medicineRepository.findById(medicine.getId()).orElseThrow();
    }

    protected void assertPersistedMedicineToMatchAllProperties(Medicine expectedMedicine) {
        assertMedicineAllPropertiesEquals(expectedMedicine, getPersistedMedicine(expectedMedicine));
    }

    protected void assertPersistedMedicineToMatchUpdatableProperties(Medicine expectedMedicine) {
        assertMedicineAllUpdatablePropertiesEquals(expectedMedicine, getPersistedMedicine(expectedMedicine));
    }
}
