package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.VaccineAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.repository.VaccineRepository;

/**
 * Integration tests for the {@link VaccineResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class VaccineResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_DISEASE_PREVENTED = "AAAAAAAAAA";
    private static final String UPDATED_DISEASE_PREVENTED = "BBBBBBBBBB";

    private static final String DEFAULT_MANUFACTURER = "AAAAAAAAAA";
    private static final String UPDATED_MANUFACTURER = "BBBBBBBBBB";

    private static final String DEFAULT_DOSE = "AAAAAAAAAA";
    private static final String UPDATED_DOSE = "BBBBBBBBBB";

    private static final String DEFAULT_ROUTE = "AAAAAAAAAA";
    private static final String UPDATED_ROUTE = "BBBBBBBBBB";

    private static final Integer DEFAULT_BOOSTER_INTERVAL = 1;
    private static final Integer UPDATED_BOOSTER_INTERVAL = 2;

    private static final String DEFAULT_WITHDRAWAL_INFO = "AAAAAAAAAA";
    private static final String UPDATED_WITHDRAWAL_INFO = "BBBBBBBBBB";

    private static final Boolean DEFAULT_AVAILABLE = false;
    private static final Boolean UPDATED_AVAILABLE = true;

    private static final String ENTITY_API_URL = "/api/vaccines";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private VaccineRepository vaccineRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restVaccineMockMvc;

    private Vaccine vaccine;

    private Vaccine insertedVaccine;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Vaccine createEntity(EntityManager em) {
        Vaccine vaccine = new Vaccine()
            .code(DEFAULT_CODE)
            .name(DEFAULT_NAME)
            .diseasePrevented(DEFAULT_DISEASE_PREVENTED)
            .manufacturer(DEFAULT_MANUFACTURER)
            .dose(DEFAULT_DOSE)
            .route(DEFAULT_ROUTE)
            .boosterInterval(DEFAULT_BOOSTER_INTERVAL)
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
        vaccine.setFarm(farm);
        return vaccine;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Vaccine createUpdatedEntity(EntityManager em) {
        Vaccine updatedVaccine = new Vaccine()
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .diseasePrevented(UPDATED_DISEASE_PREVENTED)
            .manufacturer(UPDATED_MANUFACTURER)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .boosterInterval(UPDATED_BOOSTER_INTERVAL)
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
        updatedVaccine.setFarm(farm);
        return updatedVaccine;
    }

    @BeforeEach
    void initTest() {
        vaccine = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedVaccine != null) {
            vaccineRepository.delete(insertedVaccine);
            insertedVaccine = null;
        }
    }

    @Test
    @Transactional
    void createVaccine() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Vaccine
        var returnedVaccine = om.readValue(
            restVaccineMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Vaccine.class
        );

        // Validate the Vaccine in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertVaccineUpdatableFieldsEquals(returnedVaccine, getPersistedVaccine(returnedVaccine));

        insertedVaccine = returnedVaccine;
    }

    @Test
    @Transactional
    void createVaccineWithExistingId() throws Exception {
        // Create the Vaccine with an existing ID
        vaccine.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setCode(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setName(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDiseasePreventedIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setDiseasePrevented(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkManufacturerIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setManufacturer(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDoseIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setDose(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkRouteIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setRoute(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkBoosterIntervalIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setBoosterInterval(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkWithdrawalInfoIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setWithdrawalInfo(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAvailableIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccine.setAvailable(null);

        // Create the Vaccine, which fails.

        restVaccineMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllVaccines() throws Exception {
        // Initialize the database
        insertedVaccine = vaccineRepository.saveAndFlush(vaccine);

        // Get all the vaccineList
        restVaccineMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(vaccine.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].diseasePrevented").value(hasItem(DEFAULT_DISEASE_PREVENTED)))
            .andExpect(jsonPath("$.[*].manufacturer").value(hasItem(DEFAULT_MANUFACTURER)))
            .andExpect(jsonPath("$.[*].dose").value(hasItem(DEFAULT_DOSE)))
            .andExpect(jsonPath("$.[*].route").value(hasItem(DEFAULT_ROUTE)))
            .andExpect(jsonPath("$.[*].boosterInterval").value(hasItem(DEFAULT_BOOSTER_INTERVAL)))
            .andExpect(jsonPath("$.[*].withdrawalInfo").value(hasItem(DEFAULT_WITHDRAWAL_INFO)))
            .andExpect(jsonPath("$.[*].available").value(hasItem(DEFAULT_AVAILABLE)));
    }

    @Test
    @Transactional
    void getVaccine() throws Exception {
        // Initialize the database
        insertedVaccine = vaccineRepository.saveAndFlush(vaccine);

        // Get the vaccine
        restVaccineMockMvc
            .perform(get(ENTITY_API_URL_ID, vaccine.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(vaccine.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.diseasePrevented").value(DEFAULT_DISEASE_PREVENTED))
            .andExpect(jsonPath("$.manufacturer").value(DEFAULT_MANUFACTURER))
            .andExpect(jsonPath("$.dose").value(DEFAULT_DOSE))
            .andExpect(jsonPath("$.route").value(DEFAULT_ROUTE))
            .andExpect(jsonPath("$.boosterInterval").value(DEFAULT_BOOSTER_INTERVAL))
            .andExpect(jsonPath("$.withdrawalInfo").value(DEFAULT_WITHDRAWAL_INFO))
            .andExpect(jsonPath("$.available").value(DEFAULT_AVAILABLE));
    }

    @Test
    @Transactional
    void getNonExistingVaccine() throws Exception {
        // Get the vaccine
        restVaccineMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingVaccine() throws Exception {
        // Initialize the database
        insertedVaccine = vaccineRepository.saveAndFlush(vaccine);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccine
        Vaccine updatedVaccine = vaccineRepository.findById(vaccine.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedVaccine are not directly saved in db
        em.detach(updatedVaccine);
        updatedVaccine
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .diseasePrevented(UPDATED_DISEASE_PREVENTED)
            .manufacturer(UPDATED_MANUFACTURER)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .boosterInterval(UPDATED_BOOSTER_INTERVAL)
            .withdrawalInfo(UPDATED_WITHDRAWAL_INFO)
            .available(UPDATED_AVAILABLE);

        restVaccineMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedVaccine.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedVaccine))
            )
            .andExpect(status().isOk());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedVaccineToMatchAllProperties(updatedVaccine);
    }

    @Test
    @Transactional
    void putNonExistingVaccine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccine.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restVaccineMockMvc
            .perform(put(ENTITY_API_URL_ID, vaccine.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isBadRequest());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchVaccine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccineMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(vaccine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamVaccine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccineMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateVaccineWithPatch() throws Exception {
        // Initialize the database
        insertedVaccine = vaccineRepository.saveAndFlush(vaccine);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccine using partial update
        Vaccine partialUpdatedVaccine = new Vaccine();
        partialUpdatedVaccine.setId(vaccine.getId());

        partialUpdatedVaccine.manufacturer(UPDATED_MANUFACTURER).dose(UPDATED_DOSE).withdrawalInfo(UPDATED_WITHDRAWAL_INFO);

        restVaccineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedVaccine.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedVaccine))
            )
            .andExpect(status().isOk());

        // Validate the Vaccine in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertVaccineUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedVaccine, vaccine), getPersistedVaccine(vaccine));
    }

    @Test
    @Transactional
    void fullUpdateVaccineWithPatch() throws Exception {
        // Initialize the database
        insertedVaccine = vaccineRepository.saveAndFlush(vaccine);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccine using partial update
        Vaccine partialUpdatedVaccine = new Vaccine();
        partialUpdatedVaccine.setId(vaccine.getId());

        partialUpdatedVaccine
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .diseasePrevented(UPDATED_DISEASE_PREVENTED)
            .manufacturer(UPDATED_MANUFACTURER)
            .dose(UPDATED_DOSE)
            .route(UPDATED_ROUTE)
            .boosterInterval(UPDATED_BOOSTER_INTERVAL)
            .withdrawalInfo(UPDATED_WITHDRAWAL_INFO)
            .available(UPDATED_AVAILABLE);

        restVaccineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedVaccine.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedVaccine))
            )
            .andExpect(status().isOk());

        // Validate the Vaccine in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertVaccineUpdatableFieldsEquals(partialUpdatedVaccine, getPersistedVaccine(partialUpdatedVaccine));
    }

    @Test
    @Transactional
    void patchNonExistingVaccine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccine.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restVaccineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, vaccine.getId()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(vaccine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchVaccine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccineMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(vaccine))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamVaccine() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccine.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccineMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(vaccine)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Vaccine in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteVaccine() throws Exception {
        // Initialize the database
        insertedVaccine = vaccineRepository.saveAndFlush(vaccine);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the vaccine
        restVaccineMockMvc
            .perform(delete(ENTITY_API_URL_ID, vaccine.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return vaccineRepository.count();
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

    protected Vaccine getPersistedVaccine(Vaccine vaccine) {
        return vaccineRepository.findById(vaccine.getId()).orElseThrow();
    }

    protected void assertPersistedVaccineToMatchAllProperties(Vaccine expectedVaccine) {
        assertVaccineAllPropertiesEquals(expectedVaccine, getPersistedVaccine(expectedVaccine));
    }

    protected void assertPersistedVaccineToMatchUpdatableProperties(Vaccine expectedVaccine) {
        assertVaccineAllUpdatablePropertiesEquals(expectedVaccine, getPersistedVaccine(expectedVaccine));
    }
}
