package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PregnancyEpisodeAsserts.*;
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
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.repository.PregnancyEpisodeRepository;

/**
 * Integration tests for the {@link PregnancyEpisodeResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PregnancyEpisodeResourceIT {

    private static final LocalDate DEFAULT_EXPECTED_CALVING_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EXPECTED_CALVING_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final Integer DEFAULT_PARITY = 1;
    private static final Integer UPDATED_PARITY = 2;

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/pregnancy-episodes";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PregnancyEpisodeRepository pregnancyEpisodeRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPregnancyEpisodeMockMvc;

    private PregnancyEpisode pregnancyEpisode;

    private PregnancyEpisode insertedPregnancyEpisode;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PregnancyEpisode createEntity(EntityManager em) {
        PregnancyEpisode pregnancyEpisode = new PregnancyEpisode()
            .expectedCalvingDate(DEFAULT_EXPECTED_CALVING_DATE)
            .parity(DEFAULT_PARITY)
            .status(DEFAULT_STATUS);
        // Add required entity
        ReproductionEvent reproductionEvent;
        if (TestUtil.findAll(em, ReproductionEvent.class).isEmpty()) {
            reproductionEvent = ReproductionEventResourceIT.createEntity(em);
            em.persist(reproductionEvent);
            em.flush();
        } else {
            reproductionEvent = TestUtil.findAll(em, ReproductionEvent.class).get(0);
        }
        pregnancyEpisode.setConfirmingCheck(reproductionEvent);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        pregnancyEpisode.setCattle(cattle);
        return pregnancyEpisode;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PregnancyEpisode createUpdatedEntity(EntityManager em) {
        PregnancyEpisode updatedPregnancyEpisode = new PregnancyEpisode()
            .expectedCalvingDate(UPDATED_EXPECTED_CALVING_DATE)
            .parity(UPDATED_PARITY)
            .status(UPDATED_STATUS);
        // Add required entity
        ReproductionEvent reproductionEvent;
        if (TestUtil.findAll(em, ReproductionEvent.class).isEmpty()) {
            reproductionEvent = ReproductionEventResourceIT.createUpdatedEntity(em);
            em.persist(reproductionEvent);
            em.flush();
        } else {
            reproductionEvent = TestUtil.findAll(em, ReproductionEvent.class).get(0);
        }
        updatedPregnancyEpisode.setConfirmingCheck(reproductionEvent);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedPregnancyEpisode.setCattle(cattle);
        return updatedPregnancyEpisode;
    }

    @BeforeEach
    void initTest() {
        pregnancyEpisode = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedPregnancyEpisode != null) {
            pregnancyEpisodeRepository.delete(insertedPregnancyEpisode);
            insertedPregnancyEpisode = null;
        }
    }

    @Test
    @Transactional
    void createPregnancyEpisode() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PregnancyEpisode
        var returnedPregnancyEpisode = om.readValue(
            restPregnancyEpisodeMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyEpisode)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PregnancyEpisode.class
        );

        // Validate the PregnancyEpisode in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPregnancyEpisodeUpdatableFieldsEquals(returnedPregnancyEpisode, getPersistedPregnancyEpisode(returnedPregnancyEpisode));

        insertedPregnancyEpisode = returnedPregnancyEpisode;
    }

    @Test
    @Transactional
    void createPregnancyEpisodeWithExistingId() throws Exception {
        // Create the PregnancyEpisode with an existing ID
        pregnancyEpisode.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPregnancyEpisodeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyEpisode)))
            .andExpect(status().isBadRequest());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkExpectedCalvingDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pregnancyEpisode.setExpectedCalvingDate(null);

        // Create the PregnancyEpisode, which fails.

        restPregnancyEpisodeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyEpisode)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkParityIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pregnancyEpisode.setParity(null);

        // Create the PregnancyEpisode, which fails.

        restPregnancyEpisodeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyEpisode)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pregnancyEpisode.setStatus(null);

        // Create the PregnancyEpisode, which fails.

        restPregnancyEpisodeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyEpisode)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPregnancyEpisodes() throws Exception {
        // Initialize the database
        insertedPregnancyEpisode = pregnancyEpisodeRepository.saveAndFlush(pregnancyEpisode);

        // Get all the pregnancyEpisodeList
        restPregnancyEpisodeMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(pregnancyEpisode.getId().intValue())))
            .andExpect(jsonPath("$.[*].expectedCalvingDate").value(hasItem(DEFAULT_EXPECTED_CALVING_DATE.toString())))
            .andExpect(jsonPath("$.[*].parity").value(hasItem(DEFAULT_PARITY)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getPregnancyEpisode() throws Exception {
        // Initialize the database
        insertedPregnancyEpisode = pregnancyEpisodeRepository.saveAndFlush(pregnancyEpisode);

        // Get the pregnancyEpisode
        restPregnancyEpisodeMockMvc
            .perform(get(ENTITY_API_URL_ID, pregnancyEpisode.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(pregnancyEpisode.getId().intValue()))
            .andExpect(jsonPath("$.expectedCalvingDate").value(DEFAULT_EXPECTED_CALVING_DATE.toString()))
            .andExpect(jsonPath("$.parity").value(DEFAULT_PARITY))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingPregnancyEpisode() throws Exception {
        // Get the pregnancyEpisode
        restPregnancyEpisodeMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPregnancyEpisode() throws Exception {
        // Initialize the database
        insertedPregnancyEpisode = pregnancyEpisodeRepository.saveAndFlush(pregnancyEpisode);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pregnancyEpisode
        PregnancyEpisode updatedPregnancyEpisode = pregnancyEpisodeRepository.findById(pregnancyEpisode.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPregnancyEpisode are not directly saved in db
        em.detach(updatedPregnancyEpisode);
        updatedPregnancyEpisode.expectedCalvingDate(UPDATED_EXPECTED_CALVING_DATE).parity(UPDATED_PARITY).status(UPDATED_STATUS);

        restPregnancyEpisodeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPregnancyEpisode.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedPregnancyEpisode))
            )
            .andExpect(status().isOk());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPregnancyEpisodeToMatchAllProperties(updatedPregnancyEpisode);
    }

    @Test
    @Transactional
    void putNonExistingPregnancyEpisode() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyEpisode.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPregnancyEpisodeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, pregnancyEpisode.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(pregnancyEpisode))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPregnancyEpisode() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyEpisode.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyEpisodeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(pregnancyEpisode))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPregnancyEpisode() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyEpisode.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyEpisodeMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pregnancyEpisode)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePregnancyEpisodeWithPatch() throws Exception {
        // Initialize the database
        insertedPregnancyEpisode = pregnancyEpisodeRepository.saveAndFlush(pregnancyEpisode);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pregnancyEpisode using partial update
        PregnancyEpisode partialUpdatedPregnancyEpisode = new PregnancyEpisode();
        partialUpdatedPregnancyEpisode.setId(pregnancyEpisode.getId());

        partialUpdatedPregnancyEpisode.expectedCalvingDate(UPDATED_EXPECTED_CALVING_DATE);

        restPregnancyEpisodeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPregnancyEpisode.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPregnancyEpisode))
            )
            .andExpect(status().isOk());

        // Validate the PregnancyEpisode in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPregnancyEpisodeUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPregnancyEpisode, pregnancyEpisode),
            getPersistedPregnancyEpisode(pregnancyEpisode)
        );
    }

    @Test
    @Transactional
    void fullUpdatePregnancyEpisodeWithPatch() throws Exception {
        // Initialize the database
        insertedPregnancyEpisode = pregnancyEpisodeRepository.saveAndFlush(pregnancyEpisode);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pregnancyEpisode using partial update
        PregnancyEpisode partialUpdatedPregnancyEpisode = new PregnancyEpisode();
        partialUpdatedPregnancyEpisode.setId(pregnancyEpisode.getId());

        partialUpdatedPregnancyEpisode.expectedCalvingDate(UPDATED_EXPECTED_CALVING_DATE).parity(UPDATED_PARITY).status(UPDATED_STATUS);

        restPregnancyEpisodeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPregnancyEpisode.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPregnancyEpisode))
            )
            .andExpect(status().isOk());

        // Validate the PregnancyEpisode in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPregnancyEpisodeUpdatableFieldsEquals(
            partialUpdatedPregnancyEpisode,
            getPersistedPregnancyEpisode(partialUpdatedPregnancyEpisode)
        );
    }

    @Test
    @Transactional
    void patchNonExistingPregnancyEpisode() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyEpisode.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPregnancyEpisodeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, pregnancyEpisode.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(pregnancyEpisode))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPregnancyEpisode() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyEpisode.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyEpisodeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(pregnancyEpisode))
            )
            .andExpect(status().isBadRequest());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPregnancyEpisode() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pregnancyEpisode.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPregnancyEpisodeMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(pregnancyEpisode)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PregnancyEpisode in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePregnancyEpisode() throws Exception {
        // Initialize the database
        insertedPregnancyEpisode = pregnancyEpisodeRepository.saveAndFlush(pregnancyEpisode);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the pregnancyEpisode
        restPregnancyEpisodeMockMvc
            .perform(delete(ENTITY_API_URL_ID, pregnancyEpisode.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return pregnancyEpisodeRepository.count();
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

    protected PregnancyEpisode getPersistedPregnancyEpisode(PregnancyEpisode pregnancyEpisode) {
        return pregnancyEpisodeRepository.findById(pregnancyEpisode.getId()).orElseThrow();
    }

    protected void assertPersistedPregnancyEpisodeToMatchAllProperties(PregnancyEpisode expectedPregnancyEpisode) {
        assertPregnancyEpisodeAllPropertiesEquals(expectedPregnancyEpisode, getPersistedPregnancyEpisode(expectedPregnancyEpisode));
    }

    protected void assertPersistedPregnancyEpisodeToMatchUpdatableProperties(PregnancyEpisode expectedPregnancyEpisode) {
        assertPregnancyEpisodeAllUpdatablePropertiesEquals(
            expectedPregnancyEpisode,
            getPersistedPregnancyEpisode(expectedPregnancyEpisode)
        );
    }
}
