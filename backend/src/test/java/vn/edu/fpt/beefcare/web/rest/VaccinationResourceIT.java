package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.VaccinationAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.repository.VaccinationRepository;

/**
 * Integration tests for the {@link VaccinationResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class VaccinationResourceIT {

    private static final LocalDate DEFAULT_VACCINATION_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_VACCINATION_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final Instant DEFAULT_ENTRY_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_ENTRY_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_DOSE = "AAAAAAAAAA";
    private static final String UPDATED_DOSE = "BBBBBBBBBB";

    private static final String DEFAULT_BATCH_NO = "AAAAAAAAAA";
    private static final String UPDATED_BATCH_NO = "BBBBBBBBBB";

    private static final String DEFAULT_SOURCE = "AAAAAAAAAA";
    private static final String UPDATED_SOURCE = "BBBBBBBBBB";

    private static final String DEFAULT_VACCINATOR = "AAAAAAAAAA";
    private static final String UPDATED_VACCINATOR = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/vaccinations";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private VaccinationRepository vaccinationRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restVaccinationMockMvc;

    private Vaccination vaccination;

    private Vaccination insertedVaccination;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Vaccination createEntity(EntityManager em) {
        Vaccination vaccination = new Vaccination()
            .vaccinationDate(DEFAULT_VACCINATION_DATE)
            .entryTime(DEFAULT_ENTRY_TIME)
            .dose(DEFAULT_DOSE)
            .batchNo(DEFAULT_BATCH_NO)
            .source(DEFAULT_SOURCE)
            .vaccinator(DEFAULT_VACCINATOR);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        vaccination.setCattle(cattle);
        // Add required entity
        Vaccine vaccine;
        if (TestUtil.findAll(em, Vaccine.class).isEmpty()) {
            vaccine = VaccineResourceIT.createEntity(em);
            em.persist(vaccine);
            em.flush();
        } else {
            vaccine = TestUtil.findAll(em, Vaccine.class).get(0);
        }
        vaccination.setVaccine(vaccine);
        return vaccination;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Vaccination createUpdatedEntity(EntityManager em) {
        Vaccination updatedVaccination = new Vaccination()
            .vaccinationDate(UPDATED_VACCINATION_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .dose(UPDATED_DOSE)
            .batchNo(UPDATED_BATCH_NO)
            .source(UPDATED_SOURCE)
            .vaccinator(UPDATED_VACCINATOR);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedVaccination.setCattle(cattle);
        // Add required entity
        Vaccine vaccine;
        if (TestUtil.findAll(em, Vaccine.class).isEmpty()) {
            vaccine = VaccineResourceIT.createUpdatedEntity(em);
            em.persist(vaccine);
            em.flush();
        } else {
            vaccine = TestUtil.findAll(em, Vaccine.class).get(0);
        }
        updatedVaccination.setVaccine(vaccine);
        return updatedVaccination;
    }

    @BeforeEach
    void initTest() {
        vaccination = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedVaccination != null) {
            vaccinationRepository.delete(insertedVaccination);
            insertedVaccination = null;
        }
    }

    @Test
    @Transactional
    void createVaccination() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Vaccination
        var returnedVaccination = om.readValue(
            restVaccinationMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Vaccination.class
        );

        // Validate the Vaccination in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertVaccinationUpdatableFieldsEquals(returnedVaccination, getPersistedVaccination(returnedVaccination));

        insertedVaccination = returnedVaccination;
    }

    @Test
    @Transactional
    void createVaccinationWithExistingId() throws Exception {
        // Create the Vaccination with an existing ID
        vaccination.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restVaccinationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isBadRequest());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkVaccinationDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccination.setVaccinationDate(null);

        // Create the Vaccination, which fails.

        restVaccinationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEntryTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccination.setEntryTime(null);

        // Create the Vaccination, which fails.

        restVaccinationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDoseIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccination.setDose(null);

        // Create the Vaccination, which fails.

        restVaccinationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkVaccinatorIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccination.setVaccinator(null);

        // Create the Vaccination, which fails.

        restVaccinationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllVaccinations() throws Exception {
        // Initialize the database
        insertedVaccination = vaccinationRepository.saveAndFlush(vaccination);

        // Get all the vaccinationList
        restVaccinationMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(vaccination.getId().intValue())))
            .andExpect(jsonPath("$.[*].vaccinationDate").value(hasItem(DEFAULT_VACCINATION_DATE.toString())))
            .andExpect(jsonPath("$.[*].entryTime").value(hasItem(DEFAULT_ENTRY_TIME.toString())))
            .andExpect(jsonPath("$.[*].dose").value(hasItem(DEFAULT_DOSE)))
            .andExpect(jsonPath("$.[*].batchNo").value(hasItem(DEFAULT_BATCH_NO)))
            .andExpect(jsonPath("$.[*].source").value(hasItem(DEFAULT_SOURCE)))
            .andExpect(jsonPath("$.[*].vaccinator").value(hasItem(DEFAULT_VACCINATOR)));
    }

    @Test
    @Transactional
    void getVaccination() throws Exception {
        // Initialize the database
        insertedVaccination = vaccinationRepository.saveAndFlush(vaccination);

        // Get the vaccination
        restVaccinationMockMvc
            .perform(get(ENTITY_API_URL_ID, vaccination.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(vaccination.getId().intValue()))
            .andExpect(jsonPath("$.vaccinationDate").value(DEFAULT_VACCINATION_DATE.toString()))
            .andExpect(jsonPath("$.entryTime").value(DEFAULT_ENTRY_TIME.toString()))
            .andExpect(jsonPath("$.dose").value(DEFAULT_DOSE))
            .andExpect(jsonPath("$.batchNo").value(DEFAULT_BATCH_NO))
            .andExpect(jsonPath("$.source").value(DEFAULT_SOURCE))
            .andExpect(jsonPath("$.vaccinator").value(DEFAULT_VACCINATOR));
    }

    @Test
    @Transactional
    void getNonExistingVaccination() throws Exception {
        // Get the vaccination
        restVaccinationMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingVaccination() throws Exception {
        // Initialize the database
        insertedVaccination = vaccinationRepository.saveAndFlush(vaccination);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccination
        Vaccination updatedVaccination = vaccinationRepository.findById(vaccination.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedVaccination are not directly saved in db
        em.detach(updatedVaccination);
        updatedVaccination
            .vaccinationDate(UPDATED_VACCINATION_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .dose(UPDATED_DOSE)
            .batchNo(UPDATED_BATCH_NO)
            .source(UPDATED_SOURCE)
            .vaccinator(UPDATED_VACCINATOR);

        restVaccinationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedVaccination.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedVaccination))
            )
            .andExpect(status().isOk());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedVaccinationToMatchAllProperties(updatedVaccination);
    }

    @Test
    @Transactional
    void putNonExistingVaccination() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccination.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restVaccinationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, vaccination.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(vaccination))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchVaccination() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccination.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(vaccination))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamVaccination() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccination.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateVaccinationWithPatch() throws Exception {
        // Initialize the database
        insertedVaccination = vaccinationRepository.saveAndFlush(vaccination);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccination using partial update
        Vaccination partialUpdatedVaccination = new Vaccination();
        partialUpdatedVaccination.setId(vaccination.getId());

        partialUpdatedVaccination.vaccinationDate(UPDATED_VACCINATION_DATE).entryTime(UPDATED_ENTRY_TIME).dose(UPDATED_DOSE);

        restVaccinationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedVaccination.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedVaccination))
            )
            .andExpect(status().isOk());

        // Validate the Vaccination in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertVaccinationUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedVaccination, vaccination),
            getPersistedVaccination(vaccination)
        );
    }

    @Test
    @Transactional
    void fullUpdateVaccinationWithPatch() throws Exception {
        // Initialize the database
        insertedVaccination = vaccinationRepository.saveAndFlush(vaccination);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccination using partial update
        Vaccination partialUpdatedVaccination = new Vaccination();
        partialUpdatedVaccination.setId(vaccination.getId());

        partialUpdatedVaccination
            .vaccinationDate(UPDATED_VACCINATION_DATE)
            .entryTime(UPDATED_ENTRY_TIME)
            .dose(UPDATED_DOSE)
            .batchNo(UPDATED_BATCH_NO)
            .source(UPDATED_SOURCE)
            .vaccinator(UPDATED_VACCINATOR);

        restVaccinationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedVaccination.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedVaccination))
            )
            .andExpect(status().isOk());

        // Validate the Vaccination in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertVaccinationUpdatableFieldsEquals(partialUpdatedVaccination, getPersistedVaccination(partialUpdatedVaccination));
    }

    @Test
    @Transactional
    void patchNonExistingVaccination() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccination.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restVaccinationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, vaccination.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(vaccination))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchVaccination() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccination.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(vaccination))
            )
            .andExpect(status().isBadRequest());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamVaccination() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccination.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(vaccination)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Vaccination in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteVaccination() throws Exception {
        // Initialize the database
        insertedVaccination = vaccinationRepository.saveAndFlush(vaccination);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the vaccination
        restVaccinationMockMvc
            .perform(delete(ENTITY_API_URL_ID, vaccination.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return vaccinationRepository.count();
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

    protected Vaccination getPersistedVaccination(Vaccination vaccination) {
        return vaccinationRepository.findById(vaccination.getId()).orElseThrow();
    }

    protected void assertPersistedVaccinationToMatchAllProperties(Vaccination expectedVaccination) {
        assertVaccinationAllPropertiesEquals(expectedVaccination, getPersistedVaccination(expectedVaccination));
    }

    protected void assertPersistedVaccinationToMatchUpdatableProperties(Vaccination expectedVaccination) {
        assertVaccinationAllUpdatablePropertiesEquals(expectedVaccination, getPersistedVaccination(expectedVaccination));
    }
}
