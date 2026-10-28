package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.service.HerdEntryImportService;
import vn.edu.fpt.beefcare.service.XlsxSupport;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** REST contract of trading partners and entry vouchers: status codes, {code, params} errors, multipart import. */
@ServiceIntegrationTest
@Transactional
class HerdEntryResourceTest extends HerdEntryTestBase {

    @Autowired
    MockMvc mvc;

    private RequestPostProcessor as(String email) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(email).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", java.util.UUID.randomUUID().toString());
            return processed;
        };
    }

    private String base() {
        return "/api/farms/" + farm.getId();
    }

    private String lineJson(String tag, long penId, String kg) {
        return (
            "{\"earTagNumber\":\"" + tag + "\",\"breedId\":" + breed.getId() + ",\"sex\":\"MALE\",\"ageMonths\":18,\"lifeStage\":\"YOUNG_STOCK\",\"purposeId\":" + fattening.getId() +
            ",\"entryWeightKg\":" + kg + ",\"weightBasis\":\"MEASURED\",\"penId\":" + penId + ",\"unitPrice\":50000}"
        );
    }

    private String voucherJson(String lines, long paid) {
        return (
            "{\"entryType\":\"PURCHASE\",\"entryDate\":\"2026-10-28\",\"sellerId\":" + seller.getId() + ",\"quarantineCertNo\":\"Q-1\",\"pricingBasis\":\"PER_KG\",\"transportFee\":100000,\"amountPaid\":" + paid +
            (paid > 0 ? ",\"paymentMethod\":\"CASH\"" : "") + ",\"lines\":[" + lines + "]}"
        );
    }

    private long createDraft(String json) throws Exception {
        MvcResult r = mvc.perform(post(base() + "/entry-vouchers").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(withVersion(json, 0))).andExpect(status().isCreated()).andReturn();
        String body = r.getResponse().getContentAsString();
        return Long.parseLong(body.replaceAll(".*?\"id\":(\\d+).*", "$1"));
    }

    private String withVersion(String json, int version) {
        return json.substring(0, json.length() - 1) + ",\"expectedVersion\":" + version + "}";
    }

    @Test
    void draftPostAndListFlow() throws Exception {
        MvcResult created = mvc
            .perform(post(base() + "/entry-vouchers").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(withVersion(voucherJson(lineJson("RS-1", penA.getId(), "300") + "," + lineJson("RS-2", penB.getId(), "200"), 5_000_000), 0)))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith(base() + "/entry-vouchers/")))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.matchesPattern("PN-2026-\\d{4}")))
            .andExpect(jsonPath("$.lines.length()").value(2))
            .andExpect(jsonPath("$.totalPayable").value(25_100_000))
            .andReturn();
        long id = Long.parseLong(created.getResponse().getContentAsString().replaceAll(".*?\"id\":(\\d+).*", "$1"));

        String postBody = "{\"expectedVersion\":" + entryVoucherVersion(id) + ",\"printQr\":true}";
        mvc.perform(get(base() + "/entry-vouchers/" + id + "/checks").with(as(manager.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.canPost").value(true)).andExpect(jsonPath("$.occupancy.length()").value(2));

        mvc
            .perform(post(base() + "/entry-vouchers/" + id + "/post").with(as(manager.getEmail())).header("Idempotency-Key", "abc").contentType(MediaType.APPLICATION_JSON).content(postBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cattleCodes.length()").value(2))
            .andExpect(jsonPath("$.alreadyPosted").value(false))
            .andExpect(jsonPath("$.printQr").value(true))
            .andExpect(jsonPath("$.posted.code").value("MSG-FE06-01"))
            .andExpect(jsonPath("$.voucher.status").value("POSTED"))
            .andExpect(jsonPath("$.voucher.amountPaid").value(5_000_000))
            .andExpect(jsonPath("$.voucher.payments.length()").value(1));

        mvc.perform(post(base() + "/entry-vouchers/" + id + "/post").with(as(manager.getEmail())).header("Idempotency-Key", "abc").contentType(MediaType.APPLICATION_JSON).content(postBody)).andExpect(status().isOk()).andExpect(jsonPath("$.alreadyPosted").value(false));

        mvc
            .perform(get(base() + "/entry-vouchers").param("status", "POSTED").param("type", "PURCHASE").with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].cattleCount").value(2))
            .andExpect(jsonPath("$.items[0].paymentState").value("PARTLY_PAID"))
            .andExpect(jsonPath("$.tiles.postedVouchers").value(1))
            .andExpect(jsonPath("$.statusCounts.POSTED").value(1));

        mvc.perform(get(base() + "/entry-vouchers/" + id).with(as(owner.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.lines[0].cattleCode").exists()).andExpect(jsonPath("$.history.length()").value(org.hamcrest.Matchers.greaterThan(1)));
        mvc.perform(get(base() + "/entry-vouchers/" + id + "/void-check").with(as(owner.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.canVoid").value(true)).andExpect(jsonPath("$.rows.length()").value(2));
    }

    @Test
    void updateAndDiscardADraft() throws Exception {
        long id = createDraft(voucherJson(lineJson("UD-1", penA.getId(), "300"), 0));
        mvc
            .perform(put(base() + "/entry-vouchers/" + id).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(withVersion(voucherJson(lineJson("UD-1", penA.getId(), "310") + "," + lineJson("UD-2", penA.getId(), "320"), 0), entryVoucherVersion(id))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.lines.length()").value(2));
        mvc.perform(delete(base() + "/entry-vouchers/" + id).param("expectedVersion", String.valueOf(entryVoucherVersion(id))).with(as(owner.getEmail()))).andExpect(status().isNoContent());
        mvc.perform(get(base() + "/entry-vouchers/" + id).with(as(owner.getEmail()))).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
    }

    @Test
    void errorsCarryCodeAndParams() throws Exception {
        // 422 business rule: more cattle than free places
        var small = pen(farm, "R" + next(), 1);
        long id = createDraft(voucherJson(lineJson("ER-1", small.getId(), "300") + "," + lineJson("ER-2", small.getId(), "300"), 0));
        mvc
            .perform(post(base() + "/entry-vouchers/" + id + "/post").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + entryVoucherVersion(id) + "}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE04-05"))
            .andExpect(jsonPath("$.params.pen_code").value(small.getCode()))
            .andExpect(jsonPath("$.params.free").value(1));

        // 400 bean validation
        mvc
            .perform(post(base() + "/entry-vouchers").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content(voucherJson(lineJson("X".repeat(31), penA.getId(), "300"), 0)))
            .andExpect(status().isBadRequest());

        // 403 technician, 404 unknown voucher
        mvc.perform(get(base() + "/entry-vouchers").with(as(technician.getEmail()))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(post(base() + "/entry-vouchers").with(as(technician.getEmail())).contentType(MediaType.APPLICATION_JSON).content(voucherJson(lineJson("T-1", penA.getId(), "300"), 0))).andExpect(status().isForbidden());
        mvc.perform(get(base() + "/entry-vouchers/999999").with(as(owner.getEmail()))).andExpect(status().isNotFound());
        // 401 without a signed-in user
        org.springframework.security.test.context.TestSecurityContextHolder.clearContext();
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        mvc.perform(get(base() + "/entry-vouchers").with(SecurityMockMvcRequestPostProcessors.anonymous())).andExpect(status().isUnauthorized());
    }

    @Test
    void correctVoidEntryAndVoidVoucher() throws Exception {
        long id = createDraft(voucherJson(lineJson("CV-1", penA.getId(), "300") + "," + lineJson("CV-2", penA.getId(), "200") + "," + lineJson("CV-3", penB.getId(), "100"), 0));
        mvc.perform(post(base() + "/entry-vouchers/" + id + "/post").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + entryVoucherVersion(id) + "}")).andExpect(status().isOk());
        actAs(owner);
        var voucher = vouchers.get(farm.getId(), id);
        long entry1 = voucher.lines().get(0).id();
        long entry2 = voucher.lines().get(1).id();
        int postedVersion = voucher.version();

        mvc
            .perform(patch(base() + "/herd-entries/" + entry1).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"price fix\",\"expectedVersion\":" + versionOf(vn.edu.fpt.beefcare.domain.HerdEntry.class, entry1) + ",\"voucherVersion\":" + postedVersion + ",\"changes\":{\"unitPrice\":60000}}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notice.code").value("MSG-FE06-06"))
            .andExpect(jsonPath("$.line.lineAmount").value(18_000_000))
            .andExpect(jsonPath("$.voucher.cattleAmount").value(18_000_000 + 10_000_000 + 5_000_000));
        mvc.perform(patch(base() + "/herd-entries/" + entry1).with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{\"unitPrice\":1}}")).andExpect(status().isBadRequest());

        mvc.perform(post(base() + "/herd-entries/" + entry2 + "/void").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"duplicate\",\"expectedVersion\":" + versionOf(vn.edu.fpt.beefcare.domain.HerdEntry.class, entry2) + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notice.code").value("MSG-FE06-12"));

        weight(em.find(vn.edu.fpt.beefcare.domain.Cattle.class, voucher.lines().get(0).cattleId()), TODAY, "301");
        mvc
            .perform(post(base() + "/entry-vouchers/" + id + "/void").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"wrong\",\"expectedVersion\":" + entryVoucherVersion(id) + "}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE06-21"))
            .andExpect(jsonPath("$.params.cattle_codes").value(voucher.lines().get(0).cattleCode()));
        mvc.perform(post(base() + "/entry-vouchers/" + id + "/void").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
    }

    @Test
    void voidVoucherSucceeds() throws Exception {
        long id = createDraft(voucherJson(lineJson("VV-1", penA.getId(), "300"), 0));
        mvc.perform(post(base() + "/entry-vouchers/" + id + "/post").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + entryVoucherVersion(id) + "}")).andExpect(status().isOk());
        mvc
            .perform(post(base() + "/entry-vouchers/" + id + "/void").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"wrong\",\"expectedVersion\":" + entryVoucherVersion(id) + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.voucher.status").value("VOIDED"))
            .andExpect(jsonPath("$.notice.code").value("MSG-FE06-22"));
        mvc.perform(post(base() + "/entry-vouchers/" + id + "/void").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"again\",\"expectedVersion\":0}")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    @Test
    void importEndpointAndTemplate() throws Exception {
        long id = createDraft(voucherJson("", 0));
        List<List<Object>> rows = new ArrayList<>();
        rows.add(new ArrayList<>(HerdEntryImportService.COLUMNS));
        rows.add(new ArrayList<>(java.util.Arrays.asList("IM-1", breed.getName(), "Male", 12, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null)));
        rows.add(new ArrayList<>(java.util.Arrays.asList("IM-2", "unknown breed", "Male", 12, null, null, 300, "Measured", penA.getCode(), fattening.getCode(), 1, null)));
        MockMultipartFile file = new MockMultipartFile("file", "cattle.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", XlsxSupport.write(rows));
        mvc
            .perform(multipart(base() + "/entry-vouchers/" + id + "/import").file(file).with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(2))
            .andExpect(jsonPath("$.valid").value(1))
            .andExpect(jsonPath("$.errors").value(1))
            .andExpect(jsonPath("$.summary.code").value("MSG-FE06-18"))
            .andExpect(jsonPath("$.addedNotice.code").value("MSG-FE06-19"))
            .andExpect(jsonPath("$.rows[1].result").value("ERROR"))
            .andExpect(jsonPath("$.voucher.lines.length()").value(1));
        mvc
            .perform(multipart(base() + "/entry-vouchers/" + id + "/import").file(file).param("commit", "false").with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.committed").value(false));
        mvc
            .perform(get(base() + "/entry-vouchers/import-template").with(as(manager.getEmail())))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("beefcare-entry-template.xlsx")));
        mvc.perform(multipart(base() + "/entry-vouchers/" + id + "/import").file(file).with(as(technician.getEmail()))).andExpect(status().isForbidden());
    }

    @Test
    void lifeStageProposalAndPendingCalves() throws Exception {
        mvc
            .perform(get(base() + "/entry-vouchers/life-stage-proposal").param("ageMonths", "8").param("entryDate", "2026-10-28").with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.lifeStage").value("WEANED_CALF"));
        mvc.perform(get(base() + "/pending-calves").with(as(owner.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(base() + "/pending-calves").with(as(technician.getEmail()))).andExpect(status().isForbidden());
        mvc.perform(post(base() + "/pending-calves/12345/died-before-registration").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\"}")).andExpect(status().isNotFound());
        mvc.perform(post(base() + "/pending-calves/12345/died-before-registration").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
    }

    @Test
    void tradingPartnerEndpoints() throws Exception {
        mvc
            .perform(post(base() + "/trading-partners").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Ong Tu\",\"seller\":true,\"phone\":\"0909\",\"area\":\"Binh Phuoc\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Ong Tu"))
            .andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(post(base() + "/trading-partners").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"ong tu\",\"seller\":true}")).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE06-25"));
        mvc.perform(post(base() + "/trading-partners").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Buyer Co\",\"buyer\":true}")).andExpect(status().isForbidden());
        mvc.perform(post(base() + "/trading-partners").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Buyer Co\",\"buyer\":true}")).andExpect(status().isCreated());
        mvc.perform(post(base() + "/trading-partners").with(as(owner.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"No role\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(base() + "/trading-partners").with(as(technician.getEmail())).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\",\"seller\":true}")).andExpect(status().isForbidden());
        mvc.perform(get(base() + "/trading-partners").param("role", "BUYER").with(as(manager.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get(base() + "/trading-partners").param("q", "tu").with(as(manager.getEmail()))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get(base() + "/trading-partners").with(as(technician.getEmail()))).andExpect(status().isForbidden());
    }
}
