package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = "beefcare.outbox.poll-delay-ms=3600000")
class InternalRequestHistoryPersistenceTest extends DomainTestSupport {
    @DynamicPropertySource
    static void isolatedDatabase(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> "jdbc:h2:mem:beefcare-internal-request-history;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1");
    }

    @Autowired InternalSupportRequestService requests;
    @Autowired SupportTicketCommandService tickets;
    @Autowired ObjectMapper objectMapper;
    @Autowired EntityManager entityManager;

    @Test
    void preservesNeedMoreInfoAndClarificationNotesAcrossFreshReadback() throws Exception {
        Farm farm = farm();
        AppUser owner = owner(farm);
        AppUser cs = staff(PlatformRole.CS);
        AppUser pm = staff(PlatformRole.PM);

        actAs(owner);
        SupportDtos.Ticket createdTicket = tickets.create(new SupportDtos.Create(
            "SYSTEM_USAGE", "FARM", farm.getId(), "Không tra được dịch vụ", "Cần kiểm tra trạng thái dịch vụ"
        ));
        actAs(cs);
        SupportDtos.Ticket ticket = tickets.process(createdTicket.id(), new SupportDtos.Processing(
            "CLAIM", null, null, null, null, null, createdTicket.version()
        ));
        SupportDtos.InternalView request = requests.create(ticket.id(), new SupportDtos.InternalCreate(
            PlatformRole.PM, pm.getId(), "Kiểm tra trạng thái dịch vụ", List.of(), ticket.version()
        ));

        actAs(pm);
        SupportDtos.RecipientInternalView waiting = requests.complete(request.id(), new SupportDtos.Complete(
            "NEED_MORE_INFO", "PM cần mã giao dịch để đối chiếu.", request.version()
        ));
        actAs(cs);
        requests.manage(waiting.id(), new SupportDtos.InternalManage(
            "CLARIFY", null, null, "CS bổ sung mã giao dịch từ khách.", waiting.version()
        ));
        entityManager.flush();

        TestTransaction.flagForCommit();
        TestTransaction.end();
        TestTransaction.start();
        entityManager.clear();

        @SuppressWarnings("unchecked")
        List<Object[]> history = entityManager.createNativeQuery(
            "select event_type, note, actor_id, actor_role, occurred_at from internal_request_history where internal_request_id = :request order by occurred_at, id"
        ).setParameter("request", request.id()).getResultList();

        assertThat(history).hasSize(3);
        assertThat(history).extracting(row -> row[0]).containsExactly("CREATED", "NEED_MORE_INFO", "CLARIFICATION");
        assertThat(history).extracting(row -> row[1]).containsExactly(
            "Kiểm tra trạng thái dịch vụ", "PM cần mã giao dịch để đối chiếu.", "CS bổ sung mã giao dịch từ khách."
        );
        assertThat(history).extracting(row -> row[2]).containsExactly(cs.getId(), pm.getId(), cs.getId());
        assertThat(history).extracting(row -> row[3]).containsExactly("CS", "PM", "CS");
        assertThat(history).allSatisfy(row -> assertThat(row[4]).isNotNull());

        actAs(pm);
        JsonNode projection = objectMapper.valueToTree(requests.get(request.id()));
        assertThat(projection.path("history").isArray()).isTrue();
        assertThat(projection.path("history")).hasSize(3);
        assertThat(projection.path("history").get(1).path("note").asText())
            .isEqualTo("PM cần mã giao dịch để đối chiếu.");
        assertThat(projection.path("history").get(2).path("note").asText())
            .isEqualTo("CS bổ sung mã giao dịch từ khách.");
        assertThat(projection.path("history").get(1).path("type").asText()).isEqualTo("NEED_MORE_INFO");
        assertThat(projection.path("history").get(1).path("actorRole").asText()).isEqualTo("PM");
        assertThat(projection.path("history").get(1).path("at").isTextual()).isTrue();
    }

    private AppUser owner(Farm farm) {
        AppUser user = user();
        user.setOwnerRegistrationCompleted(true);
        user.setOwnerRegistrationCompletedAt(clock.instant());
        member(farm, user, "OWNER", "ACTIVE");
        em.flush();
        return user;
    }

    private AppUser staff(PlatformRole role) {
        AppUser user = user();
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(user);
        access.setRole(role.name());
        access.setStatus("ACTIVE");
        em.persist(access);
        em.flush();
        return user;
    }
}
