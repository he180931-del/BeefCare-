package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.HerdExitAsserts.*;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;

/**
 * Integration tests for the {@link HerdExitResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class HerdExitResourceIT {

    private static final String DEFAULT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_TYPE = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_EXIT_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_EXIT_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_REASON = "AAAAAAAAAA";
    private static final String UPDATED_REASON = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/herd-exits";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private HerdExitRepository herdExitRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restHerdExitMockMvc;

    private HerdExit herdExit;

    private HerdExit insertedHerdExit;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HerdExit createEntity(EntityManager em) {
        HerdExit herdExit = new HerdExit().type(DEFAULT_TYPE).exitDate(DEFAULT_EXIT_DATE).reason(DEFAULT_REASON);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        herdExit.setCattle(cattle);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        herdExit.setConfirmedBy(appUser);
        return herdExit;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HerdExit createUpdatedEntity(EntityManager em) {
        HerdExit updatedHerdExit = new HerdExit().type(UPDATED_TYPE).exitDate(UPDATED_EXIT_DATE).reason(UPDATED_REASON);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedHerdExit.setCattle(cattle);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedHerdExit.setConfirmedBy(appUser);
        return updatedHerdExit;
    }

    @BeforeEach
    void initTest() {
        herdExit = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedHerdExit != null) {
            herdExitRepository.delete(insertedHerdExit);
            insertedHerdExit = null;
        }
    }

    @Test
    @Transactional
    void createHerdExit() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the HerdExit
        var returnedHerdExit = om.readValue(
            restHerdExitMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdExit)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            HerdExit.class
        );

        // Validate the HerdExit in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertHerdExitUpdatableFieldsEquals(returnedHerdExit, getPersistedHerdExit(returnedHerdExit));

        insertedHerdExit = returnedHerdExit;
    }

    @Test
    @Transactional
    void createHerdExitWithExistingId() throws Exception {
        // Create the HerdExit with an existing ID
        herdExit.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restHerdExitMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdExit)))
            .andExpect(status().isBadRequest());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        herdExit.setType(null);

        // Create the HerdExit, which fails.

        restHerdExitMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdExit)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkExitDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        herdExit.setExitDate(null);

        // Create the HerdExit, which fails.

        restHerdExitMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdExit)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllHerdExits() throws Exception {
        // Initialize the database
        insertedHerdExit = herdExitRepository.saveAndFlush(herdExit);

        // Get all the herdExitList
        restHerdExitMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(herdExit.getId().intValue())))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE)))
            .andExpect(jsonPath("$.[*].exitDate").value(hasItem(DEFAULT_EXIT_DATE.toString())))
            .andExpect(jsonPath("$.[*].reason").value(hasItem(DEFAULT_REASON)));
    }

    @Test
    @Transactional
    void getHerdExit() throws Exception {
        // Initialize the database
        insertedHerdExit = herdExitRepository.saveAndFlush(herdExit);

        // Get the herdExit
        restHerdExitMockMvc
            .perform(get(ENTITY_API_URL_ID, herdExit.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(herdExit.getId().intValue()))
            .andExpect(jsonPath("$.type").value(DEFAULT_TYPE))
            .andExpect(jsonPath("$.exitDate").value(DEFAULT_EXIT_DATE.toString()))
            .andExpect(jsonPath("$.reason").value(DEFAULT_REASON));
    }

    @Test
    @Transactional
    void getNonExistingHerdExit() throws Exception {
        // Get the herdExit
        restHerdExitMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingHerdExit() throws Exception {
        // Initialize the database
        insertedHerdExit = herdExitRepository.saveAndFlush(herdExit);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the herdExit
        HerdExit updatedHerdExit = herdExitRepository.findById(herdExit.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedHerdExit are not directly saved in db
        em.detach(updatedHerdExit);
        updatedHerdExit.type(UPDATED_TYPE).exitDate(UPDATED_EXIT_DATE).reason(UPDATED_REASON);

        restHerdExitMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedHerdExit.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedHerdExit))
            )
            .andExpect(status().isOk());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedHerdExitToMatchAllProperties(updatedHerdExit);
    }

    @Test
    @Transactional
    void putNonExistingHerdExit() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdExit.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHerdExitMockMvc
            .perform(
                put(ENTITY_API_URL_ID, herdExit.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdExit))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchHerdExit() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdExit.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdExitMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(herdExit))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamHerdExit() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdExit.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdExitMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdExit)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateHerdExitWithPatch() throws Exception {
        // Initialize the database
        insertedHerdExit = herdExitRepository.saveAndFlush(herdExit);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the herdExit using partial update
        HerdExit partialUpdatedHerdExit = new HerdExit();
        partialUpdatedHerdExit.setId(herdExit.getId());

        partialUpdatedHerdExit.type(UPDATED_TYPE).exitDate(UPDATED_EXIT_DATE);

        restHerdExitMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHerdExit.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHerdExit))
            )
            .andExpect(status().isOk());

        // Validate the HerdExit in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHerdExitUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedHerdExit, herdExit), getPersistedHerdExit(herdExit));
    }

    @Test
    @Transactional
    void fullUpdateHerdExitWithPatch() throws Exception {
        // Initialize the database
        insertedHerdExit = herdExitRepository.saveAndFlush(herdExit);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the herdExit using partial update
        HerdExit partialUpdatedHerdExit = new HerdExit();
        partialUpdatedHerdExit.setId(herdExit.getId());

        partialUpdatedHerdExit.type(UPDATED_TYPE).exitDate(UPDATED_EXIT_DATE).reason(UPDATED_REASON);

        restHerdExitMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHerdExit.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHerdExit))
            )
            .andExpect(status().isOk());

        // Validate the HerdExit in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHerdExitUpdatableFieldsEquals(partialUpdatedHerdExit, getPersistedHerdExit(partialUpdatedHerdExit));
    }

    @Test
    @Transactional
    void patchNonExistingHerdExit() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdExit.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHerdExitMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, herdExit.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(herdExit))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchHerdExit() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdExit.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdExitMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(herdExit))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamHerdExit() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdExit.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdExitMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(herdExit)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HerdExit in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteHerdExit() throws Exception {
        // Initialize the database
        insertedHerdExit = herdExitRepository.saveAndFlush(herdExit);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the herdExit
        restHerdExitMockMvc
            .perform(delete(ENTITY_API_URL_ID, herdExit.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return herdExitRepository.count();
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

    protected HerdExit getPersistedHerdExit(HerdExit herdExit) {
        return herdExitRepository.findById(herdExit.getId()).orElseThrow();
    }

    protected void assertPersistedHerdExitToMatchAllProperties(HerdExit expectedHerdExit) {
        assertHerdExitAllPropertiesEquals(expectedHerdExit, getPersistedHerdExit(expectedHerdExit));
    }

    protected void assertPersistedHerdExitToMatchUpdatableProperties(HerdExit expectedHerdExit) {
        assertHerdExitAllUpdatablePropertiesEquals(expectedHerdExit, getPersistedHerdExit(expectedHerdExit));
    }
}
