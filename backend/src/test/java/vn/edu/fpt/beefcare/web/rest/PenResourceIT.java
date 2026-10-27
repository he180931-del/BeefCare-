package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.PenAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.repository.PenRepository;

/**
 * Integration tests for the {@link PenResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class PenResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final Integer DEFAULT_CAPACITY = 1;
    private static final Integer UPDATED_CAPACITY = 2;

    private static final String DEFAULT_STATUS = "AAAAAAAAAA";
    private static final String UPDATED_STATUS = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/pens";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private PenRepository penRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restPenMockMvc;

    private Pen pen;

    private Pen insertedPen;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Pen createEntity(EntityManager em) {
        Pen pen = new Pen().code(DEFAULT_CODE).name(DEFAULT_NAME).capacity(DEFAULT_CAPACITY).status(DEFAULT_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        pen.setFarm(farm);
        return pen;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Pen createUpdatedEntity(EntityManager em) {
        Pen updatedPen = new Pen().code(UPDATED_CODE).name(UPDATED_NAME).capacity(UPDATED_CAPACITY).status(UPDATED_STATUS);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedPen.setFarm(farm);
        return updatedPen;
    }

    @BeforeEach
    void initTest() {
        pen = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedPen != null) {
            penRepository.delete(insertedPen);
            insertedPen = null;
        }
    }

    @Test
    @Transactional
    void createPen() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Pen
        var returnedPen = om.readValue(
            restPenMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Pen.class
        );

        // Validate the Pen in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertPenUpdatableFieldsEquals(returnedPen, getPersistedPen(returnedPen));

        insertedPen = returnedPen;
    }

    @Test
    @Transactional
    void createPenWithExistingId() throws Exception {
        // Create the Pen with an existing ID
        pen.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restPenMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pen.setCode(null);

        // Create the Pen, which fails.

        restPenMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pen.setName(null);

        // Create the Pen, which fails.

        restPenMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkCapacityIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pen.setCapacity(null);

        // Create the Pen, which fails.

        restPenMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStatusIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        pen.setStatus(null);

        // Create the Pen, which fails.

        restPenMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllPens() throws Exception {
        // Initialize the database
        insertedPen = penRepository.saveAndFlush(pen);

        // Get all the penList
        restPenMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(pen.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].capacity").value(hasItem(DEFAULT_CAPACITY)))
            .andExpect(jsonPath("$.[*].status").value(hasItem(DEFAULT_STATUS)));
    }

    @Test
    @Transactional
    void getPen() throws Exception {
        // Initialize the database
        insertedPen = penRepository.saveAndFlush(pen);

        // Get the pen
        restPenMockMvc
            .perform(get(ENTITY_API_URL_ID, pen.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(pen.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.capacity").value(DEFAULT_CAPACITY))
            .andExpect(jsonPath("$.status").value(DEFAULT_STATUS));
    }

    @Test
    @Transactional
    void getNonExistingPen() throws Exception {
        // Get the pen
        restPenMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingPen() throws Exception {
        // Initialize the database
        insertedPen = penRepository.saveAndFlush(pen);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pen
        Pen updatedPen = penRepository.findById(pen.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedPen are not directly saved in db
        em.detach(updatedPen);
        updatedPen.code(UPDATED_CODE).name(UPDATED_NAME).capacity(UPDATED_CAPACITY).status(UPDATED_STATUS);

        restPenMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedPen.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(updatedPen))
            )
            .andExpect(status().isOk());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedPenToMatchAllProperties(updatedPen);
    }

    @Test
    @Transactional
    void putNonExistingPen() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pen.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPenMockMvc
            .perform(put(ENTITY_API_URL_ID, pen.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchPen() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pen.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(pen))
            )
            .andExpect(status().isBadRequest());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamPen() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pen.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(pen)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdatePenWithPatch() throws Exception {
        // Initialize the database
        insertedPen = penRepository.saveAndFlush(pen);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pen using partial update
        Pen partialUpdatedPen = new Pen();
        partialUpdatedPen.setId(pen.getId());

        partialUpdatedPen.code(UPDATED_CODE).name(UPDATED_NAME);

        restPenMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPen.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPen))
            )
            .andExpect(status().isOk());

        // Validate the Pen in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPenUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedPen, pen), getPersistedPen(pen));
    }

    @Test
    @Transactional
    void fullUpdatePenWithPatch() throws Exception {
        // Initialize the database
        insertedPen = penRepository.saveAndFlush(pen);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the pen using partial update
        Pen partialUpdatedPen = new Pen();
        partialUpdatedPen.setId(pen.getId());

        partialUpdatedPen.code(UPDATED_CODE).name(UPDATED_NAME).capacity(UPDATED_CAPACITY).status(UPDATED_STATUS);

        restPenMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedPen.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedPen))
            )
            .andExpect(status().isOk());

        // Validate the Pen in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPenUpdatableFieldsEquals(partialUpdatedPen, getPersistedPen(partialUpdatedPen));
    }

    @Test
    @Transactional
    void patchNonExistingPen() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pen.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restPenMockMvc
            .perform(patch(ENTITY_API_URL_ID, pen.getId()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(pen)))
            .andExpect(status().isBadRequest());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchPen() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pen.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(pen))
            )
            .andExpect(status().isBadRequest());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamPen() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        pen.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restPenMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(pen)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Pen in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deletePen() throws Exception {
        // Initialize the database
        insertedPen = penRepository.saveAndFlush(pen);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the pen
        restPenMockMvc.perform(delete(ENTITY_API_URL_ID, pen.getId()).accept(MediaType.APPLICATION_JSON)).andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return penRepository.count();
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

    protected Pen getPersistedPen(Pen pen) {
        return penRepository.findById(pen.getId()).orElseThrow();
    }

    protected void assertPersistedPenToMatchAllProperties(Pen expectedPen) {
        assertPenAllPropertiesEquals(expectedPen, getPersistedPen(expectedPen));
    }

    protected void assertPersistedPenToMatchUpdatableProperties(Pen expectedPen) {
        assertPenAllUpdatablePropertiesEquals(expectedPen, getPersistedPen(expectedPen));
    }
}
