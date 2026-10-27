package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.FarmMembershipAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;

/**
 * Integration tests for the {@link FarmMembershipResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class FarmMembershipResourceIT {

    private static final String DEFAULT_ROLE = "AAAAAAAAAA";
    private static final String UPDATED_ROLE = "BBBBBBBBBB";

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/farm-memberships";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private FarmMembershipRepository farmMembershipRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restFarmMembershipMockMvc;

    private FarmMembership farmMembership;

    private FarmMembership insertedFarmMembership;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static FarmMembership createEntity(EntityManager em) {
        FarmMembership farmMembership = new FarmMembership().role(DEFAULT_ROLE).status(DEFAULT_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        farmMembership.setFarm(farm);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        farmMembership.setUser(appUser);
        return farmMembership;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static FarmMembership createUpdatedEntity(EntityManager em) {
        FarmMembership updatedFarmMembership = new FarmMembership().role(UPDATED_ROLE).status(UPDATED_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedFarmMembership.setFarm(farm);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedFarmMembership.setUser(appUser);
        return updatedFarmMembership;
    }

    @BeforeEach
    void initTest() {
        farmMembership = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedFarmMembership != null) {
            farmMembershipRepository.delete(insertedFarmMembership);
            insertedFarmMembership = null;
        }
    }

    @Test
    @Transactional
    void createFarmMembership() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the FarmMembership
        var returnedFarmMembership = om.readValue(
            restFarmMembershipMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmMembership)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            FarmMembership.class
        );

        // Validate the FarmMembership in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertFarmMembershipUpdatableFieldsEquals(returnedFarmMembership, getPersistedFarmMembership(returnedFarmMembership));

        insertedFarmMembership = returnedFarmMembership;
    }

    @Test
    @Transactional
    void createFarmMembershipWithExistingId() throws Exception {
        // Create the FarmMembership with an existing ID
        farmMembership.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restFarmMembershipMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmMembership)))
            .andExpect(status().isBadRequest());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkRoleIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmMembership.setRole(null);

        // Create the FarmMembership, which fails.

        restFarmMembershipMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmMembership)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        farmMembership.setStatus(null);

        // Create the FarmMembership, which fails.

        restFarmMembershipMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmMembership)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllFarmMemberships() throws Exception {
        // Initialize the database
        insertedFarmMembership = farmMembershipRepository.saveAndFlush(farmMembership);

        // Get all the farmMembershipList
        restFarmMembershipMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(farmMembership.getId().intValue())))
            .andExpect(jsonPath("$.[*].role").value(hasItem(DEFAULT_ROLE)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getFarmMembership() throws Exception {
        // Initialize the database
        insertedFarmMembership = farmMembershipRepository.saveAndFlush(farmMembership);

        // Get the farmMembership
        restFarmMembershipMockMvc
            .perform(get(ENTITY_API_URL_ID, farmMembership.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(farmMembership.getId().intValue()))
            .andExpect(jsonPath("$.role").value(DEFAULT_ROLE))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingFarmMembership() throws Exception {
        // Get the farmMembership
        restFarmMembershipMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingFarmMembership() throws Exception {
        // Initialize the database
        insertedFarmMembership = farmMembershipRepository.saveAndFlush(farmMembership);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmMembership
        FarmMembership updatedFarmMembership = farmMembershipRepository.findById(farmMembership.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedFarmMembership are not directly saved in db
        em.detach(updatedFarmMembership);
        updatedFarmMembership.role(UPDATED_ROLE).status(UPDATED_STATUS);

        restFarmMembershipMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedFarmMembership.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedFarmMembership))
            )
            .andExpect(status().isOk());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedFarmMembershipToMatchAllProperties(updatedFarmMembership);
    }

    @Test
    @Transactional
    void putNonExistingFarmMembership() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmMembership.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmMembershipMockMvc
            .perform(
                put(ENTITY_API_URL_ID, farmMembership.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farmMembership))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchFarmMembership() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmMembership.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMembershipMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(farmMembership))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamFarmMembership() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmMembership.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMembershipMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(farmMembership)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateFarmMembershipWithPatch() throws Exception {
        // Initialize the database
        insertedFarmMembership = farmMembershipRepository.saveAndFlush(farmMembership);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmMembership using partial update
        FarmMembership partialUpdatedFarmMembership = new FarmMembership();
        partialUpdatedFarmMembership.setId(farmMembership.getId());

        restFarmMembershipMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarmMembership.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarmMembership))
            )
            .andExpect(status().isOk());

        // Validate the FarmMembership in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmMembershipUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedFarmMembership, farmMembership),
            getPersistedFarmMembership(farmMembership)
        );
    }

    @Test
    @Transactional
    void fullUpdateFarmMembershipWithPatch() throws Exception {
        // Initialize the database
        insertedFarmMembership = farmMembershipRepository.saveAndFlush(farmMembership);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the farmMembership using partial update
        FarmMembership partialUpdatedFarmMembership = new FarmMembership();
        partialUpdatedFarmMembership.setId(farmMembership.getId());

        partialUpdatedFarmMembership.role(UPDATED_ROLE).status(UPDATED_STATUS);

        restFarmMembershipMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedFarmMembership.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedFarmMembership))
            )
            .andExpect(status().isOk());

        // Validate the FarmMembership in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertFarmMembershipUpdatableFieldsEquals(partialUpdatedFarmMembership, getPersistedFarmMembership(partialUpdatedFarmMembership));
    }

    @Test
    @Transactional
    void patchNonExistingFarmMembership() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmMembership.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restFarmMembershipMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, farmMembership.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farmMembership))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchFarmMembership() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmMembership.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMembershipMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(farmMembership))
            )
            .andExpect(status().isBadRequest());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamFarmMembership() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        farmMembership.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restFarmMembershipMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(farmMembership)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the FarmMembership in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteFarmMembership() throws Exception {
        // Initialize the database
        insertedFarmMembership = farmMembershipRepository.saveAndFlush(farmMembership);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the farmMembership
        restFarmMembershipMockMvc
            .perform(delete(ENTITY_API_URL_ID, farmMembership.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return farmMembershipRepository.count();
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

    protected FarmMembership getPersistedFarmMembership(FarmMembership farmMembership) {
        return farmMembershipRepository.findById(farmMembership.getId()).orElseThrow();
    }

    protected void assertPersistedFarmMembershipToMatchAllProperties(FarmMembership expectedFarmMembership) {
        assertFarmMembershipAllPropertiesEquals(expectedFarmMembership, getPersistedFarmMembership(expectedFarmMembership));
    }

    protected void assertPersistedFarmMembershipToMatchUpdatableProperties(FarmMembership expectedFarmMembership) {
        assertFarmMembershipAllUpdatablePropertiesEquals(expectedFarmMembership, getPersistedFarmMembership(expectedFarmMembership));
    }
}
