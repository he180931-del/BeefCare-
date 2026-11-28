package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
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
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntrySource;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/**
 * HTTP contract of FE-11 (A1–A6, TC-11-xx) and FE-12 (A1–A8, TC-12-xx): bodies, statuses and {code, params}.
 * Decisions P1–P7 and Q5: D36 in docs/REQUIREMENT_DECISIONS.md.
 */
@ServiceIntegrationTest
@Transactional
class ReproductionResourceTest extends HerdEntryTestBase {

    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired vn.edu.fpt.beefcare.service.HealthCareCommandService health;

    Cattle cow;
    Cattle bull;

    @BeforeEach
    void breedingCowAndBull() {
        cow = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.ADULT);
        bull = cattle(farm, breed, sire, Sex.MALE, LifeStage.ADULT);
        clock.set(TODAY.atTime(10, 0).atZone(ZONE).toInstant());
        parameters(Map.of("BREEDING_WINDOW_START_HOURS", 8, "BREEDING_WINDOW_END_HOURS", 12, "PREGNANCY_CHECK_DAYS", 28, "PREGNANCY_RECHECK_DAYS", 14,
            "CALVING_LEAD_DAYS", 30, "POST_CALVING_DAYS", 45, "ESTRUS_CYCLE_DAYS", 21, "MIN_BREEDING_AGE_MONTHS", 13, "MIN_BREEDING_WEIGHT_KG", 230));
        weight(cow, TODAY.minusDays(5), "320");
        em.flush();
    }

    // ------------------------------------------------------------------ helpers

    void parameters(Map<String, Object> values) {
        FarmParameterVersion p = new FarmParameterVersion();
        p.setFarm(farm); p.setVersionNo(1); p.setGestationLengthDays(283); p.setEffectiveFrom(TODAY.minusYears(3)); p.setCreatedAt(clock.instant());
        try { p.setParameterValues(json.writeValueAsString(values)); } catch (Exception e) { throw new IllegalStateException(e); }
        save(p);
    }

    static RequestPostProcessor as(String email) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(email).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", UUID.randomUUID().toString());
            return processed;
        };
    }

    String url(String suffix) { return "/api/farms/" + farm.getId() + suffix; }
    static Instant at(int daysAgo, int hour, int minute) { return TODAY.minusDays(daysAgo).atTime(hour, minute).atZone(ZONE).toInstant(); }

    static Map<String, Object> body(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    ResultActions post_(String suffix, AppUser user, Map<String, Object> body) throws Exception {
        return mvc.perform(post(url(suffix)).with(as(user.getEmail())).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    ResultActions get_(String suffix, AppUser user) throws Exception { return mvc.perform(get(url(suffix)).with(as(user.getEmail()))); }
    static boolean absent(JsonNode n, String pointer) { JsonNode x = n.at(pointer); return x.isMissingNode() || x.isNull(); }
    JsonNode read(ResultActions r) throws Exception { return json.readTree(r.andReturn().getResponse().getContentAsString()); }
    Integer v(Cattle c) { em.flush(); return versionOf(Cattle.class, c.getId()); }

    JsonNode estrus(Cattle c, Instant at, Object... extra) throws Exception {
        Map<String, Object> b = body("expectedCattleVersion", v(c), "observedAt", at, "signs", List.of("STANDING", "MUCUS"));
        b.putAll(body(extra));
        return read(post_("/cattle/" + c.getId() + "/estrus-events", manager, b).andExpect(status().isCreated()));
    }
    Map<String, Object> breedingBody(Cattle c, Instant at, Object... extra) {
        Map<String, Object> b = body("expectedCattleVersion", v(c), "bredAt", at, "method", "AI", "sireSource", "EXTERNAL", "sireBreedId", breed.getId(),
            "semenCode", "ST-01", "semenSupplier", "Trạm tinh", "performerName", "Dẫn tinh viên A");
        b.putAll(body(extra));
        return b;
    }
    JsonNode breed(Cattle c, Instant at, Object... extra) throws Exception {
        return read(post_("/cattle/" + c.getId() + "/breeding-events", manager, breedingBody(c, at, extra)).andExpect(status().isCreated()));
    }
    JsonNode check(Cattle c, Instant at, String result, Object... extra) throws Exception {
        Map<String, Object> b = body("expectedCattleVersion", v(c), "checkedAt", at, "result", result, "method", "ULTRASOUND", "examinerId", manager.getId());
        b.putAll(body(extra));
        return read(post_("/cattle/" + c.getId() + "/pregnancy-checks", manager, b).andExpect(status().isCreated()));
    }
    /** A cow with an OPEN pregnancy confirmed from a breeding {@code days} ago. */
    JsonNode pregnant(int days) throws Exception {
        JsonNode b = breed(cow, at(days, 8, 0));
        return check(cow, at(days - 30, 9, 0), "PREGNANT", "linkedBreedingId", b.get("eventId").asLong());
    }
    Map<String, Object> calf(Object... kv) {
        Map<String, Object> c = body("outcome", "LIVE", "sex", "FEMALE", "birthWeightKg", 25.5, "weightBasis", "MEASURED", "penId", penA.getId(), "registration", "DRAFT");
        c.putAll(body(kv));
        return c;
    }
    Map<String, Object> calvingBody(Instant at, List<Map<String, Object>> calves, Object... extra) {
        Map<String, Object> b = body("damId", cow.getId(), "expectedCattleVersion", v(cow), "birthAt", at, "attendantId", manager.getId(), "course", "NORMAL",
            "damCondition", "GOOD", "retainedPlacenta", false, "calves", calves);
        b.putAll(body(extra));
        return b;
    }
    Integer episodeVersion(long id) { em.flush(); return versionOf(PregnancyEpisode.class, id); }
    Integer eventVersion(long id) { em.flush(); return versionOf(ReproductionEvent.class, id); }
    void herdEntry(Cattle c, LocalDate date) {
        var voucher = entryVoucher(farm, manager, seller, 0L, 0L, EntryVoucherStatus.POSTED);
        HerdEntry line = new HerdEntry();
        line.setFarm(farm); line.setVoucher(voucher); line.setLineNo(1); line.setCattle(c); line.setSource(EntrySource.EXTERNAL);
        line.setEntryDate(date); line.setInitialPen(penA); line.setStatus(EntryLineStatus.VALID);
        line.setCreatedAt(clock.instant()); line.setUpdatedAt(clock.instant());
        save(line);
    }

    // ------------------------------------------------------------------ FE-11 A1 / A2

    @Test
    void tc11_01_aBreedingCowWithoutEventsAwaitsBreeding() throws Exception {
        get_("/cattle/" + cow.getId() + "/reproduction-history", technician)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.applicable").value(true))
            .andExpect(jsonPath("$.status").value("AWAITING_BREEDING"))
            .andExpect(jsonPath("$.allowedActions[0]").value("ESTRUS"))
            .andExpect(jsonPath("$.allowedActions[1]").value("BREEDING"))
            .andExpect(jsonPath("$.canManage").value(false))
            .andExpect(jsonPath("$.eligibility.met").value(true))
            .andExpect(jsonPath("$.eligibility.criteria[1].name").value("MINIMUM_WEIGHT"))
            .andExpect(jsonPath("$.eligibility.criteria[1].value").value("320"));
        get_("/reproduction-worklist?tab=AWAITING_BREEDING", manager)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.counts.awaitingBreeding").value(1))
            .andExpect(jsonPath("$.items[0].code").value(cow.getDisplayCode()))
            .andExpect(jsonPath("$.items[0].nextAction").value("CONSIDER_BREEDING"))
            .andExpect(jsonPath("$.items[0].ageMonths").value(30))
            .andExpect(jsonPath("$.items[0].latestWeightKg").value(320))
            .andExpect(jsonPath("$.items[0].eligibility.criteria[1].value").value("320"));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager).andExpect(jsonPath("$.ageMonths").value(30));
    }

    /** Chốt 15/11/2026: không có bản ghi cân VALID (cân nhập đàn không tính) → tiêu chí cân không đạt, "Chưa có lần cân". */
    @Test
    void aCowWithoutAValidWeighingFailsTheWeightCriterionWithNoWeighing() throws Exception {
        Cattle heifer = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.ADULT);
        get_("/cattle/" + heifer.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.latestWeight").doesNotExist())
            .andExpect(jsonPath("$.eligibility.met").value(false))
            .andExpect(jsonPath("$.eligibility.criteria[1].name").value("MINIMUM_WEIGHT"))
            .andExpect(jsonPath("$.eligibility.criteria[1].met").value(false))
            .andExpect(jsonPath("$.eligibility.criteria[1].value").value("Chưa có lần cân"));
        get_("/reproduction-worklist?eligibility=NOT_MET", manager)
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].code").value(heifer.getDisplayCode()))
            .andExpect(jsonPath("$.items[0].nextAction").value("MONITOR_WEIGHT"))
            .andExpect(jsonPath("$.items[0].eligibility.failed[0]").value("MINIMUM_WEIGHT"))
            .andExpect(jsonPath("$.items[0].eligibility.criteria[1].value").value("Chưa có lần cân"));
    }

    @Test
    void tc11_02_aFatteningCowIsNotApplicableButOtherActionsStay() throws Exception {
        Cattle heifer = cattle(farm, breed, fattening, Sex.FEMALE, LifeStage.ADULT);
        get_("/cattle/" + heifer.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.applicable").value(false))
            .andExpect(jsonPath("$.notApplicableReason").value("PURPOSE"))
            .andExpect(jsonPath("$.allowedActions.length()").value(0))
            .andExpect(jsonPath("$.otherActions[0]").value("PREGNANCY_CHECK"));
        post_("/cattle/" + heifer.getId() + "/estrus-events", manager, body("expectedCattleVersion", v(heifer), "observedAt", at(0, 6, 30)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE11-11"));
        get_("/reproduction-worklist", manager).andExpect(jsonPath("$.counts.all").value(1)); // only the breeding cow
    }

    @Test
    void tc11_03_aBullCannotGetAnEstrus() throws Exception {
        post_("/cattle/" + bull.getId() + "/estrus-events", manager, body("expectedCattleVersion", v(bull), "observedAt", at(0, 6, 30)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE11-11")).andExpect(jsonPath("$.params.reason").value("NOT_FEMALE"));
    }

    // ------------------------------------------------------------------ FE-11 A3 estrus

    @Test
    void tc11_04_anEstrusSuggestsTheBreedingWindow() throws Exception {
        JsonNode r = estrus(cow, at(0, 6, 30));
        assertThat(r.get("reproStatus").asText()).isEqualTo("IN_ESTRUS");
        assertThat(Instant.parse(r.at("/window/from").asText())).isEqualTo(at(0, 14, 30));
        assertThat(Instant.parse(r.at("/window/to").asText())).isEqualTo(at(0, 18, 30));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.window.configured").value(true))
            .andExpect(jsonPath("$.timeline[0].kind").value("ESTRUS"))
            .andExpect(jsonPath("$.timeline[0].signs[1]").value("MUCUS"))
            .andExpect(jsonPath("$.timeline[0].observer.id").value(manager.getId())); // P1: the recorder by default
        get_("/reproduction-worklist", manager).andExpect(jsonPath("$.tiles.inEstrus").value(1)).andExpect(jsonPath("$.tiles.inWindow").value(0));
    }

    @Test
    void tc11_05_anEstrusOlderThan24HoursWithoutBreedingReturnsToAwaitingBreeding() throws Exception {
        estrus(cow, at(1, 6, 30));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager).andExpect(jsonPath("$.status").value("AWAITING_BREEDING"));
    }

    @Test
    void tc11_15_anOpenHealthCaseFailsTheEligibilityCriterion() throws Exception {
        actAs(manager);
        health.open(farm.getId(), UUID.randomUUID().toString(), new vn.edu.fpt.beefcare.service.dto.CareDtos.OpenHealthCase(cow.getId(), null, null, at(0, 7, 0), null, null,
            "Ho", null, false, "MILD", null));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.eligibility.met").value(false))
            .andExpect(jsonPath("$.eligibility.criteria[2].name").value("OPEN_HEALTH_CASE"))
            .andExpect(jsonPath("$.eligibility.criteria[2].met").value(false));
        get_("/reproduction-worklist?eligibility=NOT_MET", manager)
            .andExpect(jsonPath("$.items[0].eligibility.failed[0]").value("OPEN_HEALTH_CASE"))
            .andExpect(jsonPath("$.tiles.notEligible").value(1));
    }

    @Test
    void tc11_22_23_indicatorsUseValidEventsAndFlagOverdueConception() throws Exception {
        post_("/calvings", manager, calvingBody(at(111, 6, 0), List.of(calf()), "noTrackedPregnancy", true)).andExpect(status().isCreated());
        breed(cow, at(60, 8, 0));
        long voided = breed(cow, at(30, 8, 0)).get("eventId").asLong();
        post_("/reproduction-events/" + voided + "/void", manager, body("expectedVersion", eventVersion(voided), "reason", "Nhầm")).andExpect(status().isOk());
        check(cow, at(5, 9, 0), "NOT_PREGNANT");
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.indicators.services").value(1))
            .andExpect(jsonPath("$.indicators.conceptions").value(0))
            .andExpect(jsonPath("$.indicators.daysSinceCalving").value(111))
            .andExpect(jsonPath("$.indicators.overdue").value(true)) // > 45 + 3 × 21 = 108 days
            .andExpect(jsonPath("$.indicators.ageAtFirstCalvingMonths").isNumber())
            .andExpect(jsonPath("$.parity").value(1));
    }

    /** D67: trại không siêu âm xác nhận có thai bằng quan sát – vẫn là một lần khám CÓ THAI nên mở thai và có ngày đẻ dự kiến. */
    @Test
    void d67_anObservedPregnancyCheckOpensThePregnancy() throws Exception {
        JsonNode b = breed(cow, at(25, 8, 0));
        post_("/cattle/" + cow.getId() + "/pregnancy-checks", manager, body("expectedCattleVersion", v(cow), "checkedAt", at(0, 8, 0), "result", "PREGNANT", "method", "SMELL"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("method"));
        JsonNode checked = check(cow, at(0, 9, 0), "PREGNANT", "method", "OBSERVATION", "linkedBreedingId", b.get("eventId").asLong());
        assertThat(absent(checked, "/episode")).isFalse();
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.status").value("PREGNANT"));
    }

    /** D67: bò đã từng đẻ có thêm tiêu chí "Sau đẻ ≥ 45 ngày" (chỉ cảnh báo); bò chưa đẻ không có tiêu chí này. */
    @Test
    void d67_eligibilityWarnsWhenTheCowCalvedTooRecently() throws Exception {
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.eligibility.criteria.length()").value(3));
        post_("/calvings", manager, calvingBody(at(14, 6, 0), List.of(calf()), "noTrackedPregnancy", true)).andExpect(status().isCreated());
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.eligibility.criteria[3].name").value("POSTPARTUM_INTERVAL"))
            .andExpect(jsonPath("$.eligibility.criteria[3].required").value("45"))
            .andExpect(jsonPath("$.eligibility.criteria[3].value").value("14"))
            .andExpect(jsonPath("$.eligibility.criteria[3].met").value(false));
    }

    @Test
    void tc11_06_anEstrusWithin12HoursAsksForConfirmation() throws Exception {
        clock.set(TODAY.atTime(16, 0).atZone(ZONE).toInstant());
        estrus(cow, at(0, 6, 0));
        post_("/cattle/" + cow.getId() + "/estrus-events", manager, body("expectedCattleVersion", v(cow), "observedAt", at(0, 15, 0)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE11-03"))
            .andExpect(jsonPath("$.params.time").value(String.format("%02d/%02d/%d 06:00", TODAY.getDayOfMonth(), TODAY.getMonthValue(), TODAY.getYear())));
        estrus(cow, at(0, 15, 0), "confirmDuplicate", true, "observerId", technician.getId());
    }

    @Test
    void tc11_07_aPregnantCowGetsNoEstrusOrBreeding() throws Exception {
        pregnant(60);
        post_("/cattle/" + cow.getId() + "/estrus-events", manager, body("expectedCattleVersion", v(cow), "observedAt", at(0, 6, 0)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE11-05"));
        post_("/cattle/" + cow.getId() + "/breeding-events", manager, breedingBody(cow, at(0, 7, 0)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE11-05"));
    }

    @Test
    void brD14_eventsBeforeTheHerdEntryDateAre422COM15() throws Exception {
        herdEntry(cow, TODAY.minusDays(3));
        post_("/cattle/" + cow.getId() + "/estrus-events", manager, body("expectedCattleVersion", v(cow), "observedAt", at(5, 6, 0)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-COM-15"))
            .andExpect(jsonPath("$.params.date").value(TODAY.minusDays(3).toString()))
            .andExpect(jsonPath("$.params.field").value("observedAt"));
        estrus(cow, at(2, 6, 0));
    }

    // ------------------------------------------------------------------ FE-11 A4 breeding

    @Test
    void tc11_08_aBreedingBeforeItsLinkedEstrusIsFE11_10() throws Exception {
        long estrusId = estrus(cow, at(0, 6, 30)).get("eventId").asLong();
        post_("/cattle/" + cow.getId() + "/breeding-events", manager, breedingBody(cow, at(0, 5, 0), "linkedEstrusId", estrusId))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE11-10"))
            .andExpect(jsonPath("$.params.event").value("động dục"))
            .andExpect(jsonPath("$.params.field").value("bredAt"));
    }

    @Test
    void tc11_09_10_aBreedingWithoutEstrusCreatesNoneAndGivesTheTentativeDate() throws Exception {
        JsonNode r = breed(cow, at(10, 8, 0));
        assertThat(LocalDate.parse(r.get("tentativeCalvingDate").asText())).isEqualTo(TODAY.minusDays(10).plusDays(283));
        assertThat(r.get("reproStatus").asText()).isEqualTo("BRED");
        assertThat(absent(r, "/episode")).isTrue(); // R-11-06: a breeding is not a pregnancy
        assertThat(em.createQuery("select count(e) from ReproductionEvent e where e.cattle.id=:c and e.type='ESTRUS'", Long.class).setParameter("c", cow.getId()).getSingleResult()).isZero();
        assertThat(em.createQuery("select r from Reminder r where r.cattle.id=:c and r.ruleType='REM-03'", Reminder.class).setParameter("c", cow.getId()).getResultList())
            .singleElement().satisfies(rem -> assertThat(rem.getDueTime().atZone(ZONE).toLocalDate()).isEqualTo(TODAY.minusDays(10).plusDays(28)));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.latestBreeding.method").value("AI"))
            .andExpect(jsonPath("$.latestBreeding.semenCode").value("ST-01"))
            .andExpect(jsonPath("$.latestBreeding.performer.name").value("Dẫn tinh viên A"))
            .andExpect(jsonPath("$.servicesInCycle").value(1));
    }

    @Test
    void tc11_11_anEstrusAfterABreedingCancelsTheTentativeDate() throws Exception {
        breed(cow, at(3, 8, 0));
        estrus(cow, at(0, 7, 0));
        get_("/reproduction-worklist?tab=IN_ESTRUS", manager)
            .andExpect(jsonPath("$.items[0].status").value("IN_ESTRUS"))
            .andExpect(jsonPath("$.items[0].expectedCalvingDate").doesNotExist());
    }

    @Test
    void tc11_12_aSecondServiceOnTheSameEstrusIsNotADuplicate() throws Exception {
        clock.set(TODAY.atTime(20, 0).atZone(ZONE).toInstant());
        long estrusId = estrus(cow, at(0, 6, 0)).get("eventId").asLong();
        breed(cow, at(0, 8, 0), "linkedEstrusId", estrusId);
        post_("/cattle/" + cow.getId() + "/breeding-events", manager, breedingBody(cow, at(0, 16, 0)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE11-03"));
        JsonNode second = breed(cow, at(0, 16, 0), "linkedEstrusId", estrusId); // P2
        assertThat(LocalDate.parse(second.get("tentativeCalvingDate").asText())).isEqualTo(TODAY.plusDays(283));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager).andExpect(jsonPath("$.servicesInCycle").value(2));
    }

    @Test
    void tc11_13_theFarmSireMustBeAnotherActiveMaleOfTheFarm() throws Exception {
        Cattle otherCow = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.ADULT);
        var otherFarm = farm();
        Cattle foreignBull = cattle(otherFarm, breed(otherFarm), purpose(otherFarm, PurposeType.SIRE), Sex.MALE, LifeStage.ADULT);
        for (Long sireId : List.of(cow.getId(), otherCow.getId(), foreignBull.getId())) {
            post_("/cattle/" + cow.getId() + "/breeding-events", manager, body("expectedCattleVersion", v(cow), "bredAt", at(1, 8, 0), "method", "NATURAL",
                    "sireSource", "INTERNAL", "sireCattleId", sireId))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE11-04")).andExpect(jsonPath("$.params.field").value("sireCattleId"));
        }
        post_("/cattle/" + cow.getId() + "/breeding-events", manager, body("expectedCattleVersion", v(cow), "bredAt", at(1, 8, 0), "method", "NATURAL",
                "sireSource", "INTERNAL", "sireCattleId", bull.getId(), "performerId", technician.getId()))
            .andExpect(status().isCreated());
    }

    @Test
    void tc11_14_anIneligibleCowIsWarnedButTheBreedingIsSaved() throws Exception {
        Cattle young = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.YOUNG_STOCK);
        young.setBirthDate(TODAY.minusMonths(11));
        JsonNode r = read(post_("/cattle/" + young.getId() + "/breeding-events", manager, breedingBody(young, at(1, 8, 0))).andExpect(status().isCreated()));
        assertThat(r.at("/eligibilityWarning/code").asText()).isEqualTo("MSG-FE11-09");
        assertThat(r.at("/eligibilityWarning/conditions").toString()).contains("MINIMUM_AGE", "MINIMUM_WEIGHT");
    }

    @Test
    void tc11_16_aMissingGestationParameterSavesWithoutADate() throws Exception {
        em.createQuery("delete from FarmParameterVersion p where p.farm.id=:f").setParameter("f", farm.getId()).executeUpdate();
        JsonNode r = breed(cow, at(1, 8, 0));
        assertThat(absent(r, "/tentativeCalvingDate")).isTrue();
        assertThat(r.get("parameterMissing").asText()).isEqualTo("GESTATION_LENGTH_DAYS");
        JsonNode e = estrus(cow, at(0, 7, 0));
        assertThat(absent(e, "/window")).isTrue();
        assertThat(e.get("parameterMissing").asText()).isEqualTo("BREEDING_WINDOW_START_HOURS");
    }

    @Test
    void tc11_20_theTechnicianCannotRecord() throws Exception {
        post_("/cattle/" + cow.getId() + "/estrus-events", technician, body("expectedCattleVersion", v(cow), "observedAt", at(0, 6, 0))).andExpect(status().isForbidden());
        post_("/cattle/" + cow.getId() + "/breeding-events", technician, breedingBody(cow, at(0, 7, 0))).andExpect(status().isForbidden());
    }

    /** D41: the Owner records and voids like a Manager; the Owner is the default observer. */
    @Test
    void tc11_25_theOwnerRecordsAndVoidsLikeAManager() throws Exception {
        post_("/cattle/" + cow.getId() + "/estrus-events", owner, body("expectedCattleVersion", v(cow), "observedAt", at(0, 6, 0)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.reproStatus").value("IN_ESTRUS"));
        get_("/cattle/" + cow.getId() + "/reproduction-history", owner)
            .andExpect(jsonPath("$.timeline[0].kind").value("ESTRUS"))
            .andExpect(jsonPath("$.timeline[0].observer.id").value(owner.getId()));
        long breedingId = read(post_("/cattle/" + cow.getId() + "/breeding-events", owner, breedingBody(cow, at(0, 7, 0))).andExpect(status().isCreated()))
            .get("eventId").asLong();
        post_("/reproduction-events/" + breedingId + "/void", owner, body("expectedVersion", eventVersion(breedingId), "reason", "Ghi nhầm"))
            .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ FE-11 A5 / A6

    @Test
    void tc11_17_voidingABreedingUsedByACheckIsFE11_07() throws Exception {
        long breedingId = breed(cow, at(40, 8, 0)).get("eventId").asLong();
        check(cow, at(5, 9, 0), "PREGNANT", "linkedBreedingId", breedingId);
        post_("/reproduction-events/" + breedingId + "/void", manager, body("expectedVersion", eventVersion(breedingId), "reason", "Ghi nhầm"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE11-07"))
            .andExpect(jsonPath("$.params.dependents[*].type").value(hasItem("PREGNANCY_CHECK")))
            .andExpect(jsonPath("$.params.records").value(startsWith("khám thai")));
    }

    @Test
    void tc11_18_correctingABreedingKeepsTheRevisionAndRecomputesTheDate() throws Exception {
        long id = breed(cow, at(10, 8, 0)).get("eventId").asLong();
        // D69: ghi chú không bắt buộc – sửa không ghi chú vẫn lưu, revision có reason null.
        post_("/reproduction-events/" + id + "/correction", manager, body("expectedVersion", eventVersion(id), "occurredAt", at(11, 8, 0)))
            .andExpect(status().isOk());
        JsonNode r = read(post_("/reproduction-events/" + id + "/correction", manager, body("expectedVersion", eventVersion(id), "reason", "Sai ngày", "occurredAt", at(12, 8, 0)))
            .andExpect(status().isOk()));
        assertThat(LocalDate.parse(r.get("tentativeCalvingDate").asText())).isEqualTo(TODAY.minusDays(12).plusDays(283));
        assertThat(em.createQuery("select r from RecordRevision r where r.sourceType='ReproductionEvent' and r.sourceId=:id", RecordRevision.class).setParameter("id", id).getResultList())
            .extracting(RecordRevision::getReason).containsExactlyInAnyOrder(null, "Sai ngày");
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager).andExpect(jsonPath("$.timeline[0].corrected").value(true));
    }

    @Test
    void tc11_19_theSireOfABreedingCanBeChanged() throws Exception {
        Cattle bullB = cattle(farm, breed, sire, Sex.MALE, LifeStage.ADULT);
        long id = read(post_("/cattle/" + cow.getId() + "/breeding-events", manager, body("expectedCattleVersion", v(cow), "bredAt", at(3, 8, 0), "method", "NATURAL",
            "sireSource", "INTERNAL", "sireCattleId", bull.getId())).andExpect(status().isCreated())).get("eventId").asLong();
        post_("/reproduction-events/" + id + "/correction", manager, body("expectedVersion", eventVersion(id), "reason", "Nhầm đực", "sireCattleId", bullB.getId()))
            .andExpect(status().isOk());
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager).andExpect(jsonPath("$.timeline[0].sire.id").value(bullB.getId()));
    }

    // ------------------------------------------------------------------ FE-12 A2 pregnancy check

    @Test
    void tc12_01_aPregnantCheckLinkedToTheBreedingConfirmsTheDate() throws Exception {
        long breedingId = breed(cow, at(30, 8, 0)).get("eventId").asLong();
        JsonNode r = check(cow, at(2, 9, 0), "PREGNANT", "linkedBreedingId", breedingId);
        assertThat(r.get("reproStatus").asText()).isEqualTo("PREGNANT");
        assertThat(r.at("/episode/basis").asText()).isEqualTo("CONFIRMED");
        assertThat(LocalDate.parse(r.at("/episode/expectedDate").asText())).isEqualTo(TODAY.minusDays(30).plusDays(283));
        assertThat(em.createQuery("select r.status from Reminder r where r.cattle.id=:c and r.ruleType='REM-03'", String.class).setParameter("c", cow.getId()).getResultList())
            .containsOnly("RESOLVED");
        assertThat(em.createQuery("select count(r) from Reminder r where r.cattle.id=:c and r.ruleType='REM-05' and r.status='ACTIVE'", Long.class).setParameter("c", cow.getId()).getSingleResult()).isEqualTo(1);
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.currentPregnancy.basis").value("CONFIRMED"))
            .andExpect(jsonPath("$.currentPregnancy.linkedBreedingId").value(breedingId))
            .andExpect(jsonPath("$.currentPregnancy.daysPregnant").value(30))
            .andExpect(jsonPath("$.allowedActions[1]").value("PREGNANCY_UPDATE"));
    }

    @Test
    void tc12_02_03_withoutBreedingTheDateIsEstimatedOrAbsent() throws Exception {
        JsonNode estimated = check(cow, at(0, 9, 0), "PREGNANT", "estimatedMonths", 4);
        assertThat(estimated.at("/episode/basis").asText()).isEqualTo("ESTIMATED");
        assertThat(LocalDate.parse(estimated.at("/episode/expectedDate").asText())).isEqualTo(TODAY.plusDays(283 - 120));
        Cattle other = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.ADULT);
        JsonNode none = check(other, at(0, 9, 0), "PREGNANT");
        assertThat(absent(none, "/episode/expectedDate")).isTrue();
        assertThat(none.at("/episode/notice").asText()).isEqualTo("MSG-FE12-11"); // P7
    }

    @Test
    void tc12_04_05_notPregnantAwaitsBreedingAndInconclusiveKeepsBred() throws Exception {
        breed(cow, at(30, 8, 0));
        JsonNode inconclusive = check(cow, at(1, 9, 0), "INCONCLUSIVE");
        assertThat(inconclusive.get("reproStatus").asText()).isEqualTo("BRED");
        assertThat(em.createQuery("select r from Reminder r where r.cattle.id=:c and r.ruleType='REM-04' and r.status='ACTIVE'", Reminder.class).setParameter("c", cow.getId()).getResultList())
            .singleElement().satisfies(rem -> assertThat(rem.getDueTime().atZone(ZONE).toLocalDate()).isEqualTo(TODAY.minusDays(1).plusDays(14)));
        JsonNode not = check(cow, at(0, 9, 0), "NOT_PREGNANT");
        assertThat(not.get("reproStatus").asText()).isEqualTo("AWAITING_BREEDING"); // Q1
    }

    @Test
    void tc12_06_aSecondPregnantCheckConfirmsTheOpenPregnancy() throws Exception {
        long episodeId = pregnant(60).at("/episode/episodeId").asLong();
        JsonNode again = check(cow, at(0, 9, 0), "PREGNANT");
        assertThat(again.at("/episode/episodeId").asLong()).isEqualTo(episodeId); // AF2
        post_("/cattle/" + cow.getId() + "/pregnancy-checks", manager, body("expectedCattleVersion", v(cow), "checkedAt", at(0, 9, 30), "result", "NOT_PREGNANT"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE12-02"));
        assertThat(em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id=:c and p.status='OPEN'", Long.class).setParameter("c", cow.getId()).getSingleResult()).isEqualTo(1);
    }

    @Test
    void tc12_08_aCheckBeforeItsLinkedBreedingIsFE11_10() throws Exception {
        long breedingId = breed(cow, at(3, 8, 0)).get("eventId").asLong();
        post_("/cattle/" + cow.getId() + "/pregnancy-checks", manager, body("expectedCattleVersion", v(cow), "checkedAt", at(4, 8, 0), "result", "PREGNANT", "linkedBreedingId", breedingId))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE11-10")).andExpect(jsonPath("$.params.field").value("checkedAt"));
    }

    @Test
    void tc12_26_theTechnicianCannotRecordChecksOrCalvings() throws Exception {
        post_("/cattle/" + cow.getId() + "/pregnancy-checks", technician, body("expectedCattleVersion", v(cow), "checkedAt", at(0, 9, 0), "result", "PREGNANT")).andExpect(status().isForbidden());
        post_("/calvings", technician, calvingBody(at(0, 6, 0), List.of(calf()))).andExpect(status().isForbidden());
    }

    /** D41: the Owner records a pregnancy check on the Manager's breeding and the calving, like a Manager. */
    @Test
    void tc12_27_theOwnerRecordsChecksAndCalvingsLikeAManager() throws Exception {
        long breedingId = breed(cow, at(290, 8, 0)).get("eventId").asLong();
        long episodeId = read(post_("/cattle/" + cow.getId() + "/pregnancy-checks", owner,
                body("expectedCattleVersion", v(cow), "checkedAt", at(260, 9, 0), "result", "PREGNANT", "method", "ULTRASOUND", "examinerId", owner.getId(), "linkedBreedingId", breedingId))
            .andExpect(status().isCreated())).at("/episode/episodeId").asLong();
        post_("/calvings", owner, calvingBody(at(0, 6, 0), List.of(calf()), "episodeId", episodeId, "expectedEpisodeVersion", episodeVersion(episodeId)))
            .andExpect(status().isCreated());
    }

    // ------------------------------------------------------------------ FE-12 A3 pregnancy update

    @Test
    void tc12_09_aLossClosesThePregnancyAndTheCowAwaitsBreeding() throws Exception {
        long episodeId = pregnant(80).at("/episode/episodeId").asLong();
        post_("/pregnancy-episodes/" + episodeId + "/updates", manager, body("expectedEpisodeVersion", episodeVersion(episodeId), "type", "LOSS", "occurredAt", at(0, 7, 0)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("details"));
        post_("/pregnancy-episodes/" + episodeId + "/updates", manager, body("expectedEpisodeVersion", episodeVersion(episodeId), "type", "LOSS", "occurredAt", at(0, 7, 0),
                "details", "x".repeat(1001)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        post_("/pregnancy-episodes/" + episodeId + "/updates", manager, body("expectedEpisodeVersion", episodeVersion(episodeId), "type", "LOSS", "occurredAt", at(0, 7, 0),
                "details", "Sẩy thai"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.episodeStatus").value("LOST"))
            .andExpect(jsonPath("$.reproStatus").value("AWAITING_BREEDING"));
        assertThat(em.createQuery("select count(o) from CalfOutcome o where o.calving.dam.id=:c", Long.class).setParameter("c", cow.getId()).getSingleResult()).isZero();
    }

    @Test
    void tc12_10_anUpdateOnACalvedPregnancyIsFE12_12() throws Exception {
        long episodeId = pregnant(290).at("/episode/episodeId").asLong();
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf()), "episodeId", episodeId, "expectedEpisodeVersion", episodeVersion(episodeId))).andExpect(status().isCreated());
        post_("/pregnancy-episodes/" + episodeId + "/updates", manager, body("expectedEpisodeVersion", episodeVersion(episodeId), "type", "OBSERVATION", "occurredAt", at(0, 7, 0), "details", "x"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE12-12")).andExpect(jsonPath("$.params.dam_code").value(cow.getDisplayCode()));
    }

    // ------------------------------------------------------------------ FE-12 A4 calving

    @Test
    void tc12_11_aCalvingNeedsOneToFourCalves() throws Exception {
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of()))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE12-06"));
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf(), calf(), calf(), calf(), calf())))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("calves"));
    }

    @Test
    void tc12_12_13_birthWeightAndSexAreChecked() throws Exception {
        for (Map<String, Object> bad : List.of(calf("birthWeightKg", 0.5), calf("birthWeightKg", 80.1), calf("weightBasis", null))) {
            post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf(), bad)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE12-07"))
                .andExpect(jsonPath("$.params.field").value("calves[1].birthWeightKg"));
        }
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf("sex", "UNKNOWN"))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("calves[0].sex"));
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf("outcome", "STILLBORN", "sex", "UNKNOWN", "penId", null)))).andExpect(status().isCreated());
    }

    @Test
    void tc12_14_aTagUsedByAnotherCattleIsFE12_08() throws Exception {
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf("tagCode", bull.getDisplayCode()))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE12-08"))
            .andExpect(jsonPath("$.params.tag_code").value(bull.getDisplayCode()))
            .andExpect(jsonPath("$.params.field").value("calves[0].tagCode"));
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf("tagCode", "T-1"), calf("tagCode", "t-1"))))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.params.field").value("calves[1].tagCode"));
    }

    @Test
    void tc12_15_q5_aDraftAndARegisteredCalfWithoutATag() throws Exception {
        long breedingId = read(post_("/cattle/" + cow.getId() + "/breeding-events", manager, body("expectedCattleVersion", v(cow), "bredAt", at(290, 8, 0),
            "method", "NATURAL", "sireSource", "INTERNAL", "sireCattleId", bull.getId())).andExpect(status().isCreated())).get("eventId").asLong();
        long episodeId = check(cow, at(250, 9, 0), "PREGNANT", "linkedBreedingId", breedingId).at("/episode/episodeId").asLong();
        JsonNode r = read(post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf(), calf("sex", "MALE", "registration", "REGISTER_NOW", "purposeId", undecided.getId())),
            "episodeId", episodeId, "expectedEpisodeVersion", episodeVersion(episodeId))).andExpect(status().isCreated()));
        assertThat(r.get("damStatus").asText()).isEqualTo("POST_CALVING");
        assertThat(r.at("/calves/0/registration").asText()).isEqualTo("PENDING_CONFIRMATION");
        assertThat(absent(r, "/calves/0/cattleId")).isTrue();
        assertThat(r.at("/calves/1/registration").asText()).isEqualTo("REGISTERED");
        assertThat(r.at("/calves/1/voucherCode").asText()).isNotBlank();
        Cattle calf = em.find(Cattle.class, r.at("/calves/1/cattleId").asLong());
        assertThat(calf.getLifeStage()).isEqualTo(LifeStage.UNWEANED_CALF);
        assertThat(em.createQuery("select count(t) from CattleQrTag t where t.cattle.id=:c", Long.class).setParameter("c", calf.getId()).getSingleResult()).isEqualTo(1); // Q3/Q5
        assertThat(em.find(PregnancyEpisode.class, episodeId).getStatus()).isEqualTo("CALVED");
        assertThat(em.createQuery("select count(r) from Reminder r where r.ruleType='REM-09' and r.status in ('OPEN','ACTIVE') and r.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isEqualTo(1);
        assertThat(em.createQuery("select count(r) from Reminder r where r.cattle.id=:c and r.ruleType='REM-07' and r.status='ACTIVE'", Long.class).setParameter("c", cow.getId()).getSingleResult()).isEqualTo(1);

        // TC-12-22 / TC-12-24: the registered calf blocks voiding the calving and changing that calf
        long calvingId = r.get("calvingId").asLong();
        post_("/calvings/" + calvingId + "/void", manager, body("expectedVersion", r.get("version").asInt(), "reason", "Nhầm"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE11-07")).andExpect(jsonPath("$.params.dependents[0].type").value("REGISTERED_CALF"));
        long calfId = r.at("/calves/1/calfId").asLong();
        em.flush();
        post_("/calf-outcomes/" + calfId + "/void", manager, body("expectedVersion", versionOf(CalfOutcome.class, calfId), "reason", "Nhầm"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE11-07"));
        post_("/calf-outcomes/" + calfId + "/correction", manager, body("expectedVersion", versionOf(CalfOutcome.class, calfId), "reason", "Nhầm", "outcome", "STILLBORN"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE11-07"));
        // TC-12-20: the confirming check of a calved pregnancy cannot become NOT_PREGNANT
        long checkId = em.find(PregnancyEpisode.class, episodeId).getConfirmingCheck().getId();
        post_("/reproduction-events/" + checkId + "/correction", manager, body("expectedVersion", eventVersion(checkId), "reason", "Sai", "result", "NOT_PREGNANT"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE11-07"));
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.calvings[0].calves[1].cattleCode").value(calf.getDisplayCode()))
            .andExpect(jsonPath("$.calvings[0].attendant.id").value(manager.getId()))
            .andExpect(jsonPath("$.parity").value(1));
    }

    @Test
    void tc12_17_aCalvingWithoutATrackedPregnancyCreatesNoEarlierEvent() throws Exception {
        JsonNode r = read(post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf()), "noTrackedPregnancy", true, "attendantName", "Hàng xóm"))
            .andExpect(status().isCreated()));
        assertThat(absent(r, "/episodeId")).isTrue();
        assertThat(em.createQuery("select count(e) from ReproductionEvent e where e.cattle.id=:c", Long.class).setParameter("c", cow.getId()).getSingleResult()).isZero();
    }

    @Test
    void tc12_19_aSecondCalvingWithin30DaysIsFE12_12() throws Exception {
        post_("/calvings", manager, calvingBody(at(14, 6, 0), List.of(calf()))).andExpect(status().isCreated());
        post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf())))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE12-12"));
    }

    // ------------------------------------------------------------------ FE-12 A5–A8

    @Test
    void tc12_21_voidingTheOnlyPregnantCheckVoidsThePregnancy() throws Exception {
        JsonNode r = check(cow, at(1, 9, 0), "PREGNANT", "estimatedMonths", 3);
        long checkId = r.get("eventId").asLong(), episodeId = r.at("/episode/episodeId").asLong();
        post_("/reproduction-events/" + checkId + "/void", manager, body("expectedVersion", eventVersion(checkId), "reason", "Ghi nhầm bò")).andExpect(status().isOk());
        assertThat(em.find(PregnancyEpisode.class, episodeId).getStatus()).isEqualTo("VOIDED");
        get_("/cattle/" + cow.getId() + "/reproduction-history", manager)
            .andExpect(jsonPath("$.status").value("AWAITING_BREEDING"))
            .andExpect(jsonPath("$.timeline[0].status").value("VOIDED"))
            .andExpect(jsonPath("$.timeline[0].voidReason").value("Ghi nhầm bò"));
    }

    @Test
    void tc12_23_voidingACalvingWithDraftCalvesVoidsThemAndReopensThePregnancy() throws Exception {
        long episodeId = pregnant(290).at("/episode/episodeId").asLong();
        JsonNode r = read(post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf(), calf("sex", "MALE")), "episodeId", episodeId,
            "expectedEpisodeVersion", episodeVersion(episodeId))).andExpect(status().isCreated()));
        JsonNode voided = read(post_("/calvings/" + r.get("calvingId").asLong() + "/void", manager, body("expectedVersion", r.get("version").asInt(), "reason", "Ghi nhầm"))
            .andExpect(status().isOk()));
        assertThat(voided.at("/calves/0/status").asText()).isEqualTo("VOIDED");
        assertThat(voided.at("/calves/1/status").asText()).isEqualTo("VOIDED");
        assertThat(voided.get("damStatus").asText()).isEqualTo("PREGNANT");
        assertThat(em.find(PregnancyEpisode.class, episodeId).getStatus()).isEqualTo("OPEN");
        assertThat(em.createQuery("select count(r) from Reminder r where r.ruleType='REM-09' and r.status in ('OPEN','ACTIVE') and r.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isZero();
    }

    @Test
    void tc12_25_voidingALossAfterANewPregnancyDoesNotReopenTheOldOne() throws Exception {
        long oldEpisode = check(cow, at(100, 9, 0), "PREGNANT", "estimatedMonths", 2).at("/episode/episodeId").asLong();
        JsonNode loss = read(post_("/pregnancy-episodes/" + oldEpisode + "/updates", manager, body("expectedEpisodeVersion", episodeVersion(oldEpisode), "type", "LOSS",
            "occurredAt", at(60, 7, 0), "details", "Sẩy thai")).andExpect(status().isCreated()));
        long newEpisode = check(cow, at(1, 9, 0), "PREGNANT", "estimatedMonths", 1).at("/episode/episodeId").asLong();
        assertThat(newEpisode).isNotEqualTo(oldEpisode);
        post_("/pregnancy-updates/" + loss.get("updateId").asLong() + "/void", manager, body("expectedVersion", loss.get("version").asInt(), "reason", "Nhầm"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.episodeStatus").value("LOST"));
        assertThat(em.find(PregnancyEpisode.class, newEpisode).getStatus()).isEqualTo("OPEN");
    }

    @Test
    void voidingALossWithoutANewerPregnancyReopensIt() throws Exception {
        long episodeId = check(cow, at(100, 9, 0), "PREGNANT", "estimatedMonths", 2).at("/episode/episodeId").asLong();
        JsonNode loss = read(post_("/pregnancy-episodes/" + episodeId + "/updates", manager, body("expectedEpisodeVersion", episodeVersion(episodeId), "type", "LOSS",
            "occurredAt", at(60, 7, 0), "details", "Sẩy thai")).andExpect(status().isCreated()));
        post_("/pregnancy-updates/" + loss.get("updateId").asLong() + "/void", manager, body("expectedVersion", loss.get("version").asInt(), "reason", "Nhầm"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.episodeStatus").value("OPEN")).andExpect(jsonPath("$.reproStatus").value("PREGNANT"));
    }

    @Test
    void aDraftCalfCanBeCorrectedAndItsTagStaysUnique() throws Exception {
        JsonNode r = read(post_("/calvings", manager, calvingBody(at(0, 6, 0), List.of(calf(), calf("sex", "MALE")))).andExpect(status().isCreated()));
        long calfId = r.at("/calves/0/calfId").asLong();
        em.flush();
        post_("/calf-outcomes/" + calfId + "/correction", manager, body("expectedVersion", versionOf(CalfOutcome.class, calfId), "reason", "Đo lại", "birthWeightKg", 81, "weightBasis", "MEASURED"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE12-07"));
        post_("/calf-outcomes/" + calfId + "/correction", manager, body("expectedVersion", versionOf(CalfOutcome.class, calfId), "reason", "Thẻ", "tagCode", bull.getDisplayCode()))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE12-08"));
        post_("/calf-outcomes/" + calfId + "/correction", manager, body("expectedVersion", versionOf(CalfOutcome.class, calfId), "reason", "Đo lại", "birthWeightKg", 27.4,
                "weightBasis", "ESTIMATED", "tagCode", "CALF-9"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.tagCode").value("CALF-9"));
        long secondId = r.at("/calves/1/calfId").asLong();
        em.flush();
        post_("/calf-outcomes/" + secondId + "/void", manager, body("expectedVersion", versionOf(CalfOutcome.class, secondId), "reason", "Trùng")).andExpect(status().isOk());
        em.flush();
        post_("/calf-outcomes/" + calfId + "/void", manager, body("expectedVersion", versionOf(CalfOutcome.class, calfId), "reason", "Trùng"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE12-06")); // the last calf: void the calving
    }
}
