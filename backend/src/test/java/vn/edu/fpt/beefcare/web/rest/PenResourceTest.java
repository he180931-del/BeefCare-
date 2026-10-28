package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.PenAssignmentService;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** REST contract of the pen and pen-move endpoints. */
@ServiceIntegrationTest
@Transactional
class PenResourceTest extends DomainTestSupport {

    @Autowired
    MockMvc mvc;

    @Autowired
    PenAssignmentService assignments;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
    }

    private static RequestPostProcessor as(AppUser u) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(u.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", java.util.UUID.randomUUID().toString());
            return processed;
        };
    }

    private static RequestPostProcessor as(AppUser u, String key) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(u.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            processed.addHeader("Idempotency-Key", key);
            return processed;
        };
    }

    private String base() {
        return "/api/farms/" + farm.getId();
    }

    private static final String NEW_PEN =
        "{\"code\":\"A-1\",\"name\":\"Pen one\",\"capacity\":12,\"criteria\":{\"purposeTypes\":[\"BREEDING\"],\"minAgeMonths\":6,\"minWeightKg\":150}}";

    @Test
    void createReturns201WithLocationAndVersionOneCriteria() throws Exception {
        mvc
            .perform(post(base() + "/pens").with(as(manager)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.code").value("A-1"))
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andExpect(jsonPath("$.freePlaces").value(12))
            .andExpect(jsonPath("$.currentCriteria.versionNo").value(1))
            .andExpect(jsonPath("$.message.code").value("MSG-FE04-01"));
    }

    @Test
    void idempotentCreateReplaysOnceRejectsChangedPayloadAndRechecksMembership() throws Exception {
        String key = "pen-create-" + java.util.UUID.randomUUID();
        String first = mvc.perform(post(base() + "/pens").with(as(owner, key)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = com.jayway.jsonpath.JsonPath.read(first, "$.id");

        mvc.perform(post(base() + "/pens").with(as(owner, key)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id));
        String changed = NEW_PEN.replace("Pen one", "Changed name");
        mvc.perform(post(base() + "/pens").with(as(owner, key)).contentType(MediaType.APPLICATION_JSON).content(changed))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));

        long penCount = ((Number) em.createNativeQuery("select count(*) from pen where farm_id = :farmId").setParameter("farmId", farm.getId()).getSingleResult()).longValue();
        long domainEvents = ((Number) em.createNativeQuery("select count(*) from outbox_event where event_type = 'PEN_CREATED' and farm_id = :farmId").setParameter("farmId", farm.getId()).getSingleResult()).longValue();
        long commandRecords = ((Number) em.createNativeQuery("select count(*) from idempotency_record where idempotency_key = :key").setParameter("key", key).getSingleResult()).longValue();
        assertThat(penCount).isEqualTo(1);
        assertThat(domainEvents).isEqualTo(1);
        assertThat(commandRecords).isEqualTo(1);

        var membership = em.createQuery("select m from FarmMembership m where m.farm.id = :farmId and m.user.id = :userId", vn.edu.fpt.beefcare.domain.FarmMembership.class)
            .setParameter("farmId", farm.getId()).setParameter("userId", owner.getId()).getSingleResult();
        membership.setStatus("INACTIVE");
        em.flush();
        mvc.perform(post(base() + "/pens").with(as(owner, key)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void duplicateCodeIs422MsgFe0402() throws Exception {
        mvc.perform(post(base() + "/pens").with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN)).andExpect(status().isCreated());
        String failedKey = "pen-failed-" + java.util.UUID.randomUUID();
        mvc
            .perform(post(base() + "/pens").with(as(owner, failedKey)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE04-02"))
            .andExpect(jsonPath("$.params.pen_code").value("A-1"));
        long commandRecords = ((Number) em.createNativeQuery("select count(*) from idempotency_record where idempotency_key = :key").setParameter("key", failedKey).getSingleResult()).longValue();
        long domainEvents = ((Number) em.createNativeQuery("select count(*) from outbox_event where event_type = 'PEN_CREATED' and farm_id = :farmId").setParameter("farmId", farm.getId()).getSingleResult()).longValue();
        assertThat(commandRecords).isZero();
        assertThat(domainEvents).isEqualTo(1);
    }

    @Test
    void invalidBodyIs400() throws Exception {
        String bad = "{\"code\":\"bad code!\",\"name\":\"\",\"capacity\":0,\"criteria\":{\"minAgeMonths\":999,\"minWeightKg\":0}}";
        mvc
            .perform(post(base() + "/pens").with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(bad))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors").isArray());
        mvc
            .perform(post(base() + "/pens").with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"A\",\"name\":\"n\",\"capacity\":10000}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void technicianReadsButCannotWrite() throws Exception {
        pen(farm, "T1", 5);
        mvc.perform(get(base() + "/pens").with(as(technician))).andExpect(status().isOk()).andExpect(jsonPath("$.pens.length()").value(1));
        mvc
            .perform(post(base() + "/pens").with(as(technician)).contentType(MediaType.APPLICATION_JSON).content(NEW_PEN))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void unauthenticatedIs401AndOtherFarmMemberIs403() throws Exception {
        mvc.perform(get(base() + "/pens")).andExpect(status().isUnauthorized());
        Farm other = farm();
        AppUser stranger = memberWithRole(other, FarmRole.OWNER);
        mvc.perform(get(base() + "/pens").with(as(stranger))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void updateBelowHeadcountIs422AndStaleVersionIs409() throws Exception {
        Pen p = pen(farm, "U1", 5);
        Cattle c = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        assignments.openAssignment(c, p, TODAY.minusDays(2), AssignmentSource.HERD_ENTRY, "r", null, null, owner);
        mvc
            .perform(put(base() + "/pens/" + p.getId()).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"U1\",\"name\":\"n\",\"capacity\":1,\"expectedVersion\":0}"))
            .andExpect(status().isOk());
        em.flush();
        mvc
            .perform(
                put(base() + "/pens/" + p.getId())
                    .with(as(owner))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"code\":\"U1\",\"name\":\"n\",\"capacity\":2,\"expectedVersion\":99}")
            )
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    @Test
    void availabilityEndpoint() throws Exception {
        Pen p = pen(farm, "V1", 5);
        String path = base() + "/pens/" + p.getId() + "/availability";
        mvc
            .perform(post(path).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\",\"effectiveDate\":\"2026-10-29\",\"reason\":\"x\",\"expectedVersion\":0}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-COM-07"));
        mvc
            .perform(post(path).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\",\"effectiveDate\":\"2026-10-28\",\"expectedVersion\":0}"))
            .andExpect(status().isBadRequest());
        mvc
            .perform(post(path).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\",\"effectiveDate\":\"2026-10-28\",\"reason\":\"repairs\",\"expectedVersion\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("INACTIVE"))
            .andExpect(jsonPath("$.message.code").value("MSG-FE04-04"));
    }

    @Test
    void deleteIsNotExposed() throws Exception {
        Pen p = pen(farm, "D1", 5);
        mvc
            .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(base() + "/pens/" + p.getId()).with(as(owner)))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void moveCheckAndHistoryEndpoints() throws Exception {
        Pen a = pen(farm, "A", 5);
        Pen b = pen(farm, "B", 1);
        Cattle c1 = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        Cattle c2 = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        assignments.openAssignment(c1, a, TODAY.minusDays(5), AssignmentSource.HERD_ENTRY, "r", null, null, owner);
        assignments.openAssignment(c2, a, TODAY.minusDays(5), AssignmentSource.HERD_ENTRY, "r", null, null, owner);
        String two = "{\"cattleIds\":[" + c1.getId() + "," + c2.getId() + "],\"cattleVersions\":{" + c1.getId() + ":0," + c2.getId() + ":0},\"toPenId\":" + b.getId() + ",\"moveDate\":\"2026-10-28\",\"reason\":\"regroup\"}";
        mvc
            .perform(post(base() + "/pen-moves/check").with(as(manager)).contentType(MediaType.APPLICATION_JSON).content(two))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.blocked").value(true))
            .andExpect(jsonPath("$.block.code").value("MSG-FE04-05"))
            .andExpect(jsonPath("$.cattle.length()").value(2));
        mvc
            .perform(post(base() + "/pen-moves").with(as(manager)).contentType(MediaType.APPLICATION_JSON).content(two))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE04-05"))
            .andExpect(jsonPath("$.params.free").value(1))
            .andExpect(jsonPath("$.params.count").value(2));
        String one = "{\"cattleIds\":[" + c1.getId() + "],\"cattleVersions\":{" + c1.getId() + ":0},\"toPenId\":" + b.getId() + ",\"moveDate\":\"2026-10-28\",\"reason\":\"regroup\"}";
        mvc
            .perform(post(base() + "/pen-moves").with(as(technician)).contentType(MediaType.APPLICATION_JSON).content(one))
            .andExpect(status().isForbidden());
        mvc
            .perform(post(base() + "/pen-moves").with(as(manager)).contentType(MediaType.APPLICATION_JSON).content(one))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.moved[0].toPenCode").value("B"))
            .andExpect(jsonPath("$.message.code").value("MSG-FE04-08"))
            .andExpect(jsonPath("$.destination.full").value(true));
        mvc
            .perform(get(base() + "/cattle/" + c1.getId() + "/pen-history").with(as(technician)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.current.penCode").value("B"))
            .andExpect(jsonPath("$.history.length()").value(2))
            .andExpect(jsonPath("$.history[0].toDate").doesNotExist());
        mvc.perform(post(base() + "/pen-moves").with(as(manager)).contentType(MediaType.APPLICATION_JSON).content("{\"toPenId\":1}")).andExpect(status().isBadRequest());
    }
}
