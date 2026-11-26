package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * HTTP contract of {@code POST /api/farms} (UC-FE02-01, SCR-10): field rules, message codes, Location and the request
 * key. Field limits follow SCR-10; the province rule follows the FE-02 Q3 decision (one of the 34 provinces and
 * centrally-run cities, stored by name).
 */
@ServiceIntegrationTest
@Transactional
class FarmRegistrationResourceTest extends DomainTestSupport {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    private AppUser owner;

    @BeforeEach
    void completedOwner() {
        owner = completedOwner("0900000000");
    }

    private AppUser completedOwner(String phone) {
        AppUser u = user();
        u.setOwnerRegistrationCompleted(true);
        u.setOwnerRegistrationCompletedAt(clock.instant());
        u.setPhone(phone);
        em.flush();
        return u;
    }

    private RequestPostProcessor as(AppUser user, String key) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(user.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            processed.addHeader("Idempotency-Key", key);
            return processed;
        };
    }

    /** The three required SCR-10 fields, valid; {@code changes} overrides or adds fields (a null value sends JSON null). */
    private static Map<String, Object> body(Object... changes) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Trại Thung Mây");
        body.put("province", "Phú Thọ");
        body.put("commune", "Xã Minh Đài");
        for (int i = 0; i < changes.length; i += 2) body.put((String) changes[i], changes[i + 1]);
        return body;
    }

    private ResultActions register(AppUser user, String key, Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/farms").with(as(user, key)).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body)));
    }

    private ResultActions register(Map<String, Object> body) throws Exception {
        return register(owner, UUID.randomUUID().toString(), body);
    }

    private void rejected(Map<String, Object> body, String field) throws Exception {
        register(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem(field)));
    }

    private Farm created(Map<String, Object> body) throws Exception {
        String json = register(body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return em.find(Farm.class, om.readTree(json).path("id").asLong());
    }

    private long ownerMemberships(AppUser user) {
        return em
            .createQuery("select count(m) from FarmMembership m where m.user.id = :u", Long.class)
            .setParameter("u", user.getId())
            .getSingleResult();
    }

    @Test
    void tc0201FarmNameMustHaveTwoToOneHundredFiftyCharacters() throws Exception {
        rejected(body("name", "A"), "name");
        rejected(body("name", "x".repeat(151)), "name");
        assertThat(created(body("name", "AB")).getName()).isEqualTo("AB");
        assertThat(created(body("name", "x".repeat(150))).getName()).hasSize(150);
    }

    @Test
    void tc0202ProvinceAndCommuneAreRequired() throws Exception {
        rejected(body("province", ""), "province");
        rejected(body("commune", " "), "commune");
        rejected(body("province", null), "province");
    }

    @Test
    void tc0203OptionalTextFieldsHaveTheirMaximumLength() throws Exception {
        rejected(body("commune", "x".repeat(151)), "commune");
        rejected(body("detailedAddress", "x".repeat(256)), "detailedAddress");
        rejected(body("contactPerson", "x".repeat(101)), "contactPerson");
        rejected(body("registrationCertificateInfo", "x".repeat(256)), "registrationCertificateInfo");
        Farm atLimit = created(
            body("commune", "c".repeat(150), "detailedAddress", "a".repeat(255), "contactPerson", "p".repeat(100), "registrationCertificateInfo", "r".repeat(255))
        );
        assertThat(atLimit.getCommune()).hasSize(150);
        assertThat(atLimit.getDetailedAddress()).hasSize(255);
        assertThat(atLimit.getContactPerson()).hasSize(100);
        assertThat(atLimit.getRegistrationCertificateInfo()).hasSize(255);
    }

    @Test
    void tc0204ContactPhoneIsZeroOrPlus84FollowedByNineDigits() throws Exception {
        assertThat(created(body("contactPhone", "0912345678")).getContactPhone()).isEqualTo("0912345678");
        assertThat(created(body("contactPhone", "+84912345678")).getContactPhone()).isEqualTo("+84912345678");
        rejected(body("contactPhone", "12345"), "contactPhone");
        rejected(body("contactPhone", "09123456789"), "contactPhone");
        rejected(body("contactPhone", "+849123456789"), "contactPhone");
        rejected(body("contactPhone", "091234567"), "contactPhone");
    }

    @Test
    void blankContactPhoneMeansNotProvidedAndFallsBackToTheOwnerPhone() throws Exception {
        assertThat(created(body("contactPhone", "")).getContactPhone()).isEqualTo("0900000000");
        AppUser withoutPhone = completedOwner(null);
        String json = register(withoutPhone, UUID.randomUUID().toString(), body("contactPhone", ""))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        assertThat(em.find(Farm.class, om.readTree(json).path("id").asLong()).getContactPhone()).isNull();
    }

    @Test
    void expectedHerdSizeIsOptionalAndLimitedToTheFourRanges() throws Exception {
        assertThat(created(body()).getExpectedHerdSize()).isNull();
        assertThat(created(body("expectedHerdSize", "")).getExpectedHerdSize()).isNull();
        assertThat(created(body("expectedHerdSize", "OVER_300")).getExpectedHerdSize()).isEqualTo("OVER_300");
        rejected(body("expectedHerdSize", "UNKNOWN"), "expectedHerdSize");
    }

    @Test
    void provinceOutsideTheListIsRejectedWithMsgCom10() throws Exception {
        register(body("province", "Hà Tây"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.field").value("province"));
        assertThat(ownerMemberships(owner)).isZero();
        assertThat(created(body("province", " TP. Hồ Chí Minh ")).getProvince()).isEqualTo("TP. Hồ Chí Minh");
    }

    @Test
    void tc0206UnfinishedOwnerProfileGetsMsgFe0202AndNoFarm() throws Exception {
        AppUser notOwnerYet = user();
        register(notOwnerYet, UUID.randomUUID().toString(), body())
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-FE02-02"));
        assertThat(ownerMemberships(notOwnerYet)).isZero();
    }

    @Test
    void tc0208SameKeyReturnsTheSameFarmAndTc0209ReusedKeyWithOtherDataIsRejected() throws Exception {
        String key = UUID.randomUUID().toString();
        String first = register(owner, key, body("name", "Trại lặp"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        long farmId = om.readTree(first).path("id").asLong();

        register(owner, key, body("name", "Trại lặp"))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/farms/" + farmId))
            .andExpect(jsonPath("$.id").value(farmId))
            .andExpect(jsonPath("$.serviceStatus").value("PENDING_PAYMENT"));
        assertThat(ownerMemberships(owner)).isEqualTo(1);

        register(owner, key, body("name", "Trại khác")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        assertThat(ownerMemberships(owner)).isEqualTo(1);
    }
}
