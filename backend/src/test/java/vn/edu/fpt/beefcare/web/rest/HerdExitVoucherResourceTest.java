package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.support.ExitTestSupport;

/** REST contract of /api/farms/{farmId}/exit-vouchers: status codes and the {code, params} error body. */
@ServiceIntegrationTest
@Transactional
class HerdExitVoucherResourceTest extends ExitTestSupport {

    @Autowired
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        setUpExitFarm();
    }

    private static RequestPostProcessor as(String email) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(email).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", java.util.UUID.randomUUID().toString());
            return processed;
        };
    }

    private String base() {
        return "/api/farms/" + farm.getId() + "/exit-vouchers";
    }

    private String saleBody(Cattle c, String date, String extra) {
        return (
            "{\"exitType\":\"SALE\",\"exitDate\":\"" +
            date +
            "\",\"buyerId\":" +
            buyer.getId() +
            ",\"pricingBasis\":\"PER_KG\"" +
            extra +
            ",\"lines\":[{\"cattleId\":" +
            c.getId() +
            ",\"exitWeightKg\":300,\"unitPrice\":50000}]}"
        );
    }

    private Long createDraft(Cattle c) throws Exception {
        String body = mvc
            .perform(post(base()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(saleBody(c, "2026-10-28", "")))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return Long.valueOf(com.jayway.jsonpath.JsonPath.<Integer>read(body, "$.id"));
    }

    @Test
    void ownerCreatesADraftWith201LocationAndDetail() throws Exception {
        Cattle c = placed(penA, "300");
        mvc
            .perform(post(base()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(saleBody(c, "2026-10-28", ",\"deductions\":1000000")))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.matchesPattern("PX-2026-\\d{4}")))
            .andExpect(jsonPath("$.cattleAmount").value(15000000))
            .andExpect(jsonPath("$.totalReceivable").value(14000000))
            .andExpect(jsonPath("$.lines[0].cattleCode").value(c.getDisplayCode()))
            .andExpect(jsonPath("$.lines[0].weightBasis").value("MEASURED"));
    }

    @Test
    void scenario16ManagerConfirmIs403WithTheNoPermissionCode() throws Exception {
        Cattle c = placed(penA, "300");
        Long id = createDraft(c);
        mvc
            .perform(post(base() + "/" + id + "/confirm").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"acknowledged\":true}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc
            .perform(post(base()).with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content(saleBody(c, "2026-10-28", "")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(delete(base() + "/" + id).with(as(manager.getEmail()))).andExpect(status().isForbidden());
        mvc
            .perform(post(base() + "/" + id + "/void").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\"}"))
            .andExpect(status().isForbidden());
        // the Manager may read
        mvc.perform(get(base()).with(as(manager.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.vouchers[0].id").value(id));
        mvc.perform(get(base() + "/" + id).with(as(manager.getEmail()))).andExpect(status().isOk());
        // the Technician may not
        mvc.perform(get(base()).with(as(technician.getEmail()))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void unauthenticatedIs401() throws Exception {
        mvc.perform(get(base())).andExpect(status().isUnauthorized());
    }

    @Test
    void confirmFlowAckIdempotencyAndErrorBodies() throws Exception {
        Cattle c = placed(penA, "300");
        Long id = createDraft(c);
        mvc
            .perform(post(base() + "/" + id + "/confirm").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"acknowledged\":false}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-16"));
        mvc
            .perform(get(base() + "/" + id + "/checks").with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cattle[0].hasWarnings").value(false))
            .andExpect(jsonPath("$.occupancy[0].before").value(1))
            .andExpect(jsonPath("$.occupancy[0].after").value(0));
        mvc
            .perform(
                post(base() + "/" + id + "/confirm")
                    .header("Idempotency-Key", "k-1")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"acknowledged\":true,\"expectedVersion\":0}")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.repeated").value(false))
            .andExpect(jsonPath("$.message.code").value("MSG-FE13-02"))
            .andExpect(jsonPath("$.voucher.status").value("CONFIRMED"));
        mvc
            .perform(
                post(base() + "/" + id + "/confirm")
                    .header("Idempotency-Key", "k-1")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"acknowledged\":true,\"expectedVersion\":0}")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.repeated").value(false));
        mvc
            .perform(
                post(base() + "/" + id + "/confirm")
                    .header("Idempotency-Key", "k-2")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"acknowledged\":true,\"expectedVersion\":0}")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.repeated").value(true));
        // confirmed vouchers are not editable or deletable
        mvc.perform(delete(base() + "/" + id).with(as(owner.getEmail()))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        mvc
            .perform(put(base() + "/" + id).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(saleBody(c, "2026-10-28", "")))
            .andExpect(status().isConflict());
        // collections use the shared payment endpoint: Owner only
        mvc
            .perform(
                post("/api/farms/" + farm.getId() + "/vouchers/exit/" + id + "/payments")
                    .with(as(manager.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"paymentDate\":\"2026-10-28\",\"amount\":1000,\"method\":\"CASH\"}")
            )
            .andExpect(status().isForbidden());
        mvc
            .perform(
                post("/api/farms/" + farm.getId() + "/vouchers/exit/" + id + "/payments")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"paymentDate\":\"2026-10-28\",\"amount\":1000,\"method\":\"CASH\"}")
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.summary.paid").value(1000));
    }

    @Test
    void validationAndRuleErrors() throws Exception {
        Cattle c = placed(penA, "300");
        // exit date in the future: 422 MSG-FE13-03 with earliest_date
        mvc
            .perform(post(base()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(saleBody(c, "2026-10-29", "")))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE13-03"))
            .andExpect(jsonPath("$.params.earliest_date").value("2026-10-18"));
        // too long note: bean validation
        String longNote = "x".repeat(1001);
        Cattle d = placed(penA, "300");
        mvc
            .perform(post(base()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(saleBody(d, "2026-10-28", ",\"note\":\"" + longNote + "\"")))
            .andExpect(status().isBadRequest());
        // unknown voucher
        mvc.perform(get(base() + "/999999").with(as(owner.getEmail()))).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        // exit type is required
        mvc
            .perform(post(base()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"exitDate\":\"2026-10-28\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06"))
            .andExpect(jsonPath("$.params.field").value("exitType"));
        // dismiss only applies to PENDING vouchers and needs a reason
        Cattle e = placed(penA, "300");
        Long id = createDraft(e);
        mvc
            .perform(post(base() + "/" + id + "/dismiss").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\",\"expectedVersion\":0}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    @Test
    void selectableCattleVoidCheckAndAddByQrRoutes() throws Exception {
        Cattle c = placed(penA, "300");
        mvc
            .perform(get(base() + "/selectable-cattle").with(as(owner.getEmail())).param("q", c.getDisplayCode()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].cattleId").value(c.getId()))
            .andExpect(jsonPath("$[0].latestWeight.weightKg").value(300.0));
        Long id = createDraft(c);
        mvc.perform(get(base() + "/" + id + "/void-check").with(as(owner.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.voidable").value(false));
        mvc
            .perform(post(base() + "/" + id + "/lines").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"tagCode\":\"NOPE\",\"expectedVersion\":0}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("MSG-COM-08"));
        mvc.perform(delete(base() + "/" + id).with(as(owner.getEmail()))).andExpect(status().isNoContent());
    }
}
