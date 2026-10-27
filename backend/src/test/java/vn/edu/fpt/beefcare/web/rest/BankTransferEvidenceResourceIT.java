package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.BankTransferEvidenceAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.sameNumber;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;

/**
 * Integration tests for the {@link BankTransferEvidenceResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class BankTransferEvidenceResourceIT {

    private static final Long DEFAULT_PROVIDER_TXN_ID = 1L;
    private static final Long UPDATED_PROVIDER_TXN_ID = 2L;

    private static final BigDecimal DEFAULT_AMOUNT = new BigDecimal(1);
    private static final BigDecimal UPDATED_AMOUNT = new BigDecimal(2);

    private static final Instant DEFAULT_BANK_PAID_AT = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_BANK_PAID_AT = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final String DEFAULT_QUOTE_REF = "AAAAAAAAAA";
    private static final String UPDATED_QUOTE_REF = "BBBBBBBBBB";

    private static final String DEFAULT_DELIVERY_OUTCOME = "AAAAAAAAAA";
    private static final String UPDATED_DELIVERY_OUTCOME = "BBBBBBBBBB";

    private static final String DEFAULT_AUTH_OUTCOME = "AAAAAAAAAA";
    private static final String UPDATED_AUTH_OUTCOME = "BBBBBBBBBB";

    private static final String ENTITY_API_URL = "/api/bank-transfer-evidences";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private BankTransferEvidenceRepository bankTransferEvidenceRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restBankTransferEvidenceMockMvc;

    private BankTransferEvidence bankTransferEvidence;

    private BankTransferEvidence insertedBankTransferEvidence;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static BankTransferEvidence createEntity() {
        return new BankTransferEvidence()
            .providerTxnId(DEFAULT_PROVIDER_TXN_ID)
            .amount(DEFAULT_AMOUNT)
            .bankPaidAt(DEFAULT_BANK_PAID_AT)
            .quoteRef(DEFAULT_QUOTE_REF)
            .deliveryOutcome(DEFAULT_DELIVERY_OUTCOME)
            .authOutcome(DEFAULT_AUTH_OUTCOME);
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static BankTransferEvidence createUpdatedEntity() {
        return new BankTransferEvidence()
            .providerTxnId(UPDATED_PROVIDER_TXN_ID)
            .amount(UPDATED_AMOUNT)
            .bankPaidAt(UPDATED_BANK_PAID_AT)
            .quoteRef(UPDATED_QUOTE_REF)
            .deliveryOutcome(UPDATED_DELIVERY_OUTCOME)
            .authOutcome(UPDATED_AUTH_OUTCOME);
    }

    @BeforeEach
    void initTest() {
        bankTransferEvidence = createEntity();
    }

    @AfterEach
    void cleanup() {
        if (insertedBankTransferEvidence != null) {
            bankTransferEvidenceRepository.delete(insertedBankTransferEvidence);
            insertedBankTransferEvidence = null;
        }
    }

    @Test
    @Transactional
    void createBankTransferEvidence() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the BankTransferEvidence
        var returnedBankTransferEvidence = om.readValue(
            restBankTransferEvidenceMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(bankTransferEvidence)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            BankTransferEvidence.class
        );

        // Validate the BankTransferEvidence in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertBankTransferEvidenceUpdatableFieldsEquals(
            returnedBankTransferEvidence,
            getPersistedBankTransferEvidence(returnedBankTransferEvidence)
        );

        insertedBankTransferEvidence = returnedBankTransferEvidence;
    }

    @Test
    @Transactional
    void createBankTransferEvidenceWithExistingId() throws Exception {
        // Create the BankTransferEvidence with an existing ID
        bankTransferEvidence.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restBankTransferEvidenceMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(bankTransferEvidence)))
            .andExpect(status().isBadRequest());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkProviderTxnIdIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        bankTransferEvidence.setProviderTxnId(null);

        // Create the BankTransferEvidence, which fails.

        restBankTransferEvidenceMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(bankTransferEvidence)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkAmountIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        bankTransferEvidence.setAmount(null);

        // Create the BankTransferEvidence, which fails.

        restBankTransferEvidenceMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(bankTransferEvidence)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkBankPaidAtIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        bankTransferEvidence.setBankPaidAt(null);

        // Create the BankTransferEvidence, which fails.

        restBankTransferEvidenceMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(bankTransferEvidence)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllBankTransferEvidences() throws Exception {
        // Initialize the database
        insertedBankTransferEvidence = bankTransferEvidenceRepository.saveAndFlush(bankTransferEvidence);

        // Get all the bankTransferEvidenceList
        restBankTransferEvidenceMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(bankTransferEvidence.getId().intValue())))
            .andExpect(jsonPath("$.[*].providerTxnId").value(hasItem(DEFAULT_PROVIDER_TXN_ID.intValue())))
            .andExpect(jsonPath("$.[*].amount").value(hasItem(sameNumber(DEFAULT_AMOUNT))))
            .andExpect(jsonPath("$.[*].bankPaidAt").value(hasItem(DEFAULT_BANK_PAID_AT.toString())))
            .andExpect(jsonPath("$.[*].quoteRef").value(hasItem(DEFAULT_QUOTE_REF)))
            .andExpect(jsonPath("$.[*].deliveryOutcome").value(hasItem(DEFAULT_DELIVERY_OUTCOME)))
            .andExpect(jsonPath("$.[*].authOutcome").value(hasItem(DEFAULT_AUTH_OUTCOME)));
    }

    @Test
    @Transactional
    void getBankTransferEvidence() throws Exception {
        // Initialize the database
        insertedBankTransferEvidence = bankTransferEvidenceRepository.saveAndFlush(bankTransferEvidence);

        // Get the bankTransferEvidence
        restBankTransferEvidenceMockMvc
            .perform(get(ENTITY_API_URL_ID, bankTransferEvidence.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(bankTransferEvidence.getId().intValue()))
            .andExpect(jsonPath("$.providerTxnId").value(DEFAULT_PROVIDER_TXN_ID.intValue()))
            .andExpect(jsonPath("$.amount").value(sameNumber(DEFAULT_AMOUNT)))
            .andExpect(jsonPath("$.bankPaidAt").value(DEFAULT_BANK_PAID_AT.toString()))
            .andExpect(jsonPath("$.quoteRef").value(DEFAULT_QUOTE_REF))
            .andExpect(jsonPath("$.deliveryOutcome").value(DEFAULT_DELIVERY_OUTCOME))
            .andExpect(jsonPath("$.authOutcome").value(DEFAULT_AUTH_OUTCOME));
    }

    @Test
    @Transactional
    void getNonExistingBankTransferEvidence() throws Exception {
        // Get the bankTransferEvidence
        restBankTransferEvidenceMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingBankTransferEvidence() throws Exception {
        // Initialize the database
        insertedBankTransferEvidence = bankTransferEvidenceRepository.saveAndFlush(bankTransferEvidence);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the bankTransferEvidence
        BankTransferEvidence updatedBankTransferEvidence = bankTransferEvidenceRepository
            .findById(bankTransferEvidence.getId())
            .orElseThrow();
        // Disconnect from session so that the updates on updatedBankTransferEvidence are not directly saved in db
        em.detach(updatedBankTransferEvidence);
        updatedBankTransferEvidence
            .providerTxnId(UPDATED_PROVIDER_TXN_ID)
            .amount(UPDATED_AMOUNT)
            .bankPaidAt(UPDATED_BANK_PAID_AT)
            .quoteRef(UPDATED_QUOTE_REF)
            .deliveryOutcome(UPDATED_DELIVERY_OUTCOME)
            .authOutcome(UPDATED_AUTH_OUTCOME);

        restBankTransferEvidenceMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedBankTransferEvidence.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedBankTransferEvidence))
            )
            .andExpect(status().isOk());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedBankTransferEvidenceToMatchAllProperties(updatedBankTransferEvidence);
    }

    @Test
    @Transactional
    void putNonExistingBankTransferEvidence() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        bankTransferEvidence.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restBankTransferEvidenceMockMvc
            .perform(
                put(ENTITY_API_URL_ID, bankTransferEvidence.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(bankTransferEvidence))
            )
            .andExpect(status().isBadRequest());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchBankTransferEvidence() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        bankTransferEvidence.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBankTransferEvidenceMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(bankTransferEvidence))
            )
            .andExpect(status().isBadRequest());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamBankTransferEvidence() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        bankTransferEvidence.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBankTransferEvidenceMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(bankTransferEvidence)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateBankTransferEvidenceWithPatch() throws Exception {
        // Initialize the database
        insertedBankTransferEvidence = bankTransferEvidenceRepository.saveAndFlush(bankTransferEvidence);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the bankTransferEvidence using partial update
        BankTransferEvidence partialUpdatedBankTransferEvidence = new BankTransferEvidence();
        partialUpdatedBankTransferEvidence.setId(bankTransferEvidence.getId());

        partialUpdatedBankTransferEvidence
            .providerTxnId(UPDATED_PROVIDER_TXN_ID)
            .quoteRef(UPDATED_QUOTE_REF)
            .deliveryOutcome(UPDATED_DELIVERY_OUTCOME)
            .authOutcome(UPDATED_AUTH_OUTCOME);

        restBankTransferEvidenceMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedBankTransferEvidence.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedBankTransferEvidence))
            )
            .andExpect(status().isOk());

        // Validate the BankTransferEvidence in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertBankTransferEvidenceUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedBankTransferEvidence, bankTransferEvidence),
            getPersistedBankTransferEvidence(bankTransferEvidence)
        );
    }

    @Test
    @Transactional
    void fullUpdateBankTransferEvidenceWithPatch() throws Exception {
        // Initialize the database
        insertedBankTransferEvidence = bankTransferEvidenceRepository.saveAndFlush(bankTransferEvidence);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the bankTransferEvidence using partial update
        BankTransferEvidence partialUpdatedBankTransferEvidence = new BankTransferEvidence();
        partialUpdatedBankTransferEvidence.setId(bankTransferEvidence.getId());

        partialUpdatedBankTransferEvidence
            .providerTxnId(UPDATED_PROVIDER_TXN_ID)
            .amount(UPDATED_AMOUNT)
            .bankPaidAt(UPDATED_BANK_PAID_AT)
            .quoteRef(UPDATED_QUOTE_REF)
            .deliveryOutcome(UPDATED_DELIVERY_OUTCOME)
            .authOutcome(UPDATED_AUTH_OUTCOME);

        restBankTransferEvidenceMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedBankTransferEvidence.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedBankTransferEvidence))
            )
            .andExpect(status().isOk());

        // Validate the BankTransferEvidence in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertBankTransferEvidenceUpdatableFieldsEquals(
            partialUpdatedBankTransferEvidence,
            getPersistedBankTransferEvidence(partialUpdatedBankTransferEvidence)
        );
    }

    @Test
    @Transactional
    void patchNonExistingBankTransferEvidence() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        bankTransferEvidence.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restBankTransferEvidenceMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, bankTransferEvidence.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(bankTransferEvidence))
            )
            .andExpect(status().isBadRequest());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchBankTransferEvidence() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        bankTransferEvidence.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBankTransferEvidenceMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(bankTransferEvidence))
            )
            .andExpect(status().isBadRequest());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamBankTransferEvidence() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        bankTransferEvidence.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restBankTransferEvidenceMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(bankTransferEvidence)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the BankTransferEvidence in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteBankTransferEvidence() throws Exception {
        // Initialize the database
        insertedBankTransferEvidence = bankTransferEvidenceRepository.saveAndFlush(bankTransferEvidence);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the bankTransferEvidence
        restBankTransferEvidenceMockMvc
            .perform(delete(ENTITY_API_URL_ID, bankTransferEvidence.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return bankTransferEvidenceRepository.count();
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

    protected BankTransferEvidence getPersistedBankTransferEvidence(BankTransferEvidence bankTransferEvidence) {
        return bankTransferEvidenceRepository.findById(bankTransferEvidence.getId()).orElseThrow();
    }

    protected void assertPersistedBankTransferEvidenceToMatchAllProperties(BankTransferEvidence expectedBankTransferEvidence) {
        assertBankTransferEvidenceAllPropertiesEquals(
            expectedBankTransferEvidence,
            getPersistedBankTransferEvidence(expectedBankTransferEvidence)
        );
    }

    protected void assertPersistedBankTransferEvidenceToMatchUpdatableProperties(BankTransferEvidence expectedBankTransferEvidence) {
        assertBankTransferEvidenceAllUpdatablePropertiesEquals(
            expectedBankTransferEvidence,
            getPersistedBankTransferEvidence(expectedBankTransferEvidence)
        );
    }
}
