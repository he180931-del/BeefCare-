package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
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
import vn.edu.fpt.beefcare.domain.FeedItem;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.service.FeedManagementService;
import vn.edu.fpt.beefcare.service.FeedPaymentAttachmentService;
import vn.edu.fpt.beefcare.service.VoucherPaymentService;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.CreateReceiptRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.ReceiptLineRequest;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.ReceiptView;
import vn.edu.fpt.beefcare.service.dto.PaymentResultDTO;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** Payment-level evidence stays distinct from the feed-receipt attachment collection. */
@ServiceIntegrationTest
@Transactional
class FeedPaymentAttachmentResourceTest extends DomainTestSupport {

    private static final byte[] PDF = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] PDF_ALT = "%PDF-1.5\n2 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] JPEG = {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 16, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, (byte) 0xff, (byte) 0xd9};

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired FeedManagementService feedService;
    @Autowired VoucherPaymentService paymentService;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    FeedItem hay;
    TradingPartner supplier;
    ReceiptView receipt;
    Long paymentId;

    @BeforeEach
    void setUpFarmAndRecordedPayment() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        hay = new FeedItem();
        hay.setFarm(farm);
        hay.setCode("TA-" + next());
        hay.setName("Hay " + next());
        hay.setFeedGroup("DRY_ROUGHAGE");
        hay.setOnHandKg(new BigDecimal("100.000"));
        hay.setAvgUnitCost(new BigDecimal("50.00"));
        hay.setAvailable(true);
        save(hay);
        supplier = partner(farm, owner, false, false);
        supplier.setSupplier(true);
        save(supplier);

        actAs(manager);
        receipt = createPostedReceipt();
        paymentId = createRecordedPayment(receipt).payment().id();
    }

    private static RequestPostProcessor as(AppUser user) {
        return as(user, UUID.randomUUID().toString());
    }

    private static RequestPostProcessor as(AppUser user, String key) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(user.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            processed.addHeader("Idempotency-Key", key);
            return processed;
        };
    }

    private String paymentFiles() {
        return paymentFiles(receipt.id(), paymentId);
    }

    private String paymentFiles(Long receiptId, Long id) {
        return "/api/farms/" + farm.getId() + "/feed/receipts/" + receiptId + "/payments/" + id + "/attachments";
    }

    private String receiptFiles() {
        return "/api/farms/" + farm.getId() + "/feed/receipts/" + receipt.id() + "/attachments";
    }

    private static MockMultipartFile file(String name, String type, byte[] content) {
        return new MockMultipartFile("file", name, type, content);
    }

    private long upload(String path, AppUser by, MockMultipartFile file) throws Exception {
        MvcResult result = mvc.perform(multipart(path).file(file).with(as(by)))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asLong();
    }

    private ReceiptView createPostedReceipt() {
        actAs(manager);
        ReceiptView draft = feedService.createReceipt(farm.getId(), new CreateReceiptRequest(TODAY, supplier.getId(), "INV-" + next(),
            "Manager", "Shed 1", null, 0L,
            List.of(new ReceiptLineRequest(hay.getId(), "LOT-" + next(), TODAY.plusDays(90), new BigDecimal("10"), "kg", 100L)), false), false);
        return feedService.postReceipt(farm.getId(), draft.id(), draft.version());
    }

    private PaymentResultDTO createRecordedPayment(ReceiptView target) {
        actAs(manager);
        return paymentService.recordFeedReceiptPayment(farm.getId(), target.id(),
            new RecordPaymentRequest(TODAY, 500L, PaymentMethod.CASH, null, null, target.version()));
    }

    @Test
    void managerCanUploadListAndDownloadPaymentEvidenceWithoutMixingReceiptFiles() throws Exception {
        MvcResult pdf = mvc.perform(multipart(paymentFiles()).file(file("../../paid-invoice.pdf", "application/pdf", PDF)).with(as(manager)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentType").value("application/pdf"))
            .andExpect(jsonPath("$.fileSize").value(PDF.length))
            .andExpect(jsonPath("$.originalFilename").value("paid-invoice.pdf"))
            .andExpect(jsonPath("$.storageKey").doesNotExist())
            .andReturn();
        long pdfId = objectMapper.readTree(pdf.getResponse().getContentAsString()).path("id").asLong();
        long jpegId = upload(paymentFiles(), owner, file("bank-slip.JPEG", "image/jpeg", JPEG));

        mvc.perform(get(paymentFiles()).with(as(manager)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].id").value(pdfId))
            .andExpect(jsonPath("$[1].id").value(jpegId));
        assertThat(mvc.perform(get(paymentFiles() + "/" + pdfId).with(as(owner)))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andReturn().getResponse().getContentAsByteArray()).isEqualTo(PDF);

        mvc.perform(get(receiptFiles()).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        Attachment saved = em.find(Attachment.class, pdfId);
        assertThat(saved.getOwnerType()).isEqualTo(AttachmentOwnerType.FEED_RECEIPT_PAYMENT);
        assertThat(saved.getOwnerId()).isEqualTo(paymentId);
    }

    @Test
    void uploadIsIdempotentAndRejectsInvalidBytesLabelsAndOversizeFiles() throws Exception {
        String key = UUID.randomUUID().toString();
        long first = objectMapper.readTree(mvc.perform(multipart(paymentFiles()).file(file("proof.pdf", "application/pdf", PDF)).with(as(manager, key)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(multipart(paymentFiles()).file(file("proof.pdf", "application/pdf", PDF)).with(as(manager, key)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(first));
        mvc.perform(multipart(paymentFiles()).file(file("different.pdf", "application/pdf", PDF_ALT)).with(as(manager, key)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));

        byte[] atLimit = Arrays.copyOf(PDF, (int) FeedPaymentAttachmentService.MAX_BYTES);
        upload(paymentFiles(), manager, file("exact-limit.pdf", "application/pdf", atLimit));
        byte[] oversize = Arrays.copyOf(PDF, (int) FeedPaymentAttachmentService.MAX_BYTES + 1);
        mvc.perform(multipart(paymentFiles()).file(file("too-large.pdf", "application/pdf", oversize)).with(as(manager)))
            .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.reason").value("too_large"));
        mvc.perform(multipart(paymentFiles()).file(file("fake.pdf", "application/pdf", "not a PDF".getBytes(StandardCharsets.UTF_8))).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("unsupported_type"));
        mvc.perform(multipart(paymentFiles()).file(file("wrong-label.pdf", "image/jpeg", PDF)).with(as(manager)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.params.reason").value("content_type_mismatch"));
        mvc.perform(get(paymentFiles()).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void paymentMustBeRecordedToAddEvidenceButVoidedPaymentEvidenceRemainsReadable() throws Exception {
        long attachmentId = upload(paymentFiles(), manager, file("proof.pdf", "application/pdf", PDF));
        VoucherPayment payment = em.find(VoucherPayment.class, paymentId);
        actAs(manager);
        paymentService.voidPayment(farm.getId(), paymentId, new VoidPaymentRequest("Recorded incorrectly", payment.getVersion()));

        mvc.perform(multipart(paymentFiles()).file(file("late-proof.pdf", "application/pdf", PDF_ALT)).with(as(manager)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        mvc.perform(get(paymentFiles()).with(as(manager))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        assertThat(mvc.perform(get(paymentFiles() + "/" + attachmentId).with(as(manager)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(em.find(Attachment.class, attachmentId).getRemovedAt()).isNull();
    }

    @Test
    void nestedIdsTenantAndRoleAreCheckedForEveryOperation() throws Exception {
        String successfulKey = UUID.randomUUID().toString();
        long attachmentId = objectMapper.readTree(mvc.perform(multipart(paymentFiles()).file(file("proof.pdf", "application/pdf", PDF)).with(as(manager, successfulKey)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        ReceiptView otherReceipt = createPostedReceipt();
        Long otherPayment = createRecordedPayment(otherReceipt).payment().id();
        String mismatchedTarget = paymentFiles(receipt.id(), otherPayment);
        mvc.perform(get(mismatchedTarget).with(as(manager))).andExpect(status().isNotFound());
        mvc.perform(multipart(mismatchedTarget).file(file("foreign.pdf", "application/pdf", PDF_ALT)).with(as(manager)))
            .andExpect(status().isNotFound());
        // A replay key does not bypass the receipt-to-payment relationship check.
        mvc.perform(multipart(paymentFiles(receipt.id() + 9999, paymentId)).file(file("proof.pdf", "application/pdf", PDF)).with(as(manager, successfulKey)))
            .andExpect(status().isNotFound());
        mvc.perform(get(paymentFiles(receipt.id() + 9999, paymentId) + "/" + attachmentId).with(as(manager)))
            .andExpect(status().isNotFound());

        mvc.perform(get(paymentFiles()).with(as(technician))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get(paymentFiles() + "/" + attachmentId).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(multipart(paymentFiles()).file(file("x.pdf", "application/pdf", PDF)).with(as(technician))).andExpect(status().isForbidden());

        Farm otherFarm = farm();
        AppUser otherOwner = memberWithRole(otherFarm, FarmRole.OWNER);
        mvc.perform(get(paymentFiles()).with(as(otherOwner))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get(paymentFiles() + "/" + attachmentId).with(SecurityMockMvcRequestPostProcessors.anonymous()))
            .andExpect(status().isUnauthorized());
        assertThat(em.find(Attachment.class, attachmentId).getRemovedAt()).isNull();
    }
}
