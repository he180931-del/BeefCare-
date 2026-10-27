package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.EvidenceReviewAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.time.Instant;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.EvidenceReview;
import vn.edu.fpt.beefcare.repository.EvidenceReviewRepository;

/**
 * Integration tests for the {@link EvidenceReviewResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class EvidenceReviewResourceIT {

    private static final String DEFAULT_DECISION = "AAAAAAAAAA";
    private static final String UPDATED_DECISION = "BBBBBBBBBB";

    private static final String DEFAULT_REASON = "AAAAAAAAAA";
    private static final String UPDATED_REASON = "BBBBBBBBBB";

    private static final Instant DEFAULT_REVIEWED_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_REVIEWED_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/evidence-reviews";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private EvidenceReviewRepository evidenceReviewRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restEvidenceReviewMockMvc;

    private EvidenceReview evidenceReview;

    private EvidenceReview insertedEvidenceReview;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static EvidenceReview createEntity(EntityManager em) {
        EvidenceReview evidenceReview = new EvidenceReview()
            .decision(DEFAULT_DECISION)
            .reason(DEFAULT_REASON)
            .reviewedAt(DEFAULT_REVIEWED_AT);
        // Add required entity
        BankTransferEvidence bankTransferEvidence;
        if (TestUtil.findAll(em, BankTransferEvidence.class).isEmpty()) {
            bankTransferEvidence = BankTransferEvidenceResourceIT.createEntity();
            em.persist(bankTransferEvidence);
            em.flush();
        } else {
            bankTransferEvidence = TestUtil.findAll(em, BankTransferEvidence.class).get(0);
        }
        evidenceReview.setEvidence(bankTransferEvidence);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        evidenceReview.setPmUser(appUser);
        return evidenceReview;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static EvidenceReview createUpdatedEntity(EntityManager em) {
        EvidenceReview updatedEvidenceReview = new EvidenceReview()
            .decision(UPDATED_DECISION)
            .reason(UPDATED_REASON)
            .reviewedAt(UPDATED_REVIEWED_AT);
        // Add required entity
        BankTransferEvidence bankTransferEvidence;
        if (TestUtil.findAll(em, BankTransferEvidence.class).isEmpty()) {
            bankTransferEvidence = BankTransferEvidenceResourceIT.createUpdatedEntity();
            em.persist(bankTransferEvidence);
            em.flush();
        } else {
            bankTransferEvidence = TestUtil.findAll(em, BankTransferEvidence.class).get(0);
        }
        updatedEvidenceReview.setEvidence(bankTransferEvidence);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedEvidenceReview.setPmUser(appUser);
        return updatedEvidenceReview;
    }

    @BeforeEach
    void initTest() {
        evidenceReview = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedEvidenceReview != null) {
            evidenceReviewRepository.delete(insertedEvidenceReview);
            insertedEvidenceReview = null;
        }
    }

    @Test
    @Transactional
    void createEvidenceReview() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the EvidenceReview
        var returnedEvidenceReview = om.readValue(
            restEvidenceReviewMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(evidenceReview)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            EvidenceReview.class
        );

        // Validate the EvidenceReview in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertEvidenceReviewUpdatableFieldsEquals(returnedEvidenceReview, getPersistedEvidenceReview(returnedEvidenceReview));

        insertedEvidenceReview = returnedEvidenceReview;
    }

    @Test
    @Transactional
    void createEvidenceReviewWithExistingId() throws Exception {
        // Create the EvidenceReview with an existing ID
        evidenceReview.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restEvidenceReviewMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(evidenceReview)))
            .andExpect(status().isBadRequest());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkDecisionIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        evidenceReview.setDecision(null);

        // Create the EvidenceReview, which fails.

        restEvidenceReviewMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(evidenceReview)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkReviewedAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        evidenceReview.setReviewedAt(null);

        // Create the EvidenceReview, which fails.

        restEvidenceReviewMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(evidenceReview)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllEvidenceReviews() throws Exception {
        // Initialize the database
        insertedEvidenceReview = evidenceReviewRepository.saveAndFlush(evidenceReview);

        // Get all the evidenceReviewList
        restEvidenceReviewMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(evidenceReview.getId().intValue())))
            .andExpect(jsonPath("$.[*].decision").value(hasItem(DEFAULT_DECISION)))
            .andExpect(jsonPath("$.[*].reason").value(hasItem(DEFAULT_REASON)))
            .andExpect(jsonPath("$.[*].reviewedAt").value(hasItem(DEFAULT_REVIEWED_AT.toString())));
    }

    @Test
    @Transactional
    void getEvidenceReview() throws Exception {
        // Initialize the database
        insertedEvidenceReview = evidenceReviewRepository.saveAndFlush(evidenceReview);

        // Get the evidenceReview
        restEvidenceReviewMockMvc
            .perform(get(ENTITY_API_URL_ID, evidenceReview.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(evidenceReview.getId().intValue()))
            .andExpect(jsonPath("$.decision").value(DEFAULT_DECISION))
            .andExpect(jsonPath("$.reason").value(DEFAULT_REASON))
            .andExpect(jsonPath("$.reviewedAt").value(DEFAULT_REVIEWED_AT.toString()));
    }

    @Test
    @Transactional
    void getNonExistingEvidenceReview() throws Exception {
        // Get the evidenceReview
        restEvidenceReviewMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingEvidenceReview() throws Exception {
        // Initialize the database
        insertedEvidenceReview = evidenceReviewRepository.saveAndFlush(evidenceReview);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the evidenceReview
        EvidenceReview updatedEvidenceReview = evidenceReviewRepository.findById(evidenceReview.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedEvidenceReview are not directly saved in db
        em.detach(updatedEvidenceReview);
        updatedEvidenceReview.decision(UPDATED_DECISION).reason(UPDATED_REASON).reviewedAt(UPDATED_REVIEWED_AT);

        restEvidenceReviewMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedEvidenceReview.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedEvidenceReview))
            )
            .andExpect(status().isOk());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedEvidenceReviewToMatchAllProperties(updatedEvidenceReview);
    }

    @Test
    @Transactional
    void putNonExistingEvidenceReview() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        evidenceReview.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restEvidenceReviewMockMvc
            .perform(
                put(ENTITY_API_URL_ID, evidenceReview.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(evidenceReview))
            )
            .andExpect(status().isBadRequest());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchEvidenceReview() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        evidenceReview.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restEvidenceReviewMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(evidenceReview))
            )
            .andExpect(status().isBadRequest());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamEvidenceReview() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        evidenceReview.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restEvidenceReviewMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(evidenceReview)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateEvidenceReviewWithPatch() throws Exception {
        // Initialize the database
        insertedEvidenceReview = evidenceReviewRepository.saveAndFlush(evidenceReview);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the evidenceReview using partial update
        EvidenceReview partialUpdatedEvidenceReview = new EvidenceReview();
        partialUpdatedEvidenceReview.setId(evidenceReview.getId());

        partialUpdatedEvidenceReview.reviewedAt(UPDATED_REVIEWED_AT);

        restEvidenceReviewMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedEvidenceReview.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedEvidenceReview))
            )
            .andExpect(status().isOk());

        // Validate the EvidenceReview in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertEvidenceReviewUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedEvidenceReview, evidenceReview),
            getPersistedEvidenceReview(evidenceReview)
        );
    }

    @Test
    @Transactional
    void fullUpdateEvidenceReviewWithPatch() throws Exception {
        // Initialize the database
        insertedEvidenceReview = evidenceReviewRepository.saveAndFlush(evidenceReview);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the evidenceReview using partial update
        EvidenceReview partialUpdatedEvidenceReview = new EvidenceReview();
        partialUpdatedEvidenceReview.setId(evidenceReview.getId());

        partialUpdatedEvidenceReview.decision(UPDATED_DECISION).reason(UPDATED_REASON).reviewedAt(UPDATED_REVIEWED_AT);

        restEvidenceReviewMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedEvidenceReview.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedEvidenceReview))
            )
            .andExpect(status().isOk());

        // Validate the EvidenceReview in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertEvidenceReviewUpdatableFieldsEquals(partialUpdatedEvidenceReview, getPersistedEvidenceReview(partialUpdatedEvidenceReview));
    }

    @Test
    @Transactional
    void patchNonExistingEvidenceReview() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        evidenceReview.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restEvidenceReviewMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, evidenceReview.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(evidenceReview))
            )
            .andExpect(status().isBadRequest());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchEvidenceReview() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        evidenceReview.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restEvidenceReviewMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(evidenceReview))
            )
            .andExpect(status().isBadRequest());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamEvidenceReview() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        evidenceReview.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restEvidenceReviewMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(evidenceReview)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the EvidenceReview in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteEvidenceReview() throws Exception {
        // Initialize the database
        insertedEvidenceReview = evidenceReviewRepository.saveAndFlush(evidenceReview);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the evidenceReview
        restEvidenceReviewMockMvc
            .perform(delete(ENTITY_API_URL_ID, evidenceReview.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return evidenceReviewRepository.count();
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

    protected EvidenceReview getPersistedEvidenceReview(EvidenceReview evidenceReview) {
        return evidenceReviewRepository.findById(evidenceReview.getId()).orElseThrow();
    }

    protected void assertPersistedEvidenceReviewToMatchAllProperties(EvidenceReview expectedEvidenceReview) {
        assertEvidenceReviewAllPropertiesEquals(expectedEvidenceReview, getPersistedEvidenceReview(expectedEvidenceReview));
    }

    protected void assertPersistedEvidenceReviewToMatchUpdatableProperties(EvidenceReview expectedEvidenceReview) {
        assertEvidenceReviewAllUpdatablePropertiesEquals(expectedEvidenceReview, getPersistedEvidenceReview(expectedEvidenceReview));
    }
}
