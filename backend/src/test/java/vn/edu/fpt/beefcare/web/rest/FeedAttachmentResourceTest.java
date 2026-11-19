package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
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
import vn.edu.fpt.beefcare.domain.FeedItem;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.FeedAttachmentService;
import vn.edu.fpt.beefcare.service.FeedManagementService;
import vn.edu.fpt.beefcare.service.FeedStockAdjustmentService;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.AdjustmentView;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.CreateReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.ReceiptLineRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.ReceiptView;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.StockAdjustmentLine;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.StockAdjustmentRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * SCR-79 / SCR-80 attachments over HTTP: the invoice or delivery note of a feed receipt and the count record or photos of a stock
 * adjustment (PDF or JPEG, 10 MB each, Owner and Manager, DRAFT only for changes).
 */
@ServiceIntegrationTest
@Transactional
class FeedAttachmentResourceTest extends DomainTestSupport {

    private static final byte[] PDF = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] JPEG = {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 16, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, (byte) 0xff, (byte) 0xd9};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0};

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired FeedManagementService feedService;
    @Autowired FeedStockAdjustmentService adjustmentService;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    ReceiptView receipt;
    AdjustmentView adjustment;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        FeedItem hay = new FeedItem();
        hay.setFarm(farm);
        hay.setCode("TA-" + next());
        hay.setName("Hay " + next());
        hay.setFeedGroup("DRY_ROUGHAGE");
        hay.setOnHandKg(new BigDecimal("100.000"));
        hay.setAvgUnitCost(new BigDecimal("50.00"));
        hay.setAvailable(true);
        save(hay);
        TradingPartner supplier = partner(farm, owner, false, false);
        supplier.setSupplier(true);
        save(supplier);
        actAs(manager);
        receipt = feedService.createReceipt(farm.getId(),
            new CreateReceiptRequest(TODAY, supplier.getId(), "INV-1", "Manager", "Shed 1", null, 0L,
                List.of(new ReceiptLineRequest(hay.getId(), "LOT-1", TODAY.plusDays(90), new BigDecimal("10"), "kg", 100L)), false), false);
        adjustment = adjustmentService.create(farm.getId(),
            new StockAdjustmentRequest(TODAY, "PERIODIC_COUNT", "Manager", List.of(new StockAdjustmentLine(hay.getId(), new BigDecimal("95"), "Hao hut")), false));
    }

    private static RequestPostProcessor as(AppUser user) {
        return request -> as(user, UUID.randomUUID().toString()).postProcessRequest(request);
    }

    private static RequestPostProcessor as(AppUser user, String key) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(user.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            processed.addHeader("Idempotency-Key", key);
            return processed;
        };
    }

    private String receiptFiles() {
        return "/api/farms/" + farm.getId() + "/feed/receipts/" + receipt.id() + "/attachments";
    }

    private String adjustmentFiles() {
        return "/api/farms/" + farm.getId() + "/feed/adjustments/" + adjustment.id() + "/attachments";
    }

    private static MockMultipartFile file(String name, String type, byte[] content) {
        return new MockMultipartFile("file", name, type, content);
    }

    private long upload(String path, AppUser by, MockMultipartFile file) throws Exception {
        MvcResult result = mvc.perform(multipart(path).file(file).with(as(by))).andExpect(status().isOk()).andReturn();
        return om.readTree(result.getResponse().getContentAsString()).path("id").asLong();
    }

    // ---------------------------------------------------------------- happy paths

    @Test
    void managerAttachesListsDownloadsAndRemovesAnInvoiceOnADraftReceipt() throws Exception {
        MvcResult uploaded = mvc.perform(multipart(receiptFiles()).file(file("invoice.pdf", "application/pdf", PDF)).with(as(manager)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.contentType").value("application/pdf")).andExpect(jsonPath("$.fileSize").value(PDF.length))
            .andExpect(jsonPath("$.originalFilename").value("invoice.pdf")).andExpect(jsonPath("$.storageKey").doesNotExist()).andExpect(jsonPath("$.createdAt").exists())
            .andReturn();
        long id = om.readTree(uploaded.getResponse().getContentAsString()).path("id").asLong();
        long photo = upload(receiptFiles(), owner, file("delivery-note.jpg", "image/jpeg", JPEG)); // the Owner may too

        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].id").value(id)).andExpect(jsonPath("$[1].id").value(photo));
        MvcResult download = mvc.perform(get(receiptFiles() + "/" + id).with(as(owner))).andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.allOf(org.hamcrest.Matchers.startsWith("attachment"), org.hamcrest.Matchers.containsString("invoice.pdf"))))
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store"))).andExpect(header().string("X-Content-Type-Options", "nosniff")).andReturn();
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(PDF);

        mvc.perform(delete(receiptFiles() + "/" + id).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(photo));
        mvc.perform(get(receiptFiles() + "/" + id).with(as(manager))).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        // metadata is kept with removed_at (history); the file is simply no longer served
        assertThat(em.find(Attachment.class, id).getRemovedAt()).isNotNull();
        assertThat(em.find(Attachment.class, id).getOwnerType()).isEqualTo(AttachmentOwnerType.FEED_RECEIPT);
    }

    @Test
    void aStockAdjustmentTakesCountRecordsAndPhotos() throws Exception {
        long count = upload(adjustmentFiles(), manager, file("count-sheet.pdf", "application/pdf", PDF));
        long photo = upload(adjustmentFiles(), owner, file("shed.JPEG", "image/jpeg", JPEG));
        mvc.perform(get(adjustmentFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[1].originalFilename").value("shed.JPEG"));
        assertThat(mvc.perform(get(adjustmentFiles() + "/" + photo).with(as(manager))).andExpect(status().isOk()).andExpect(header().string("Content-Type", "image/jpeg"))
            .andReturn().getResponse().getContentAsByteArray()).isEqualTo(JPEG);
        // a receipt's list does not show the adjustment's files
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete(adjustmentFiles() + "/" + count).with(as(owner))).andExpect(status().isOk());
        mvc.perform(get(adjustmentFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void uploadIsIdempotentPerKeyAndContent() throws Exception {
        String key = UUID.randomUUID().toString();
        long first = om.readTree(mvc.perform(multipart(receiptFiles()).file(file("invoice.pdf", "application/pdf", PDF)).with(as(manager, key)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(multipart(receiptFiles()).file(file("invoice.pdf", "application/pdf", PDF)).with(as(manager, key)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(first));
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(1));
        // the same key with other content is refused instead of silently replaying
        mvc.perform(multipart(receiptFiles()).file(file("other.jpg", "image/jpeg", JPEG)).with(as(manager, key)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(1));
        // a missing header is a client error and stores nothing
        mvc.perform(multipart(receiptFiles()).file(file("invoice.pdf", "application/pdf", PDF)).with(request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(manager.getEmail()).postProcessRequest(request);
            return SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
        })).andExpect(status().isBadRequest());
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(1));
    }

    // ---------------------------------------------------------------- roles and farms

    @Test
    void aTechnicianCannotAttachListDownloadOrRemove() throws Exception {
        long id = upload(receiptFiles(), manager, file("invoice.pdf", "application/pdf", PDF));
        mvc.perform(multipart(receiptFiles()).file(file("x.pdf", "application/pdf", PDF)).with(as(technician))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get(receiptFiles()).with(as(technician))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get(receiptFiles() + "/" + id).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(delete(receiptFiles() + "/" + id).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(multipart(adjustmentFiles()).file(file("x.pdf", "application/pdf", PDF)).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(get(adjustmentFiles()).with(as(technician))).andExpect(status().isForbidden());
        assertThat(em.find(Attachment.class, id).getRemovedAt()).isNull();
    }

    @Test
    void aMemberOfAnotherFarmAndAnAnonymousCallerAreRefused() throws Exception {
        long id = upload(receiptFiles(), manager, file("invoice.pdf", "application/pdf", PDF));
        Farm other = farm();
        AppUser strangerOwner = memberWithRole(other, FarmRole.OWNER);
        mvc.perform(get(receiptFiles()).with(as(strangerOwner))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get(receiptFiles() + "/" + id).with(as(strangerOwner))).andExpect(status().isForbidden());
        mvc.perform(multipart(receiptFiles()).file(file("x.pdf", "application/pdf", PDF)).with(as(strangerOwner))).andExpect(status().isForbidden());
        mvc.perform(delete(receiptFiles() + "/" + id).with(as(strangerOwner))).andExpect(status().isForbidden());
        // (the thread still holds the actAs(manager) context from setUp, so anonymous must be explicit)
        mvc.perform(get(receiptFiles()).with(SecurityMockMvcRequestPostProcessors.anonymous())).andExpect(status().isUnauthorized());
        mvc.perform(multipart(receiptFiles()).file(file("x.pdf", "application/pdf", PDF)).with(SecurityMockMvcRequestPostProcessors.anonymous()).with(SecurityMockMvcRequestPostProcessors.csrf()))
            .andExpect(status().isUnauthorized());
        // even a member of both farms cannot reach this farm's document through the other farm's route, nor a foreign attachment id
        AppUser both = memberWithRole(other, FarmRole.MANAGER);
        member(farm, both, FarmRole.MANAGER.name(), "ACTIVE");
        String viaOtherFarm = "/api/farms/" + other.getId() + "/feed/receipts/" + receipt.id() + "/attachments";
        mvc.perform(get(viaOtherFarm).with(as(both))).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        mvc.perform(multipart(viaOtherFarm).file(file("x.pdf", "application/pdf", PDF)).with(as(both))).andExpect(status().isNotFound());
        mvc.perform(get(viaOtherFarm + "/" + id).with(as(both))).andExpect(status().isNotFound());
        // an attachment of the receipt is not reachable as an adjustment file, and the shared photo route never serves feed documents
        mvc.perform(get(adjustmentFiles() + "/" + id).with(as(manager))).andExpect(status().isNotFound());
        mvc.perform(get("/api/farms/" + farm.getId() + "/attachments/" + id).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get(receiptFiles() + "/" + id).with(as(manager))).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- validation

    @Test
    void sizeTypeAndContentRulesAreEnforcedFromTheBytesNotTheLabel() throws Exception {
        byte[] atLimit = Arrays.copyOf(PDF, (int) FeedAttachmentService.MAX_BYTES);
        byte[] overLimit = Arrays.copyOf(PDF, (int) FeedAttachmentService.MAX_BYTES + 1);
        upload(receiptFiles(), manager, file("exactly-10-mib.pdf", "application/pdf", atLimit)); // "max 10 MB each" includes 10 MB
        mvc.perform(multipart(receiptFiles()).file(file("too-big.pdf", "application/pdf", overLimit)).with(as(manager)))
            .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("file")).andExpect(jsonPath("$.params.reason").value("too_large"));
        // not a PDF or JPEG, however it is named or labelled
        mvc.perform(multipart(receiptFiles()).file(file("invoice.pdf", "application/pdf", "hello, not a pdf".getBytes(StandardCharsets.UTF_8))).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("unsupported_type"));
        mvc.perform(multipart(receiptFiles()).file(file("script.pdf", "application/pdf", "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8))).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType());
        mvc.perform(multipart(receiptFiles()).file(file("photo.png", "image/png", PNG)).with(as(manager))) // PNG is a cattle-photo type, not a feed document type
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("unsupported_type"));
        mvc.perform(multipart(receiptFiles()).file(file("page.html", "text/html", "<html></html>".getBytes(StandardCharsets.UTF_8))).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType());
        // right bytes, wrong label (and the reverse)
        mvc.perform(multipart(receiptFiles()).file(file("photo.pdf", "application/pdf", JPEG)).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("content_type_mismatch"));
        mvc.perform(multipart(receiptFiles()).file(file("scan.jpg", "image/jpeg", PDF)).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("content_type_mismatch"));
        mvc.perform(multipart(receiptFiles()).file(file("scan.pdf", "application/octet-stream", PDF)).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType());
        // a charset parameter on the declared type is harmless
        upload(receiptFiles(), manager, file("scan.pdf", "application/pdf; charset=binary", PDF));
        // empty file and no file part
        mvc.perform(multipart(receiptFiles()).file(file("empty.pdf", "application/pdf", new byte[0])).with(as(manager)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        mvc.perform(multipart(receiptFiles()).with(as(manager))).andExpect(status().isBadRequest());
        // only the two accepted files were stored; the rejected ones left nothing behind
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(jsonPath("$.length()").value(2));
        assertThat(em.createQuery("select count(a) from Attachment a where a.farm.id=:farm and a.ownerType=:type", Long.class)
            .setParameter("farm", farm.getId()).setParameter("type", AttachmentOwnerType.FEED_RECEIPT).getSingleResult()).isEqualTo(2L);
    }

    @Test
    void fileNamesAreSanitizedAndAlwaysMatchTheDetectedType() throws Exception {
        long traversal = upload(receiptFiles(), manager, file("../../etc/passwd\u202E.exe", "application/pdf", PDF));
        long windows = upload(receiptFiles(), manager, file("C:\\Users\\farm\\scan.JPEG", "image/jpeg", JPEG));
        long control = upload(receiptFiles(), manager, file("inv\u0000oi\nce<1>?.pdf", "application/pdf", PDF));
        long blank = upload(receiptFiles(), manager, file("   ", "application/pdf", PDF));
        long dots = upload(receiptFiles(), manager, file("..", "image/jpeg", JPEG));
        assertThat(em.find(Attachment.class, traversal).getOriginalFilename()).isEqualTo("passwd.exe.pdf");
        assertThat(em.find(Attachment.class, windows).getOriginalFilename()).isEqualTo("scan.JPEG");
        assertThat(em.find(Attachment.class, control).getOriginalFilename()).isEqualTo("invoi" + "ce1.pdf");
        assertThat(em.find(Attachment.class, blank).getOriginalFilename()).isEqualTo("document.pdf");
        assertThat(em.find(Attachment.class, dots).getOriginalFilename()).isEqualTo("document.jpg");
        String longName = "n".repeat(300) + ".pdf";
        long truncated = upload(receiptFiles(), manager, file(longName, "application/pdf", PDF));
        assertThat(em.find(Attachment.class, truncated).getOriginalFilename()).hasSize(255).endsWith(".pdf");
        assertThat(FeedAttachmentService.displayName("a.pdf.exe", ".pdf")).isEqualTo("a.pdf.exe.pdf");
    }

    // ---------------------------------------------------------------- status rules

    @Test
    void filesChangeOnlyWhileTheDocumentIsADraft() throws Exception {
        long onReceipt = upload(receiptFiles(), manager, file("invoice.pdf", "application/pdf", PDF));
        long onAdjustment = upload(adjustmentFiles(), manager, file("count.pdf", "application/pdf", PDF));
        actAs(manager); // the MockMvc requests above cleared the thread's security context
        feedService.postReceipt(farm.getId(), receipt.id(), receipt.version());
        adjustmentService.post(farm.getId(), adjustment.id(), adjustment.version());
        em.flush();

        // a POSTED receipt opens read-only (SCR-79) and a posted adjustment is immutable (GBR-100): view yes, change no
        mvc.perform(multipart(receiptFiles()).file(file("late.pdf", "application/pdf", PDF)).with(as(manager)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05")).andExpect(jsonPath("$.params.reason").value("receipt_is_not_draft"));
        mvc.perform(delete(receiptFiles() + "/" + onReceipt).with(as(manager)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        mvc.perform(multipart(adjustmentFiles()).file(file("late.pdf", "application/pdf", PDF)).with(as(owner)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.params.reason").value("adjustment_is_not_draft"));
        mvc.perform(delete(adjustmentFiles() + "/" + onAdjustment).with(as(owner))).andExpect(status().isConflict());
        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        assertThat(mvc.perform(get(receiptFiles() + "/" + onReceipt).with(as(owner))).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(mvc.perform(get(adjustmentFiles() + "/" + onAdjustment).with(as(manager))).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(em.find(Attachment.class, onReceipt).getRemovedAt()).isNull();
    }

    @Test
    void anUnknownDocumentIsNotFoundAndASuspendedFarmBlocksChanges() throws Exception {
        mvc.perform(multipart("/api/farms/" + farm.getId() + "/feed/receipts/999999/attachments").file(file("x.pdf", "application/pdf", PDF)).with(as(manager)))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        mvc.perform(get("/api/farms/" + farm.getId() + "/feed/adjustments/999999/attachments").with(as(manager))).andExpect(status().isNotFound());
        farm.setServiceStatus("SUSPENDED");
        em.flush();
        mvc.perform(multipart(receiptFiles()).file(file("x.pdf", "application/pdf", PDF)).with(as(manager)))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-12"));
    }

    // ---------------------------------------------------------------- shared store and database rule

    @Test
    void theDatabaseItselfRefusesAFeedDocumentThatIsNotPdfOrJpeg() {
        Attachment bad = new Attachment();
        bad.setFarm(farm);
        bad.setOwnerType(AttachmentOwnerType.FEED_RECEIPT);
        bad.setOwnerId(receipt.id());
        bad.setStorageKey("ab/" + UUID.randomUUID() + ".png");
        bad.setOriginalFilename("photo.png");
        bad.setContentType("image/png"); // valid for a cattle photo, never for a feed document (ck_attachment_feed_document)
        bad.setFileSize(10L);
        bad.setCreatedAt(Instant.now());
        em.persist(bad);
        assertThatThrownBy(() -> em.flush()).isInstanceOfAny(DataIntegrityViolationException.class, jakarta.persistence.PersistenceException.class);
    }
}
