package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.ScheduledDoseAsserts.*;
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
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.repository.ScheduledDoseRepository;

/**
 * Integration tests for the {@link ScheduledDoseResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class ScheduledDoseResourceIT {

    private static final Integer DEFAULT_DOSE_NO = 1;
    private static final Integer UPDATED_DOSE_NO = 2;

    private static final LocalDate DEFAULT_DUE_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_DUE_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String DEFAULT_DEFERRAL_REASON = "AAAAAAAAAA";
    private static final String UPDATED_DEFERRAL_REASON = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_NEW_EXPECTED_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_NEW_EXPECTED_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String ENTITY_API_URL = "/api/scheduled-doses";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ScheduledDoseRepository scheduledDoseRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restScheduledDoseMockMvc;

    private ScheduledDose scheduledDose;

    private ScheduledDose insertedScheduledDose;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ScheduledDose createEntity(EntityManager em) {
        ScheduledDose scheduledDose = new ScheduledDose()
            .doseNo(DEFAULT_DOSE_NO)
            .dueDate(DEFAULT_DUE_DATE)
            .status(DEFAULT_STATUS)
            .deferralReason(DEFAULT_DEFERRAL_REASON)
            .newExpectedDate(DEFAULT_NEW_EXPECTED_DATE);
        // Add required entity
        VaccinationSchedule vaccinationSchedule;
        if (TestUtil.findAll(em, VaccinationSchedule.class).isEmpty()) {
            vaccinationSchedule = VaccinationScheduleResourceIT.createEntity(em);
            em.persist(vaccinationSchedule);
            em.flush();
        } else {
            vaccinationSchedule = TestUtil.findAll(em, VaccinationSchedule.class).get(0);
        }
        scheduledDose.setSchedule(vaccinationSchedule);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        scheduledDose.setCattle(cattle);
        return scheduledDose;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ScheduledDose createUpdatedEntity(EntityManager em) {
        ScheduledDose updatedScheduledDose = new ScheduledDose()
            .doseNo(UPDATED_DOSE_NO)
            .dueDate(UPDATED_DUE_DATE)
            .status(UPDATED_STATUS)
            .deferralReason(UPDATED_DEFERRAL_REASON)
            .newExpectedDate(UPDATED_NEW_EXPECTED_DATE);
        // Add required entity
        VaccinationSchedule vaccinationSchedule;
        if (TestUtil.findAll(em, VaccinationSchedule.class).isEmpty()) {
            vaccinationSchedule = VaccinationScheduleResourceIT.createUpdatedEntity(em);
            em.persist(vaccinationSchedule);
            em.flush();
        } else {
            vaccinationSchedule = TestUtil.findAll(em, VaccinationSchedule.class).get(0);
        }
        updatedScheduledDose.setSchedule(vaccinationSchedule);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedScheduledDose.setCattle(cattle);
        return updatedScheduledDose;
    }

    @BeforeEach
    void initTest() {
        scheduledDose = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedScheduledDose != null) {
            scheduledDoseRepository.delete(insertedScheduledDose);
            insertedScheduledDose = null;
        }
    }

    @Test
    @Transactional
    void createScheduledDose() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the ScheduledDose
        var returnedScheduledDose = om.readValue(
            restScheduledDoseMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(scheduledDose)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ScheduledDose.class
        );

        // Validate the ScheduledDose in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertScheduledDoseUpdatableFieldsEquals(returnedScheduledDose, getPersistedScheduledDose(returnedScheduledDose));

        insertedScheduledDose = returnedScheduledDose;
    }

    @Test
    @Transactional
    void createScheduledDoseWithExistingId() throws Exception {
        // Create the ScheduledDose with an existing ID
        scheduledDose.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restScheduledDoseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(scheduledDose)))
            .andExpect(status().isBadRequest());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkDoseNoIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        scheduledDose.setDoseNo(null);

        // Create the ScheduledDose, which fails.

        restScheduledDoseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(scheduledDose)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDueDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        scheduledDose.setDueDate(null);

        // Create the ScheduledDose, which fails.

        restScheduledDoseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(scheduledDose)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        scheduledDose.setStatus(null);

        // Create the ScheduledDose, which fails.

        restScheduledDoseMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(scheduledDose)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllScheduledDoses() throws Exception {
        // Initialize the database
        insertedScheduledDose = scheduledDoseRepository.saveAndFlush(scheduledDose);

        // Get all the scheduledDoseList
        restScheduledDoseMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(scheduledDose.getId().intValue())))
            .andExpect(jsonPath("$.[*].doseNo").value(hasItem(DEFAULT_DOSE_NO)))
            .andExpect(jsonPath("$.[*].dueDate").value(hasItem(DEFAULT_DUE_DATE.toString())))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)))
            .andExpect(jsonPath("$.[*].deferralReason").value(hasItem(DEFAULT_DEFERRAL_REASON)))
            .andExpect(jsonPath("$.[*].newExpectedDate").value(hasItem(DEFAULT_NEW_EXPECTED_DATE.toString())));
    }

    @Test
    @Transactional
    void getScheduledDose() throws Exception {
        // Initialize the database
        insertedScheduledDose = scheduledDoseRepository.saveAndFlush(scheduledDose);

        // Get the scheduledDose
        restScheduledDoseMockMvc
            .perform(get(ENTITY_API_URL_ID, scheduledDose.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(scheduledDose.getId().intValue()))
            .andExpect(jsonPath("$.doseNo").value(DEFAULT_DOSE_NO))
            .andExpect(jsonPath("$.dueDate").value(DEFAULT_DUE_DATE.toString()))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS))
            .andExpect(jsonPath("$.deferralReason").value(DEFAULT_DEFERRAL_REASON))
            .andExpect(jsonPath("$.newExpectedDate").value(DEFAULT_NEW_EXPECTED_DATE.toString()));
    }

    @Test
    @Transactional
    void getNonExistingScheduledDose() throws Exception {
        // Get the scheduledDose
        restScheduledDoseMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingScheduledDose() throws Exception {
        // Initialize the database
        insertedScheduledDose = scheduledDoseRepository.saveAndFlush(scheduledDose);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the scheduledDose
        ScheduledDose updatedScheduledDose = scheduledDoseRepository.findById(scheduledDose.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedScheduledDose are not directly saved in db
        em.detach(updatedScheduledDose);
        updatedScheduledDose
            .doseNo(UPDATED_DOSE_NO)
            .dueDate(UPDATED_DUE_DATE)
            .status(UPDATED_STATUS)
            .deferralReason(UPDATED_DEFERRAL_REASON)
            .newExpectedDate(UPDATED_NEW_EXPECTED_DATE);

        restScheduledDoseMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedScheduledDose.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedScheduledDose))
            )
            .andExpect(status().isOk());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedScheduledDoseToMatchAllProperties(updatedScheduledDose);
    }

    @Test
    @Transactional
    void putNonExistingScheduledDose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        scheduledDose.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restScheduledDoseMockMvc
            .perform(
                put(ENTITY_API_URL_ID, scheduledDose.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(scheduledDose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchScheduledDose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        scheduledDose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restScheduledDoseMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(scheduledDose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamScheduledDose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        scheduledDose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restScheduledDoseMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(scheduledDose)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateScheduledDoseWithPatch() throws Exception {
        // Initialize the database
        insertedScheduledDose = scheduledDoseRepository.saveAndFlush(scheduledDose);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the scheduledDose using partial update
        ScheduledDose partialUpdatedScheduledDose = new ScheduledDose();
        partialUpdatedScheduledDose.setId(scheduledDose.getId());

        partialUpdatedScheduledDose
            .doseNo(UPDATED_DOSE_NO)
            .dueDate(UPDATED_DUE_DATE)
            .deferralReason(UPDATED_DEFERRAL_REASON)
            .newExpectedDate(UPDATED_NEW_EXPECTED_DATE);

        restScheduledDoseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedScheduledDose.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedScheduledDose))
            )
            .andExpect(status().isOk());

        // Validate the ScheduledDose in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertScheduledDoseUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedScheduledDose, scheduledDose),
            getPersistedScheduledDose(scheduledDose)
        );
    }

    @Test
    @Transactional
    void fullUpdateScheduledDoseWithPatch() throws Exception {
        // Initialize the database
        insertedScheduledDose = scheduledDoseRepository.saveAndFlush(scheduledDose);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the scheduledDose using partial update
        ScheduledDose partialUpdatedScheduledDose = new ScheduledDose();
        partialUpdatedScheduledDose.setId(scheduledDose.getId());

        partialUpdatedScheduledDose
            .doseNo(UPDATED_DOSE_NO)
            .dueDate(UPDATED_DUE_DATE)
            .status(UPDATED_STATUS)
            .deferralReason(UPDATED_DEFERRAL_REASON)
            .newExpectedDate(UPDATED_NEW_EXPECTED_DATE);

        restScheduledDoseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedScheduledDose.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedScheduledDose))
            )
            .andExpect(status().isOk());

        // Validate the ScheduledDose in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertScheduledDoseUpdatableFieldsEquals(partialUpdatedScheduledDose, getPersistedScheduledDose(partialUpdatedScheduledDose));
    }

    @Test
    @Transactional
    void patchNonExistingScheduledDose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        scheduledDose.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restScheduledDoseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, scheduledDose.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(scheduledDose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchScheduledDose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        scheduledDose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restScheduledDoseMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(scheduledDose))
            )
            .andExpect(status().isBadRequest());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamScheduledDose() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        scheduledDose.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restScheduledDoseMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(scheduledDose)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ScheduledDose in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteScheduledDose() throws Exception {
        // Initialize the database
        insertedScheduledDose = scheduledDoseRepository.saveAndFlush(scheduledDose);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the scheduledDose
        restScheduledDoseMockMvc
            .perform(delete(ENTITY_API_URL_ID, scheduledDose.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return scheduledDoseRepository.count();
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

    protected ScheduledDose getPersistedScheduledDose(ScheduledDose scheduledDose) {
        return scheduledDoseRepository.findById(scheduledDose.getId()).orElseThrow();
    }

    protected void assertPersistedScheduledDoseToMatchAllProperties(ScheduledDose expectedScheduledDose) {
        assertScheduledDoseAllPropertiesEquals(expectedScheduledDose, getPersistedScheduledDose(expectedScheduledDose));
    }

    protected void assertPersistedScheduledDoseToMatchUpdatableProperties(ScheduledDose expectedScheduledDose) {
        assertScheduledDoseAllUpdatablePropertiesEquals(expectedScheduledDose, getPersistedScheduledDose(expectedScheduledDose));
    }
}
