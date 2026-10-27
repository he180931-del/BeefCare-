package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.SupportTicketAsserts.*;
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
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.SupportTicketRepository;

/**
 * Integration tests for the {@link SupportTicketResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class SupportTicketResourceIT {

    private static final String DEFAULT_CATEGORY = "AAAAAAAAAA";
    private static final String UPDATED_CATEGORY = "BBBBBBBBBB";

    private static final String DEFAULT_PRIORITY = "AAAAAAAAAA";
    private static final String UPDATED_PRIORITY = "BBBBBBBBBB";

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/support-tickets";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restSupportTicketMockMvc;

    private SupportTicket supportTicket;

    private SupportTicket insertedSupportTicket;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static SupportTicket createEntity(EntityManager em) {
        SupportTicket supportTicket = new SupportTicket().category(DEFAULT_CATEGORY).priority(DEFAULT_PRIORITY).status(DEFAULT_STATUS);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        supportTicket.setRequester(appUser);
        return supportTicket;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static SupportTicket createUpdatedEntity(EntityManager em) {
        SupportTicket updatedSupportTicket = new SupportTicket()
            .category(UPDATED_CATEGORY)
            .priority(UPDATED_PRIORITY)
            .status(UPDATED_STATUS);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedSupportTicket.setRequester(appUser);
        return updatedSupportTicket;
    }

    @BeforeEach
    void initTest() {
        supportTicket = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedSupportTicket != null) {
            supportTicketRepository.delete(insertedSupportTicket);
            insertedSupportTicket = null;
        }
    }

    @Test
    @Transactional
    void createSupportTicket() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the SupportTicket
        var returnedSupportTicket = om.readValue(
            restSupportTicketMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportTicket)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            SupportTicket.class
        );

        // Validate the SupportTicket in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertSupportTicketUpdatableFieldsEquals(returnedSupportTicket, getPersistedSupportTicket(returnedSupportTicket));

        insertedSupportTicket = returnedSupportTicket;
    }

    @Test
    @Transactional
    void createSupportTicketWithExistingId() throws Exception {
        // Create the SupportTicket with an existing ID
        supportTicket.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restSupportTicketMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportTicket)))
            .andExpect(status().isBadRequest());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCategoryIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        supportTicket.setCategory(null);

        // Create the SupportTicket, which fails.

        restSupportTicketMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportTicket)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkPriorityIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        supportTicket.setPriority(null);

        // Create the SupportTicket, which fails.

        restSupportTicketMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportTicket)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        supportTicket.setStatus(null);

        // Create the SupportTicket, which fails.

        restSupportTicketMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportTicket)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllSupportTickets() throws Exception {
        // Initialize the database
        insertedSupportTicket = supportTicketRepository.saveAndFlush(supportTicket);

        // Get all the supportTicketList
        restSupportTicketMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(supportTicket.getId().intValue())))
            .andExpect(jsonPath("$.[*].category").value(hasItem(DEFAULT_CATEGORY)))
            .andExpect(jsonPath("$.[*].priority").value(hasItem(DEFAULT_PRIORITY)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getSupportTicket() throws Exception {
        // Initialize the database
        insertedSupportTicket = supportTicketRepository.saveAndFlush(supportTicket);

        // Get the supportTicket
        restSupportTicketMockMvc
            .perform(get(ENTITY_API_URL_ID, supportTicket.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(supportTicket.getId().intValue()))
            .andExpect(jsonPath("$.category").value(DEFAULT_CATEGORY))
            .andExpect(jsonPath("$.priority").value(DEFAULT_PRIORITY))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingSupportTicket() throws Exception {
        // Get the supportTicket
        restSupportTicketMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingSupportTicket() throws Exception {
        // Initialize the database
        insertedSupportTicket = supportTicketRepository.saveAndFlush(supportTicket);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the supportTicket
        SupportTicket updatedSupportTicket = supportTicketRepository.findById(supportTicket.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedSupportTicket are not directly saved in db
        em.detach(updatedSupportTicket);
        updatedSupportTicket.category(UPDATED_CATEGORY).priority(UPDATED_PRIORITY).status(UPDATED_STATUS);

        restSupportTicketMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedSupportTicket.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedSupportTicket))
            )
            .andExpect(status().isOk());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedSupportTicketToMatchAllProperties(updatedSupportTicket);
    }

    @Test
    @Transactional
    void putNonExistingSupportTicket() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportTicket.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSupportTicketMockMvc
            .perform(
                put(ENTITY_API_URL_ID, supportTicket.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(supportTicket))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchSupportTicket() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportTicket.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportTicketMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(supportTicket))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamSupportTicket() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportTicket.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportTicketMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(supportTicket)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateSupportTicketWithPatch() throws Exception {
        // Initialize the database
        insertedSupportTicket = supportTicketRepository.saveAndFlush(supportTicket);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the supportTicket using partial update
        SupportTicket partialUpdatedSupportTicket = new SupportTicket();
        partialUpdatedSupportTicket.setId(supportTicket.getId());

        restSupportTicketMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSupportTicket.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSupportTicket))
            )
            .andExpect(status().isOk());

        // Validate the SupportTicket in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSupportTicketUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedSupportTicket, supportTicket),
            getPersistedSupportTicket(supportTicket)
        );
    }

    @Test
    @Transactional
    void fullUpdateSupportTicketWithPatch() throws Exception {
        // Initialize the database
        insertedSupportTicket = supportTicketRepository.saveAndFlush(supportTicket);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the supportTicket using partial update
        SupportTicket partialUpdatedSupportTicket = new SupportTicket();
        partialUpdatedSupportTicket.setId(supportTicket.getId());

        partialUpdatedSupportTicket.category(UPDATED_CATEGORY).priority(UPDATED_PRIORITY).status(UPDATED_STATUS);

        restSupportTicketMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedSupportTicket.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedSupportTicket))
            )
            .andExpect(status().isOk());

        // Validate the SupportTicket in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertSupportTicketUpdatableFieldsEquals(partialUpdatedSupportTicket, getPersistedSupportTicket(partialUpdatedSupportTicket));
    }

    @Test
    @Transactional
    void patchNonExistingSupportTicket() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportTicket.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restSupportTicketMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, supportTicket.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(supportTicket))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchSupportTicket() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportTicket.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportTicketMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(supportTicket))
            )
            .andExpect(status().isBadRequest());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamSupportTicket() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        supportTicket.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restSupportTicketMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(supportTicket)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the SupportTicket in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteSupportTicket() throws Exception {
        // Initialize the database
        insertedSupportTicket = supportTicketRepository.saveAndFlush(supportTicket);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the supportTicket
        restSupportTicketMockMvc
            .perform(delete(ENTITY_API_URL_ID, supportTicket.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return supportTicketRepository.count();
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

    protected SupportTicket getPersistedSupportTicket(SupportTicket supportTicket) {
        return supportTicketRepository.findById(supportTicket.getId()).orElseThrow();
    }

    protected void assertPersistedSupportTicketToMatchAllProperties(SupportTicket expectedSupportTicket) {
        assertSupportTicketAllPropertiesEquals(expectedSupportTicket, getPersistedSupportTicket(expectedSupportTicket));
    }

    protected void assertPersistedSupportTicketToMatchUpdatableProperties(SupportTicket expectedSupportTicket) {
        assertSupportTicketAllUpdatablePropertiesEquals(expectedSupportTicket, getPersistedSupportTicket(expectedSupportTicket));
    }
}
