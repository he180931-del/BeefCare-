package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.InternalRequestAsserts.*;
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
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.InternalRequestRepository;

/**
 * Integration tests for the {@link InternalRequestResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class InternalRequestResourceIT {

    private static final String DEFAULT_TARGET_ROLE = "AAAAAAAAAA";
    private static final String UPDATED_TARGET_ROLE = "BBBBBBBBBB";

    private static final String DEFAULT_STATE = "AAAAAAAAAA";
    private static final String UPDATED_STATE = "BBBBBBBBBB";

    private static final String DEFAULT_OUTCOME = "AAAAAAAAAA";
    private static final String UPDATED_OUTCOME = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/internal-requests";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private InternalRequestRepository internalRequestRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restInternalRequestMockMvc;

    private InternalRequest internalRequest;

    private InternalRequest insertedInternalRequest;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static InternalRequest createEntity(EntityManager em) {
        InternalRequest internalRequest = new InternalRequest()
            .targetRole(DEFAULT_TARGET_ROLE)
            .state(DEFAULT_STATE)
            .outcome(DEFAULT_OUTCOME);
        // Add required entity
        SupportTicket supportTicket;
        if (TestUtil.findAll(em, SupportTicket.class).isEmpty()) {
            supportTicket = SupportTicketResourceIT.createEntity(em);
            em.persist(supportTicket);
            em.flush();
        } else {
            supportTicket = TestUtil.findAll(em, SupportTicket.class).get(0);
        }
        internalRequest.setTicket(supportTicket);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        internalRequest.setRecipient(appUser);
        return internalRequest;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static InternalRequest createUpdatedEntity(EntityManager em) {
        InternalRequest updatedInternalRequest = new InternalRequest()
            .targetRole(UPDATED_TARGET_ROLE)
            .state(UPDATED_STATE)
            .outcome(UPDATED_OUTCOME);
        // Add required entity
        SupportTicket supportTicket;
        if (TestUtil.findAll(em, SupportTicket.class).isEmpty()) {
            supportTicket = SupportTicketResourceIT.createUpdatedEntity(em);
            em.persist(supportTicket);
            em.flush();
        } else {
            supportTicket = TestUtil.findAll(em, SupportTicket.class).get(0);
        }
        updatedInternalRequest.setTicket(supportTicket);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedInternalRequest.setRecipient(appUser);
        return updatedInternalRequest;
    }

    @BeforeEach
    void initTest() {
        internalRequest = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedInternalRequest != null) {
            internalRequestRepository.delete(insertedInternalRequest);
            insertedInternalRequest = null;
        }
    }

    @Test
    @Transactional
    void createInternalRequest() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the InternalRequest
        var returnedInternalRequest = om.readValue(
            restInternalRequestMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(internalRequest)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            InternalRequest.class
        );

        // Validate the InternalRequest in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertInternalRequestUpdatableFieldsEquals(returnedInternalRequest, getPersistedInternalRequest(returnedInternalRequest));

        insertedInternalRequest = returnedInternalRequest;
    }

    @Test
    @Transactional
    void createInternalRequestWithExistingId() throws Exception {
        // Create the InternalRequest with an existing ID
        internalRequest.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restInternalRequestMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(internalRequest)))
            .andExpect(status().isBadRequest());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTargetRoleIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        internalRequest.setTargetRole(null);

        // Create the InternalRequest, which fails.

        restInternalRequestMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(internalRequest)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        internalRequest.setState(null);

        // Create the InternalRequest, which fails.

        restInternalRequestMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(internalRequest)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllInternalRequests() throws Exception {
        // Initialize the database
        insertedInternalRequest = internalRequestRepository.saveAndFlush(internalRequest);

        // Get all the internalRequestList
        restInternalRequestMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(internalRequest.getId().intValue())))
            .andExpect(jsonPath("$.[*].targetRole").value(hasItem(DEFAULT_TARGET_ROLE)))
            .andExpect(jsonPath("$.[*].state").value(hasItem(DEFAULT_STATE)))
            .andExpect(jsonPath("$.[*].outcome").value(hasItem(DEFAULT_OUTCOME)));
    }

    @Test
    @Transactional
    void getInternalRequest() throws Exception {
        // Initialize the database
        insertedInternalRequest = internalRequestRepository.saveAndFlush(internalRequest);

        // Get the internalRequest
        restInternalRequestMockMvc
            .perform(get(ENTITY_API_URL_ID, internalRequest.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(internalRequest.getId().intValue()))
            .andExpect(jsonPath("$.targetRole").value(DEFAULT_TARGET_ROLE))
            .andExpect(jsonPath("$.state").value(DEFAULT_STATE))
            .andExpect(jsonPath("$.outcome").value(DEFAULT_OUTCOME));
    }

    @Test
    @Transactional
    void getNonExistingInternalRequest() throws Exception {
        // Get the internalRequest
        restInternalRequestMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingInternalRequest() throws Exception {
        // Initialize the database
        insertedInternalRequest = internalRequestRepository.saveAndFlush(internalRequest);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the internalRequest
        InternalRequest updatedInternalRequest = internalRequestRepository.findById(internalRequest.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedInternalRequest are not directly saved in db
        em.detach(updatedInternalRequest);
        updatedInternalRequest.targetRole(UPDATED_TARGET_ROLE).state(UPDATED_STATE).outcome(UPDATED_OUTCOME);

        restInternalRequestMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedInternalRequest.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedInternalRequest))
            )
            .andExpect(status().isOk());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedInternalRequestToMatchAllProperties(updatedInternalRequest);
    }

    @Test
    @Transactional
    void putNonExistingInternalRequest() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        internalRequest.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restInternalRequestMockMvc
            .perform(
                put(ENTITY_API_URL_ID, internalRequest.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(internalRequest))
            )
            .andExpect(status().isBadRequest());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchInternalRequest() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        internalRequest.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restInternalRequestMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(internalRequest))
            )
            .andExpect(status().isBadRequest());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamInternalRequest() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        internalRequest.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restInternalRequestMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(internalRequest)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateInternalRequestWithPatch() throws Exception {
        // Initialize the database
        insertedInternalRequest = internalRequestRepository.saveAndFlush(internalRequest);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the internalRequest using partial update
        InternalRequest partialUpdatedInternalRequest = new InternalRequest();
        partialUpdatedInternalRequest.setId(internalRequest.getId());

        partialUpdatedInternalRequest.outcome(UPDATED_OUTCOME);

        restInternalRequestMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedInternalRequest.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedInternalRequest))
            )
            .andExpect(status().isOk());

        // Validate the InternalRequest in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertInternalRequestUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedInternalRequest, internalRequest),
            getPersistedInternalRequest(internalRequest)
        );
    }

    @Test
    @Transactional
    void fullUpdateInternalRequestWithPatch() throws Exception {
        // Initialize the database
        insertedInternalRequest = internalRequestRepository.saveAndFlush(internalRequest);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the internalRequest using partial update
        InternalRequest partialUpdatedInternalRequest = new InternalRequest();
        partialUpdatedInternalRequest.setId(internalRequest.getId());

        partialUpdatedInternalRequest.targetRole(UPDATED_TARGET_ROLE).state(UPDATED_STATE).outcome(UPDATED_OUTCOME);

        restInternalRequestMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedInternalRequest.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedInternalRequest))
            )
            .andExpect(status().isOk());

        // Validate the InternalRequest in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertInternalRequestUpdatableFieldsEquals(
            partialUpdatedInternalRequest,
            getPersistedInternalRequest(partialUpdatedInternalRequest)
        );
    }

    @Test
    @Transactional
    void patchNonExistingInternalRequest() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        internalRequest.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restInternalRequestMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, internalRequest.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(internalRequest))
            )
            .andExpect(status().isBadRequest());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchInternalRequest() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        internalRequest.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restInternalRequestMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(internalRequest))
            )
            .andExpect(status().isBadRequest());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamInternalRequest() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        internalRequest.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restInternalRequestMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(internalRequest)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the InternalRequest in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteInternalRequest() throws Exception {
        // Initialize the database
        insertedInternalRequest = internalRequestRepository.saveAndFlush(internalRequest);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the internalRequest
        restInternalRequestMockMvc
            .perform(delete(ENTITY_API_URL_ID, internalRequest.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return internalRequestRepository.count();
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

    protected InternalRequest getPersistedInternalRequest(InternalRequest internalRequest) {
        return internalRequestRepository.findById(internalRequest.getId()).orElseThrow();
    }

    protected void assertPersistedInternalRequestToMatchAllProperties(InternalRequest expectedInternalRequest) {
        assertInternalRequestAllPropertiesEquals(expectedInternalRequest, getPersistedInternalRequest(expectedInternalRequest));
    }

    protected void assertPersistedInternalRequestToMatchUpdatableProperties(InternalRequest expectedInternalRequest) {
        assertInternalRequestAllUpdatablePropertiesEquals(expectedInternalRequest, getPersistedInternalRequest(expectedInternalRequest));
    }
}
