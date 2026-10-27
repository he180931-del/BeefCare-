package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static vn.edu.fpt.beefcare.domain.CashReportSnapshotAsserts.*;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.createUpdateProxyForBean;
import static vn.edu.fpt.beefcare.web.rest.TestUtil.sameNumber;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.CashReportSnapshot;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;

/**
 * Integration tests for the {@link CashReportSnapshotResource} REST controller.
 */
@IntegrationTest
@AutoConfigureMockMvc
@WithMockUser
class CashReportSnapshotResourceIT {

    private static final Instant DEFAULT_AS_OF = Instant.ofEpochMilli(0L);
    private static final Instant UPDATED_AS_OF = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    private static final LocalDate DEFAULT_DATE_FROM = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_DATE_FROM = LocalDate.now(ZoneId.systemDefault());

    private static final LocalDate DEFAULT_DATE_TO = LocalDate.ofEpochDay(0L);
    private static final LocalDate UPDATED_DATE_TO = LocalDate.now(ZoneId.systemDefault());

    private static final BigDecimal DEFAULT_TOTALS = new BigDecimal(1);
    private static final BigDecimal UPDATED_TOTALS = new BigDecimal(2);

    private static final String ENTITY_API_URL = "/api/cash-report-snapshots";
    private static final String ENTITY_API_URL_ID = ENTITY_API_URL + "/{id}";

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    @Autowired
    private ObjectMapper om;

    @Autowired
    private CashReportSnapshotRepository cashReportSnapshotRepository;

    @Autowired
    private EntityManager em;

    @Autowired
    private MockMvc restCashReportSnapshotMockMvc;

    private CashReportSnapshot cashReportSnapshot;

    private CashReportSnapshot insertedCashReportSnapshot;

    /**
     * Create an entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CashReportSnapshot createEntity(EntityManager em) {
        CashReportSnapshot cashReportSnapshot = new CashReportSnapshot()
            .asOf(DEFAULT_AS_OF)
            .dateFrom(DEFAULT_DATE_FROM)
            .dateTo(DEFAULT_DATE_TO)
            .totals(DEFAULT_TOTALS);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        cashReportSnapshot.setPmUser(appUser);
        return cashReportSnapshot;
    }

    /**
     * Create an updated entity for this test.
     *
     * This is a static method, as tests for other entities might also need it,
     * if they test an entity which requires the current entity.
     */
    public static CashReportSnapshot createUpdatedEntity(EntityManager em) {
        CashReportSnapshot updatedCashReportSnapshot = new CashReportSnapshot()
            .asOf(UPDATED_AS_OF)
            .dateFrom(UPDATED_DATE_FROM)
            .dateTo(UPDATED_DATE_TO)
            .totals(UPDATED_TOTALS);
        // Add required entity
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = AppUserResourceIT.createUpdatedEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        updatedCashReportSnapshot.setPmUser(appUser);
        return updatedCashReportSnapshot;
    }

    @BeforeEach
    void initTest() {
        cashReportSnapshot = createEntity(em);
    }

    @AfterEach
    void cleanup() {
        if (insertedCashReportSnapshot != null) {
            cashReportSnapshotRepository.delete(insertedCashReportSnapshot);
            insertedCashReportSnapshot = null;
        }
    }

    @Test
    @Transactional
    void createCashReportSnapshot() throws Exception {
        long databaseSizeBeforeCreate = getRepositoryCount();
        // Create the CashReportSnapshot
        var returnedCashReportSnapshot = om.readValue(
            restCashReportSnapshotMockMvc
                .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            CashReportSnapshot.class
        );

        // Validate the CashReportSnapshot in the database
        assertIncrementedRepositoryCount(databaseSizeBeforeCreate);
        assertCashReportSnapshotUpdatableFieldsEquals(
            returnedCashReportSnapshot,
            getPersistedCashReportSnapshot(returnedCashReportSnapshot)
        );

        insertedCashReportSnapshot = returnedCashReportSnapshot;
    }

    @Test
    @Transactional
    void createCashReportSnapshotWithExistingId() throws Exception {
        // Create the CashReportSnapshot with an existing ID
        cashReportSnapshot.setId(1L);

        long databaseSizeBeforeCreate = getRepositoryCount();

        // An entity with an existing ID cannot be created, so this API call must fail
        restCashReportSnapshotMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isBadRequest());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeCreate);
    }

    @Test
    @Transactional
    void checkAsOfIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cashReportSnapshot.setAsOf(null);

        // Create the CashReportSnapshot, which fails.

        restCashReportSnapshotMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDateFromIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cashReportSnapshot.setDateFrom(null);

        // Create the CashReportSnapshot, which fails.

        restCashReportSnapshotMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkDateToIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cashReportSnapshot.setDateTo(null);

        // Create the CashReportSnapshot, which fails.

        restCashReportSnapshotMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void checkTotalsIsRequired() throws Exception {
        long databaseSizeBeforeTest = getRepositoryCount();
        // set the field null
        cashReportSnapshot.setTotals(null);

        // Create the CashReportSnapshot, which fails.

        restCashReportSnapshotMockMvc
            .perform(post(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isBadRequest());

        assertSameRepositoryCount(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    void getAllCashReportSnapshots() throws Exception {
        // Initialize the database
        insertedCashReportSnapshot = cashReportSnapshotRepository.saveAndFlush(cashReportSnapshot);

        // Get all the cashReportSnapshotList
        restCashReportSnapshotMockMvc
            .perform(get(ENTITY_API_URL + "?sort=id,desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.[*].id").value(hasItem(cashReportSnapshot.getId().intValue())))
            .andExpect(jsonPath("$.[*].asOf").value(hasItem(DEFAULT_AS_OF.toString())))
            .andExpect(jsonPath("$.[*].dateFrom").value(hasItem(DEFAULT_DATE_FROM.toString())))
            .andExpect(jsonPath("$.[*].dateTo").value(hasItem(DEFAULT_DATE_TO.toString())))
            .andExpect(jsonPath("$.[*].totals").value(hasItem(sameNumber(DEFAULT_TOTALS))));
    }

    @Test
    @Transactional
    void getCashReportSnapshot() throws Exception {
        // Initialize the database
        insertedCashReportSnapshot = cashReportSnapshotRepository.saveAndFlush(cashReportSnapshot);

        // Get the cashReportSnapshot
        restCashReportSnapshotMockMvc
            .perform(get(ENTITY_API_URL_ID, cashReportSnapshot.getId()))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$.id").value(cashReportSnapshot.getId().intValue()))
            .andExpect(jsonPath("$.asOf").value(DEFAULT_AS_OF.toString()))
            .andExpect(jsonPath("$.dateFrom").value(DEFAULT_DATE_FROM.toString()))
            .andExpect(jsonPath("$.dateTo").value(DEFAULT_DATE_TO.toString()))
            .andExpect(jsonPath("$.totals").value(sameNumber(DEFAULT_TOTALS)));
    }

    @Test
    @Transactional
    void getNonExistingCashReportSnapshot() throws Exception {
        // Get the cashReportSnapshot
        restCashReportSnapshotMockMvc.perform(get(ENTITY_API_URL_ID, Long.MAX_VALUE)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void putExistingCashReportSnapshot() throws Exception {
        // Initialize the database
        insertedCashReportSnapshot = cashReportSnapshotRepository.saveAndFlush(cashReportSnapshot);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cashReportSnapshot
        CashReportSnapshot updatedCashReportSnapshot = cashReportSnapshotRepository.findById(cashReportSnapshot.getId()).orElseThrow();
        // Disconnect from session so that the updates on updatedCashReportSnapshot are not directly saved in db
        em.detach(updatedCashReportSnapshot);
        updatedCashReportSnapshot.asOf(UPDATED_AS_OF).dateFrom(UPDATED_DATE_FROM).dateTo(UPDATED_DATE_TO).totals(UPDATED_TOTALS);

        restCashReportSnapshotMockMvc
            .perform(
                put(ENTITY_API_URL_ID, updatedCashReportSnapshot.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(updatedCashReportSnapshot))
            )
            .andExpect(status().isOk());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertPersistedCashReportSnapshotToMatchAllProperties(updatedCashReportSnapshot);
    }

    @Test
    @Transactional
    void putNonExistingCashReportSnapshot() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cashReportSnapshot.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCashReportSnapshotMockMvc
            .perform(
                put(ENTITY_API_URL_ID, cashReportSnapshot.getId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cashReportSnapshot))
            )
            .andExpect(status().isBadRequest());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithIdMismatchCashReportSnapshot() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cashReportSnapshot.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCashReportSnapshotMockMvc
            .perform(
                put(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsBytes(cashReportSnapshot))
            )
            .andExpect(status().isBadRequest());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void putWithMissingIdPathParamCashReportSnapshot() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cashReportSnapshot.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCashReportSnapshotMockMvc
            .perform(put(ENTITY_API_URL).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void partialUpdateCashReportSnapshotWithPatch() throws Exception {
        // Initialize the database
        insertedCashReportSnapshot = cashReportSnapshotRepository.saveAndFlush(cashReportSnapshot);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cashReportSnapshot using partial update
        CashReportSnapshot partialUpdatedCashReportSnapshot = new CashReportSnapshot();
        partialUpdatedCashReportSnapshot.setId(cashReportSnapshot.getId());

        partialUpdatedCashReportSnapshot.dateFrom(UPDATED_DATE_FROM).dateTo(UPDATED_DATE_TO);

        restCashReportSnapshotMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCashReportSnapshot.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCashReportSnapshot))
            )
            .andExpect(status().isOk());

        // Validate the CashReportSnapshot in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCashReportSnapshotUpdatableFieldsEquals(
            createUpdateProxyForBean(partialUpdatedCashReportSnapshot, cashReportSnapshot),
            getPersistedCashReportSnapshot(cashReportSnapshot)
        );
    }

    @Test
    @Transactional
    void fullUpdateCashReportSnapshotWithPatch() throws Exception {
        // Initialize the database
        insertedCashReportSnapshot = cashReportSnapshotRepository.saveAndFlush(cashReportSnapshot);

        long databaseSizeBeforeUpdate = getRepositoryCount();

        // Update the cashReportSnapshot using partial update
        CashReportSnapshot partialUpdatedCashReportSnapshot = new CashReportSnapshot();
        partialUpdatedCashReportSnapshot.setId(cashReportSnapshot.getId());

        partialUpdatedCashReportSnapshot.asOf(UPDATED_AS_OF).dateFrom(UPDATED_DATE_FROM).dateTo(UPDATED_DATE_TO).totals(UPDATED_TOTALS);

        restCashReportSnapshotMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, partialUpdatedCashReportSnapshot.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(partialUpdatedCashReportSnapshot))
            )
            .andExpect(status().isOk());

        // Validate the CashReportSnapshot in the database

        assertSameRepositoryCount(databaseSizeBeforeUpdate);
        assertCashReportSnapshotUpdatableFieldsEquals(
            partialUpdatedCashReportSnapshot,
            getPersistedCashReportSnapshot(partialUpdatedCashReportSnapshot)
        );
    }

    @Test
    @Transactional
    void patchNonExistingCashReportSnapshot() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cashReportSnapshot.setId(longCount.incrementAndGet());

        // If the entity doesn't have an ID, it will throw BadRequestAlertException
        restCashReportSnapshotMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, cashReportSnapshot.getId())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cashReportSnapshot))
            )
            .andExpect(status().isBadRequest());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithIdMismatchCashReportSnapshot() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cashReportSnapshot.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCashReportSnapshotMockMvc
            .perform(
                patch(ENTITY_API_URL_ID, longCount.incrementAndGet())
                    .contentType("application/merge-patch+json")
                    .content(om.writeValueAsBytes(cashReportSnapshot))
            )
            .andExpect(status().isBadRequest());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void patchWithMissingIdPathParamCashReportSnapshot() throws Exception {
        long databaseSizeBeforeUpdate = getRepositoryCount();
        cashReportSnapshot.setId(longCount.incrementAndGet());

        // If url ID doesn't match entity ID, it will throw BadRequestAlertException
        restCashReportSnapshotMockMvc
            .perform(patch(ENTITY_API_URL).contentType("application/merge-patch+json").content(om.writeValueAsBytes(cashReportSnapshot)))
            .andExpect(status().isMethodNotAllowed());

        // Validate the CashReportSnapshot in the database
        assertSameRepositoryCount(databaseSizeBeforeUpdate);
    }

    @Test
    @Transactional
    void deleteCashReportSnapshot() throws Exception {
        // Initialize the database
        insertedCashReportSnapshot = cashReportSnapshotRepository.saveAndFlush(cashReportSnapshot);

        long databaseSizeBeforeDelete = getRepositoryCount();

        // Delete the cashReportSnapshot
        restCashReportSnapshotMockMvc
            .perform(delete(ENTITY_API_URL_ID, cashReportSnapshot.getId()).accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNoContent());

        // Validate the database contains one less item
        assertDecrementedRepositoryCount(databaseSizeBeforeDelete);
    }

    protected long getRepositoryCount() {
        return cashReportSnapshotRepository.count();
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

    protected CashReportSnapshot getPersistedCashReportSnapshot(CashReportSnapshot cashReportSnapshot) {
        return cashReportSnapshotRepository.findById(cashReportSnapshot.getId()).orElseThrow();
    }

    protected void assertPersistedCashReportSnapshotToMatchAllProperties(CashReportSnapshot expectedCashReportSnapshot) {
        assertCashReportSnapshotAllPropertiesEquals(expectedCashReportSnapshot, getPersistedCashReportSnapshot(expectedCashReportSnapshot));
    }

    protected void assertPersistedCashReportSnapshotToMatchUpdatableProperties(CashReportSnapshot expectedCashReportSnapshot) {
        assertCashReportSnapshotAllUpdatablePropertiesEquals(
            expectedCashReportSnapshot,
            getPersistedCashReportSnapshot(expectedCashReportSnapshot)
        );
    }
}
