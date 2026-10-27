package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.FarmAnnouncementAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.repository.FarmAnnouncementRepository;

/**
 * Integration tests for the {@link FarmAnnouncementResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class FarmAnnouncementResourceIT {

    private static final String DEFAULT_STATE = "AAAAAAAAAA";
    private static final String UPDATED_STATE = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/farm-announcements";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private FarmAnnouncementRepository farmAnnouncementRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restFarmAnnouncementMockMvc;

    private FarmAnnouncement farmAnnouncement;

    private FarmAnnouncement insertedFarmAnnouncement;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static FarmAnnouncement createEntity(EntityManager em) {
        FarmAnnouncement farmAnnouncement = new FarmAnnouncement().state(DEFAULT_STATE);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        farmAnnouncement.setFarm(farm);
        // Add required entity
        FarmMembership farmMembership;
        if (TestUtil.findAll(em, FarmMembership.class).isEmpty()) {
            farmMembership = FarmMembershipResourceIT.createEntity(em);
            em.persist(farmMembership);
            em.flush();
        } else {
            farmMembership = TestUtil.findAll(em, FarmMembership.class).get(0);
        }
        farmAnnouncement.setAuthor(farmMembership);
        return farmAnnouncement;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static FarmAnnouncement createUpdatedEntity(EntityManager em) {
        FarmAnnouncement updatedFarmAnnouncement = new FarmAnnouncement().state(UPDATED_STATE);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedFarmAnnouncement.setFarm(farm);
        // Add required entity
        FarmMembership farmMembership;
        if (TestUtil.findAll(em, FarmMembership.class).isEmpty()) {
            farmMembership = FarmMembershipResourceIT.createUpdatedEntity(em);
            em.persist(farmMembership);
            em.flush();
        } else {
            farmMembership = TestUtil.findAll(em, FarmMembership.class).get(0);
        }
        updatedFarmAnnouncement.setAuthor(farmMembership);
        return updatedFarmAnnouncement;
    }

    @BeforeEach
    void initTest() {
        farmAnnouncement = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedFarmAnnouncement != null) {
            farmAnnouncementRepository.delete(insertedFarmAnnouncement);
            insertedFarmAnnouncement = null;
        }
    }

    @Test
    @Transactional
    void createFarmAnnouncement() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the FarmAnnouncement
        var returnedFarmAnnouncement = om.readValue(
            restFarmAnnouncementMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmAnnouncement)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            FarmAnnouncement.class
        );

        // Validate the FarmAnnouncement in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertFarmAnnouncementUpdatableFieldsEquals(returnedFarmAnnouncement, getPersistedFarmAnnouncement(returnedFarmAnnouncement));

        insertedFarmAnnouncement = returnedFarmAnnouncement;
    }

    @Test
    @Transactional
    void createFarmAnnouncementWithExistingId() throws Exception {
        // Create the FarmAnnouncement with an existing ID
        farmAnnouncement.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restFarmAnnouncementMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmAnnouncement)))
            .andExpect(status().isBadRequest());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkStateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmAnnouncement.setState(null);

        // Create the FarmAnnouncement, which fails.

        restFarmAnnouncementMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmAnnouncement)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllFarmAnnouncements() throws Exception {
        // Initialize the database
        insertedFarmAnnouncement = farmAnnouncementRepository.saveAndFlush(farmAnnouncement);

        // Get all the farmAnnouncementList
        restFarmAnnouncementMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(farmAnnouncement.getId().intValue())))
            .andExpect(jsonPath("$.[*].state").value(hasItem(DEFAULT_STATE)));
    }

    @Test
    @Transactional
    void getFarmAnnouncement() throws Exception {
        // Initialize the database
        insertedFarmAnnouncement = farmAnnouncementRepository.saveAndFlush(farmAnnouncement);

        // Get the farmAnnouncement
        restFarmAnnouncementMockMvc
            .perform(get(ENTITY_API_URL_ID, farmAnnouncement.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(farmAnnouncement.getId().intValue()))
            .andExpect(jsonPath("$.state").value(DEFAULT_STATE));
    }

    @Test
    @Transactional
    void getNonExistingFarmAnnouncement() throws Exception {
        // Get the farmAnnouncement
        restFarmAnnouncementMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingFarmAnnouncement() throws Exception {
        // Initialize the database
        insertedFarmAnnouncement = farmAnnouncementRepository.saveAndFlush(farmAnnouncement);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmAnnouncement
        FarmAnnouncement updatedFarmAnnouncement = farmAnnouncementRepository.findById(farmAnnouncement.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedFarmAnnouncement are not directly saved in db
        em.detach(updatedFarmAnnouncement);
        updatedFarmAnnouncement.state(UPDATED_STATE);

        restFarmAnnouncementMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedFarmAnnouncement.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedFarmAnnouncement))
            )
            .andExpect(status().isOk());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedFarmAnnouncementToMatchAllProperties(updatedFarmAnnouncement);
    }

    @Test
    @Transactional
    void putNonExistingFarmAnnouncement() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmAnnouncement.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmAnnouncementMockMvc
            .perform(
                put(ENTITY_API_URL_ID, farmAnnouncement.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farmAnnouncement))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchFarmAnnouncement() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmAnnouncement.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmAnnouncementMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farmAnnouncement))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamFarmAnnouncement() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmAnnouncement.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmAnnouncementMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmAnnouncement)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateFarmAnnouncementWithPatch() throws Exception {
        // Initialize the database
        insertedFarmAnnouncement = farmAnnouncementRepository.saveAndFlush(farmAnnouncement);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmAnnouncement using partial update
        FarmAnnouncement partialUpdatedFarmAnnouncement = new FarmAnnouncement();
        partialUpdatedFarmAnnouncement.setId(farmAnnouncement.getId());

        partialUpdatedFarmAnnouncement.state(UPDATED_STATE);

        restFarmAnnouncementMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarmAnnouncement.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarmAnnouncement))
            )
            .andExpect(status().isOk());

        // Validate the FarmAnnouncement in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmAnnouncementUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedFarmAnnouncement, farmAnnouncement),
            getPersistedFarmAnnouncement(farmAnnouncement)
        );
    }

    @Test
    @Transactional
    void fullUpdateFarmAnnouncementWithPatch() throws Exception {
        // Initialize the database
        insertedFarmAnnouncement = farmAnnouncementRepository.saveAndFlush(farmAnnouncement);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmAnnouncement using partial update
        FarmAnnouncement partialUpdatedFarmAnnouncement = new FarmAnnouncement();
        partialUpdatedFarmAnnouncement.setId(farmAnnouncement.getId());

        partialUpdatedFarmAnnouncement.state(UPDATED_STATE);

        restFarmAnnouncementMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarmAnnouncement.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarmAnnouncement))
            )
            .andExpect(status().isOk());

        // Validate the FarmAnnouncement in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmAnnouncementUpdatableFieldsEquals(
            partialUpdatedFarmAnnouncement,
            getPersistedFarmAnnouncement(partialUpdatedFarmAnnouncement)
        );
    }

    @Test
    @Transactional
    void patchNonExistingFarmAnnouncement() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmAnnouncement.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmAnnouncementMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, farmAnnouncement.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farmAnnouncement))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchFarmAnnouncement() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmAnnouncement.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmAnnouncementMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farmAnnouncement))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamFarmAnnouncement() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmAnnouncement.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmAnnouncementMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(farmAnnouncement)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the FarmAnnouncement in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteFarmAnnouncement() throws Exception {
        // Initialize the database
        insertedFarmAnnouncement = farmAnnouncementRepository.saveAndFlush(farmAnnouncement);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the farmAnnouncement
        restFarmAnnouncementMockMvc
            .perform(delete(ENTITY_API_URL_ID, farmAnnouncement.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return farmAnnouncementRepository.count();
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

    protected FarmAnnouncement getPersistedFarmAnnouncement(FarmAnnouncement farmAnnouncement) {
        return farmAnnouncementRepository.findById(farmAnnouncement.getId()).orElseThrow();
    }

    protected void assertPersistedFarmAnnouncementToMatchAllProperties(FarmAnnouncement expectedFarmAnnouncement) {
        assertFarmAnnouncementAllPropertiesEquals(expectedFarmAnnouncement, getPersistedFarmAnnouncement(expectedFarmAnnouncement));
    }

    protected void assertPersistedFarmAnnouncementToMatchUpdatableProperties(FarmAnnouncement expectedFarmAnnouncement) {
        assertFarmAnnouncementAllUpdatablePropertiesEquals(
            expectedFarmAnnouncement,
            getPersistedFarmAnnouncement(expectedFarmAnnouncement)
        );
    }
}
