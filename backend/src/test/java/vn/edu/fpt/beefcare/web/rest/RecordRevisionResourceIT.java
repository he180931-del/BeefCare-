package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.RecordRevisionAsserts.*;
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
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;

/**
 * Integration tests for the {@link RecordRevisionResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class RecordRevisionResourceIT {

    private static final String DEFAULT_SOURCE_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_SOURCE_TYPE = "BBBBBBBBBB";

    private static final Long DEFAULT_SOURCE_ID = 1L;
    private static final Long UPDATED_SOURCE_ID = 2L;

    private static final String DEFAULT_ACTION = "AAAAAAAAAA";
    private static final String UPDATED_ACTION = "BBBBBBBBBB";

    private static final String DEFAULT_REASON = "AAAAAAAAAA";
    private static final String UPDATED_REASON = "BBBBBBBBBB";

    private static final String DEFAULT_BEFORE_SNAPSHOT = "AAAAAAAAAA";
    private static final String UPDATED_BEFORE_SNAPSHOT = "BBBBBBBBBB";

    private static final String DEFAULT_AFTER_SNAPSHOT = "AAAAAAAAAA";
    private static final String UPDATED_AFTER_SNAPSHOT = "BBBBBBBBBB";

    private static final Instant DEFAULT_CHANGED_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_CHANGED_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/record-revisions";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private RecordRevisionRepository recordRevisionRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restRecordRevisionMockMvc;

    private RecordRevision recordRevision;

    private RecordRevision insertedRecordRevision;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static RecordRevision createEntity() {
        return new RecordRevision()
            .sourceType(DEFAULT_SOURCE_TYPE)
            .sourceId(DEFAULT_SOURCE_ID)
            .action(DEFAULT_ACTION)
            .reason(DEFAULT_REASON)
            .beforeSnapshot(DEFAULT_BEFORE_SNAPSHOT)
            .afterSnapshot(DEFAULT_AFTER_SNAPSHOT)
            .changedAt(DEFAULT_CHANGED_AT);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static RecordRevision createUpdatedEntity() {
        return new RecordRevision()
            .sourceType(UPDATED_SOURCE_TYPE)
            .sourceId(UPDATED_SOURCE_ID)
            .action(UPDATED_ACTION)
            .reason(UPDATED_REASON)
            .beforeSnapshot(UPDATED_BEFORE_SNAPSHOT)
            .afterSnapshot(UPDATED_AFTER_SNAPSHOT)
            .changedAt(UPDATED_CHANGED_AT);
    }

    @BeforeEach
    void initTest() {
        recordRevision = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedRecordRevision != null) {
            recordRevisionRepository.delete(insertedRecordRevision);
            insertedRecordRevision = null;
        }
    }

    @Test
    @Transactional
    void createRecordRevision() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the RecordRevision
        var returnedRecordRevision = om.readValue(
            restRecordRevisionMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            RecordRevision.class
        );

        // Validate the RecordRevision in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertRecordRevisionUpdatableFieldsEquals(returnedRecordRevision, getPersistedRecordRevision(returnedRecordRevision));

        insertedRecordRevision = returnedRecordRevision;
    }

    @Test
    @Transactional
    void createRecordRevisionWithExistingId() throws Exception {
        // Create the RecordRevision with an existing ID
        recordRevision.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restRecordRevisionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isBadRequest());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkSourceTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        recordRevision.setSourceType(null);

        // Create the RecordRevision, which fails.

        restRecordRevisionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkSourceIdIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        recordRevision.setSourceId(null);

        // Create the RecordRevision, which fails.

        restRecordRevisionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkActionIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        recordRevision.setAction(null);

        // Create the RecordRevision, which fails.

        restRecordRevisionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkChangedAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        recordRevision.setChangedAt(null);

        // Create the RecordRevision, which fails.

        restRecordRevisionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllRecordRevisions() throws Exception {
        // Initialize the database
        insertedRecordRevision = recordRevisionRepository.saveAndFlush(recordRevision);

        // Get all the recordRevisionList
        restRecordRevisionMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(recordRevision.getId().intValue())))
            .andExpect(jsonPath("$.[*].sourceType").value(hasItem(DEFAULT_SOURCE_TYPE)))
            .andExpect(jsonPath("$.[*].sourceId").value(hasItem(DEFAULT_SOURCE_ID.intValue())))
            .andExpect(jsonPath("$.[*].action").value(hasItem(DEFAULT_ACTION)))
            .andExpect(jsonPath("$.[*].reason").value(hasItem(DEFAULT_REASON)))
            .andExpect(jsonPath("$.[*].beforeSnapshot").value(hasItem(DEFAULT_BEFORE_SNAPSHOT)))
            .andExpect(jsonPath("$.[*].afterSnapshot").value(hasItem(DEFAULT_AFTER_SNAPSHOT)))
            .andExpect(jsonPath("$.[*].changedAt").value(hasItem(DEFAULT_CHANGED_AT.toString())));
    }

    @Test
    @Transactional
    void getRecordRevision() throws Exception {
        // Initialize the database
        insertedRecordRevision = recordRevisionRepository.saveAndFlush(recordRevision);

        // Get the recordRevision
        restRecordRevisionMockMvc
            .perform(get(ENTITY_API_URL_ID, recordRevision.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(recordRevision.getId().intValue()))
            .andExpect(jsonPath("$.sourceType").value(DEFAULT_SOURCE_TYPE))
            .andExpect(jsonPath("$.sourceId").value(DEFAULT_SOURCE_ID.intValue()))
            .andExpect(jsonPath("$.action").value(DEFAULT_ACTION))
            .andExpect(jsonPath("$.reason").value(DEFAULT_REASON))
            .andExpect(jsonPath("$.beforeSnapshot").value(DEFAULT_BEFORE_SNAPSHOT))
            .andExpect(jsonPath("$.afterSnapshot").value(DEFAULT_AFTER_SNAPSHOT))
            .andExpect(jsonPath("$.changedAt").value(DEFAULT_CHANGED_AT.toString()));
    }

    @Test
    @Transactional
    void getNonExistingRecordRevision() throws Exception {
        // Get the recordRevision
        restRecordRevisionMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingRecordRevision() throws Exception {
        // Initialize the database
        insertedRecordRevision = recordRevisionRepository.saveAndFlush(recordRevision);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the recordRevision
        RecordRevision updatedRecordRevision = recordRevisionRepository.findById(recordRevision.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedRecordRevision are not directly saved in db
        em.detach(updatedRecordRevision);
        updatedRecordRevision
            .sourceType(UPDATED_SOURCE_TYPE)
            .sourceId(UPDATED_SOURCE_ID)
            .action(UPDATED_ACTION)
            .reason(UPDATED_REASON)
            .beforeSnapshot(UPDATED_BEFORE_SNAPSHOT)
            .afterSnapshot(UPDATED_AFTER_SNAPSHOT)
            .changedAt(UPDATED_CHANGED_AT);

        restRecordRevisionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedRecordRevision.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedRecordRevision))
            )
            .andExpect(status().isOk());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedRecordRevisionToMatchAllProperties(updatedRecordRevision);
    }

    @Test
    @Transactional
    void putNonExistingRecordRevision() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        recordRevision.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restRecordRevisionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, recordRevision.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(recordRevision))
            )
            .andExpect(status().isBadRequest());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchRecordRevision() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        recordRevision.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restRecordRevisionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(recordRevision))
            )
            .andExpect(status().isBadRequest());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamRecordRevision() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        recordRevision.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restRecordRevisionMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateRecordRevisionWithPatch() throws Exception {
        // Initialize the database
        insertedRecordRevision = recordRevisionRepository.saveAndFlush(recordRevision);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the recordRevision using partial update
        RecordRevision partialUpdatedRecordRevision = new RecordRevision();
        partialUpdatedRecordRevision.setId(recordRevision.getId());

        partialUpdatedRecordRevision.sourceType(UPDATED_SOURCE_TYPE).changedAt(UPDATED_CHANGED_AT);

        restRecordRevisionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedRecordRevision.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedRecordRevision))
            )
            .andExpect(status().isOk());

        // Validate the RecordRevision in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertRecordRevisionUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedRecordRevision, recordRevision),
            getPersistedRecordRevision(recordRevision)
        );
    }

    @Test
    @Transactional
    void fullUpdateRecordRevisionWithPatch() throws Exception {
        // Initialize the database
        insertedRecordRevision = recordRevisionRepository.saveAndFlush(recordRevision);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the recordRevision using partial update
        RecordRevision partialUpdatedRecordRevision = new RecordRevision();
        partialUpdatedRecordRevision.setId(recordRevision.getId());

        partialUpdatedRecordRevision
            .sourceType(UPDATED_SOURCE_TYPE)
            .sourceId(UPDATED_SOURCE_ID)
            .action(UPDATED_ACTION)
            .reason(UPDATED_REASON)
            .beforeSnapshot(UPDATED_BEFORE_SNAPSHOT)
            .afterSnapshot(UPDATED_AFTER_SNAPSHOT)
            .changedAt(UPDATED_CHANGED_AT);

        restRecordRevisionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedRecordRevision.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedRecordRevision))
            )
            .andExpect(status().isOk());

        // Validate the RecordRevision in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertRecordRevisionUpdatableFieldsEquals(partialUpdatedRecordRevision, getPersistedRecordRevision(partialUpdatedRecordRevision));
    }

    @Test
    @Transactional
    void patchNonExistingRecordRevision() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        recordRevision.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restRecordRevisionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, recordRevision.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(recordRevision))
            )
            .andExpect(status().isBadRequest());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchRecordRevision() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        recordRevision.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restRecordRevisionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(recordRevision))
            )
            .andExpect(status().isBadRequest());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamRecordRevision() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        recordRevision.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restRecordRevisionMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(recordRevision)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the RecordRevision in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteRecordRevision() throws Exception {
        // Initialize the database
        insertedRecordRevision = recordRevisionRepository.saveAndFlush(recordRevision);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the recordRevision
        restRecordRevisionMockMvc
            .perform(delete(ENTITY_API_URL_ID, recordRevision.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return recordRevisionRepository.count();
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

    protected RecordRevision getPersistedRecordRevision(RecordRevision recordRevision) {
        return recordRevisionRepository.findById(recordRevision.getId()).orElseThrow();
    }

    protected void assertPersistedRecordRevisionToMatchAllProperties(RecordRevision expectedRecordRevision) {
        assertRecordRevisionAllPropertiesEquals(expectedRecordRevision, getPersistedRecordRevision(expectedRecordRevision));
    }

    protected void assertPersistedRecordRevisionToMatchUpdatableProperties(RecordRevision expectedRecordRevision) {
        assertRecordRevisionAllUpdatablePropertiesEquals(expectedRecordRevision, getPersistedRecordRevision(expectedRecordRevision));
    }
}
