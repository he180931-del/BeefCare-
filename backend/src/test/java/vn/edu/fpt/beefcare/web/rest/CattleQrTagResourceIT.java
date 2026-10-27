package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.CattleQrTagAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;

/**
 * Integration tests for the {@link CattleQrTagResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class CattleQrTagResourceIT {

    private static final String DEFAULT_TAG_CODE = "AAAAAAAAAA";
    private static final String UPDATED_TAG_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/cattle-qr-tags";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private CattleQrTagRepository cattleQrTagRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restCattleQrTagMockMvc;

    private CattleQrTag cattleQrTag;

    private CattleQrTag insertedCattleQrTag;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CattleQrTag createEntity(EntityManager em) {
        CattleQrTag cattleQrTag = new CattleQrTag().tagCode(DEFAULT_TAG_CODE).status(DEFAULT_STATUS);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        cattleQrTag.setCattle(cattle);
        return cattleQrTag;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CattleQrTag createUpdatedEntity(EntityManager em) {
        CattleQrTag updatedCattleQrTag = new CattleQrTag().tagCode(UPDATED_TAG_CODE).status(UPDATED_STATUS);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedCattleQrTag.setCattle(cattle);
        return updatedCattleQrTag;
    }

    @BeforeEach
    void initTest() {
        cattleQrTag = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedCattleQrTag != null) {
            cattleQrTagRepository.delete(insertedCattleQrTag);
            insertedCattleQrTag = null;
        }
    }

    @Test
    @Transactional
    void createCattleQrTag() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the CattleQrTag
        var returnedCattleQrTag = om.readValue(
            restCattleQrTagMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleQrTag)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            CattleQrTag.class
        );

        // Validate the CattleQrTag in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertCattleQrTagUpdatableFieldsEquals(returnedCattleQrTag, getPersistedCattleQrTag(returnedCattleQrTag));

        insertedCattleQrTag = returnedCattleQrTag;
    }

    @Test
    @Transactional
    void createCattleQrTagWithExistingId() throws Exception {
        // Create the CattleQrTag with an existing ID
        cattleQrTag.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restCattleQrTagMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleQrTag)))
            .andExpect(status().isBadRequest());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTagCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattleQrTag.setTagCode(null);

        // Create the CattleQrTag, which fails.

        restCattleQrTagMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleQrTag)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cattleQrTag.setStatus(null);

        // Create the CattleQrTag, which fails.

        restCattleQrTagMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleQrTag)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllCattleQrTags() throws Exception {
        // Initialize the database
        insertedCattleQrTag = cattleQrTagRepository.saveAndFlush(cattleQrTag);

        // Get all the cattleQrTagList
        restCattleQrTagMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(cattleQrTag.getId().intValue())))
            .andExpect(jsonPath("$.[*].tagCode").value(hasItem(DEFAULT_TAG_CODE)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getCattleQrTag() throws Exception {
        // Initialize the database
        insertedCattleQrTag = cattleQrTagRepository.saveAndFlush(cattleQrTag);

        // Get the cattleQrTag
        restCattleQrTagMockMvc
            .perform(get(ENTITY_API_URL_ID, cattleQrTag.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(cattleQrTag.getId().intValue()))
            .andExpect(jsonPath("$.tagCode").value(DEFAULT_TAG_CODE))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingCattleQrTag() throws Exception {
        // Get the cattleQrTag
        restCattleQrTagMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingCattleQrTag() throws Exception {
        // Initialize the database
        insertedCattleQrTag = cattleQrTagRepository.saveAndFlush(cattleQrTag);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattleQrTag
        CattleQrTag updatedCattleQrTag = cattleQrTagRepository.findById(cattleQrTag.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedCattleQrTag are not directly saved in db
        em.detach(updatedCattleQrTag);
        updatedCattleQrTag.tagCode(UPDATED_TAG_CODE).status(UPDATED_STATUS);

        restCattleQrTagMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedCattleQrTag.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedCattleQrTag))
            )
            .andExpect(status().isOk());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedCattleQrTagToMatchAllProperties(updatedCattleQrTag);
    }

    @Test
    @Transactional
    void putNonExistingCattleQrTag() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleQrTag.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCattleQrTagMockMvc
            .perform(
                put(ENTITY_API_URL_ID, cattleQrTag.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cattleQrTag))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchCattleQrTag() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleQrTag.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleQrTagMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cattleQrTag))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamCattleQrTag() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleQrTag.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleQrTagMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cattleQrTag)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateCattleQrTagWithPatch() throws Exception {
        // Initialize the database
        insertedCattleQrTag = cattleQrTagRepository.saveAndFlush(cattleQrTag);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattleQrTag using partial update
        CattleQrTag partialUpdatedCattleQrTag = new CattleQrTag();
        partialUpdatedCattleQrTag.setId(cattleQrTag.getId());

        partialUpdatedCattleQrTag.tagCode(UPDATED_TAG_CODE);

        restCattleQrTagMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCattleQrTag.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCattleQrTag))
            )
            .andExpect(status().isOk());

        // Validate the CattleQrTag in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCattleQrTagUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedCattleQrTag, cattleQrTag),
            getPersistedCattleQrTag(cattleQrTag)
        );
    }

    @Test
    @Transactional
    void fullUpdateCattleQrTagWithPatch() throws Exception {
        // Initialize the database
        insertedCattleQrTag = cattleQrTagRepository.saveAndFlush(cattleQrTag);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cattleQrTag using partial update
        CattleQrTag partialUpdatedCattleQrTag = new CattleQrTag();
        partialUpdatedCattleQrTag.setId(cattleQrTag.getId());

        partialUpdatedCattleQrTag.tagCode(UPDATED_TAG_CODE).status(UPDATED_STATUS);

        restCattleQrTagMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCattleQrTag.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCattleQrTag))
            )
            .andExpect(status().isOk());

        // Validate the CattleQrTag in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCattleQrTagUpdatableFieldsEquals(partialUpdatedCattleQrTag, getPersistedCattleQrTag(partialUpdatedCattleQrTag));
    }

    @Test
    @Transactional
    void patchNonExistingCattleQrTag() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleQrTag.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCattleQrTagMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, cattleQrTag.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cattleQrTag))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchCattleQrTag() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleQrTag.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleQrTagMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cattleQrTag))
            )
            .andExpect(status().isBadRequest());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamCattleQrTag() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cattleQrTag.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCattleQrTagMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(cattleQrTag)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CattleQrTag in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteCattleQrTag() throws Exception {
        // Initialize the database
        insertedCattleQrTag = cattleQrTagRepository.saveAndFlush(cattleQrTag);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the cattleQrTag
        restCattleQrTagMockMvc
            .perform(delete(ENTITY_API_URL_ID, cattleQrTag.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return cattleQrTagRepository.count();
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

    protected CattleQrTag getPersistedCattleQrTag(CattleQrTag cattleQrTag) {
        return cattleQrTagRepository.findById(cattleQrTag.getId()).orElseThrow();
    }

    protected void assertPersistedCattleQrTagToMatchAllProperties(CattleQrTag expectedCattleQrTag) {
        assertCattleQrTagAllPropertiesEquals(expectedCattleQrTag, getPersistedCattleQrTag(expectedCattleQrTag));
    }

    protected void assertPersistedCattleQrTagToMatchUpdatableProperties(CattleQrTag expectedCattleQrTag) {
        assertCattleQrTagAllUpdatablePropertiesEquals(expectedCattleQrTag, getPersistedCattleQrTag(expectedCattleQrTag));
    }
}
