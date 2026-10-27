package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.ManualFinanceRecordAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.sameNumber;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
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
import vn.edu.fpt.beefcare.domain.ManualFinanceRecord;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;

/**
 * Integration tests for the {@link ManualFinanceRecordResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class ManualFinanceRecordResourceIT {

    private static final String DEFAULT_TYPE = "AAAAAAAAAA";
    private static final String UPDATED_TYPE = "BBBBBBBBBB";

    private static final String DEFAULT_CATEGORY = "AAAAAAAAAA";
    private static final String UPDATED_CATEGORY = "BBBBBBBBBB";

    private static final BigDecimal DEFAULT_AMOUNT_VND = new BigDecimal(1);
    private static final BigDecimal UPDATED_AMOUNT_VND = new BigDecimal(2);

    private static final LocalDate DEFAULT_OCCURRED_ON = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_OCCURRED_ON = LocalDate.now(ZoneId.systemDefault());

    private static final String DEFAULT_STATE = "AAAAAAAAAA";
    private static final String UPDATED_STATE = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/manual-finance-records";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private ManualFinanceRecordRepository manualFinanceRecordRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restManualFinanceRecordMockMvc;

    private ManualFinanceRecord manualFinanceRecord;

    private ManualFinanceRecord insertedManualFinanceRecord;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ManualFinanceRecord createEntity() {
        return new ManualFinanceRecord()
            .type(DEFAULT_TYPE)
            .category(DEFAULT_CATEGORY)
            .amountVnd(DEFAULT_AMOUNT_VND)
            .occurredOn(DEFAULT_OCCURRED_ON)
            .state(DEFAULT_STATE);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static ManualFinanceRecord createUpdatedEntity() {
        return new ManualFinanceRecord()
            .type(UPDATED_TYPE)
            .category(UPDATED_CATEGORY)
            .amountVnd(UPDATED_AMOUNT_VND)
            .occurredOn(UPDATED_OCCURRED_ON)
            .state(UPDATED_STATE);
    }

    @BeforeEach
    void initTest() {
        manualFinanceRecord = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedManualFinanceRecord != null) {
            manualFinanceRecordRepository.delete(insertedManualFinanceRecord);
            insertedManualFinanceRecord = null;
        }
    }

    @Test
    @Transactional
    void createManualFinanceRecord() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the ManualFinanceRecord
        var returnedManualFinanceRecord = om.readValue(
            restManualFinanceRecordMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            ManualFinanceRecord.class
        );

        // Validate the ManualFinanceRecord in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertManualFinanceRecordUpdatableFieldsEquals(
            returnedManualFinanceRecord,
            getPersistedManualFinanceRecord(returnedManualFinanceRecord)
        );

        insertedManualFinanceRecord = returnedManualFinanceRecord;
    }

    @Test
    @Transactional
    void createManualFinanceRecordWithExistingId() throws Exception {
        // Create the ManualFinanceRecord with an existing ID
        manualFinanceRecord.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restManualFinanceRecordMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isBadRequest());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkTypeIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        manualFinanceRecord.setType(null);

        // Create the ManualFinanceRecord, which fails.

        restManualFinanceRecordMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkCategoryIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        manualFinanceRecord.setCategory(null);

        // Create the ManualFinanceRecord, which fails.

        restManualFinanceRecordMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAmountVndIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        manualFinanceRecord.setAmountVnd(null);

        // Create the ManualFinanceRecord, which fails.

        restManualFinanceRecordMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkOccurredOnIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        manualFinanceRecord.setOccurredOn(null);

        // Create the ManualFinanceRecord, which fails.

        restManualFinanceRecordMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkStateIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        manualFinanceRecord.setState(null);

        // Create the ManualFinanceRecord, which fails.

        restManualFinanceRecordMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllManualFinanceRecords() throws Exception {
        // Initialize the database
        insertedManualFinanceRecord = manualFinanceRecordRepository.saveAndFlush(manualFinanceRecord);

        // Get all the manualFinanceRecordList
        restManualFinanceRecordMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(manualFinanceRecord.getId().intValue())))
            .andExpect(jsonPath("$.[*].type").value(hasItem(DEFAULT_TYPE)))
            .andExpect(jsonPath("$.[*].category").value(hasItem(DEFAULT_CATEGORY)))
            .andExpect(jsonPath("$.[*].amountVnd").value(hasItem(sameNumber(DEFAULT_AMOUNT_VND))))
            .andExpect(jsonPath("$.[*].occurredOn").value(hasItem(DEFAULT_OCCURRED_ON.toString())))
            .andExpect(jsonPath("$.[*].state").value(hasItem(DEFAULT_STATE)));
    }

    @Test
    @Transactional
    void getManualFinanceRecord() throws Exception {
        // Initialize the database
        insertedManualFinanceRecord = manualFinanceRecordRepository.saveAndFlush(manualFinanceRecord);

        // Get the manualFinanceRecord
        restManualFinanceRecordMockMvc
            .perform(get(ENTITY_API_URL_ID, manualFinanceRecord.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(manualFinanceRecord.getId().intValue()))
            .andExpect(jsonPath("$.type").value(DEFAULT_TYPE))
            .andExpect(jsonPath("$.category").value(DEFAULT_CATEGORY))
            .andExpect(jsonPath("$.amountVnd").value(sameNumber(DEFAULT_AMOUNT_VND)))
            .andExpect(jsonPath("$.occurredOn").value(DEFAULT_OCCURRED_ON.toString()))
            .andExpect(jsonPath("$.state").value(DEFAULT_STATE));
    }

    @Test
    @Transactional
    void getNonExistingManualFinanceRecord() throws Exception {
        // Get the manualFinanceRecord
        restManualFinanceRecordMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingManualFinanceRecord() throws Exception {
        // Initialize the database
        insertedManualFinanceRecord = manualFinanceRecordRepository.saveAndFlush(manualFinanceRecord);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the manualFinanceRecord
        ManualFinanceRecord updatedManualFinanceRecord = manualFinanceRecordRepository.findById(manualFinanceRecord.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedManualFinanceRecord are not directly saved in db
        em.detach(updatedManualFinanceRecord);
        updatedManualFinanceRecord
            .type(UPDATED_TYPE)
            .category(UPDATED_CATEGORY)
            .amountVnd(UPDATED_AMOUNT_VND)
            .occurredOn(UPDATED_OCCURRED_ON)
            .state(UPDATED_STATE);

        restManualFinanceRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedManualFinanceRecord.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedManualFinanceRecord))
            )
            .andExpect(status().isOk());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedManualFinanceRecordToMatchAllProperties(updatedManualFinanceRecord);
    }

    @Test
    @Transactional
    void putNonExistingManualFinanceRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        manualFinanceRecord.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restManualFinanceRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, manualFinanceRecord.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(manualFinanceRecord))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchManualFinanceRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        manualFinanceRecord.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManualFinanceRecordMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(manualFinanceRecord))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamManualFinanceRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        manualFinanceRecord.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManualFinanceRecordMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateManualFinanceRecordWithPatch() throws Exception {
        // Initialize the database
        insertedManualFinanceRecord = manualFinanceRecordRepository.saveAndFlush(manualFinanceRecord);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the manualFinanceRecord using partial update
        ManualFinanceRecord partialUpdatedManualFinanceRecord = new ManualFinanceRecord();
        partialUpdatedManualFinanceRecord.setId(manualFinanceRecord.getId());

        partialUpdatedManualFinanceRecord
            .type(UPDATED_TYPE)
            .category(UPDATED_CATEGORY)
            .occurredOn(UPDATED_OCCURRED_ON)
            .state(UPDATED_STATE);

        restManualFinanceRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedManualFinanceRecord.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedManualFinanceRecord))
            )
            .andExpect(status().isOk());

        // Validate the ManualFinanceRecord in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertManualFinanceRecordUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedManualFinanceRecord, manualFinanceRecord),
            getPersistedManualFinanceRecord(manualFinanceRecord)
        );
    }

    @Test
    @Transactional
    void fullUpdateManualFinanceRecordWithPatch() throws Exception {
        // Initialize the database
        insertedManualFinanceRecord = manualFinanceRecordRepository.saveAndFlush(manualFinanceRecord);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the manualFinanceRecord using partial update
        ManualFinanceRecord partialUpdatedManualFinanceRecord = new ManualFinanceRecord();
        partialUpdatedManualFinanceRecord.setId(manualFinanceRecord.getId());

        partialUpdatedManualFinanceRecord
            .type(UPDATED_TYPE)
            .category(UPDATED_CATEGORY)
            .amountVnd(UPDATED_AMOUNT_VND)
            .occurredOn(UPDATED_OCCURRED_ON)
            .state(UPDATED_STATE);

        restManualFinanceRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedManualFinanceRecord.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedManualFinanceRecord))
            )
            .andExpect(status().isOk());

        // Validate the ManualFinanceRecord in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertManualFinanceRecordUpdatableFieldsEquals(
            partialUpdatedManualFinanceRecord,
            getPersistedManualFinanceRecord(partialUpdatedManualFinanceRecord)
        );
    }

    @Test
    @Transactional
    void patchNonExistingManualFinanceRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        manualFinanceRecord.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restManualFinanceRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, manualFinanceRecord.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(manualFinanceRecord))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchManualFinanceRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        manualFinanceRecord.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManualFinanceRecordMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(manualFinanceRecord))
            )
            .andExpect(status().isBadRequest());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamManualFinanceRecord() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        manualFinanceRecord.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restManualFinanceRecordMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(manualFinanceRecord)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the ManualFinanceRecord in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteManualFinanceRecord() throws Exception {
        // Initialize the database
        insertedManualFinanceRecord = manualFinanceRecordRepository.saveAndFlush(manualFinanceRecord);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the manualFinanceRecord
        restManualFinanceRecordMockMvc
            .perform(delete(ENTITY_API_URL_ID, manualFinanceRecord.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return manualFinanceRecordRepository.count();
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

    protected ManualFinanceRecord getPersistedManualFinanceRecord(ManualFinanceRecord manualFinanceRecord) {
        return manualFinanceRecordRepository.findById(manualFinanceRecord.getId()).orElseThrow();
    }

    protected void assertPersistedManualFinanceRecordToMatchAllProperties(ManualFinanceRecord expectedManualFinanceRecord) {
        assertManualFinanceRecordAllPropertiesEquals(
            expectedManualFinanceRecord,
            getPersistedManualFinanceRecord(expectedManualFinanceRecord)
        );
    }

    protected void assertPersistedManualFinanceRecordToMatchUpdatableProperties(ManualFinanceRecord expectedManualFinanceRecord) {
        assertManualFinanceRecordAllUpdatablePropertiesEquals(
            expectedManualFinanceRecord,
            getPersistedManualFinanceRecord(expectedManualFinanceRecord)
        );
    }
}
