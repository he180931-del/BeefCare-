package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.CodeType;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;

/** GBR-109: each farm receives its own ordinary catalogue rows, in the farm creation transaction. */
@Service
public class StarterCatalogueService {
    public record BreedSeed(String code, String name, String group) {}
    public static final List<BreedSeed> BREEDS = List.of(
        new BreedSeed("VANG", "Bò Vàng Việt Nam", "Local"),
        new BreedSeed("LAISIND", "Lai Sind", "Crossbred"),
        new BreedSeed("ZEBU-D", "Zebu đỏ", "Zebu crossbred"),
        new BreedSeed("BRAHMAN-D", "Brahman đỏ", "Zebu"),
        new BreedSeed("BRAHMAN-T", "Brahman trắng", "Zebu"),
        new BreedSeed("DROUGHT", "Droughtmaster", "Crossbred"),
        new BreedSeed("F1-BBB", "F1 BBB × Lai Sind", "Crossbred"),
        new BreedSeed("F1-CHA", "F1 Charolais × Lai Sind", "Crossbred"),
        new BreedSeed("F1-ANG", "F1 Red Angus × Lai Sind", "Crossbred")
    );
    private final EntityManager em;
    private final FarmClock clock;
    public StarterCatalogueService(EntityManager em, FarmClock clock) { this.em = em; this.clock = clock; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void create(Farm farm, AppUser owner, Set<String> selectedBreedCodes) {
        Set<String> selected = selectedBreedCodes == null ? Set.of() : selectedBreedCodes;
        Set<String> validCodes = BREEDS.stream().map(BreedSeed::code).collect(java.util.stream.Collectors.toSet());
        if (!validCodes.containsAll(selected)) throw DomainException.invalid("mainBreedCodes");
        Set<Breed> main = new LinkedHashSet<>();
        for (BreedSeed seed : BREEDS) {
            Breed b = new Breed(); b.setFarm(farm); b.setCode(seed.code()); b.setName(seed.name());
            b.setBreedGroup(seed.group()); b.setAvailable(selected.contains(seed.code())); em.persist(b);
            if (b.getAvailable()) main.add(b);
        }
        farm.setMainBreeds(main);
        purpose(farm, "MD-SS", "Bò cái sinh sản", PurposeType.BREEDING);
        purpose(farm, "MD-VB", "Vỗ béo", PurposeType.FATTENING);
        purpose(farm, "MD-DG", "Đực giống", PurposeType.SIRE);
        purpose(farm, "MD-CXD", "Chưa xác định", PurposeType.UNDECIDED);
        vaccine(farm, "VX-LMLM", "Vắc-xin Lở mồm long móng", "Lở mồm long móng", true);
        vaccine(farm, "VX-THT", "Vắc-xin Tụ huyết trùng", "Tụ huyết trùng", true);
        vaccine(farm, "VX-VDNC", "Vắc-xin Viêm da nổi cục", "Viêm da nổi cục", true);
        vaccine(farm, "VX-NT", "Vắc-xin Nhiệt thán", "Nhiệt thán", false);
        feed(farm, "TA-01", "Cỏ voi tươi", "GREEN_ROUGHAGE", "kg", 1);
        feed(farm, "TA-02", "Cỏ VA06 tươi", "GREEN_ROUGHAGE", "kg", 1);
        feed(farm, "TA-03", "Rơm khô", "DRY_ROUGHAGE", "kg", 1);
        feed(farm, "TA-04", "Thân cây ngô ủ chua", "GREEN_ROUGHAGE", "kg", 1);
        feed(farm, "TA-05", "Cám hỗn hợp bò thịt", "CONCENTRATE", "bao", 25);
        feed(farm, "TA-06", "Bột ngô", "CONCENTRATE", "kg", 1);
        feed(farm, "TA-07", "Rỉ mật", "CONCENTRATE", "kg", 1);
        feed(farm, "TA-08", "Đá liếm khoáng", "MINERAL_ADDITIVE", "kg", 1);
        feed(farm, "TA-09", "Thức ăn tập ăn cho bê", "CALF_FEED", "bao", 25);
        CodeSequence sequence = new CodeSequence(); sequence.setFarmId(farm.getId()); sequence.setCodeType(CodeType.FEED_ITEM);
        sequence.setPeriodYear(0); sequence.setLastValue(9L); em.persist(sequence);
        FarmParameterVersion parameters = new FarmParameterVersion(); parameters.setFarm(farm); parameters.setVersionNo(1);
        parameters.setGestationLengthDays(283); parameters.setEffectiveFrom(clock.today());
        parameters.setSourceNote("SRS SCR-56 default parameters"); parameters.setChangedBy(owner); parameters.setCreatedAt(clock.now());
        parameters.setParameterValues(JsonSupport.toJson(defaultParameters())); em.persist(parameters);
        // Compatibility projection for the existing entry/reminder services. The version entity remains authoritative.
        defaultParameters().forEach((name, value) -> {
            ReminderParameter p = new ReminderParameter(); p.setFarm(farm); p.setParameterType(name);
            p.setParamValue(String.valueOf(value)); p.setVersionNo(1); p.setEffectiveFrom(clock.today()); em.persist(p);
        });
    }

    public static Map<String, Object> defaultParameters() {
        Map<String, Object> p = new java.util.LinkedHashMap<>();
        p.put("WEANING_AGE_MONTHS", 6); p.put("YOUNG_STOCK_AGE_MONTHS", 12); p.put("ADULT_AGE_MONTHS", 24);
        p.put("MIN_BREEDING_AGE_MONTHS", 13); p.put("MIN_BREEDING_WEIGHT_KG", 230); p.put("GESTATION_LENGTH_DAYS", 283);
        p.put("PREGNANCY_CHECK_DAYS", 28); p.put("PREGNANCY_RECHECK_DAYS", 14); p.put("CALVING_LEAD_DAYS", 30);
        p.put("POST_CALVING_DAYS", 45); p.put("BREEDING_WINDOW_START_HOURS", 8); p.put("BREEDING_WINDOW_END_HOURS", 12);
        p.put("ESTRUS_CYCLE_DAYS", 21); p.put("BCS_SCALE", "1-5:0.5"); p.put("WEIGHING_INTERVAL_DAYS", 30);
        p.put("VACCINATION_LEAD_DAYS", 7); p.put("TARGET_FINISHING_WEIGHT_KG", 450);
        return p;
    }
    private void purpose(Farm f, String code, String name, PurposeType type) {
        ProductionPurpose p = new ProductionPurpose(); p.setFarm(f); p.setCode(code); p.setName(name);
        p.setPurposeType(type); p.setAvailable(true); em.persist(p);
    }
    private void vaccine(Farm f, String code, String name, String disease, boolean available) {
        Vaccine v = new Vaccine(); v.setFarm(f); v.setCode(code); v.setName(name); v.setDiseasePrevented(disease);
        v.setWithdrawalInfo("0"); v.setAvailable(available); em.persist(v);
    }
    private void feed(Farm f, String code, String name, String group, String purchaseUnit, int kg) {
        FeedItem item = new FeedItem(); item.setFarm(f); item.setCode(code); item.setName(name); item.setFeedGroup(group);
        item.setStockUnit("kg"); item.setPurchaseUnit(purchaseUnit); item.setKgPerPurchaseUnit(BigDecimal.valueOf(kg));
        item.setOnHandKg(BigDecimal.ZERO); item.setAvgUnitCost(BigDecimal.ZERO); item.setAvailable(true); em.persist(item);
    }
}

