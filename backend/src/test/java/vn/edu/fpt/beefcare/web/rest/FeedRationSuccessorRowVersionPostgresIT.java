package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FeedItem;
import vn.edu.fpt.beefcare.domain.FeedRationPen;
import vn.edu.fpt.beefcare.domain.FeedRationVersion;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.FeedRationVersionRepository;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationComponentRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationVersionRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.RationView;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.SaveRationRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/**
 * FE-23 row-version contract against PostgreSQL: creating a version before an existing successor returns the
 * persisted row token, and that token can be used by the next HTTP command to cancel the created schedule.
 * This test intentionally has no test-level transaction; each MockMvc command commits before the database readback.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class FeedRationSuccessorRowVersionPostgresIT extends DomainTestSupport {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired DataSource dataSource;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired FeedRationVersionRepository rationVersions;

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        FarmInvitationPostgresIT.configure(properties, "fe23_ration_row_version_");
    }

    @BeforeEach
    void requirePostgres16() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }

    @Test
    void createWithSuccessorReturnsPersistedRowVersionAndThatTokenCancelsIt() throws Exception {
        Fixture fixture = fixture();
        LocalDate createDate = TODAY.plusDays(10);
        LocalDate successorStart = TODAY.plusDays(20);
        SaveRationRequest request = new SaveRationRequest(
            "KP-ROW-TEST",
            "Khẩu phần chèn trước lịch kế tiếp",
            "FATTENING",
            "FE23 row-version PostgreSQL test",
            createDate,
            1,
            List.of("06:30"),
            List.of(fixture.penId()),
            List.of(new RationComponentRequest(fixture.feedItemId(), BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ZERO)),
            2
        );

        String createdBody = mvc.perform(
                post("/api/farms/{farmId}/feed/rations", fixture.farmId())
                    .with(SecurityMockMvcRequestPostProcessors.user(fixture.managerEmail()))
                    .with(csrf())
                    .header("Idempotency-Key", "fe23-create-" + UUID.randomUUID())
                    .contentType("application/json")
                    .content(mapper.writeValueAsBytes(request))
            )
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        RationView created = mapper.readValue(createdBody, RationView.class);

        assertThat(created.effectiveTo()).isEqualTo(successorStart.minusDays(1));
        assertThat(created.status()).isEqualTo("SCHEDULED");
        assertThat(created.version()).isNotNull();

        FeedRationVersion persistedAfterCreate = readVersion(fixture.farmId(), created.id());
        assertThat(created.version()).isEqualTo(persistedAfterCreate.getVersion());
        assertThat(persistedAfterCreate.getEffectiveTo()).isEqualTo(successorStart.minusDays(1));
        assertThat(persistedAfterCreate.getStatus()).isEqualTo("SCHEDULED");

        String cancelBody = mvc.perform(
                post("/api/farms/{farmId}/feed/rations/{rationId}/versions/{versionNo}/cancel",
                    fixture.farmId(), created.id(), created.versionNo())
                    .with(SecurityMockMvcRequestPostProcessors.user(fixture.managerEmail()))
                    .with(csrf())
                    .header("Idempotency-Key", "fe23-cancel-" + UUID.randomUUID())
                    .contentType("application/json")
                    .content(mapper.writeValueAsBytes(new RationVersionRequest(created.version())))
            )
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        RationView cancelled = mapper.readValue(cancelBody, RationView.class);

        assertThat(cancelled.status()).isEqualTo("CANCELLED");
        assertThat(cancelled.version()).isGreaterThan(created.version());
        FeedRationVersion persistedAfterCancel = readVersion(fixture.farmId(), created.id());
        assertThat(cancelled.version()).isEqualTo(persistedAfterCancel.getVersion());
        assertThat(persistedAfterCancel.getStatus()).isEqualTo("CANCELLED");
    }

    private Fixture fixture() {
        return inTransaction(() -> {
            Farm farm = farm();
            AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
            Pen pen = pen(farm, "R-PG-" + next(), 20);
            FeedItem feed = new FeedItem();
            feed.setFarm(farm);
            feed.setCode("TA-PG-" + next());
            feed.setName("Thức ăn kiểm thử row version");
            feed.setFeedGroup("DRY_ROUGHAGE");
            feed.setStockUnit("kg");
            feed.setOnHandKg(BigDecimal.ZERO.setScale(3));
            feed.setAvgUnitCost(BigDecimal.ZERO.setScale(2));
            feed.setAvailable(true);
            save(feed);

            LocalDate predecessorStart = TODAY.plusDays(1);
            LocalDate successorStart = TODAY.plusDays(20);
            FeedRationVersion predecessor = saveRationVersion(farm, manager, 1, predecessorStart, successorStart.minusDays(1));
            FeedRationVersion successor = saveRationVersion(farm, manager, 2, successorStart, null);
            saveRationPen(predecessor, pen, null);
            saveRationPen(successor, pen, predecessor);

            return new Fixture(farm.getId(), manager.getEmail(), pen.getId(), feed.getId());
        });
    }

    private FeedRationVersion saveRationVersion(Farm farm, AppUser createdBy, int versionNo, LocalDate start, LocalDate end) {
        FeedRationVersion ration = new FeedRationVersion();
        ration.setFarm(farm);
        ration.setRationCode("KP-ROW-TEST");
        ration.setVersionNo(versionNo);
        ration.setName("Khẩu phần " + versionNo);
        ration.setHerdGroup("FATTENING");
        ration.setEffectiveFrom(start);
        ration.setEffectiveTo(end);
        ration.setStatus("SCHEDULED");
        ration.setSessionsPerDay(1);
        ration.setSessionTimes("06:30");
        ration.setCreatedBy(createdBy);
        ration.setCreatedAt(clock.instant());
        return save(ration);
    }

    private void saveRationPen(FeedRationVersion ration, Pen pen, FeedRationVersion predecessor) {
        FeedRationPen link = new FeedRationPen();
        link.setRationVersion(ration);
        link.setPen(pen);
        link.setPredecessorVersion(predecessor);
        link.setPredecessorEffectiveTo(null);
        link.setPredecessorEffectiveToManuallySet(false);
        link.setPredecessorSnapshotCaptured(true);
        save(link);
    }

    private FeedRationVersion readVersion(Long farmId, Long rationId) {
        return inTransaction(() -> {
            em.clear();
            return rationVersions.findByIdAndFarm_Id(rationId, farmId).orElseThrow();
        });
    }

    private <T> T inTransaction(java.util.function.Supplier<T> work) {
        return new TransactionTemplate(transactionManager).execute(status -> work.get());
    }

    private record Fixture(Long farmId, String managerEmail, Long penId, Long feedItemId) {}
}
