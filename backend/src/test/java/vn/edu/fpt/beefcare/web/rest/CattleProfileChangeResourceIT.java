package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.CattleProfileChangeAsserts.*;
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
import vn.edu.fpt.beefcare.domain.CattleProfileChange;
import vn.edu.fpt.beefcare.repository.CattleProfileChangeRepository;

/**
 * Integration tests for the {@link CattleProfileChangeResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class CattleProfileChangeResourceIT {

    private static final String DEFAULT_FIELD_NAME = "AAAAAAAAAA";
    private static final String UPDATED_FIELD_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_OLD_VALUE = "AAAAAAAAAA";
    private static final String UPDATED_OLD_VALUE = "BBBBBBBBBB";

    private static final String DEFAULT_NEW_VALUE = "AAAAAAAAAA";
    private static final String UPDATED_NEW_VALUE = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_EFFECTIVE_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EFFECTIVE_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_REASON = "AAAAAAAAAA";
    private static final String UPDATED_REASON = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/cattle-profile-changes";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private CattleProfileChangeRepository cattleProfileChangeRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restCattleProfileChangeMockMvc;

    private CattleProfileChange cattleProfileChange;

    private CattleProfileChange insertedCattleProfileChange;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CattleProfileChange createEntity(EntityManager em) {
        CattleProfileChange cattleProfileChange = new CattleProfileChange()
            .fieldName(DEFAULT_FIELD_NAME)
            .oldValue(DEFAULT_OLD_VALUE)
            .newValue(DEFAULT_NEW_VALUE)
            .effectiveDate(DEFAULT_EFFECTIVE_DATE)
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
        cattleProfileChange.setCattle(cattle);
        return cattleProfileChange;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CattleProfileChange createUpdatedEntity(EntityManager em) {
        CattleProfileChange updatedCattleProfileChange = new CattleProfileChange()
            .fieldName(UPDATED_FIELD_NAME)
            .oldValue(UPDATED_OLD_VALUE)
            .newValue(UPDATED_NEW_VALUE)
            .effectiveDate(UPDATED_EFFECTIVE_DATE)
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
        updatedCattleProfileChange.setCattle(cattle);
        return updatedCattleProfileChange;
    }

    @BeforeEach
    void initTest() {
        cattleProfileChange = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedCattleProfileChange != null) {
            cattleProfileChangeRepository.delete(insertedCattleProfileChange);
            insertedCattleProfileChange = null;
        }
    }

    @Test
    @Transactional
    void createCattleProfileChange() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the CattleProfileChange
        var returnedCattleProfileChange = om.readValue(
            restCattleProfileChangeMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            CattleProfileChange.class
        );

        // Validate the CattleProfileChange in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertCattleProfileChangeUpdatableFieldsEquals(
            returnedCattleProfileChange,
            getPersistedCattleProfileChange(returnedCattleProfileChange)
        );

        insertedCattleProfileChange = returnedCattleProfileChange;
    }

    @Test
    @Transactional
    void createCattleProfileChangeWithExistingId() throws Exception {
        // Create the CattleProfileChange with an existing ID
        cattleProfileChange.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restCattleProfileChangeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isBadRequest());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkFieldNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattleProfileChange.setFieldName(null);

        // Create the CattleProfileChange, which fails.

        restCattleProfileChangeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOldValueIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattleProfileChange.setOldValue(null);

        // Create the CattleProfileChange, which fails.

        restCattleProfileChangeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNewValueIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattleProfileChange.setNewValue(null);

        // Create the CattleProfileChange, which fails.

        restCattleProfileChangeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEffectiveDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattleProfileChange.setEffectiveDate(null);

        // Create the CattleProfileChange, which fails.

        restCattleProfileChangeMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllCattleProfileChanges() throws Exception {
        // Initialize the database
        insertedCattleProfileChange = cattleProfileChangeRepository.saveAndFlush(cattleProfileChange);

        // Get all the cattleProfileChangeList
        restCattleProfileChangeMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(cattleProfileChange.getId().intValue())))
            .andExpect(jsonPath("$.[*].fieldName").value(hasItem(DEFAULT_FIELD_NAME)))
            .andExpect(jsonPath("$.[*].oldValue").value(hasItem(DEFAULT_OLD_VALUE)))
            .andExpect(jsonPath("$.[*].newValue").value(hasItem(DEFAULT_NEW_VALUE)))
            .andExpect(jsonPath("$.[*].effectiveDate").value(hasItem(DEFAULT_EFFECTIVE_DATE.toString())))
            .andExpect(jsonPath("$.[*].reason").value(hasItem(DEFAULT_REASON)));
    }

    @Test
    @Transactional
    void getCattleProfileChange() throws Exception {
        // Initialize the database
        insertedCattleProfileChange = cattleProfileChangeRepository.saveAndFlush(cattleProfileChange);

        // Get the cattleProfileChange
        restCattleProfileChangeMockMvc
            .perform(get(ENTITY_API_URL_ID, cattleProfileChange.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(cattleProfileChange.getId().intValue()))
            .andExpect(jsonPath("$.fieldName").value(DEFAULT_FIELD_NAME))
            .andExpect(jsonPath("$.oldValue").value(DEFAULT_OLD_VALUE))
            .andExpect(jsonPath("$.newValue").value(DEFAULT_NEW_VALUE))
            .andExpect(jsonPath("$.effectiveDate").value(DEFAULT_EFFECTIVE_DATE.toString()))
            .andExpect(jsonPath("$.reason").value(DEFAULT_REASON));
    }

    @Test
    @Transactional
    void getNonExistingCattleProfileChange() throws Exception {
        // Get the cattleProfileChange
        restCattleProfileChangeMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingCattleProfileChange() throws Exception {
        // Initialize the database
        insertedCattleProfileChange = cattleProfileChangeRepository.saveAndFlush(cattleProfileChange);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattleProfileChange
        CattleProfileChange updatedCattleProfileChange = cattleProfileChangeRepository.findById(cattleProfileChange.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedCattleProfileChange are not directly saved in db
        em.detach(updatedCattleProfileChange);
        updatedCattleProfileChange
            .fieldName(UPDATED_FIELD_NAME)
            .oldValue(UPDATED_OLD_VALUE)
            .newValue(UPDATED_NEW_VALUE)
            .effectiveDate(UPDATED_EFFECTIVE_DATE)
            .reason(UPDATED_REASON);

        restCattleProfileChangeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedCattleProfileChange.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedCattleProfileChange))
            )
            .andExpect(status().isOk());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedCattleProfileChangeToMatchAllProperties(updatedCattleProfileChange);
    }

    @Test
    @Transactional
    void putNonExistingCattleProfileChange() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleProfileChange.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCattleProfileChangeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, cattleProfileChange.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cattleProfileChange))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchCattleProfileChange() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleProfileChange.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleProfileChangeMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cattleProfileChange))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamCattleProfileChange() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleProfileChange.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleProfileChangeMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateCattleProfileChangeWithPatch() throws Exception {
        // Initialize the database
        insertedCattleProfileChange = cattleProfileChangeRepository.saveAndFlush(cattleProfileChange);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattleProfileChange using partial update
        CattleProfileChange partialUpdatedCattleProfileChange = new CattleProfileChange();
        partialUpdatedCattleProfileChange.setId(cattleProfileChange.getId());

        partialUpdatedCattleProfileChange.oldValue(UPDATED_OLD_VALUE).effectiveDate(UPDATED_EFFECTIVE_DATE);

        restCattleProfileChangeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCattleProfileChange.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCattleProfileChange))
            )
            .andExpect(status().isOk());

        // Validate the CattleProfileChange in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCattleProfileChangeUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedCattleProfileChange, cattleProfileChange),
            getPersistedCattleProfileChange(cattleProfileChange)
        );
    }

    @Test
    @Transactional
    void fullUpdateCattleProfileChangeWithPatch() throws Exception {
        // Initialize the database
        insertedCattleProfileChange = cattleProfileChangeRepository.saveAndFlush(cattleProfileChange);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattleProfileChange using partial update
        CattleProfileChange partialUpdatedCattleProfileChange = new CattleProfileChange();
        partialUpdatedCattleProfileChange.setId(cattleProfileChange.getId());

        partialUpdatedCattleProfileChange
            .fieldName(UPDATED_FIELD_NAME)
            .oldValue(UPDATED_OLD_VALUE)
            .newValue(UPDATED_NEW_VALUE)
            .effectiveDate(UPDATED_EFFECTIVE_DATE)
            .reason(UPDATED_REASON);

        restCattleProfileChangeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCattleProfileChange.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCattleProfileChange))
            )
            .andExpect(status().isOk());

        // Validate the CattleProfileChange in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCattleProfileChangeUpdatableFieldsEquals(
            partialUpdatedCattleProfileChange,
            getPersistedCattleProfileChange(partialUpdatedCattleProfileChange)
        );
    }

    @Test
    @Transactional
    void patchNonExistingCattleProfileChange() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleProfileChange.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCattleProfileChangeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, cattleProfileChange.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cattleProfileChange))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchCattleProfileChange() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleProfileChange.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleProfileChangeMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cattleProfileChange))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamCattleProfileChange() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleProfileChange.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleProfileChangeMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(cattleProfileChange)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CattleProfileChange in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteCattleProfileChange() throws Exception {
        // Initialize the database
        insertedCattleProfileChange = cattleProfileChangeRepository.saveAndFlush(cattleProfileChange);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the cattleProfileChange
        restCattleProfileChangeMockMvc
            .perform(delete(ENTITY_API_URL_ID, cattleProfileChange.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return cattleProfileChangeRepository.count();
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

    protected CattleProfileChange getPersistedCattleProfileChange(CattleProfileChange cattleProfileChange) {
        return cattleProfileChangeRepository.findById(cattleProfileChange.getId()).orElseThrow();
    }

    protected void assertPersistedCattleProfileChangeToMatchAllProperties(CattleProfileChange expectedCattleProfileChange) {
        assertCattleProfileChangeAllPropertiesEquals(
            expectedCattleProfileChange,
            getPersistedCattleProfileChange(expectedCattleProfileChange)
        );
    }

    protected void assertPersistedCattleProfileChangeToMatchUpdatableProperties(CattleProfileChange expectedCattleProfileChange) {
        assertCattleProfileChangeAllUpdatablePropertiesEquals(
            expectedCattleProfileChange,
            getPersistedCattleProfileChange(expectedCattleProfileChange)
        );
    }
}
