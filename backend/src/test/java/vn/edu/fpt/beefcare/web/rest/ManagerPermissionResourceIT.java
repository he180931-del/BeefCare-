package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.ManagerPermissionAsserts.*;
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
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.ManagerPermission;
import vn.edu.fpt.beefcare.repository.ManagerPermissionRepository;

/**
 * Integration tests for the {@link ManagerPermissionResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class ManagerPermissionResourceIT {

    private static final String DEFAULT_PERMISSION_CODE = "AAAAAAAAAA";
    private static final String UPDATED_PERMISSION_CODE = "BBBBBBBBBB";

    private static final Boolean DEFAULT_ENABLED = false;
    private static final Boolean UPDATED_ENABLED = true;

    private static final String ENTITY_API_URL = "/api/manager-permissions";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ManagerPermissionRepository managerPermissionRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restManagerPermissionMockMvc;

    private ManagerPermission managerPermission;

    private ManagerPermission insertedManagerPermission;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ManagerPermission createEntity(EntityManager em) {
        ManagerPermission managerPermission = new ManagerPermission().permissionCode(DEFAULT_PERMISSION_CODE).enabled(DEFAULT_ENABLED);
        // Add required entity
        FarmMembership farmMembership;
        if (TestUtil.findAll(em, FarmMembership.class).isEmpty()) {
            farmMembership = FarmMembershipResourceIT.createEntity(em);
            em.persist(farmMembership);
            em.flush();
        } else {
            farmMembership = TestUtil.findAll(em, FarmMembership.class).get(0);
        }
        managerPermission.setMembership(farmMembership);
        return managerPermission;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ManagerPermission createUpdatedEntity(EntityManager em) {
        ManagerPermission updatedManagerPermission = new ManagerPermission()
            .permissionCode(UPDATED_PERMISSION_CODE)
            .enabled(UPDATED_ENABLED);
        // Add required entity
        FarmMembership farmMembership;
        if (TestUtil.findAll(em, FarmMembership.class).isEmpty()) {
            farmMembership = FarmMembershipResourceIT.createUpdatedEntity(em);
            em.persist(farmMembership);
            em.flush();
        } else {
            farmMembership = TestUtil.findAll(em, FarmMembership.class).get(0);
        }
        updatedManagerPermission.setMembership(farmMembership);
        return updatedManagerPermission;
    }

    @BeforeEach
    void initTest() {
        managerPermission = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedManagerPermission != null) {
            managerPermissionRepository.delete(insertedManagerPermission);
            insertedManagerPermission = null;
        }
    }

    @Test
    @Transactional
    void createManagerPermission() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the ManagerPermission
        var returnedManagerPermission = om.readValue(
            restManagerPermissionMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(managerPermission)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ManagerPermission.class
        );

        // Validate the ManagerPermission in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertManagerPermissionUpdatableFieldsEquals(returnedManagerPermission, getPersistedManagerPermission(returnedManagerPermission));

        insertedManagerPermission = returnedManagerPermission;
    }

    @Test
    @Transactional
    void createManagerPermissionWithExistingId() throws Exception {
        // Create the ManagerPermission with an existing ID
        managerPermission.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restManagerPermissionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(managerPermission)))
            .andExpect(status().isBadRequest());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkPermissionCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        managerPermission.setPermissionCode(null);

        // Create the ManagerPermission, which fails.

        restManagerPermissionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(managerPermission)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkEnabledIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        managerPermission.setEnabled(null);

        // Create the ManagerPermission, which fails.

        restManagerPermissionMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(managerPermission)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllManagerPermissions() throws Exception {
        // Initialize the database
        insertedManagerPermission = managerPermissionRepository.saveAndFlush(managerPermission);

        // Get all the managerPermissionList
        restManagerPermissionMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(managerPermission.getId().intValue())))
            .andExpect(jsonPath("$.[*].permissionCode").value(hasItem(DEFAULT_PERMISSION_CODE)))
            .andExpect(jsonPath("$.[*].enabled").value(hasItem(DEFAULT_ENABLED)));
    }

    @Test
    @Transactional
    void getManagerPermission() throws Exception {
        // Initialize the database
        insertedManagerPermission = managerPermissionRepository.saveAndFlush(managerPermission);

        // Get the managerPermission
        restManagerPermissionMockMvc
            .perform(get(ENTITY_API_URL_ID, managerPermission.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(managerPermission.getId().intValue()))
            .andExpect(jsonPath("$.permissionCode").value(DEFAULT_PERMISSION_CODE))
            .andExpect(jsonPath("$.enabled").value(DEFAULT_ENABLED));
    }

    @Test
    @Transactional
    void getNonExistingManagerPermission() throws Exception {
        // Get the managerPermission
        restManagerPermissionMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingManagerPermission() throws Exception {
        // Initialize the database
        insertedManagerPermission = managerPermissionRepository.saveAndFlush(managerPermission);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the managerPermission
        ManagerPermission updatedManagerPermission = managerPermissionRepository.findById(managerPermission.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedManagerPermission are not directly saved in db
        em.detach(updatedManagerPermission);
        updatedManagerPermission.permissionCode(UPDATED_PERMISSION_CODE).enabled(UPDATED_ENABLED);

        restManagerPermissionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedManagerPermission.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedManagerPermission))
            )
            .andExpect(status().isOk());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedManagerPermissionToMatchAllProperties(updatedManagerPermission);
    }

    @Test
    @Transactional
    void putNonExistingManagerPermission() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        managerPermission.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restManagerPermissionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, managerPermission.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(managerPermission))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchManagerPermission() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        managerPermission.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManagerPermissionMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(managerPermission))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamManagerPermission() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        managerPermission.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManagerPermissionMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(managerPermission)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateManagerPermissionWithPatch() throws Exception {
        // Initialize the database
        insertedManagerPermission = managerPermissionRepository.saveAndFlush(managerPermission);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the managerPermission using partial update
        ManagerPermission partialUpdatedManagerPermission = new ManagerPermission();
        partialUpdatedManagerPermission.setId(managerPermission.getId());

        partialUpdatedManagerPermission.permissionCode(UPDATED_PERMISSION_CODE);

        restManagerPermissionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedManagerPermission.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedManagerPermission))
            )
            .andExpect(status().isOk());

        // Validate the ManagerPermission in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertManagerPermissionUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedManagerPermission, managerPermission),
            getPersistedManagerPermission(managerPermission)
        );
    }

    @Test
    @Transactional
    void fullUpdateManagerPermissionWithPatch() throws Exception {
        // Initialize the database
        insertedManagerPermission = managerPermissionRepository.saveAndFlush(managerPermission);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the managerPermission using partial update
        ManagerPermission partialUpdatedManagerPermission = new ManagerPermission();
        partialUpdatedManagerPermission.setId(managerPermission.getId());

        partialUpdatedManagerPermission.permissionCode(UPDATED_PERMISSION_CODE).enabled(UPDATED_ENABLED);

        restManagerPermissionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedManagerPermission.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedManagerPermission))
            )
            .andExpect(status().isOk());

        // Validate the ManagerPermission in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertManagerPermissionUpdatableFieldsEquals(
            partialUpdatedManagerPermission,
            getPersistedManagerPermission(partialUpdatedManagerPermission)
        );
    }

    @Test
    @Transactional
    void patchNonExistingManagerPermission() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        managerPermission.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restManagerPermissionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, managerPermission.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(managerPermission))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchManagerPermission() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        managerPermission.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManagerPermissionMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(managerPermission))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamManagerPermission() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        managerPermission.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManagerPermissionMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(managerPermission)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ManagerPermission in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteManagerPermission() throws Exception {
        // Initialize the database
        insertedManagerPermission = managerPermissionRepository.saveAndFlush(managerPermission);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the managerPermission
        restManagerPermissionMockMvc
            .perform(delete(ENTITY_API_URL_ID, managerPermission.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return managerPermissionRepository.count();
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

    protected ManagerPermission getPersistedManagerPermission(ManagerPermission managerPermission) {
        return managerPermissionRepository.findById(managerPermission.getId()).orElseThrow();
    }

    protected void assertPersistedManagerPermissionToMatchAllProperties(ManagerPermission expectedManagerPermission) {
        assertManagerPermissionAllPropertiesEquals(expectedManagerPermission, getPersistedManagerPermission(expectedManagerPermission));
    }

    protected void assertPersistedManagerPermissionToMatchUpdatableProperties(ManagerPermission expectedManagerPermission) {
        assertManagerPermissionAllUpdatablePropertiesEquals(
            expectedManagerPermission,
            getPersistedManagerPermission(expectedManagerPermission)
        );
    }
}
