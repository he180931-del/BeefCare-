package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PenReceptionCriteriaAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenReceptionCriteria;
import vn.edu.fpt.beefcare.repository.PenReceptionCriteriaRepository;

/**
 * Integration tests for the {@link PenReceptionCriteriaResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PenReceptionCriteriaResourceIT {

    private static final Integer DEFAULT_VERSION_NO = 1;
    private static final Integer UPDATED_VERSION_NO = 2;

    private static final String DEFAULT_ACCEPTED_PURPOSES = "AAAAAAAAAA";
    private static final String UPDATED_ACCEPTED_PURPOSES = "BBBBBBBBBB";

    private static final String DEFAULT_ACCEPTED_STAGES = "AAAAAAAAAA";
    private static final String UPDATED_ACCEPTED_STAGES = "BBBBBBBBBB";

    private static final String DEFAULT_THRESHOLDS = "AAAAAAAAAA";
    private static final String UPDATED_THRESHOLDS = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_EFFECTIVE_FROM = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EFFECTIVE_FROM = LocalDate.now(ZoneId.systemDefault());

    private static final String ENTITY_API_URL = "/api/pen-reception-criteria";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PenReceptionCriteriaRepository penReceptionCriteriaRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPenReceptionCriteriaMockMvc;

    private PenReceptionCriteria penReceptionCriteria;

    private PenReceptionCriteria insertedPenReceptionCriteria;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PenReceptionCriteria createEntity(EntityManager em) {
        PenReceptionCriteria penReceptionCriteria = new PenReceptionCriteria()
            .versionNo(DEFAULT_VERSION_NO)
            .acceptedPurposes(DEFAULT_ACCEPTED_PURPOSES)
            .acceptedStages(DEFAULT_ACCEPTED_STAGES)
            .thresholds(DEFAULT_THRESHOLDS)
            .effectiveFrom(DEFAULT_EFFECTIVE_FROM);
        // Add required entity
        Pen pen;
        if (TestUtil.findAll(em, Pen.class).isEmpty()) {
            pen = PenResourceIT.createEntity(em);
            em.persist(pen);
            em.flush();
        } else {
            pen = TestUtil.findAll(em, Pen.class).get(0);
        }
        penReceptionCriteria.setPen(pen);
        return penReceptionCriteria;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PenReceptionCriteria createUpdatedEntity(EntityManager em) {
        PenReceptionCriteria updatedPenReceptionCriteria = new PenReceptionCriteria()
            .versionNo(UPDATED_VERSION_NO)
            .acceptedPurposes(UPDATED_ACCEPTED_PURPOSES)
            .acceptedStages(UPDATED_ACCEPTED_STAGES)
            .thresholds(UPDATED_THRESHOLDS)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);
        // Add required entity
        Pen pen;
        if (TestUtil.findAll(em, Pen.class).isEmpty()) {
            pen = PenResourceIT.createUpdatedEntity(em);
            em.persist(pen);
            em.flush();
        } else {
            pen = TestUtil.findAll(em, Pen.class).get(0);
        }
        updatedPenReceptionCriteria.setPen(pen);
        return updatedPenReceptionCriteria;
    }

    @BeforeEach
    void initTest() {
        penReceptionCriteria = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedPenReceptionCriteria != null) {
            penReceptionCriteriaRepository.delete(insertedPenReceptionCriteria);
            insertedPenReceptionCriteria = null;
        }
    }

    @Test
    @Transactional
    void createPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PenReceptionCriteria
        var returnedPenReceptionCriteria = om.readValue(
            restPenReceptionCriteriaMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PenReceptionCriteria.class
        );

        // Validate the PenReceptionCriteria in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPenReceptionCriteriaUpdatableFieldsEquals(
            returnedPenReceptionCriteria,
            getPersistedPenReceptionCriteria(returnedPenReceptionCriteria)
        );

        insertedPenReceptionCriteria = returnedPenReceptionCriteria;
    }

    @Test
    @Transactional
    void createPenReceptionCriteriaWithExistingId() throws Exception {
        // Create the PenReceptionCriteria with an existing ID
        penReceptionCriteria.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPenReceptionCriteriaMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isBadRequest());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkVersionNoIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        penReceptionCriteria.setVersionNo(null);

        // Create the PenReceptionCriteria, which fails.

        restPenReceptionCriteriaMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAcceptedPurposesIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        penReceptionCriteria.setAcceptedPurposes(null);

        // Create the PenReceptionCriteria, which fails.

        restPenReceptionCriteriaMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAcceptedStagesIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        penReceptionCriteria.setAcceptedStages(null);

        // Create the PenReceptionCriteria, which fails.

        restPenReceptionCriteriaMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEffectiveFromIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        penReceptionCriteria.setEffectiveFrom(null);

        // Create the PenReceptionCriteria, which fails.

        restPenReceptionCriteriaMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPenReceptionCriterias() throws Exception {
        // Initialize the database
        insertedPenReceptionCriteria = penReceptionCriteriaRepository.saveAndFlush(penReceptionCriteria);

        // Get all the penReceptionCriteriaList
        restPenReceptionCriteriaMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(penReceptionCriteria.getId().intValue())))
            .andExpect(jsonPath("$.[*].versionNo").value(hasItem(DEFAULT_VERSION_NO)))
            .andExpect(jsonPath("$.[*].acceptedPurposes").value(hasItem(DEFAULT_ACCEPTED_PURPOSES)))
            .andExpect(jsonPath("$.[*].acceptedStages").value(hasItem(DEFAULT_ACCEPTED_STAGES)))
            .andExpect(jsonPath("$.[*].thresholds").value(hasItem(DEFAULT_THRESHOLDS)))
            .andExpect(jsonPath("$.[*].effectiveFrom").value(hasItem(DEFAULT_EFFECTIVE_FROM.toString())));
    }

    @Test
    @Transactional
    void getPenReceptionCriteria() throws Exception {
        // Initialize the database
        insertedPenReceptionCriteria = penReceptionCriteriaRepository.saveAndFlush(penReceptionCriteria);

        // Get the penReceptionCriteria
        restPenReceptionCriteriaMockMvc
            .perform(get(ENTITY_API_URL_ID, penReceptionCriteria.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(penReceptionCriteria.getId().intValue()))
            .andExpect(jsonPath("$.versionNo").value(DEFAULT_VERSION_NO))
            .andExpect(jsonPath("$.acceptedPurposes").value(DEFAULT_ACCEPTED_PURPOSES))
            .andExpect(jsonPath("$.acceptedStages").value(DEFAULT_ACCEPTED_STAGES))
            .andExpect(jsonPath("$.thresholds").value(DEFAULT_THRESHOLDS))
            .andExpect(jsonPath("$.effectiveFrom").value(DEFAULT_EFFECTIVE_FROM.toString()));
    }

    @Test
    @Transactional
    void getNonExistingPenReceptionCriteria() throws Exception {
        // Get the penReceptionCriteria
        restPenReceptionCriteriaMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPenReceptionCriteria() throws Exception {
        // Initialize the database
        insertedPenReceptionCriteria = penReceptionCriteriaRepository.saveAndFlush(penReceptionCriteria);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the penReceptionCriteria
        PenReceptionCriteria updatedPenReceptionCriteria = penReceptionCriteriaRepository
            .findById(penReceptionCriteria.getId())
            .orElseThrow();
        // Disconnect from session so that the updates on updatedPenReceptionCriteria are not directly saved in db
        em.detach(updatedPenReceptionCriteria);
        updatedPenReceptionCriteria
            .versionNo(UPDATED_VERSION_NO)
            .acceptedPurposes(UPDATED_ACCEPTED_PURPOSES)
            .acceptedStages(UPDATED_ACCEPTED_STAGES)
            .thresholds(UPDATED_THRESHOLDS)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);

        restPenReceptionCriteriaMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPenReceptionCriteria.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedPenReceptionCriteria))
            )
            .andExpect(status().isOk());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPenReceptionCriteriaToMatchAllProperties(updatedPenReceptionCriteria);
    }

    @Test
    @Transactional
    void putNonExistingPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penReceptionCriteria.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPenReceptionCriteriaMockMvc
            .perform(
                put(ENTITY_API_URL_ID, penReceptionCriteria.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(penReceptionCriteria))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penReceptionCriteria.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenReceptionCriteriaMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(penReceptionCriteria))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penReceptionCriteria.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenReceptionCriteriaMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePenReceptionCriteriaWithPatch() throws Exception {
        // Initialize the database
        insertedPenReceptionCriteria = penReceptionCriteriaRepository.saveAndFlush(penReceptionCriteria);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the penReceptionCriteria using partial update
        PenReceptionCriteria partialUpdatedPenReceptionCriteria = new PenReceptionCriteria();
        partialUpdatedPenReceptionCriteria.setId(penReceptionCriteria.getId());

        partialUpdatedPenReceptionCriteria
            .versionNo(UPDATED_VERSION_NO)
            .acceptedPurposes(UPDATED_ACCEPTED_PURPOSES)
            .thresholds(UPDATED_THRESHOLDS)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);

        restPenReceptionCriteriaMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPenReceptionCriteria.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPenReceptionCriteria))
            )
            .andExpect(status().isOk());

        // Validate the PenReceptionCriteria in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPenReceptionCriteriaUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPenReceptionCriteria, penReceptionCriteria),
            getPersistedPenReceptionCriteria(penReceptionCriteria)
        );
    }

    @Test
    @Transactional
    void fullUpdatePenReceptionCriteriaWithPatch() throws Exception {
        // Initialize the database
        insertedPenReceptionCriteria = penReceptionCriteriaRepository.saveAndFlush(penReceptionCriteria);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the penReceptionCriteria using partial update
        PenReceptionCriteria partialUpdatedPenReceptionCriteria = new PenReceptionCriteria();
        partialUpdatedPenReceptionCriteria.setId(penReceptionCriteria.getId());

        partialUpdatedPenReceptionCriteria
            .versionNo(UPDATED_VERSION_NO)
            .acceptedPurposes(UPDATED_ACCEPTED_PURPOSES)
            .acceptedStages(UPDATED_ACCEPTED_STAGES)
            .thresholds(UPDATED_THRESHOLDS)
            .effectiveFrom(UPDATED_EFFECTIVE_FROM);

        restPenReceptionCriteriaMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPenReceptionCriteria.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPenReceptionCriteria))
            )
            .andExpect(status().isOk());

        // Validate the PenReceptionCriteria in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPenReceptionCriteriaUpdatableFieldsEquals(
            partialUpdatedPenReceptionCriteria,
            getPersistedPenReceptionCriteria(partialUpdatedPenReceptionCriteria)
        );
    }

    @Test
    @Transactional
    void patchNonExistingPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penReceptionCriteria.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPenReceptionCriteriaMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, penReceptionCriteria.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(penReceptionCriteria))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penReceptionCriteria.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenReceptionCriteriaMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(penReceptionCriteria))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPenReceptionCriteria() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penReceptionCriteria.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenReceptionCriteriaMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(penReceptionCriteria)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PenReceptionCriteria in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePenReceptionCriteria() throws Exception {
        // Initialize the database
        insertedPenReceptionCriteria = penReceptionCriteriaRepository.saveAndFlush(penReceptionCriteria);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the penReceptionCriteria
        restPenReceptionCriteriaMockMvc
            .perform(delete(ENTITY_API_URL_ID, penReceptionCriteria.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return penReceptionCriteriaRepository.count();
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

    protected PenReceptionCriteria getPersistedPenReceptionCriteria(PenReceptionCriteria penReceptionCriteria) {
        return penReceptionCriteriaRepository.findById(penReceptionCriteria.getId()).orElseThrow();
    }

    protected void assertPersistedPenReceptionCriteriaToMatchAllProperties(PenReceptionCriteria expectedPenReceptionCriteria) {
        assertPenReceptionCriteriaAllPropertiesEquals(
            expectedPenReceptionCriteria,
            getPersistedPenReceptionCriteria(expectedPenReceptionCriteria)
        );
    }

    protected void assertPersistedPenReceptionCriteriaToMatchUpdatableProperties(PenReceptionCriteria expectedPenReceptionCriteria) {
        assertPenReceptionCriteriaAllUpdatablePropertiesEquals(
            expectedPenReceptionCriteria,
            getPersistedPenReceptionCriteria(expectedPenReceptionCriteria)
        );
    }
}
