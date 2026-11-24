package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-07 / A9, A10 (D31): who may read SCR-16, search, filters, Vietnamese name order, paging, farms joined, account
 * detail and the absence of phone / password data. Real security chain, JSON and database. Also run on PostgreSQL.
 * Every test isolates its accounts with a unique tag in the email (other test data may share the database).
 */
@ServiceIntegrationTest
@Transactional
class PlatformAccountListResourceTest extends DomainTestSupport {
    static final String BASE = "/api/platform/accounts";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired DataSource dataSource;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;

    private AppUser staff(String role, String status) {
        AppUser user = user();
        save(new PlatformStaffAccess().user(user).role(role).status(status));
        return user;
    }

    private AppUser sa() { return staff("SA", "ACTIVE"); }

    private AppUser account(String local, String tag, String fullName) {
        AppUser account = new AppUser();
        account.setEmail(local + "." + tag + "@beefcare.test");
        account.setFullName(fullName);
        account.setAccountStatus("ACTIVE");
        account.setPhone("09" + (10_000_000 + next()));
        return save(account);
    }

    private void identity(AppUser account, boolean activated) {
        User identity = new User();
        identity.setLogin("uc7-" + next());
        identity.setPassword("x".repeat(60));
        identity.setEmail(account.getEmail());
        identity.setActivated(activated);
        identity.setLangKey("vi");
        identity.setCreatedBy("system");
        save(identity);
    }

    private Farm farmNamed(String name) {
        Farm farm = farm(); farm.setName(name); em.flush();
        return farm;
    }

    private ResultActions call(AppUser caller, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(caller == null ? request : request.with(SecurityMockMvcRequestPostProcessors.user(caller.getEmail())));
    }

    private ResultActions list(AppUser caller, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get(BASE);
        for (int i = 0; i + 1 < params.length; i += 2) request.param(params[i], params[i + 1]);
        return call(caller, request);
    }

    private JsonNode read(AppUser caller, String... params) throws Exception {
        return mapper.readTree(list(caller, params).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode detail(AppUser caller, Long id) throws Exception {
        return mapper.readTree(call(caller, get(BASE + "/{id}", id)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static List<String> emails(JsonNode page) {
        List<String> emails = new ArrayList<>();
        page.path("items").forEach(row -> emails.add(row.path("email").asText()));
        return emails;
    }

    private static JsonNode row(JsonNode page, AppUser account) {
        for (JsonNode row : page.path("items")) if (row.path("id").asLong() == account.getId()) return row;
        throw new AssertionError("no row " + account.getId() + " in " + page);
    }

    private boolean postgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            return "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName());
        }
    }

    /** TC-03-74: order by name (email when unnamed), platform role as stored, farms joined = ACTIVE memberships, no phone. */
    @Test
    void listsAccountsByNameWithPlatformRoleVerificationAndFarmsJoined() throws Exception {
        AppUser admin = sa();
        String tag = "uc7l" + next();
        AppUser hung = account("hung", tag, "Nguyen Van Hung");
        AppUser an = account("an", tag, "an tran");
        AppUser binh = account("binh", tag, "Binh Le");
        AppUser unnamed = account("aaa", tag, " ");
        Farm first = farm(); Farm second = farm(); Farm third = farm();
        member(first, hung, "OWNER", "ACTIVE"); member(second, hung, "OWNER", "ACTIVE");
        member(third, hung, "MANAGER", "INACTIVE");
        member(first, an, "MANAGER", "ACTIVE"); member(third, an, "TECHNICIAN", "ACTIVE");
        save(new PlatformStaffAccess().user(an).role("CS").status("REVOKED"));
        save(new PlatformStaffAccess().user(binh).role("PM").status("ACTIVE"));
        binh.setAccountStatus("SUSPENDED"); binh.setGoogleSubject("google-" + tag); em.flush();
        identity(hung, true); identity(an, false);
        // A request has its own persistence context: do not serve the accounts built above with their stale inverse side.
        em.flush(); em.clear();

        JsonNode page = read(admin, "q", tag);
        assertThat(emails(page)).containsExactly(unnamed.getEmail(), an.getEmail(), binh.getEmail(), hung.getEmail());
        assertThat(page.path("total").asLong()).isEqualTo(4);
        assertThat(page.path("page").asInt()).isZero();
        assertThat(page.path("size").asInt()).isEqualTo(20);

        JsonNode hungRow = row(page, hung);
        assertThat(hungRow.path("fullName").asText()).isEqualTo("Nguyen Van Hung");
        assertThat(hungRow.path("accountStatus").asText()).isEqualTo("ACTIVE");
        assertThat(hungRow.path("platformRole").isNull()).isTrue();
        assertThat(hungRow.path("farmCount").asLong()).isEqualTo(2);
        assertThat(hungRow.path("farmRoles").toString()).isEqualTo("[\"OWNER\"]");
        assertThat(hungRow.path("emailVerified").asBoolean()).isTrue();

        JsonNode anRow = row(page, an);
        assertThat(anRow.path("platformRole").asText()).isEqualTo("CS");
        assertThat(anRow.path("platformAccessStatus").asText()).isEqualTo("REVOKED");
        assertThat(anRow.path("farmCount").asLong()).isEqualTo(2);
        assertThat(anRow.path("farmRoles").toString()).isEqualTo("[\"MANAGER\",\"TECHNICIAN\"]");
        assertThat(anRow.path("emailVerified").asBoolean()).isFalse();

        JsonNode binhRow = row(page, binh);
        assertThat(binhRow.path("accountStatus").asText()).isEqualTo("SUSPENDED");
        assertThat(binhRow.path("platformRole").asText()).isEqualTo("PM");
        assertThat(binhRow.path("platformAccessStatus").asText()).isEqualTo("ACTIVE");
        assertThat(binhRow.path("farmCount").asLong()).isZero();
        assertThat(binhRow.path("farmRoles")).isEmpty();
        assertThat(binhRow.path("emailVerified").asBoolean()).as("verified by Google").isTrue();
        assertThat(row(page, unnamed).path("emailVerified").asBoolean()).isFalse();

        // SCR-16 shows no phone; the list carries no password, detail or farm operational data either.
        page.path("items").forEach(item -> {
            assertThat(item.has("phone")).isFalse();
            assertThat(item.has("version")).isFalse();
            assertThat(item.has("ownedFarms")).isFalse();
        });
    }

    /** TC-03-75: status, ACTIVE platform role (NONE includes REVOKED), name or email case-insensitive, not phone, literal %. */
    @Test
    void filtersByStatusActivePlatformRoleAndNameOrEmail() throws Exception {
        AppUser admin = sa();
        String tag = "uc7f" + next();
        AppUser hung = account("hung", tag, "Nguyen Van Hung");
        AppUser revoked = account("revoked", tag, "Thu Hoi");
        AppUser cs = account("cs", tag, "Cuong Ho Tro");
        AppUser pm = account("pm", tag, "Phuong Quan Ly");
        AppUser otherSa = account("sa", tag, "Son Quan Tri");
        save(new PlatformStaffAccess().user(revoked).role("CS").status("REVOKED"));
        save(new PlatformStaffAccess().user(cs).role("CS").status("ACTIVE"));
        save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE"));
        save(new PlatformStaffAccess().user(otherSa).role("SA").status("ACTIVE"));
        pm.setAccountStatus("SUSPENDED"); em.flush();

        assertThat(emails(read(admin, "q", tag, "status", "SUSPENDED"))).containsExactly(pm.getEmail());
        assertThat(emails(read(admin, "q", tag, "status", "ACTIVE"))).containsExactly(cs.getEmail(), hung.getEmail(), otherSa.getEmail(), revoked.getEmail());
        assertThat(emails(read(admin, "q", tag, "platformRole", "CS"))).as("REVOKED is not CS").containsExactly(cs.getEmail());
        assertThat(emails(read(admin, "q", tag, "platformRole", "PM"))).containsExactly(pm.getEmail());
        assertThat(emails(read(admin, "q", tag, "platformRole", "SA"))).containsExactly(otherSa.getEmail());
        assertThat(emails(read(admin, "q", tag, "platformRole", "NONE"))).containsExactly(hung.getEmail(), revoked.getEmail());
        assertThat(emails(read(admin, "q", tag, "platformRole", "PM", "status", "ACTIVE"))).isEmpty();

        // Name search, case-insensitive, trimmed; an email part matches too.
        AppUser named = account("named", "x" + next(), "Mai " + tag.toUpperCase());
        assertThat(emails(read(admin, "q", "  " + tag.toUpperCase() + "  "))).contains(named.getEmail(), hung.getEmail());
        assertThat(emails(read(admin, "q", "mai " + tag))).containsExactly(named.getEmail());
        assertThat(emails(read(admin, "q", "cs." + tag))).containsExactly(cs.getEmail());
        // SRS SCR-16: name or email only, the phone is not searched.
        assertThat(read(admin, "q", hung.getPhone()).path("total").asLong()).isZero();
        // % and _ are literal characters, not wildcards.
        assertThat(read(admin, "q", tag + "%").path("total").asLong()).isZero();
        assertThat(read(admin, "q", tag.substring(0, 3) + "_" + tag.substring(4)).path("total").asLong()).isZero();
    }

    /** TC-03-76: 20 rows by default, page numbers from 0, total after filters, reverse order on desc. */
    @Test
    void pagesAndReversesTheNameOrder() throws Exception {
        AppUser admin = sa();
        String tag = "uc7p" + next();
        AppUser a = account("a", tag, "Anh");
        AppUser b = account("b", tag, "Bao");
        AppUser c = account("c", tag, "Chau");
        AppUser d = account("d", tag, "Dung");
        AppUser e = account("e", tag, "Dung");

        JsonNode first = read(admin, "q", tag, "size", "2");
        assertThat(emails(first)).containsExactly(a.getEmail(), b.getEmail());
        assertThat(first.path("total").asLong()).isEqualTo(5);
        assertThat(first.path("size").asInt()).isEqualTo(2);
        JsonNode second = read(admin, "q", tag, "size", "2", "page", "1");
        assertThat(second.path("page").asInt()).isEqualTo(1);
        // equal names: email order
        assertThat(emails(second)).containsExactly(c.getEmail(), d.getEmail());
        assertThat(emails(read(admin, "q", tag, "size", "2", "page", "2"))).containsExactly(e.getEmail());
        assertThat(emails(read(admin, "q", tag, "size", "2", "page", "3"))).isEmpty();
        assertThat(emails(read(admin, "q", tag, "sort", "name", "dir", "desc")))
            .containsExactly(e.getEmail(), d.getEmail(), c.getEmail(), b.getEmail(), a.getEmail());
    }

    /** TC-03-77: an invalid query value is MSG-COM-10 with the parameter name, not an empty or silently fixed page. */
    @ParameterizedTest
    @CsvSource({
        "status,BLOCKED,status", "status,active,status", "platformRole,STAFF,platformRole", "platformRole,REVOKED,platformRole",
        "page,-1,page", "page,abc,page", "size,0,size", "size,101,size", "size,x,size", "sort,email,sort", "dir,up,dir",
    })
    void rejectsAnInvalidQueryWithTheParameterName(String name, String value, String field) throws Exception {
        AppUser admin = sa();
        list(admin, name, value).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value(field));
    }

    @Test
    void rejectsASearchLongerThanAShortText() throws Exception {
        AppUser admin = sa();
        list(admin, "q", "a".repeat(100)).andExpect(status().isOk());
        list(admin, "q", "a".repeat(101)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("q"));
    }

    /** TC-03-78: Permission Matrix "User Account (any) – view list and detail": SA only, rechecked on every request. */
    @Test
    void onlyAnActiveSystemAdminReadsAccounts() throws Exception {
        AppUser target = user();
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        for (AppUser refused : List.of(staff("CS", "ACTIVE"), staff("PM", "ACTIVE"), staff("SA", "REVOKED"), owner)) {
            list(refused).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            call(refused, get(BASE + "/{id}", target.getId())).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        AppUser suspendedAdmin = sa(); suspendedAdmin.setAccountStatus("SUSPENDED"); em.flush();
        list(suspendedAdmin).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE01-03"));
        call(suspendedAdmin, get(BASE + "/{id}", target.getId())).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE01-03"));
        list(null).andExpect(status().isUnauthorized());
        call(null, get(BASE + "/{id}", target.getId())).andExpect(status().isUnauthorized());
    }

    /** TC-03-79: A10 shows verification, created / last sign-in, Owner registration and owned farms; no phone. */
    @Test
    void detailShowsVerificationTimesOwnerRegistrationAndOwnedFarmsWithoutPhone() throws Exception {
        AppUser admin = sa();
        String tag = "uc7d" + next();
        AppUser owner = new AppUser();
        owner.setEmail("owner." + tag + "@beefcare.test"); owner.setFullName("Lê Thị Chủ"); owner.setAccountStatus("ACTIVE");
        owner.setPhone("0912345678"); owner.setPasswordLoginEnabled(true); owner.setGoogleSubject("google-" + tag);
        Instant created = Instant.parse("2025-01-15T02:30:00Z");
        owner.setCreatedAt(created);
        owner.setPasswordLastUsedAt(Instant.parse("2026-10-01T01:00:00Z"));
        owner.setGoogleLastUsedAt(Instant.parse("2026-10-20T03:45:00Z"));
        owner.setOwnerRegistrationCompleted(true); owner.setOwnerRegistrationCompletedAt(Instant.parse("2025-01-16T00:00:00Z"));
        save(owner);
        identity(owner, true);
        member(farmNamed("Trại Bình Minh " + tag), owner, "OWNER", "ACTIVE");
        member(farmNamed("Trại An Phú " + tag), owner, "OWNER", "ACTIVE");
        member(farm(), owner, "MANAGER", "ACTIVE");
        member(farm(), owner, "TECHNICIAN", "INACTIVE");

        JsonNode detail = detail(admin, owner.getId());
        assertThat(detail.path("id").asLong()).isEqualTo(owner.getId());
        assertThat(detail.path("email").asText()).isEqualTo(owner.getEmail());
        assertThat(detail.path("fullName").asText()).isEqualTo("Lê Thị Chủ");
        assertThat(detail.path("emailVerified").asBoolean()).isTrue();
        assertThat(detail.path("signInMethods").toString()).isEqualTo("[\"PASSWORD\",\"GOOGLE\"]");
        assertThat(Instant.parse(detail.path("createdAt").asText())).isEqualTo(created);
        assertThat(Instant.parse(detail.path("lastSignInAt").asText())).as("latest sign-in method").isEqualTo(Instant.parse("2026-10-20T03:45:00Z"));
        assertThat(detail.path("ownerRegistrationCompleted").asBoolean()).isTrue();
        assertThat(Instant.parse(detail.path("ownerRegistrationCompletedAt").asText())).isEqualTo(Instant.parse("2025-01-16T00:00:00Z"));
        assertThat(detail.path("ownedFarms").toString()).isEqualTo("[\"Trại An Phú " + tag + "\",\"Trại Bình Minh " + tag + "\"]");
        assertThat(detail.path("farmCount").asLong()).isEqualTo(3);
        assertThat(detail.path("farmRoles").toString()).isEqualTo("[\"OWNER\",\"MANAGER\"]");
        assertThat(detail.path("platformRole").isNull()).isTrue();
        assertThat(detail.path("platformAccessVersion").isNull()).isTrue();
        assertThat(detail.path("version").isNumber()).isTrue();
        assertThat(detail.has("phone")).isFalse();
        assertThat(detail.toString()).doesNotContain("0912345678").doesNotContain("passwordHash").doesNotContain("google-" + tag);

        // Registered with a password, never verified and never signed in.
        AppUser pending = account("pending", tag, "Chờ Xác Minh");
        pending.setPasswordLoginEnabled(true); pending.setPasswordMethodStatus("PENDING_VERIFICATION"); em.flush();
        identity(pending, false);
        JsonNode unverified = detail(admin, pending.getId());
        assertThat(unverified.path("emailVerified").asBoolean()).isFalse();
        assertThat(unverified.path("signInMethods").toString()).isEqualTo("[\"PASSWORD\"]");
        assertThat(unverified.path("lastSignInAt").isNull()).isTrue();
        assertThat(unverified.path("createdAt").isTextual()).as("set on insert").isTrue();
        assertThat(unverified.path("ownedFarms")).isEmpty();
        assertThat(unverified.path("ownerRegistrationCompleted").asBoolean()).isFalse();

        call(admin, get(BASE + "/{id}", Long.MAX_VALUE)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        call(admin, get(BASE + "/{id}", "abc")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("id"));
    }

    /** UC8 / UC9 commands return the same A10 detail: no phone either (D31; UC8 rules: PlatformAccountStatusResourceTest, D32). */
    @Test
    void suspendRespondsWithTheAccountDetail() throws Exception {
        AppUser admin = sa();
        AppUser target = account("target", "uc7s" + next(), "Bị Tạm Ngưng");
        String body = "{\"reason\":\"Nghi ngờ lộ tài khoản\",\"version\":" + target.getVersion() + "}";
        String response = call(admin, post(BASE + "/{id}/suspend", target.getId()).with(csrf()).header("Idempotency-Key", "uc7-suspend").contentType("application/json").content(body))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode detail = mapper.readTree(response);
        assertThat(detail.path("accountStatus").asText()).isEqualTo("SUSPENDED");
        assertThat(detail.has("createdAt")).isTrue();
        assertThat(detail.has("farmRoles")).isTrue();
        assertThat(detail.has("phone")).isFalse();
    }

    /** TC-03-80: platform access, farms joined and verification are read per page, not per account (no N+1). */
    @Test
    void readsAPageInTheSameNumberOfQueriesWhateverItsSize() throws Exception {
        AppUser admin = sa();
        String tag = "uc7n" + next();
        Farm farm = farm();
        for (int i = 0; i < 2; i++) populated(tag, farm, i);
        em.flush(); em.clear();
        long two = statements(() -> assertThat(read(admin, "q", tag).path("items")).hasSize(2));
        Farm attached = em.find(Farm.class, farm.getId());
        for (int i = 2; i < 12; i++) populated(tag, attached, i);
        em.flush(); em.clear();
        long twelve = statements(() -> assertThat(read(admin, "q", tag).path("items")).hasSize(12));
        assertThat(two).as("statistics must observe the request").isPositive();
        // Hibernate statistics are process-wide; one scheduled statement may interleave with this request.
        assertThat(twelve)
            .as("no query per account: 2 accounts %d, 12 accounts %d", two, twelve)
            .isLessThanOrEqualTo(two + 1);
    }

    private void populated(String tag, Farm farm, int i) {
        AppUser account = account("n" + i, tag, "Account " + (char) ('a' + i));
        member(farm, account, i % 2 == 0 ? "MANAGER" : "TECHNICIAN", "ACTIVE");
        save(new PlatformStaffAccess().user(account).role("CS").status(i % 3 == 0 ? "REVOKED" : "ACTIVE"));
        identity(account, i % 2 == 0);
    }

    /** TC-03-74 on PostgreSQL: Vietnamese alphabet (a < ă < â, d < đ), letter case ignored; H2 keeps ASCII order only. */
    @Test
    void ordersVietnameseNamesAlphabeticallyOnPostgres() throws Exception {
        assumeTrue(postgres(), "the vi-x-icu collation exists on PostgreSQL only");
        AppUser admin = sa();
        String tag = "uc7v" + next();
        List<AppUser> expected = new ArrayList<>();
        for (String name : List.of("an", "Ánh", "ăn", "Ân", "Bình", "dương thị hoa", "Đỗ Văn Bình", "Zoe")) {
            expected.add(account("v" + next(), tag, name));
        }
        List<AppUser> shuffled = new ArrayList<>(expected);
        java.util.Collections.reverse(shuffled);
        assertThat(emails(read(admin, "q", tag))).containsExactlyElementsOf(expected.stream().map(AppUser::getEmail).toList());
        assertThat(emails(read(admin, "q", tag, "dir", "desc"))).containsExactlyElementsOf(shuffled.stream().map(AppUser::getEmail).toList());
    }

    interface Call { void run() throws Exception; }

    private long statements(Call call) throws Exception {
        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            call.run();
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }
}
