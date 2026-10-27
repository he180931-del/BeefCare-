package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.AnnouncementRecipientAsserts.*;
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
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;

/**
 * Integration tests for the {@link AnnouncementRecipientResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class AnnouncementRecipientResourceIT {

    private static final Instant DEFAULT_DELIVERED_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_DELIVERED_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final Instant DEFAULT_READ_TIME = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_READ_TIME = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/announcement-recipients";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private AnnouncementRecipientRepository announcementRecipientRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restAnnouncementRecipientMockMvc;

    private AnnouncementRecipient announcementRecipient;

    private AnnouncementRecipient insertedAnnouncementRecipient;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static AnnouncementRecipient createEntity(EntityManager em) {
        AnnouncementRecipient announcementRecipient = new AnnouncementRecipient()
            .deliveredTime(DEFAULT_DELIVERED_TIME)
            .readTime(DEFAULT_READ_TIME);
        // Add required entity
        AnnouncementVersion announcementVersion;
        if (TestUtil.findAll(em, AnnouncementVersion.class).isEmpty()) {
            announcementVersion = AnnouncementVersionResourceIT.createEntity(em);
            em.persist(announcementVersion);
            em.flush();
        } else {
            announcementVersion = TestUtil.findAll(em, AnnouncementVersion.class).get(0);
        }
        announcementRecipient.setVersion(announcementVersion);
        // Add required entity
        FarmMembership farmMembership;
        if (TestUtil.findAll(em, FarmMembership.class).isEmpty()) {
            farmMembership = FarmMembershipResourceIT.createEntity(em);
            em.persist(farmMembership);
            em.flush();
        } else {
            farmMembership = TestUtil.findAll(em, FarmMembership.class).get(0);
        }
        announcementRecipient.setMembership(farmMembership);
        return announcementRecipient;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static AnnouncementRecipient createUpdatedEntity(EntityManager em) {
        AnnouncementRecipient updatedAnnouncementRecipient = new AnnouncementRecipient()
            .deliveredTime(UPDATED_DELIVERED_TIME)
            .readTime(UPDATED_READ_TIME);
        // Add required entity
        AnnouncementVersion announcementVersion;
        if (TestUtil.findAll(em, AnnouncementVersion.class).isEmpty()) {
            announcementVersion = AnnouncementVersionResourceIT.createUpdatedEntity(em);
            em.persist(announcementVersion);
            em.flush();
        } else {
            announcementVersion = TestUtil.findAll(em, AnnouncementVersion.class).get(0);
        }
        updatedAnnouncementRecipient.setVersion(announcementVersion);
        // Add required entity
        FarmMembership farmMembership;
        if (TestUtil.findAll(em, FarmMembership.class).isEmpty()) {
            farmMembership = FarmMembershipResourceIT.createUpdatedEntity(em);
            em.persist(farmMembership);
            em.flush();
        } else {
            farmMembership = TestUtil.findAll(em, FarmMembership.class).get(0);
        }
        updatedAnnouncementRecipient.setMembership(farmMembership);
        return updatedAnnouncementRecipient;
    }

    @BeforeEach
    void initTest() {
        announcementRecipient = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedAnnouncementRecipient != null) {
            announcementRecipientRepository.delete(insertedAnnouncementRecipient);
            insertedAnnouncementRecipient = null;
        }
    }

    @Test
    @Transactional
    void createAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the AnnouncementRecipient
        var returnedAnnouncementRecipient = om.readValue(
            restAnnouncementRecipientMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementRecipient)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            AnnouncementRecipient.class
        );

        // Validate the AnnouncementRecipient in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertAnnouncementRecipientUpdatableFieldsEquals(
            returnedAnnouncementRecipient,
            getPersistedAnnouncementRecipient(returnedAnnouncementRecipient)
        );

        insertedAnnouncementRecipient = returnedAnnouncementRecipient;
    }

    @Test
    @Transactional
    void createAnnouncementRecipientWithExistingId() throws Exception {
        // Create the AnnouncementRecipient with an existing ID
        announcementRecipient.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restAnnouncementRecipientMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementRecipient)))
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkDeliveredTimeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        announcementRecipient.setDeliveredTime(null);

        // Create the AnnouncementRecipient, which fails.

        restAnnouncementRecipientMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementRecipient)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllAnnouncementRecipients() throws Exception {
        // Initialize the database
        insertedAnnouncementRecipient = announcementRecipientRepository.saveAndFlush(announcementRecipient);

        // Get all the announcementRecipientList
        restAnnouncementRecipientMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(announcementRecipient.getId().intValue())))
            .andExpect(jsonPath("$.[*].deliveredTime").value(hasItem(DEFAULT_DELIVERED_TIME.toString())))
            .andExpect(jsonPath("$.[*].readTime").value(hasItem(DEFAULT_READ_TIME.toString())));
    }

    @Test
    @Transactional
    void getAnnouncementRecipient() throws Exception {
        // Initialize the database
        insertedAnnouncementRecipient = announcementRecipientRepository.saveAndFlush(announcementRecipient);

        // Get the announcementRecipient
        restAnnouncementRecipientMockMvc
            .perform(get(ENTITY_API_URL_ID, announcementRecipient.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(announcementRecipient.getId().intValue()))
            .andExpect(jsonPath("$.deliveredTime").value(DEFAULT_DELIVERED_TIME.toString()))
            .andExpect(jsonPath("$.readTime").value(DEFAULT_READ_TIME.toString()));
    }

    @Test
    @Transactional
    void getNonExistingAnnouncementRecipient() throws Exception {
        // Get the announcementRecipient
        restAnnouncementRecipientMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingAnnouncementRecipient() throws Exception {
        // Initialize the database
        insertedAnnouncementRecipient = announcementRecipientRepository.saveAndFlush(announcementRecipient);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the announcementRecipient
        AnnouncementRecipient updatedAnnouncementRecipient = announcementRecipientRepository
            .findById(announcementRecipient.getId())
            .orElseThrow();
        // Disconnect from session so that the updates on updatedAnnouncementRecipient are not directly saved in db
        em.detach(updatedAnnouncementRecipient);
        updatedAnnouncementRecipient.deliveredTime(UPDATED_DELIVERED_TIME).readTime(UPDATED_READ_TIME);

        restAnnouncementRecipientMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedAnnouncementRecipient.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedAnnouncementRecipient))
            )
            .andExpect(status().isOk());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedAnnouncementRecipientToMatchAllProperties(updatedAnnouncementRecipient);
    }

    @Test
    @Transactional
    void putNonExistingAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementRecipient.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restAnnouncementRecipientMockMvc
            .perform(
                put(ENTITY_API_URL_ID, announcementRecipient.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(announcementRecipient))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementRecipient.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementRecipientMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(announcementRecipient))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementRecipient.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementRecipientMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(announcementRecipient)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateAnnouncementRecipientWithPatch() throws Exception {
        // Initialize the database
        insertedAnnouncementRecipient = announcementRecipientRepository.saveAndFlush(announcementRecipient);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the announcementRecipient using partial update
        AnnouncementRecipient partialUpdatedAnnouncementRecipient = new AnnouncementRecipient();
        partialUpdatedAnnouncementRecipient.setId(announcementRecipient.getId());

        partialUpdatedAnnouncementRecipient.deliveredTime(UPDATED_DELIVERED_TIME);

        restAnnouncementRecipientMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedAnnouncementRecipient.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedAnnouncementRecipient))
            )
            .andExpect(status().isOk());

        // Validate the AnnouncementRecipient in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertAnnouncementRecipientUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedAnnouncementRecipient, announcementRecipient),
            getPersistedAnnouncementRecipient(announcementRecipient)
        );
    }

    @Test
    @Transactional
    void fullUpdateAnnouncementRecipientWithPatch() throws Exception {
        // Initialize the database
        insertedAnnouncementRecipient = announcementRecipientRepository.saveAndFlush(announcementRecipient);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the announcementRecipient using partial update
        AnnouncementRecipient partialUpdatedAnnouncementRecipient = new AnnouncementRecipient();
        partialUpdatedAnnouncementRecipient.setId(announcementRecipient.getId());

        partialUpdatedAnnouncementRecipient.deliveredTime(UPDATED_DELIVERED_TIME).readTime(UPDATED_READ_TIME);

        restAnnouncementRecipientMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedAnnouncementRecipient.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedAnnouncementRecipient))
            )
            .andExpect(status().isOk());

        // Validate the AnnouncementRecipient in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertAnnouncementRecipientUpdatableFieldsEquals(
            partialUpdatedAnnouncementRecipient,
            getPersistedAnnouncementRecipient(partialUpdatedAnnouncementRecipient)
        );
    }

    @Test
    @Transactional
    void patchNonExistingAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementRecipient.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restAnnouncementRecipientMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, announcementRecipient.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(announcementRecipient))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementRecipient.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementRecipientMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(announcementRecipient))
            )
            .andExpect(status().isBadRequest());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamAnnouncementRecipient() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        announcementRecipient.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restAnnouncementRecipientMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(announcementRecipient)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the AnnouncementRecipient in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteAnnouncementRecipient() throws Exception {
        // Initialize the database
        insertedAnnouncementRecipient = announcementRecipientRepository.saveAndFlush(announcementRecipient);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the announcementRecipient
        restAnnouncementRecipientMockMvc
            .perform(delete(ENTITY_API_URL_ID, announcementRecipient.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return announcementRecipientRepository.count();
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

    protected AnnouncementRecipient getPersistedAnnouncementRecipient(AnnouncementRecipient announcementRecipient) {
        return announcementRecipientRepository.findById(announcementRecipient.getId()).orElseThrow();
    }

    protected void assertPersistedAnnouncementRecipientToMatchAllProperties(AnnouncementRecipient expectedAnnouncementRecipient) {
        assertAnnouncementRecipientAllPropertiesEquals(
            expectedAnnouncementRecipient,
            getPersistedAnnouncementRecipient(expectedAnnouncementRecipient)
        );
    }

    protected void assertPersistedAnnouncementRecipientToMatchUpdatableProperties(AnnouncementRecipient expectedAnnouncementRecipient) {
        assertAnnouncementRecipientAllUpdatablePropertiesEquals(
            expectedAnnouncementRecipient,
            getPersistedAnnouncementRecipient(expectedAnnouncementRecipient)
        );
    }
}
