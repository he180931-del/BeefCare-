package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.TicketMessageAsserts.*;
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
import vn.edu.fpt.beefcare.domain.TicketMessage;
import vn.edu.fpt.beefcare.repository.TicketMessageRepository;

/**
 * Integration tests for the {@link TicketMessageResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class TicketMessageResourceIT {

    private static final String DEFAULT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_TYPE = "BBBBBBBBBB";

    private static final String DEFAULT_AUDIENCE = "AAAAAAAAAA";
    private static final String UPDATED_AUDIENCE = "BBBBBBBBBB";

    private static final String DEFAULT_CONTENT = "AAAAAAAAAA";
    private static final String UPDATED_CONTENT = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/ticket-messages";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private TicketMessageRepository ticketMessageRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restTicketMessageMockMvc;

    private TicketMessage ticketMessage;

    private TicketMessage insertedTicketMessage;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static TicketMessage createEntity(EntityManager em) {
        TicketMessage ticketMessage = new TicketMessage().type(DEFAULT_TYPE).audience(DEFAULT_AUDIENCE).content(DEFAULT_CONTENT);
        // Add required entity
        SupportTicket supportTicket;
        if (TestUtil.findAll(em, SupportTicket.class).isEmpty()) {
            supportTicket = SupportTicketResourceIT.createEntity(em);
            em.persist(supportTicket);
            em.flush();
        } else {
            supportTicket = TestUtil.findAll(em, SupportTicket.class).get(0);
        }
        ticketMessage.setTicket(supportTicket);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        ticketMessage.setAuthor(appUser);
        return ticketMessage;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static TicketMessage createUpdatedEntity(EntityManager em) {
        TicketMessage updatedTicketMessage = new TicketMessage().type(UPDATED_TYPE).audience(UPDATED_AUDIENCE).content(UPDATED_CONTENT);
        // Add required entity
        SupportTicket supportTicket;
        if (TestUtil.findAll(em, SupportTicket.class).isEmpty()) {
            supportTicket = SupportTicketResourceIT.createUpdatedEntity(em);
            em.persist(supportTicket);
            em.flush();
        } else {
            supportTicket = TestUtil.findAll(em, SupportTicket.class).get(0);
        }
        updatedTicketMessage.setTicket(supportTicket);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedTicketMessage.setAuthor(appUser);
        return updatedTicketMessage;
    }

    @BeforeEach
    void initTest() {
        ticketMessage = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedTicketMessage != null) {
            ticketMessageRepository.delete(insertedTicketMessage);
            insertedTicketMessage = null;
        }
    }

    @Test
    @Transactional
    void createTicketMessage() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the TicketMessage
        var returnedTicketMessage = om.readValue(
            restTicketMessageMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(ticketMessage)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            TicketMessage.class
        );

        // Validate the TicketMessage in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertTicketMessageUpdatableFieldsEquals(returnedTicketMessage, getPersistedTicketMessage(returnedTicketMessage));

        insertedTicketMessage = returnedTicketMessage;
    }

    @Test
    @Transactional
    void createTicketMessageWithExistingId() throws Exception {
        // Create the TicketMessage with an existing ID
        ticketMessage.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restTicketMessageMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(ticketMessage)))
            .andExpect(status().isBadRequest());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        ticketMessage.setType(null);

        // Create the TicketMessage, which fails.

        restTicketMessageMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(ticketMessage)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAudienceIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        ticketMessage.setAudience(null);

        // Create the TicketMessage, which fails.

        restTicketMessageMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(ticketMessage)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllTicketMessages() throws Exception {
        // Initialize the database
        insertedTicketMessage = ticketMessageRepository.saveAndFlush(ticketMessage);

        // Get all the ticketMessageList
        restTicketMessageMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(ticketMessage.getId().intValue())))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE)))
            .andExpect(jsonPath("$.[*].audience").value(hasItem(DEFAULT_AUDIENCE)))
            .andExpect(jsonPath("$.[*].content").value(hasItem(DEFAULT_CONTENT)));
    }

    @Test
    @Transactional
    void getTicketMessage() throws Exception {
        // Initialize the database
        insertedTicketMessage = ticketMessageRepository.saveAndFlush(ticketMessage);

        // Get the ticketMessage
        restTicketMessageMockMvc
            .perform(get(ENTITY_API_URL_ID, ticketMessage.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(ticketMessage.getId().intValue()))
            .andExpect(jsonPath("$.type").value(DEFAULT_TYPE))
            .andExpect(jsonPath("$.audience").value(DEFAULT_AUDIENCE))
            .andExpect(jsonPath("$.content").value(DEFAULT_CONTENT));
    }

    @Test
    @Transactional
    void getNonExistingTicketMessage() throws Exception {
        // Get the ticketMessage
        restTicketMessageMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingTicketMessage() throws Exception {
        // Initialize the database
        insertedTicketMessage = ticketMessageRepository.saveAndFlush(ticketMessage);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the ticketMessage
        TicketMessage updatedTicketMessage = ticketMessageRepository.findById(ticketMessage.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedTicketMessage are not directly saved in db
        em.detach(updatedTicketMessage);
        updatedTicketMessage.type(UPDATED_TYPE).audience(UPDATED_AUDIENCE).content(UPDATED_CONTENT);

        restTicketMessageMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedTicketMessage.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedTicketMessage))
            )
            .andExpect(status().isOk());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedTicketMessageToMatchAllProperties(updatedTicketMessage);
    }

    @Test
    @Transactional
    void putNonExistingTicketMessage() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        ticketMessage.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restTicketMessageMockMvc
            .perform(
                put(ENTITY_API_URL_ID, ticketMessage.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(ticketMessage))
            )
            .andExpect(status().isBadRequest());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchTicketMessage() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        ticketMessage.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTicketMessageMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(ticketMessage))
            )
            .andExpect(status().isBadRequest());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamTicketMessage() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        ticketMessage.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTicketMessageMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(ticketMessage)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateTicketMessageWithPatch() throws Exception {
        // Initialize the database
        insertedTicketMessage = ticketMessageRepository.saveAndFlush(ticketMessage);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the ticketMessage using partial update
        TicketMessage partialUpdatedTicketMessage = new TicketMessage();
        partialUpdatedTicketMessage.setId(ticketMessage.getId());

        partialUpdatedTicketMessage.type(UPDATED_TYPE).audience(UPDATED_AUDIENCE).content(UPDATED_CONTENT);

        restTicketMessageMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedTicketMessage.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedTicketMessage))
            )
            .andExpect(status().isOk());

        // Validate the TicketMessage in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertTicketMessageUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedTicketMessage, ticketMessage),
            getPersistedTicketMessage(ticketMessage)
        );
    }

    @Test
    @Transactional
    void fullUpdateTicketMessageWithPatch() throws Exception {
        // Initialize the database
        insertedTicketMessage = ticketMessageRepository.saveAndFlush(ticketMessage);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the ticketMessage using partial update
        TicketMessage partialUpdatedTicketMessage = new TicketMessage();
        partialUpdatedTicketMessage.setId(ticketMessage.getId());

        partialUpdatedTicketMessage.type(UPDATED_TYPE).audience(UPDATED_AUDIENCE).content(UPDATED_CONTENT);

        restTicketMessageMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedTicketMessage.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedTicketMessage))
            )
            .andExpect(status().isOk());

        // Validate the TicketMessage in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertTicketMessageUpdatableFieldsEquals(partialUpdatedTicketMessage, getPersistedTicketMessage(partialUpdatedTicketMessage));
    }

    @Test
    @Transactional
    void patchNonExistingTicketMessage() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        ticketMessage.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restTicketMessageMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, ticketMessage.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(ticketMessage))
            )
            .andExpect(status().isBadRequest());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchTicketMessage() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        ticketMessage.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTicketMessageMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(ticketMessage))
            )
            .andExpect(status().isBadRequest());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamTicketMessage() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        ticketMessage.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restTicketMessageMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(ticketMessage)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the TicketMessage in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteTicketMessage() throws Exception {
        // Initialize the database
        insertedTicketMessage = ticketMessageRepository.saveAndFlush(ticketMessage);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the ticketMessage
        restTicketMessageMockMvc
            .perform(delete(ENTITY_API_URL_ID, ticketMessage.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return ticketMessageRepository.count();
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

    protected TicketMessage getPersistedTicketMessage(TicketMessage ticketMessage) {
        return ticketMessageRepository.findById(ticketMessage.getId()).orElseThrow();
    }

    protected void assertPersistedTicketMessageToMatchAllProperties(TicketMessage expectedTicketMessage) {
        assertTicketMessageAllPropertiesEquals(expectedTicketMessage, getPersistedTicketMessage(expectedTicketMessage));
    }

    protected void assertPersistedTicketMessageToMatchUpdatableProperties(TicketMessage expectedTicketMessage) {
        assertTicketMessageAllUpdatablePropertiesEquals(expectedTicketMessage, getPersistedTicketMessage(expectedTicketMessage));
    }
}
