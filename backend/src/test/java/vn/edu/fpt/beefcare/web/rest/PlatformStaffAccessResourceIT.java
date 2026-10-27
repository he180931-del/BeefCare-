package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PlatformStaffAccessAsserts.*;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;

/**
 * Integration tests for the {@link PlatformStaffAccessResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PlatformStaffAccessResourceIT {

    private static final String DEFAULT_ROLE = "AAAAAAAAAA";
    private static final String UPDATED_ROLE = "BBBBBBBBBB";

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/platform-staff-accesses";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PlatformStaffAccessRepository platformStaffAccessRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPlatformStaffAccessMockMvc;

    private PlatformStaffAccess platformStaffAccess;

    private PlatformStaffAccess insertedPlatformStaffAccess;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PlatformStaffAccess createEntity(EntityManager em) {
        PlatformStaffAccess platformStaffAccess = new PlatformStaffAccess().role(DEFAULT_ROLE).status(DEFAULT_STATUS);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        platformStaffAccess.setUser(appUser);
        return platformStaffAccess;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static PlatformStaffAccess createUpdatedEntity(EntityManager em) {
        PlatformStaffAccess updatedPlatformStaffAccess = new PlatformStaffAccess().role(UPDATED_ROLE).status(UPDATED_STATUS);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedPlatformStaffAccess.setUser(appUser);
        return updatedPlatformStaffAccess;
    }

    @BeforeEach
    void initTest() {
        platformStaffAccess = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedPlatformStaffAccess != null) {
            platformStaffAccessRepository.delete(insertedPlatformStaffAccess);
            insertedPlatformStaffAccess = null;
        }
    }

    @Test
    @Transactional
    void createPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the PlatformStaffAccess
        var returnedPlatformStaffAccess = om.readValue(
            restPlatformStaffAccessMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(platformStaffAccess)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            PlatformStaffAccess.class
        );

        // Validate the PlatformStaffAccess in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPlatformStaffAccessUpdatableFieldsEquals(
            returnedPlatformStaffAccess,
            getPersistedPlatformStaffAccess(returnedPlatformStaffAccess)
        );

        insertedPlatformStaffAccess = returnedPlatformStaffAccess;
    }

    @Test
    @Transactional
    void createPlatformStaffAccessWithExistingId() throws Exception {
        // Create the PlatformStaffAccess with an existing ID
        platformStaffAccess.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPlatformStaffAccessMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(platformStaffAccess)))
            .andExpect(status().isBadRequest());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkRoleIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        platformStaffAccess.setRole(null);

        // Create the PlatformStaffAccess, which fails.

        restPlatformStaffAccessMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(platformStaffAccess)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        platformStaffAccess.setStatus(null);

        // Create the PlatformStaffAccess, which fails.

        restPlatformStaffAccessMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(platformStaffAccess)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPlatformStaffAccesses() throws Exception {
        // Initialize the database
        insertedPlatformStaffAccess = platformStaffAccessRepository.saveAndFlush(platformStaffAccess);

        // Get all the platformStaffAccessList
        restPlatformStaffAccessMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(platformStaffAccess.getId().intValue())))
            .andExpect(jsonPath("$.[*].role").value(hasItem(DEFAULT_ROLE)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getPlatformStaffAccess() throws Exception {
        // Initialize the database
        insertedPlatformStaffAccess = platformStaffAccessRepository.saveAndFlush(platformStaffAccess);

        // Get the platformStaffAccess
        restPlatformStaffAccessMockMvc
            .perform(get(ENTITY_API_URL_ID, platformStaffAccess.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(platformStaffAccess.getId().intValue()))
            .andExpect(jsonPath("$.role").value(DEFAULT_ROLE))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingPlatformStaffAccess() throws Exception {
        // Get the platformStaffAccess
        restPlatformStaffAccessMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPlatformStaffAccess() throws Exception {
        // Initialize the database
        insertedPlatformStaffAccess = platformStaffAccessRepository.saveAndFlush(platformStaffAccess);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the platformStaffAccess
        PlatformStaffAccess updatedPlatformStaffAccess = platformStaffAccessRepository.findById(platformStaffAccess.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPlatformStaffAccess are not directly saved in db
        em.detach(updatedPlatformStaffAccess);
        updatedPlatformStaffAccess.role(UPDATED_ROLE).status(UPDATED_STATUS);

        restPlatformStaffAccessMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPlatformStaffAccess.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedPlatformStaffAccess))
            )
            .andExpect(status().isOk());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPlatformStaffAccessToMatchAllProperties(updatedPlatformStaffAccess);
    }

    @Test
    @Transactional
    void putNonExistingPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        platformStaffAccess.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPlatformStaffAccessMockMvc
            .perform(
                put(ENTITY_API_URL_ID, platformStaffAccess.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(platformStaffAccess))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        platformStaffAccess.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlatformStaffAccessMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(platformStaffAccess))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        platformStaffAccess.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlatformStaffAccessMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(platformStaffAccess)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePlatformStaffAccessWithPatch() throws Exception {
        // Initialize the database
        insertedPlatformStaffAccess = platformStaffAccessRepository.saveAndFlush(platformStaffAccess);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the platformStaffAccess using partial update
        PlatformStaffAccess partialUpdatedPlatformStaffAccess = new PlatformStaffAccess();
        partialUpdatedPlatformStaffAccess.setId(platformStaffAccess.getId());

        partialUpdatedPlatformStaffAccess.role(UPDATED_ROLE).status(UPDATED_STATUS);

        restPlatformStaffAccessMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPlatformStaffAccess.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPlatformStaffAccess))
            )
            .andExpect(status().isOk());

        // Validate the PlatformStaffAccess in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPlatformStaffAccessUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedPlatformStaffAccess, platformStaffAccess),
            getPersistedPlatformStaffAccess(platformStaffAccess)
        );
    }

    @Test
    @Transactional
    void fullUpdatePlatformStaffAccessWithPatch() throws Exception {
        // Initialize the database
        insertedPlatformStaffAccess = platformStaffAccessRepository.saveAndFlush(platformStaffAccess);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the platformStaffAccess using partial update
        PlatformStaffAccess partialUpdatedPlatformStaffAccess = new PlatformStaffAccess();
        partialUpdatedPlatformStaffAccess.setId(platformStaffAccess.getId());

        partialUpdatedPlatformStaffAccess.role(UPDATED_ROLE).status(UPDATED_STATUS);

        restPlatformStaffAccessMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPlatformStaffAccess.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPlatformStaffAccess))
            )
            .andExpect(status().isOk());

        // Validate the PlatformStaffAccess in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPlatformStaffAccessUpdatableFieldsEquals(
            partialUpdatedPlatformStaffAccess,
            getPersistedPlatformStaffAccess(partialUpdatedPlatformStaffAccess)
        );
    }

    @Test
    @Transactional
    void patchNonExistingPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        platformStaffAccess.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPlatformStaffAccessMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, platformStaffAccess.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(platformStaffAccess))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        platformStaffAccess.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlatformStaffAccessMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(platformStaffAccess))
            )
            .andExpect(status().isBadRequest());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPlatformStaffAccess() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        platformStaffAccess.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPlatformStaffAccessMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(platformStaffAccess)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the PlatformStaffAccess in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePlatformStaffAccess() throws Exception {
        // Initialize the database
        insertedPlatformStaffAccess = platformStaffAccessRepository.saveAndFlush(platformStaffAccess);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the platformStaffAccess
        restPlatformStaffAccessMockMvc
            .perform(delete(ENTITY_API_URL_ID, platformStaffAccess.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return platformStaffAccessRepository.count();
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

    protected PlatformStaffAccess getPersistedPlatformStaffAccess(PlatformStaffAccess platformStaffAccess) {
        return platformStaffAccessRepository.findById(platformStaffAccess.getId()).orElseThrow();
    }

    protected void assertPersistedPlatformStaffAccessToMatchAllProperties(PlatformStaffAccess expectedPlatformStaffAccess) {
        assertPlatformStaffAccessAllPropertiesEquals(
            expectedPlatformStaffAccess,
            getPersistedPlatformStaffAccess(expectedPlatformStaffAccess)
        );
    }

    protected void assertPersistedPlatformStaffAccessToMatchUpdatableProperties(PlatformStaffAccess expectedPlatformStaffAccess) {
        assertPlatformStaffAccessAllUpdatablePropertiesEquals(
            expectedPlatformStaffAccess,
            getPersistedPlatformStaffAccess(expectedPlatformStaffAccess)
        );
    }
}
