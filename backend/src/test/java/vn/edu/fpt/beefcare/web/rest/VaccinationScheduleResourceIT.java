package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.VaccinationScheduleAsserts.*;
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
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.repository.VaccinationScheduleRepository;

/**
 * Integration tests for the {@link VaccinationScheduleResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class VaccinationScheduleResourceIT {

    private static final String DEFAULT_TARGET_GROUP = "AAAAAAAAAA";
    private static final String UPDATED_TARGET_GROUP = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_FIRST_DUE_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_FIRST_DUE_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final Integer DEFAULT_DOSE_COUNT = 1;
    private static final Integer UPDATED_DOSE_COUNT = 2;

    private static final Integer DEFAULT_INTERVAL_DAYS = 1;
    private static final Integer UPDATED_INTERVAL_DAYS = 2;

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/vaccination-schedules";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private VaccinationScheduleRepository vaccinationScheduleRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restVaccinationScheduleMockMvc;

    private VaccinationSchedule vaccinationSchedule;

    private VaccinationSchedule insertedVaccinationSchedule;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static VaccinationSchedule createEntity(EntityManager em) {
        VaccinationSchedule vaccinationSchedule = new VaccinationSchedule()
            .targetGroup(DEFAULT_TARGET_GROUP)
            .firstDueDate(DEFAULT_FIRST_DUE_DATE)
            .doseCount(DEFAULT_DOSE_COUNT)
            .intervalDays(DEFAULT_INTERVAL_DAYS)
            .status(DEFAULT_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        vaccinationSchedule.setFarm(farm);
        // Add required entity
        Vaccine vaccine;
        if (TestUtil.findAll(em, Vaccine.class).isEmpty()) {
            vaccine = VaccineResourceIT.createEntity(em);
            em.persist(vaccine);
            em.flush();
        } else {
            vaccine = TestUtil.findAll(em, Vaccine.class).get(0);
        }
        vaccinationSchedule.setVaccine(vaccine);
        return vaccinationSchedule;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static VaccinationSchedule createUpdatedEntity(EntityManager em) {
        VaccinationSchedule updatedVaccinationSchedule = new VaccinationSchedule()
            .targetGroup(UPDATED_TARGET_GROUP)
            .firstDueDate(UPDATED_FIRST_DUE_DATE)
            .doseCount(UPDATED_DOSE_COUNT)
            .intervalDays(UPDATED_INTERVAL_DAYS)
            .status(UPDATED_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedVaccinationSchedule.setFarm(farm);
        // Add required entity
        Vaccine vaccine;
        if (TestUtil.findAll(em, Vaccine.class).isEmpty()) {
            vaccine = VaccineResourceIT.createUpdatedEntity(em);
            em.persist(vaccine);
            em.flush();
        } else {
            vaccine = TestUtil.findAll(em, Vaccine.class).get(0);
        }
        updatedVaccinationSchedule.setVaccine(vaccine);
        return updatedVaccinationSchedule;
    }

    @BeforeEach
    void initTest() {
        vaccinationSchedule = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedVaccinationSchedule != null) {
            vaccinationScheduleRepository.delete(insertedVaccinationSchedule);
            insertedVaccinationSchedule = null;
        }
    }

    @Test
    @Transactional
    void createVaccinationSchedule() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the VaccinationSchedule
        var returnedVaccinationSchedule = om.readValue(
            restVaccinationScheduleMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            VaccinationSchedule.class
        );

        // Validate the VaccinationSchedule in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertVaccinationScheduleUpdatableFieldsEquals(
            returnedVaccinationSchedule,
            getPersistedVaccinationSchedule(returnedVaccinationSchedule)
        );

        insertedVaccinationSchedule = returnedVaccinationSchedule;
    }

    @Test
    @Transactional
    void createVaccinationScheduleWithExistingId() throws Exception {
        // Create the VaccinationSchedule with an existing ID
        vaccinationSchedule.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restVaccinationScheduleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isBadRequest());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTargetGroupIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccinationSchedule.setTargetGroup(null);

        // Create the VaccinationSchedule, which fails.

        restVaccinationScheduleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkFirstDueDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccinationSchedule.setFirstDueDate(null);

        // Create the VaccinationSchedule, which fails.

        restVaccinationScheduleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDoseCountIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccinationSchedule.setDoseCount(null);

        // Create the VaccinationSchedule, which fails.

        restVaccinationScheduleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkIntervalDaysIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccinationSchedule.setIntervalDays(null);

        // Create the VaccinationSchedule, which fails.

        restVaccinationScheduleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        vaccinationSchedule.setStatus(null);

        // Create the VaccinationSchedule, which fails.

        restVaccinationScheduleMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllVaccinationSchedules() throws Exception {
        // Initialize the database
        insertedVaccinationSchedule = vaccinationScheduleRepository.saveAndFlush(vaccinationSchedule);

        // Get all the vaccinationScheduleList
        restVaccinationScheduleMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(vaccinationSchedule.getId().intValue())))
            .andExpect(jsonPath("$.[*].targetGroup").value(hasItem(DEFAULT_TARGET_GROUP)))
            .andExpect(jsonPath("$.[*].firstDueDate").value(hasItem(DEFAULT_FIRST_DUE_DATE.toString())))
            .andExpect(jsonPath("$.[*].doseCount").value(hasItem(DEFAULT_DOSE_COUNT)))
            .andExpect(jsonPath("$.[*].intervalDays").value(hasItem(DEFAULT_INTERVAL_DAYS)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getVaccinationSchedule() throws Exception {
        // Initialize the database
        insertedVaccinationSchedule = vaccinationScheduleRepository.saveAndFlush(vaccinationSchedule);

        // Get the vaccinationSchedule
        restVaccinationScheduleMockMvc
            .perform(get(ENTITY_API_URL_ID, vaccinationSchedule.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(vaccinationSchedule.getId().intValue()))
            .andExpect(jsonPath("$.targetGroup").value(DEFAULT_TARGET_GROUP))
            .andExpect(jsonPath("$.firstDueDate").value(DEFAULT_FIRST_DUE_DATE.toString()))
            .andExpect(jsonPath("$.doseCount").value(DEFAULT_DOSE_COUNT))
            .andExpect(jsonPath("$.intervalDays").value(DEFAULT_INTERVAL_DAYS))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingVaccinationSchedule() throws Exception {
        // Get the vaccinationSchedule
        restVaccinationScheduleMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingVaccinationSchedule() throws Exception {
        // Initialize the database
        insertedVaccinationSchedule = vaccinationScheduleRepository.saveAndFlush(vaccinationSchedule);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccinationSchedule
        VaccinationSchedule updatedVaccinationSchedule = vaccinationScheduleRepository.findById(vaccinationSchedule.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedVaccinationSchedule are not directly saved in db
        em.detach(updatedVaccinationSchedule);
        updatedVaccinationSchedule
            .targetGroup(UPDATED_TARGET_GROUP)
            .firstDueDate(UPDATED_FIRST_DUE_DATE)
            .doseCount(UPDATED_DOSE_COUNT)
            .intervalDays(UPDATED_INTERVAL_DAYS)
            .status(UPDATED_STATUS);

        restVaccinationScheduleMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedVaccinationSchedule.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedVaccinationSchedule))
            )
            .andExpect(status().isOk());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedVaccinationScheduleToMatchAllProperties(updatedVaccinationSchedule);
    }

    @Test
    @Transactional
    void putNonExistingVaccinationSchedule() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccinationSchedule.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restVaccinationScheduleMockMvc
            .perform(
                put(ENTITY_API_URL_ID, vaccinationSchedule.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(vaccinationSchedule))
            )
            .andExpect(status().isBadRequest());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchVaccinationSchedule() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccinationSchedule.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationScheduleMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(vaccinationSchedule))
            )
            .andExpect(status().isBadRequest());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamVaccinationSchedule() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccinationSchedule.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationScheduleMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateVaccinationScheduleWithPatch() throws Exception {
        // Initialize the database
        insertedVaccinationSchedule = vaccinationScheduleRepository.saveAndFlush(vaccinationSchedule);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccinationSchedule using partial update
        VaccinationSchedule partialUpdatedVaccinationSchedule = new VaccinationSchedule();
        partialUpdatedVaccinationSchedule.setId(vaccinationSchedule.getId());

        partialUpdatedVaccinationSchedule.targetGroup(UPDATED_TARGET_GROUP).status(UPDATED_STATUS);

        restVaccinationScheduleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedVaccinationSchedule.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedVaccinationSchedule))
            )
            .andExpect(status().isOk());

        // Validate the VaccinationSchedule in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertVaccinationScheduleUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedVaccinationSchedule, vaccinationSchedule),
            getPersistedVaccinationSchedule(vaccinationSchedule)
        );
    }

    @Test
    @Transactional
    void fullUpdateVaccinationScheduleWithPatch() throws Exception {
        // Initialize the database
        insertedVaccinationSchedule = vaccinationScheduleRepository.saveAndFlush(vaccinationSchedule);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the vaccinationSchedule using partial update
        VaccinationSchedule partialUpdatedVaccinationSchedule = new VaccinationSchedule();
        partialUpdatedVaccinationSchedule.setId(vaccinationSchedule.getId());

        partialUpdatedVaccinationSchedule
            .targetGroup(UPDATED_TARGET_GROUP)
            .firstDueDate(UPDATED_FIRST_DUE_DATE)
            .doseCount(UPDATED_DOSE_COUNT)
            .intervalDays(UPDATED_INTERVAL_DAYS)
            .status(UPDATED_STATUS);

        restVaccinationScheduleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedVaccinationSchedule.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedVaccinationSchedule))
            )
            .andExpect(status().isOk());

        // Validate the VaccinationSchedule in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertVaccinationScheduleUpdatableFieldsEquals(
            partialUpdatedVaccinationSchedule,
            getPersistedVaccinationSchedule(partialUpdatedVaccinationSchedule)
        );
    }

    @Test
    @Transactional
    void patchNonExistingVaccinationSchedule() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccinationSchedule.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restVaccinationScheduleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, vaccinationSchedule.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(vaccinationSchedule))
            )
            .andExpect(status().isBadRequest());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchVaccinationSchedule() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccinationSchedule.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationScheduleMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(vaccinationSchedule))
            )
            .andExpect(status().isBadRequest());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamVaccinationSchedule() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        vaccinationSchedule.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restVaccinationScheduleMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(vaccinationSchedule)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the VaccinationSchedule in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteVaccinationSchedule() throws Exception {
        // Initialize the database
        insertedVaccinationSchedule = vaccinationScheduleRepository.saveAndFlush(vaccinationSchedule);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the vaccinationSchedule
        restVaccinationScheduleMockMvc
            .perform(delete(ENTITY_API_URL_ID, vaccinationSchedule.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return vaccinationScheduleRepository.count();
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

    protected VaccinationSchedule getPersistedVaccinationSchedule(VaccinationSchedule vaccinationSchedule) {
        return vaccinationScheduleRepository.findById(vaccinationSchedule.getId()).orElseThrow();
    }

    protected void assertPersistedVaccinationScheduleToMatchAllProperties(VaccinationSchedule expectedVaccinationSchedule) {
        assertVaccinationScheduleAllPropertiesEquals(
            expectedVaccinationSchedule,
            getPersistedVaccinationSchedule(expectedVaccinationSchedule)
        );
    }

    protected void assertPersistedVaccinationScheduleToMatchUpdatableProperties(VaccinationSchedule expectedVaccinationSchedule) {
        assertVaccinationScheduleAllUpdatablePropertiesEquals(
            expectedVaccinationSchedule,
            getPersistedVaccinationSchedule(expectedVaccinationSchedule)
        );
    }
}
