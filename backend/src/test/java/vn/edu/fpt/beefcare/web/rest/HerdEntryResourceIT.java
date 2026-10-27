package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.HerdEntryAsserts.*;
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
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;

/**
 * Integration tests for the {@link HerdEntryResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class HerdEntryResourceIT {

    private static final String DEFAULT_SOURCE = "AAAAAAAAAA";
    private static final String UPDATED_SOURCE = "BBBBBBBBBB";

    private static final LocalDate DEFAULT_ENTRY_DATE = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_ENTRY_DATE = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_HISTORY_DECLARATIONS = "AAAAAAAAAA";
    private static final String UPDATED_HISTORY_DECLARATIONS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/herd-entries";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private HerdEntryRepository herdEntryRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restHerdEntryMockMvc;

    private HerdEntry herdEntry;

    private HerdEntry insertedHerdEntry;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HerdEntry createEntity(EntityManager em) {
        HerdEntry herdEntry = new HerdEntry()
            .source(DEFAULT_SOURCE)
            .entryDate(DEFAULT_ENTRY_DATE)
            .historyDeclarations(DEFAULT_HISTORY_DECLARATIONS);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        herdEntry.setCattle(cattle);
        // Add required entity
        Pen pen;
        if (TestUtil.findAll(em, Pen.class).isEmpty()) {
            pen = PenResourceIT.createEntity(em);
            em.persist(pen);
            em.flush();
        } else {
            pen = TestUtil.findAll(em, Pen.class).get(0);
        }
        herdEntry.setInitialPen(pen);
        return herdEntry;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static HerdEntry createUpdatedEntity(EntityManager em) {
        HerdEntry updatedHerdEntry = new HerdEntry()
            .source(UPDATED_SOURCE)
            .entryDate(UPDATED_ENTRY_DATE)
            .historyDeclarations(UPDATED_HISTORY_DECLARATIONS);
        // Add required entity
        Cattle cattle;
        if (TestUtil.findAll(em, Cattle.class).isEmpty()) {
            cattle = CattleResourceIT.createUpdatedEntity(em);
            em.persist(cattle);
            em.flush();
        } else {
            cattle = TestUtil.findAll(em, Cattle.class).get(0);
        }
        updatedHerdEntry.setCattle(cattle);
        // Add required entity
        Pen pen;
        if (TestUtil.findAll(em, Pen.class).isEmpty()) {
            pen = PenResourceIT.createUpdatedEntity(em);
            em.persist(pen);
            em.flush();
        } else {
            pen = TestUtil.findAll(em, Pen.class).get(0);
        }
        updatedHerdEntry.setInitialPen(pen);
        return updatedHerdEntry;
    }

    @BeforeEach
    void initTest() {
        herdEntry = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedHerdEntry != null) {
            herdEntryRepository.delete(insertedHerdEntry);
            insertedHerdEntry = null;
        }
    }

    @Test
    @Transactional
    void createHerdEntry() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the HerdEntry
        var returnedHerdEntry = om.readValue(
            restHerdEntryMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdEntry)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            HerdEntry.class
        );

        // Validate the HerdEntry in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertHerdEntryUpdatableFieldsEquals(returnedHerdEntry, getPersistedHerdEntry(returnedHerdEntry));

        insertedHerdEntry = returnedHerdEntry;
    }

    @Test
    @Transactional
    void createHerdEntryWithExistingId() throws Exception {
        // Create the HerdEntry with an existing ID
        herdEntry.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restHerdEntryMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdEntry)))
            .andExpect(status().isBadRequest());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkEntryDateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        herdEntry.setEntryDate(null);

        // Create the HerdEntry, which fails.

        restHerdEntryMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdEntry)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllHerdEntries() throws Exception {
        // Initialize the database
        insertedHerdEntry = herdEntryRepository.saveAndFlush(herdEntry);

        // Get all the herdEntryList
        restHerdEntryMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(herdEntry.getId().intValue())))
            .andExpect(jsonPath("$.[*].source").value(hasItem(DEFAULT_SOURCE)))
            .andExpect(jsonPath("$.[*].entryDate").value(hasItem(DEFAULT_ENTRY_DATE.toString())))
            .andExpect(jsonPath("$.[*].historyDeclarations").value(hasItem(DEFAULT_HISTORY_DECLARATIONS)));
    }

    @Test
    @Transactional
    void getHerdEntry() throws Exception {
        // Initialize the database
        insertedHerdEntry = herdEntryRepository.saveAndFlush(herdEntry);

        // Get the herdEntry
        restHerdEntryMockMvc
            .perform(get(ENTITY_API_URL_ID, herdEntry.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(herdEntry.getId().intValue()))
            .andExpect(jsonPath("$.source").value(DEFAULT_SOURCE))
            .andExpect(jsonPath("$.entryDate").value(DEFAULT_ENTRY_DATE.toString()))
            .andExpect(jsonPath("$.historyDeclarations").value(DEFAULT_HISTORY_DECLARATIONS));
    }

    @Test
    @Transactional
    void getNonExistingHerdEntry() throws Exception {
        // Get the herdEntry
        restHerdEntryMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingHerdEntry() throws Exception {
        // Initialize the database
        insertedHerdEntry = herdEntryRepository.saveAndFlush(herdEntry);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the herdEntry
        HerdEntry updatedHerdEntry = herdEntryRepository.findById(herdEntry.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedHerdEntry are not directly saved in db
        em.detach(updatedHerdEntry);
        updatedHerdEntry.source(UPDATED_SOURCE).entryDate(UPDATED_ENTRY_DATE).historyDeclarations(UPDATED_HISTORY_DECLARATIONS);

        restHerdEntryMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedHerdEntry.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedHerdEntry))
            )
            .andExpect(status().isOk());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedHerdEntryToMatchAllProperties(updatedHerdEntry);
    }

    @Test
    @Transactional
    void putNonExistingHerdEntry() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdEntry.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHerdEntryMockMvc
            .perform(
                put(ENTITY_API_URL_ID, herdEntry.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdEntry))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchHerdEntry() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdEntry.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdEntryMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(herdEntry))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamHerdEntry() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdEntry.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdEntryMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(herdEntry)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateHerdEntryWithPatch() throws Exception {
        // Initialize the database
        insertedHerdEntry = herdEntryRepository.saveAndFlush(herdEntry);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the herdEntry using partial update
        HerdEntry partialUpdatedHerdEntry = new HerdEntry();
        partialUpdatedHerdEntry.setId(herdEntry.getId());

        restHerdEntryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHerdEntry.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHerdEntry))
            )
            .andExpect(status().isOk());

        // Validate the HerdEntry in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHerdEntryUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedHerdEntry, herdEntry),
            getPersistedHerdEntry(herdEntry)
        );
    }

    @Test
    @Transactional
    void fullUpdateHerdEntryWithPatch() throws Exception {
        // Initialize the database
        insertedHerdEntry = herdEntryRepository.saveAndFlush(herdEntry);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the herdEntry using partial update
        HerdEntry partialUpdatedHerdEntry = new HerdEntry();
        partialUpdatedHerdEntry.setId(herdEntry.getId());

        partialUpdatedHerdEntry.source(UPDATED_SOURCE).entryDate(UPDATED_ENTRY_DATE).historyDeclarations(UPDATED_HISTORY_DECLARATIONS);

        restHerdEntryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedHerdEntry.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedHerdEntry))
            )
            .andExpect(status().isOk());

        // Validate the HerdEntry in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertHerdEntryUpdatableFieldsEquals(partialUpdatedHerdEntry, getPersistedHerdEntry(partialUpdatedHerdEntry));
    }

    @Test
    @Transactional
    void patchNonExistingHerdEntry() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdEntry.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restHerdEntryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, herdEntry.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(herdEntry))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchHerdEntry() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdEntry.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdEntryMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(herdEntry))
            )
            .andExpect(status().isBadRequest());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamHerdEntry() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        herdEntry.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restHerdEntryMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(herdEntry)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the HerdEntry in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteHerdEntry() throws Exception {
        // Initialize the database
        insertedHerdEntry = herdEntryRepository.saveAndFlush(herdEntry);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the herdEntry
        restHerdEntryMockMvc
            .perform(delete(ENTITY_API_URL_ID, herdEntry.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return herdEntryRepository.count();
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

    protected HerdEntry getPersistedHerdEntry(HerdEntry herdEntry) {
        return herdEntryRepository.findById(herdEntry.getId()).orElseThrow();
    }

    protected void assertPersistedHerdEntryToMatchAllProperties(HerdEntry expectedHerdEntry) {
        assertHerdEntryAllPropertiesEquals(expectedHerdEntry, getPersistedHerdEntry(expectedHerdEntry));
    }

    protected void assertPersistedHerdEntryToMatchUpdatableProperties(HerdEntry expectedHerdEntry) {
        assertHerdEntryAllUpdatablePropertiesEquals(expectedHerdEntry, getPersistedHerdEntry(expectedHerdEntry));
    }
}
