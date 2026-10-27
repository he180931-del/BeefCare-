package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.FarmInvitationAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;

/**
 * Integration tests for the {@link FarmInvitationResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class FarmInvitationResourceIT {

    private static final String DEFAULT_INVITED_EMAIL = "AAAAAAAAAA";
    private static final String UPDATED_INVITED_EMAIL = "BBBBBBBBBB";

    private static final String DEFAULT_PROPOSED_ROLE = "AAAAAAAAAA";
    private static final String UPDATED_PROPOSED_ROLE = "BBBBBBBBBB";

    private static final String DEFAULT_PROPOSED_PERMISSIONS = "AAAAAAAAAA";
    private static final String UPDATED_PROPOSED_PERMISSIONS = "BBBBBBBBBB";

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final Instant DEFAULT_EXPIRES_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_EXPIRES_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String ENTITY_API_URL = "/api/farm-invitations";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private FarmInvitationRepository farmInvitationRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restFarmInvitationMockMvc;

    private FarmInvitation farmInvitation;

    private FarmInvitation insertedFarmInvitation;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static FarmInvitation createEntity(EntityManager em) {
        FarmInvitation farmInvitation = new FarmInvitation()
            .invitedEmail(DEFAULT_INVITED_EMAIL)
            .proposedRole(DEFAULT_PROPOSED_ROLE)
            .proposedPermissions(DEFAULT_PROPOSED_PERMISSIONS)
            .status(DEFAULT_STATUS)
            .expiresAt(DEFAULT_EXPIRES_AT);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        farmInvitation.setFarm(farm);
        return farmInvitation;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static FarmInvitation createUpdatedEntity(EntityManager em) {
        FarmInvitation updatedFarmInvitation = new FarmInvitation()
            .invitedEmail(UPDATED_INVITED_EMAIL)
            .proposedRole(UPDATED_PROPOSED_ROLE)
            .proposedPermissions(UPDATED_PROPOSED_PERMISSIONS)
            .status(UPDATED_STATUS)
            .expiresAt(UPDATED_EXPIRES_AT);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedFarmInvitation.setFarm(farm);
        return updatedFarmInvitation;
    }

    @BeforeEach
    void initTest() {
        farmInvitation = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedFarmInvitation != null) {
            farmInvitationRepository.delete(insertedFarmInvitation);
            insertedFarmInvitation = null;
        }
    }

    @Test
    @Transactional
    void createFarmInvitation() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the FarmInvitation
        var returnedFarmInvitation = om.readValue(
            restFarmInvitationMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            FarmInvitation.class
        );

        // Validate the FarmInvitation in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertFarmInvitationUpdatableFieldsEquals(returnedFarmInvitation, getPersistedFarmInvitation(returnedFarmInvitation));

        insertedFarmInvitation = returnedFarmInvitation;
    }

    @Test
    @Transactional
    void createFarmInvitationWithExistingId() throws Exception {
        // Create the FarmInvitation with an existing ID
        farmInvitation.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restFarmInvitationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isBadRequest());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkInvitedEmailIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmInvitation.setInvitedEmail(null);

        // Create the FarmInvitation, which fails.

        restFarmInvitationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkProposedRoleIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmInvitation.setProposedRole(null);

        // Create the FarmInvitation, which fails.

        restFarmInvitationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmInvitation.setStatus(null);

        // Create the FarmInvitation, which fails.

        restFarmInvitationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkExpiresAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmInvitation.setExpiresAt(null);

        // Create the FarmInvitation, which fails.

        restFarmInvitationMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllFarmInvitations() throws Exception {
        // Initialize the database
        insertedFarmInvitation = farmInvitationRepository.saveAndFlush(farmInvitation);

        // Get all the farmInvitationList
        restFarmInvitationMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(farmInvitation.getId().intValue())))
            .andExpect(jsonPath("$.[*].invitedEmail").value(hasItem(DEFAULT_INVITED_EMAIL)))
            .andExpect(jsonPath("$.[*].proposedRole").value(hasItem(DEFAULT_PROPOSED_ROLE)))
            .andExpect(jsonPath("$.[*].proposedPermissions").value(hasItem(DEFAULT_PROPOSED_PERMISSIONS)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)))
            .andExpect(jsonPath("$.[*].expiresAt").value(hasItem(DEFAULT_EXPIRES_AT.toString())));
    }

    @Test
    @Transactional
    void getFarmInvitation() throws Exception {
        // Initialize the database
        insertedFarmInvitation = farmInvitationRepository.saveAndFlush(farmInvitation);

        // Get the farmInvitation
        restFarmInvitationMockMvc
            .perform(get(ENTITY_API_URL_ID, farmInvitation.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(farmInvitation.getId().intValue()))
            .andExpect(jsonPath("$.invitedEmail").value(DEFAULT_INVITED_EMAIL))
            .andExpect(jsonPath("$.proposedRole").value(DEFAULT_PROPOSED_ROLE))
            .andExpect(jsonPath("$.proposedPermissions").value(DEFAULT_PROPOSED_PERMISSIONS))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS))
            .andExpect(jsonPath("$.expiresAt").value(DEFAULT_EXPIRES_AT.toString()));
    }

    @Test
    @Transactional
    void getNonExistingFarmInvitation() throws Exception {
        // Get the farmInvitation
        restFarmInvitationMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingFarmInvitation() throws Exception {
        // Initialize the database
        insertedFarmInvitation = farmInvitationRepository.saveAndFlush(farmInvitation);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmInvitation
        FarmInvitation updatedFarmInvitation = farmInvitationRepository.findById(farmInvitation.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedFarmInvitation are not directly saved in db
        em.detach(updatedFarmInvitation);
        updatedFarmInvitation
            .invitedEmail(UPDATED_INVITED_EMAIL)
            .proposedRole(UPDATED_PROPOSED_ROLE)
            .proposedPermissions(UPDATED_PROPOSED_PERMISSIONS)
            .status(UPDATED_STATUS)
            .expiresAt(UPDATED_EXPIRES_AT);

        restFarmInvitationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedFarmInvitation.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedFarmInvitation))
            )
            .andExpect(status().isOk());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedFarmInvitationToMatchAllProperties(updatedFarmInvitation);
    }

    @Test
    @Transactional
    void putNonExistingFarmInvitation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmInvitation.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmInvitationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, farmInvitation.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farmInvitation))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchFarmInvitation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmInvitation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmInvitationMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farmInvitation))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamFarmInvitation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmInvitation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmInvitationMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateFarmInvitationWithPatch() throws Exception {
        // Initialize the database
        insertedFarmInvitation = farmInvitationRepository.saveAndFlush(farmInvitation);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmInvitation using partial update
        FarmInvitation partialUpdatedFarmInvitation = new FarmInvitation();
        partialUpdatedFarmInvitation.setId(farmInvitation.getId());

        partialUpdatedFarmInvitation.expiresAt(UPDATED_EXPIRES_AT);

        restFarmInvitationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarmInvitation.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarmInvitation))
            )
            .andExpect(status().isOk());

        // Validate the FarmInvitation in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmInvitationUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedFarmInvitation, farmInvitation),
            getPersistedFarmInvitation(farmInvitation)
        );
    }

    @Test
    @Transactional
    void fullUpdateFarmInvitationWithPatch() throws Exception {
        // Initialize the database
        insertedFarmInvitation = farmInvitationRepository.saveAndFlush(farmInvitation);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmInvitation using partial update
        FarmInvitation partialUpdatedFarmInvitation = new FarmInvitation();
        partialUpdatedFarmInvitation.setId(farmInvitation.getId());

        partialUpdatedFarmInvitation
            .invitedEmail(UPDATED_INVITED_EMAIL)
            .proposedRole(UPDATED_PROPOSED_ROLE)
            .proposedPermissions(UPDATED_PROPOSED_PERMISSIONS)
            .status(UPDATED_STATUS)
            .expiresAt(UPDATED_EXPIRES_AT);

        restFarmInvitationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarmInvitation.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarmInvitation))
            )
            .andExpect(status().isOk());

        // Validate the FarmInvitation in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmInvitationUpdatableFieldsEquals(partialUpdatedFarmInvitation, getPersistedFarmInvitation(partialUpdatedFarmInvitation));
    }

    @Test
    @Transactional
    void patchNonExistingFarmInvitation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmInvitation.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmInvitationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, farmInvitation.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farmInvitation))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchFarmInvitation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmInvitation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmInvitationMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farmInvitation))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamFarmInvitation() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmInvitation.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmInvitationMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(farmInvitation)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the FarmInvitation in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteFarmInvitation() throws Exception {
        // Initialize the database
        insertedFarmInvitation = farmInvitationRepository.saveAndFlush(farmInvitation);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the farmInvitation
        restFarmInvitationMockMvc
            .perform(delete(ENTITY_API_URL_ID, farmInvitation.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return farmInvitationRepository.count();
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

    protected FarmInvitation getPersistedFarmInvitation(FarmInvitation farmInvitation) {
        return farmInvitationRepository.findById(farmInvitation.getId()).orElseThrow();
    }

    protected void assertPersistedFarmInvitationToMatchAllProperties(FarmInvitation expectedFarmInvitation) {
        assertFarmInvitationAllPropertiesEquals(expectedFarmInvitation, getPersistedFarmInvitation(expectedFarmInvitation));
    }

    protected void assertPersistedFarmInvitationToMatchUpdatableProperties(FarmInvitation expectedFarmInvitation) {
        assertFarmInvitationAllUpdatablePropertiesEquals(expectedFarmInvitation, getPersistedFarmInvitation(expectedFarmInvitation));
    }
}
