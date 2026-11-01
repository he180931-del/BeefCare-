package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Attachment;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** Integration contract for private attachments on entry and exit vouchers. */
@ServiceIntegrationTest
@Transactional
class VoucherAttachmentResourceTest extends DomainTestSupport {

    private static final byte[] PDF = "%PDF-1.4\n%%EOF\n".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] JPEG = { (byte) 0xff, (byte) 0xd8, (byte) 0xff, 0, 1, (byte) 0xff, (byte) 0xd9 };
    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a };

    @Autowired MockMvc mvc;

    private Farm farm;
    private AppUser owner;
    private AppUser manager;
    private AppUser technician;
    private HerdEntryVoucher entry;
    private HerdExitVoucher exit;

    @BeforeEach
    void setUp() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        entry = entryVoucher(farm, owner, partner(farm, owner, true, false), 1_000L, 0L, EntryVoucherStatus.DRAFT);
        exit = exitVoucher(farm, owner, partner(farm, owner, false, true), 1_000L, 0L, ExitVoucherStatus.DRAFT);
    }

    private static RequestPostProcessor as(AppUser user) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(user.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            processed.addHeader("Idempotency-Key", UUID.randomUUID().toString());
            return processed;
        };
    }

    private String entryFiles() {
        return "/api/farms/" + farm.getId() + "/entry-vouchers/" + entry.getId() + "/attachments";
    }

    private String exitFiles() {
        return "/api/farms/" + farm.getId() + "/exit-vouchers/" + exit.getId() + "/attachments";
    }

    private static MockMultipartFile file(String name, String type, byte[] content) {
        return new MockMultipartFile("file", name, type, content);
    }

    @Test
    void draftEntryAttachmentCanBeUploadedListedDownloadedAndRemoved() throws Exception {
        MvcResult uploaded = mvc.perform(multipart(entryFiles()).file(file("invoice.pdf", "application/pdf", PDF)).with(as(manager)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentType").value("application/pdf"))
            .andExpect(jsonPath("$.fileSize").value(PDF.length))
            .andExpect(jsonPath("$.storageKey").doesNotExist())
            .andReturn();
        long id = com.jayway.jsonpath.JsonPath.<Integer>read(uploaded.getResponse().getContentAsString(), "$.id");

        mvc.perform(get(entryFiles()).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        MvcResult download = mvc.perform(get(entryFiles() + "/" + id).with(as(owner))).andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("invoice.pdf")))
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andReturn();
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(PDF);

        mvc.perform(delete(entryFiles() + "/" + id).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get(entryFiles()).with(as(owner))).andExpect(jsonPath("$.length()").value(0));
        assertThat(em.find(Attachment.class, id).getRemovedAt()).isNotNull();
        assertThat(em.find(Attachment.class, id).getOwnerType().name()).isEqualTo("HERD_ENTRY_VOUCHER");
    }

    @Test
    void draftExitAttachmentCanBeUploadedAndReadByManagerButOnlyOwnerCanChangeIt() throws Exception {
        MvcResult uploaded = mvc.perform(multipart(exitFiles()).file(file("permit.jpg", "image/jpeg", JPEG)).with(as(owner)))
            .andExpect(status().isOk()).andReturn();
        long id = com.jayway.jsonpath.JsonPath.<Integer>read(uploaded.getResponse().getContentAsString(), "$.id");

        mvc.perform(get(exitFiles()).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get(exitFiles() + "/" + id).with(as(manager))).andExpect(status().isOk());
        mvc.perform(delete(exitFiles() + "/" + id).with(as(manager))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(multipart(exitFiles()).file(file("x.pdf", "application/pdf", PDF)).with(as(manager))).andExpect(status().isForbidden());
    }

    @Test
    void postedAndConfirmedVouchersRemainReadableButCannotChangeAttachments() throws Exception {
        long entryId = com.jayway.jsonpath.JsonPath.<Integer>read(
            mvc.perform(multipart(entryFiles()).file(file("posted.pdf", "application/pdf", PDF)).with(as(owner))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString(), "$.id");
        entry.setStatus(EntryVoucherStatus.POSTED);
        em.flush();
        mvc.perform(get(entryFiles() + "/" + entryId).with(as(manager))).andExpect(status().isOk());
        mvc.perform(delete(entryFiles() + "/" + entryId).with(as(owner))).andExpect(status().isConflict());

        long exitId = com.jayway.jsonpath.JsonPath.<Integer>read(
            mvc.perform(multipart(exitFiles()).file(file("confirmed.pdf", "application/pdf", PDF)).with(as(owner))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString(), "$.id");
        exit.setStatus(ExitVoucherStatus.CONFIRMED);
        em.flush();
        mvc.perform(get(exitFiles() + "/" + exitId).with(as(manager))).andExpect(status().isOk());
        mvc.perform(delete(exitFiles() + "/" + exitId).with(as(owner))).andExpect(status().isConflict());
    }

    @Test
    void voucherAttachmentRejectsUnsupportedTypeMismatchAndOversizedContent() throws Exception {
        mvc.perform(multipart(entryFiles()).file(file("image.png", "image/png", PNG)).with(as(owner)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("unsupported_type"));
        mvc.perform(multipart(entryFiles()).file(file("mislabelled.jpg", "image/jpeg", PDF)).with(as(owner)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("content_type_mismatch"));
        mvc.perform(multipart(entryFiles()).file(file("large.pdf", "application/pdf", new byte[10 * 1024 * 1024 + 1])).with(as(owner)))
            .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.params.reason").value("too_large"));
    }

    @Test
    void technicianAndOtherFarmMembersCannotAccessVoucherAttachments() throws Exception {
        mvc.perform(get(entryFiles()).with(as(technician))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        Farm other = farm();
        AppUser both = memberWithRole(other, FarmRole.MANAGER);
        member(farm, both, FarmRole.MANAGER.name(), "ACTIVE");
        String otherPath = "/api/farms/" + other.getId() + "/entry-vouchers/" + entry.getId() + "/attachments";
        mvc.perform(get(otherPath).with(as(both))).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
    }
}
