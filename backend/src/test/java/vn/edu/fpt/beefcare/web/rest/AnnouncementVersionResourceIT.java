package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.AnnouncementVersionAsserts.*;
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
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;

/**
 * Integration tests for the {@link AnnouncementVersionResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class AnnouncementVersionResourceIT {

    private static final Integer DEFAULT_VERSION_NO = 1;
    private static final Integer UPDATED_VERSION_NO = 2;

    private static final String DEFAULT_TITLE = "AAAAAAAAAA";
    private static final String UPDATED_TITLE = "BBBBBBBBBB";

    private static final String DEFAULT_BODY = "AAAAAAAAAA";
    private static final String UPDATED_BODY = "BBBBBBBBBB";

    private static final Instant DEFAULT_PUBLISHED_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_PUBLISHED_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/announcement-versions";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private AnnouncementVersionRepository announcementVersionRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restAnnouncementVersionMockMvc;

    private AnnouncementVersion announcementVersion;

    private AnnouncementVersion insertedAnnouncementVersion;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static AnnouncementVersion createEntity(EntityManager em) {
        AnnouncementVersion announcementVersion = new AnnouncementVersion()
            .versionNo(DEFAULT_VERSION_NO)
            .title(DEFAULT_TITLE)
            .body(DEFAULT_BODY)
            .publishedTime(DEFAULT_PUBLISHED_TIME);
        // Add required entity
        FarmAnnouncement farmAnnouncement;
        if (TestUtil.findAll(em, FarmAnnouncement.class).isEmpty()) {
            farmAnnouncement = FarmAnnouncementResourceIT.createEntity(em);
            em.persist(farmAnnouncement);
            em.flush();
        } else {
            farmAnnouncement = TestUtil.findAll(em, FarmAnnouncement.class).get(0);
        }
        announcementVersion.setAnnouncement(farmAnnouncement);
        return announcementVersion;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static AnnouncementVersion createUpdatedEntity(EntityManager em) {
        AnnouncementVersion updatedAnnouncementVersion = new AnnouncementVersion()
            .versionNo(UPDATED_VERSION_NO)
            .title(UPDATED_TITLE)
            .body(UPDATED_BODY)
            .publishedTime(UPDATED_PUBLISHED_TIME);
        // Add required entity
        FarmAnnouncement farmAnnouncement;
        if (TestUtil.findAll(em, FarmAnnouncement.class).isEmpty()) {
            farmAnnouncement = FarmAnnouncementResourceIT.createUpdatedEntity(em);
            em.persist(farmAnnouncement);
            em.flush();
        } else {
            farmAnnouncement = TestUtil.findAll(em, FarmAnnouncement.class).get(0);
        }
        updatedAnnouncementVersion.setAnnouncement(farmAnnouncement);
        return updatedAnnouncementVersion;
    }

    @BeforeEach
    void initTest() {
        announcementVersion = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedAnnouncementVersion != null) {
            announcementVersionRepository.delete(insertedAnnouncementVersion);
            insertedAnnouncementVersion = null;
        }
    }

    @Test
    @Transactional
    void createAnnouncementVersion() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the AnnouncementVersion
        var returnedAnnouncementVersion = om.readValue(
            restAnnouncementVersionMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementVersion)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            AnnouncementVersion.class
        );

        // Validate the AnnouncementVersion in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertAnnouncementVersionUpdatableFieldsEquals(
            returnedAnnouncementVersion,
            getPersistedAnnouncementVersion(returnedAnnouncementVersion)
        );

        insertedAnnouncementVersion = returnedAnnouncementVersion;
    }

    @Test
    @Transactional
    void createAnnouncementVersionWithExistingId() throws Exception {
        // Create the AnnouncementVersion with an existing ID
        announcementVersion.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restAnnouncementVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementVersion)))
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkVersionNoIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        announcementVersion.setVersionNo(null);

        // Create the AnnouncementVersion, which fails.

        restAnnouncementVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkTitleIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        announcementVersion.setTitle(null);

        // Create the AnnouncementVersion, which fails.

        restAnnouncementVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkPublishedTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        announcementVersion.setPublishedTime(null);

        // Create the AnnouncementVersion, which fails.

        restAnnouncementVersionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementVersion)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllAnnouncementVersions() throws Exception {
        // Initialize the database
        insertedAnnouncementVersion = announcementVersionRepository.saveAndFlush(announcementVersion);

        // Get all the announcementVersionList
        restAnnouncementVersionMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(announcementVersion.getId().intValue())))
            .andExpect(jsonPath("$.[*].versionNo").value(hasItem(DEFAULT_VERSION_NO)))
            .andExpect(jsonPath("$.[*].title").value(hasItem(DEFAULT_TITLE)))
            .andExpect(jsonPath("$.[*].body").value(hasItem(DEFAULT_BODY)))
            .andExpect(jsonPath("$.[*].publishedTime").value(hasItem(DEFAULT_PUBLISHED_TIME.toString())));
    }

    @Test
    @Transactional
    void getAnnouncementVersion() throws Exception {
        // Initialize the database
        insertedAnnouncementVersion = announcementVersionRepository.saveAndFlush(announcementVersion);

        // Get the announcementVersion
        restAnnouncementVersionMockMvc
            .perform(get(ENTITY_API_URL_ID, announcementVersion.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(announcementVersion.getId().intValue()))
            .andExpect(jsonPath("$.versionNo").value(DEFAULT_VERSION_NO))
            .andExpect(jsonPath("$.title").value(DEFAULT_TITLE))
            .andExpect(jsonPath("$.body").value(DEFAULT_BODY))
            .andExpect(jsonPath("$.publishedTime").value(DEFAULT_PUBLISHED_TIME.toString()));
    }

    @Test
    @Transactional
    void getNonExistingAnnouncementVersion() throws Exception {
        // Get the announcementVersion
        restAnnouncementVersionMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingAnnouncementVersion() throws Exception {
        // Initialize the database
        insertedAnnouncementVersion = announcementVersionRepository.saveAndFlush(announcementVersion);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the announcementVersion
        AnnouncementVersion updatedAnnouncementVersion = announcementVersionRepository.findById(announcementVersion.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedAnnouncementVersion are not directly saved in db
        em.detach(updatedAnnouncementVersion);
        updatedAnnouncementVersion
            .versionNo(UPDATED_VERSION_NO)
            .title(UPDATED_TITLE)
            .body(UPDATED_BODY)
            .publishedTime(UPDATED_PUBLISHED_TIME);

        restAnnouncementVersionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedAnnouncementVersion.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedAnnouncementVersion))
            )
            .andExpect(status().isOk());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedAnnouncementVersionToMatchAllProperties(updatedAnnouncementVersion);
    }

    @Test
    @Transactional
    void putNonExistingAnnouncementVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementVersion.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restAnnouncementVersionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, announcementVersion.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(announcementVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchAnnouncementVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementVersionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(announcementVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamAnnouncementVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementVersionMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementVersion)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateAnnouncementVersionWithPatch() throws Exception {
        // Initialize the database
        insertedAnnouncementVersion = announcementVersionRepository.saveAndFlush(announcementVersion);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the announcementVersion using partial update
        AnnouncementVersion partialUpdatedAnnouncementVersion = new AnnouncementVersion();
        partialUpdatedAnnouncementVersion.setId(announcementVersion.getId());

        partialUpdatedAnnouncementVersion.versionNo(UPDATED_VERSION_NO).title(UPDATED_TITLE).body(UPDATED_BODY);

        restAnnouncementVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedAnnouncementVersion.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedAnnouncementVersion))
            )
            .andExpect(status().isOk());

        // Validate the AnnouncementVersion in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertAnnouncementVersionUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedAnnouncementVersion, announcementVersion),
            getPersistedAnnouncementVersion(announcementVersion)
        );
    }

    @Test
    @Transactional
    void fullUpdateAnnouncementVersionWithPatch() throws Exception {
        // Initialize the database
        insertedAnnouncementVersion = announcementVersionRepository.saveAndFlush(announcementVersion);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the announcementVersion using partial update
        AnnouncementVersion partialUpdatedAnnouncementVersion = new AnnouncementVersion();
        partialUpdatedAnnouncementVersion.setId(announcementVersion.getId());

        partialUpdatedAnnouncementVersion
            .versionNo(UPDATED_VERSION_NO)
            .title(UPDATED_TITLE)
            .body(UPDATED_BODY)
            .publishedTime(UPDATED_PUBLISHED_TIME);

        restAnnouncementVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedAnnouncementVersion.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedAnnouncementVersion))
            )
            .andExpect(status().isOk());

        // Validate the AnnouncementVersion in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertAnnouncementVersionUpdatableFieldsEquals(
            partialUpdatedAnnouncementVersion,
            getPersistedAnnouncementVersion(partialUpdatedAnnouncementVersion)
        );
    }

    @Test
    @Transactional
    void patchNonExistingAnnouncementVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementVersion.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restAnnouncementVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, announcementVersion.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(announcementVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchAnnouncementVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementVersionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(announcementVersion))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamAnnouncementVersion() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementVersion.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementVersionMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(announcementVersion)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the AnnouncementVersion in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteAnnouncementVersion() throws Exception {
        // Initialize the database
        insertedAnnouncementVersion = announcementVersionRepository.saveAndFlush(announcementVersion);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the announcementVersion
        restAnnouncementVersionMockMvc
            .perform(delete(ENTITY_API_URL_ID, announcementVersion.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return announcementVersionRepository.count();
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

    protected AnnouncementVersion getPersistedAnnouncementVersion(AnnouncementVersion announcementVersion) {
        return announcementVersionRepository.findById(announcementVersion.getId()).orElseThrow();
    }

    protected void assertPersistedAnnouncementVersionToMatchAllProperties(AnnouncementVersion expectedAnnouncementVersion) {
        assertAnnouncementVersionAllPropertiesEquals(
            expectedAnnouncementVersion,
            getPersistedAnnouncementVersion(expectedAnnouncementVersion)
        );
    }

    protected void assertPersistedAnnouncementVersionToMatchUpdatableProperties(AnnouncementVersion expectedAnnouncementVersion) {
        assertAnnouncementVersionAllUpdatablePropertiesEquals(
            expectedAnnouncementVersion,
            getPersistedAnnouncementVersion(expectedAnnouncementVersion)
        );
    }
}
