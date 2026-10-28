package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** REST contract of the payment endpoints: status codes and the {code, params} error body. */
@ServiceIntegrationTest
@Transactional
class VoucherPaymentResourceTest extends DomainTestSupport {

    @Autowired
    MockMvc mvc;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    HerdEntryVoucher entry;
    HerdExitVoucher exit;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        TradingPartner seller = partner(farm, owner, true, false);
        TradingPartner buyer = partner(farm, owner, false, true);
        entry = entryVoucher(farm, owner, seller, 60_000_000L, 2_000_000L, EntryVoucherStatus.POSTED);
        exit = exitVoucher(farm, owner, buyer, 60_000_000L, 1_000_000L, ExitVoucherStatus.CONFIRMED);
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor as(String email) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email);
    }

    private String body(String date, String amount, String method) {
        return "{\"paymentDate\":\"" + date + "\",\"amount\":" + amount + ",\"method\":" + method + ",\"reference\":\"ck\"}";
    }

    private String entryUrl() {
        return "/api/farms/" + farm.getId() + "/vouchers/entry/" + entry.getId() + "/payments";
    }

    @Test
    void managerRecordsPaymentGets201WithSummary() throws Exception {
        mvc
            .perform(post(entryUrl()).with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body("2026-10-28", "20000000", "\"BANK_TRANSFER\"")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.payment.amount").value(20000000))
            .andExpect(jsonPath("$.payment.direction").value("PAY"))
            .andExpect(jsonPath("$.payment.status").value("RECORDED"))
            .andExpect(jsonPath("$.summary.outstanding").value(42000000))
            .andExpect(jsonPath("$.summary.state").value("PARTLY_PAID"))
            .andExpect(jsonPath("$.summary.voucherCode").value(entry.getCode()));
    }

    @Test
    void overpaymentIs422WithCodeAndParams() throws Exception {
        mvc
            .perform(post(entryUrl()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body("2026-10-28", "62000001", "\"CASH\"")))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE06-13"))
            .andExpect(jsonPath("$.params.amount").value(62000000))
            .andExpect(jsonPath("$.status").value(422))
            .andExpect(jsonPath("$.message").value("The amount cannot exceed 62000000 VND."));
    }

    @Test
    void vietnameseTextIsServedForAcceptLanguageVi() throws Exception {
        mvc
            .perform(
                post(entryUrl())
                    .with(as(owner.getEmail()))
                    .header("Accept-Language", "vi")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body("2026-10-28", "62000001", "\"CASH\""))
            )
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE06-13"))
            .andExpect(jsonPath("$.message").value("Số tiền không được vượt quá 62000000 đ."));
    }

    @Test
    void technicianGets403MsgCom01() throws Exception {
        mvc
            .perform(post(entryUrl()).with(as(technician.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body("2026-10-28", "1000", "\"CASH\"")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void managerCollectingFromBuyerGets403() throws Exception {
        mvc
            .perform(
                post("/api/farms/" + farm.getId() + "/vouchers/exit/" + exit.getId() + "/payments")
                    .with(as(manager.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body("2026-10-28", "1000", "\"CASH\""))
            )
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void expiredFarmGets403MsgCom12() throws Exception {
        farm.setServiceStatus("EXPIRED");
        em.flush();
        mvc
            .perform(post(entryUrl()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body("2026-10-28", "1000", "\"CASH\"")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-12"))
            .andExpect(jsonPath("$.params.status").value("EXPIRED"));
    }

    @Test
    void invalidBodyIs400WithFieldErrors() throws Exception {
        mvc
            .perform(post(entryUrl()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"paymentDate\":\"2026-10-28\",\"amount\":-5}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    void staleVoucherVersionIs409MsgCom05() throws Exception {
        mvc
            .perform(
                post(entryUrl())
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"paymentDate\":\"2026-10-28\",\"amount\":1000,\"method\":\"CASH\",\"voucherVersion\":41}")
            )
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    @Test
    void futureDateIsRejectedWithMsgCom07() throws Exception {
        mvc
            .perform(post(entryUrl()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body("2026-10-29", "1000", "\"CASH\"")))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-COM-07"));
    }

    @Test
    void unknownVoucherTypeIs404() throws Exception {
        mvc
            .perform(get("/api/farms/" + farm.getId() + "/vouchers/feed/1/payments").with(as(owner.getEmail())))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("MSG-COM-08"));
    }

    @Test
    void recordThenListThenVoid() throws Exception {
        String created = mvc
            .perform(post(entryUrl()).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body("2026-10-28", "5000000", "\"CASH\"")))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        int paymentId = com.jayway.jsonpath.JsonPath.read(created, "$.payment.id");

        mvc
            .perform(get(entryUrl()).with(as(manager.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.payments.length()").value(1))
            .andExpect(jsonPath("$.summary.paid").value(5000000));

        mvc
            .perform(
                post("/api/farms/" + farm.getId() + "/payments/" + paymentId + "/void")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reason\":\"entered twice\"}")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.payment.status").value("VOIDED"))
            .andExpect(jsonPath("$.summary.outstanding").value(62000000));

        mvc
            .perform(
                post("/api/farms/" + farm.getId() + "/payments/" + paymentId + "/void")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reason\":\"again\"}")
            )
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));

        mvc
            .perform(
                post("/api/farms/" + farm.getId() + "/payments/" + paymentId + "/void")
                    .with(as(owner.getEmail()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reason\":\"\"}")
            )
            .andExpect(status().isBadRequest());
    }
}
