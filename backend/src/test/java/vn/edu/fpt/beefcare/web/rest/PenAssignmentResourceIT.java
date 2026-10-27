package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PenAssignmentAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;

/**
 * Integration tests for the {@link PenAssignmentResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PenAssignmentResourceIT {

    private static final LocalDate DEFAULT_EFFECTIVE_FROM = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EFFECTIVE_FROM = LocalDate.now(ZoneId.systemDefault());

    private static final LocalDate DEFAULT_EFFECTIVE_TO = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EFFECTIVE_TO = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_SOURCE = "AAAAAAAAAA";
    private static final String UPDATED_SOURCE = "BBBBBBBBBB";

    private static final String DEFAULT_REASON = "AAAAAAAAAA";
    private static final String UPDATED_REASON = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/pen-assignments";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PenAssignmentRepository penAssignmentRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPenAssignmentMockMvc;

    private PenAssignment penAssignment;

    private PenAssignment insertedPenAssignment;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PenAssignment createEntity(EntityManager em) {
        PenAssignment penAssignment = new PenAssignment()
            .effectiveFrom(DEFAULT_EFFECTIVE_FROM)
            .effectiveTo(DEFAULT_EFFECTIVE_TO)
            .source(DEFAULT_SOURCE)
            .reason(DEFAULT_REASON);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        penAssignment.setCattle(cattle);
        // Add required entity
        Pen pen;
        if (TestUtil.findAll(em, Pen.class).isEmpty()) {
            pen = PenResourceIT.createEntity(em);
            em.persist(pen);
            em.flush();
        } else {
            pen = TestUtil.findAll(em, Pen.class).get(0);
        }
        penAssignment.setPen(pen);
        return penAssignment;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PenAssignment createUpdatedEntity(EntityManager em) {
        PenAssignment updatedPenAssignment = new PenAssignment()
            .effectiveFrom(UPDATED_EFFECTIVE_FROM)
            .effectiveTo(UPDATED_EFFECTIVE_TO)
            .source(UPDATED_SOURCE)
            .reason(UPDATED_REASON);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedPenAssignment.setCattle(cattle);
        // Add required entity
        Pen pen;
        if (TestUtil.findAll(em, Pen.class).isEmpty()) {
            pen = PenResourceIT.createUpdatedEntity(em);
            em.persist(pen);
            em.flush();
        } else {
            pen = TestUtil.findAll(em, Pen.class).get(0);
        }
        updatedPenAssignment.setPen(pen);
        return updatedPenAssignment;
    }

    @BeforeEach
    void initTest() {
        penAssignment = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedPenAssignment != null) {
            penAssignmentRepository.delete(insertedPenAssignment);
            insertedPenAssignment = null;
        }
    }

    @Test
    @Transactional
    void createPenAssignment() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PenAssignment
        var returnedPenAssignment = om.readValue(
            restPenAssignmentMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penAssignment)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PenAssignment.class
        );

        // Validate the PenAssignment in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPenAssignmentUpdatableFieldsEquals(returnedPenAssignment, getPersistedPenAssignment(returnedPenAssignment));

        insertedPenAssignment = returnedPenAssignment;
    }

    @Test
    @Transactional
    void createPenAssignmentWithExistingId() throws Exception {
        // Create the PenAssignment with an existing ID
        penAssignment.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPenAssignmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penAssignment)))
            .andExpect(status().isBadRequest());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkEffectiveFromIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        penAssignment.setEffectiveFrom(null);

        // Create the PenAssignment, which fails.

        restPenAssignmentMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penAssignment)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPenAssignments() throws Exception {
        // Initialize the database
        insertedPenAssignment = penAssignmentRepository.saveAndFlush(penAssignment);

        // Get all the penAssignmentList
        restPenAssignmentMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(penAssignment.getId().intValue())))
            .andExpect(jsonPath("$.[*].effectiveFrom").value(hasItem(DEFAULT_EFFECTIVE_FROM.toString())))
            .andExpect(jsonPath("$.[*].effectiveTo").value(hasItem(DEFAULT_EFFECTIVE_TO.toString())))
            .andExpect(jsonPath("$.[*].source").value(hasItem(DEFAULT_SOURCE)))
            .andExpect(jsonPath("$.[*].reason").value(hasItem(DEFAULT_REASON)));
    }

    @Test
    @Transactional
    void getPenAssignment() throws Exception {
        // Initialize the database
        insertedPenAssignment = penAssignmentRepository.saveAndFlush(penAssignment);

        // Get the penAssignment
        restPenAssignmentMockMvc
            .perform(get(ENTITY_API_URL_ID, penAssignment.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(penAssignment.getId().intValue()))
            .andExpect(jsonPath("$.effectiveFrom").value(DEFAULT_EFFECTIVE_FROM.toString()))
            .andExpect(jsonPath("$.effectiveTo").value(DEFAULT_EFFECTIVE_TO.toString()))
            .andExpect(jsonPath("$.source").value(DEFAULT_SOURCE))
            .andExpect(jsonPath("$.reason").value(DEFAULT_REASON));
    }

    @Test
    @Transactional
    void getNonExistingPenAssignment() throws Exception {
        // Get the penAssignment
        restPenAssignmentMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPenAssignment() throws Exception {
        // Initialize the database
        insertedPenAssignment = penAssignmentRepository.saveAndFlush(penAssignment);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the penAssignment
        PenAssignment updatedPenAssignment = penAssignmentRepository.findById(penAssignment.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPenAssignment are not directly saved in db
        em.detach(updatedPenAssignment);
        updatedPenAssignment
            .effectiveFrom(UPDATED_EFFECTIVE_FROM)
            .effectiveTo(UPDATED_EFFECTIVE_TO)
            .source(UPDATED_SOURCE)
            .reason(UPDATED_REASON);

        restPenAssignmentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPenAssignment.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedPenAssignment))
            )
            .andExpect(status().isOk());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPenAssignmentToMatchAllProperties(updatedPenAssignment);
    }

    @Test
    @Transactional
    void putNonExistingPenAssignment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penAssignment.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPenAssignmentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, penAssignment.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(penAssignment))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPenAssignment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penAssignment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenAssignmentMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(penAssignment))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPenAssignment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penAssignment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenAssignmentMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(penAssignment)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePenAssignmentWithPatch() throws Exception {
        // Initialize the database
        insertedPenAssignment = penAssignmentRepository.saveAndFlush(penAssignment);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the penAssignment using partial update
        PenAssignment partialUpdatedPenAssignment = new PenAssignment();
        partialUpdatedPenAssignment.setId(penAssignment.getId());

        partialUpdatedPenAssignment.effectiveFrom(UPDATED_EFFECTIVE_FROM).source(UPDATED_SOURCE);

        restPenAssignmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPenAssignment.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPenAssignment))
            )
            .andExpect(status().isOk());

        // Validate the PenAssignment in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPenAssignmentUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPenAssignment, penAssignment),
            getPersistedPenAssignment(penAssignment)
        );
    }

    @Test
    @Transactional
    void fullUpdatePenAssignmentWithPatch() throws Exception {
        // Initialize the database
        insertedPenAssignment = penAssignmentRepository.saveAndFlush(penAssignment);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the penAssignment using partial update
        PenAssignment partialUpdatedPenAssignment = new PenAssignment();
        partialUpdatedPenAssignment.setId(penAssignment.getId());

        partialUpdatedPenAssignment
            .effectiveFrom(UPDATED_EFFECTIVE_FROM)
            .effectiveTo(UPDATED_EFFECTIVE_TO)
            .source(UPDATED_SOURCE)
            .reason(UPDATED_REASON);

        restPenAssignmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPenAssignment.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPenAssignment))
            )
            .andExpect(status().isOk());

        // Validate the PenAssignment in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPenAssignmentUpdatableFieldsEquals(partialUpdatedPenAssignment, getPersistedPenAssignment(partialUpdatedPenAssignment));
    }

    @Test
    @Transactional
    void patchNonExistingPenAssignment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penAssignment.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPenAssignmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, penAssignment.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(penAssignment))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPenAssignment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penAssignment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenAssignmentMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(penAssignment))
            )
            .andExpect(status().isBadRequest());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPenAssignment() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        penAssignment.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenAssignmentMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(penAssignment)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PenAssignment in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePenAssignment() throws Exception {
        // Initialize the database
        insertedPenAssignment = penAssignmentRepository.saveAndFlush(penAssignment);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the penAssignment
        restPenAssignmentMockMvc
            .perform(delete(ENTITY_API_URL_ID, penAssignment.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return penAssignmentRepository.count();
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

    protected PenAssignment getPersistedPenAssignment(PenAssignment penAssignment) {
        return penAssignmentRepository.findById(penAssignment.getId()).orElseThrow();
    }

    protected void assertPersistedPenAssignmentToMatchAllProperties(PenAssignment expectedPenAssignment) {
        assertPenAssignmentAllPropertiesEquals(expectedPenAssignment, getPersistedPenAssignment(expectedPenAssignment));
    }

    protected void assertPersistedPenAssignmentToMatchUpdatableProperties(PenAssignment expectedPenAssignment) {
        assertPenAssignmentAllUpdatablePropertiesEquals(expectedPenAssignment, getPersistedPenAssignment(expectedPenAssignment));
    }
}
