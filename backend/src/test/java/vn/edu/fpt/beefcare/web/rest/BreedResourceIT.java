package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.BreedAsserts.*;
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
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.repository.BreedRepository;

/**
 * Integration tests for the {@link BreedResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class BreedResourceIT {

    private static final String DEFAULT_CODE = "AAAAAAAAAA";
    private static final String UPDATED_CODE = "BBBBBBBBBB";

    private static final String DEFAULT_NAME = "AAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBB";

    private static final String DEFAULT_DESCRIPTION = "AAAAAAAAAA";
    private static final String UPDATED_DESCRIPTION = "BBBBBBBBBB";

    private static final Boolean DEFAULT_AVAILABLE = false;
    private static final Boolean UPDATED_AVAILABLE = true;

    private static final String ENTITY_API_URL = "/api/breeds";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private BreedRepository breedRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restBreedMockMvc;

    private Breed breed;

    private Breed insertedBreed;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Breed createEntity(EntityManager em) {
        Breed breed = new Breed().code(DEFAULT_CODE).name(DEFAULT_NAME).description(DEFAULT_DESCRIPTION).available(DEFAULT_AVAILABLE);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        breed.setFarm(farm);
        return breed;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static Breed createUpdatedEntity(EntityManager em) {
        Breed updatedBreed = new Breed()
            .code(UPDATED_CODE)
            .name(UPDATED_NAME)
            .description(UPDATED_DESCRIPTION)
            .available(UPDATED_AVAILABLE);
        // Add required entity
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createUpdatedEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        updatedBreed.setFarm(farm);
        return updatedBreed;
    }

    @BeforeEach
    void initTest() {
        breed = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedBreed != null) {
            breedRepository.delete(insertedBreed);
            insertedBreed = null;
        }
    }

    @Test
    @Transactional
    void createBreed() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the Breed
        var returnedBreed = om.readValue(
            restBreedMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            Breed.class
        );

        // Validate the Breed in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertBreedUpdatableFieldsEquals(returnedBreed, getPersistedBreed(returnedBreed));

        insertedBreed = returnedBreed;
    }

    @Test
    @Transactional
    void createBreedWithExistingId() throws Exception {
        // Create the Breed with an existing ID
        breed.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restBreedMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
            .andExpect(status().isBadRequest());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkCodeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        breed.setCode(null);

        // Create the Breed, which fails.

        restBreedMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkNameIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        breed.setName(null);

        // Create the Breed, which fails.

        restBreedMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAvailableIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        breed.setAvailable(null);

        // Create the Breed, which fails.

        restBreedMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllBreeds() throws Exception {
        // Initialize the database
        insertedBreed = breedRepository.saveAndFlush(breed);

        // Get all the breedList
        restBreedMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(breed.getId().intValue())))
            .andExpect(jsonPath("$.[*].code").value(hasItem(DEFAULT_CODE)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME)))
            .andExpect(jsonPath("$.[*].description").value(hasItem(DEFAULT_DESCRIPTION)))
            .andExpect(jsonPath("$.[*].available").value(hasItem(DEFAULT_AVAILABLE)));
    }

    @Test
    @Transactional
    void getBreed() throws Exception {
        // Initialize the database
        insertedBreed = breedRepository.saveAndFlush(breed);

        // Get the breed
        restBreedMockMvc
            .perform(get(ENTITY_API_URL_ID, breed.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(breed.getId().intValue()))
            .andExpect(jsonPath("$.code").value(DEFAULT_CODE))
            .andExpect(jsonPath("$.name").value(DEFAULT_NAME))
            .andExpect(jsonPath("$.description").value(DEFAULT_DESCRIPTION))
            .andExpect(jsonPath("$.available").value(DEFAULT_AVAILABLE));
    }

    @Test
    @Transactional
    void getNonExistingBreed() throws Exception {
        // Get the breed
        restBreedMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingBreed() throws Exception {
        // Initialize the database
        insertedBreed = breedRepository.saveAndFlush(breed);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the breed
        Breed updatedBreed = breedRepository.findById(breed.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedBreed are not directly saved in db
        em.detach(updatedBreed);
        updatedBreed.code(UPDATED_CODE).name(UPDATED_NAME).description(UPDATED_DESCRIPTION).available(UPDATED_AVAILABLE);

        restBreedMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedBreed.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedBreed))
            )
            .andExpect(status().isOk());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedBreedToMatchAllProperties(updatedBreed);
    }

    @Test
    @Transactional
    void putNonExistingBreed() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        breed.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restBreedMockMvc
            .perform(put(ENTITY_API_URL_ID, breed.getId()).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
            .andExpect(status().isBadRequest());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchBreed() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        breed.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBreedMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(breed))
            )
            .andExpect(status().isBadRequest());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamBreed() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        breed.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBreedMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(breed)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateBreedWithPatch() throws Exception {
        // Initialize the database
        insertedBreed = breedRepository.saveAndFlush(breed);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the breed using partial update
        Breed partialUpdatedBreed = new Breed();
        partialUpdatedBreed.setId(breed.getId());

        partialUpdatedBreed.description(UPDATED_DESCRIPTION).available(UPDATED_AVAILABLE);

        restBreedMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedBreed.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedBreed))
            )
            .andExpect(status().isOk());

        // Validate the Breed in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertBreedUpdatableFieldsEquals(createUpdateProxyForBean(partialUpdatedBreed, breed), getPersistedBreed(breed));
    }

    @Test
    @Transactional
    void fullUpdateBreedWithPatch() throws Exception {
        // Initialize the database
        insertedBreed = breedRepository.saveAndFlush(breed);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the breed using partial update
        Breed partialUpdatedBreed = new Breed();
        partialUpdatedBreed.setId(breed.getId());

        partialUpdatedBreed.code(UPDATED_CODE).name(UPDATED_NAME).description(UPDATED_DESCRIPTION).available(UPDATED_AVAILABLE);

        restBreedMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedBreed.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedBreed))
            )
            .andExpect(status().isOk());

        // Validate the Breed in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertBreedUpdatableFieldsEquals(partialUpdatedBreed, getPersistedBreed(partialUpdatedBreed));
    }

    @Test
    @Transactional
    void patchNonExistingBreed() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        breed.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restBreedMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, breed.getId()).contentType("application/merge-patch+json").content(om.writeValueAsBytes(breed))
            )
            .andExpect(status().isBadRequest());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchBreed() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        breed.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBreedMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(breed))
            )
            .andExpect(status().isBadRequest());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamBreed() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        breed.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBreedMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(breed)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the Breed in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteBreed() throws Exception {
        // Initialize the database
        insertedBreed = breedRepository.saveAndFlush(breed);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the breed
        restBreedMockMvc
            .perform(delete(ENTITY_API_URL_ID, breed.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return breedRepository.count();
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

    protected Breed getPersistedBreed(Breed breed) {
        return breedRepository.findById(breed.getId()).orElseThrow();
    }

    protected void assertPersistedBreedToMatchAllProperties(Breed expectedBreed) {
        assertBreedAllPropertiesEquals(expectedBreed, getPersistedBreed(expectedBreed));
    }

    protected void assertPersistedBreedToMatchUpdatableProperties(Breed expectedBreed) {
        assertBreedAllUpdatablePropertiesEquals(expectedBreed, getPersistedBreed(expectedBreed));
    }
}
