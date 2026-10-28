package vn.edu.fpt.beefcare.support;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

/**
 * Builders for the service tests (H2, rolled back per test): farm, members with roles, pens, catalogue rows, cattle,
 * vouchers, a settable "today" and a way to act as a member.
 */
public abstract class DomainTestSupport {

    protected static final LocalDate TODAY = LocalDate.of(2026, 10, 28);
    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    protected EntityManager em;

    @Autowired
    protected MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.setFarmToday(TODAY);
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    protected int next() {
        return SEQ.incrementAndGet();
    }

    protected <T> T save(T entity) {
        em.persist(entity);
        em.flush();
        return entity;
    }

    protected Farm farm(String serviceStatus) {
        Farm f = new Farm();
        f.setName("Farm " + next());
        f.setLocation("Dong Nai");
        f.setContact("0900000000");
        f.setServiceStatus(serviceStatus);
        return save(f);
    }

    protected Farm farm() {
        return farm("ACTIVE");
    }

    protected AppUser user(String accountStatus) {
        AppUser u = new AppUser();
        u.setEmail("user" + next() + "@beefcare.test");
        u.setFullName("User " + u.getEmail());
        u.setAccountStatus(accountStatus);
        return save(u);
    }

    protected AppUser user() {
        return user("ACTIVE");
    }

    protected FarmMembership member(Farm farm, AppUser user, String role, String status) {
        FarmMembership m = new FarmMembership();
        m.setFarm(farm);
        m.setUser(user);
        m.setRole(role);
        m.setStatus(status);
        return save(m);
    }

    /** A new ACTIVE account with an ACTIVE membership of the given role in the farm. */
    protected AppUser memberWithRole(Farm farm, FarmRole role) {
        AppUser u = user();
        member(farm, u, role.name(), "ACTIVE");
        return u;
    }

    protected void actAs(AppUser user) {
        SecurityContextHolder.getContext()
            .setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "n/a", List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    protected Pen pen(Farm farm, String code, int capacity) {
        Pen p = new Pen();
        p.setFarm(farm);
        p.setCode(code);
        p.setName("Pen " + code);
        p.setCapacity(capacity);
        p.setStatus(ActiveStatus.ACTIVE);
        return save(p);
    }

    protected PenCriteriaVersion criteria(
        Pen pen,
        int versionNo,
        Set<PurposeType> purposes,
        Set<LifeStage> stages,
        Sex sex,
        Integer minAgeMonths,
        BigDecimal minWeightKg,
        AppUser by
    ) {
        PenCriteriaVersion c = new PenCriteriaVersion();
        c.setFarm(pen.getFarm());
        c.setPen(pen);
        c.setVersionNo(versionNo);
        c.setPurposeTypes(purposes);
        c.setLifeStages(stages);
        c.setSex(sex);
        c.setMinAgeMonths(minAgeMonths);
        c.setMinWeightKg(minWeightKg);
        c.setEffectiveFrom(TODAY);
        c.setChangedBy(by);
        c.setCreatedAt(Instant.now());
        return save(c);
    }

    protected Breed breed(Farm farm) {
        Breed b = new Breed();
        b.setFarm(farm);
        b.setCode("B" + next());
        b.setName("Breed");
        b.setAvailable(true);
        return save(b);
    }

    protected ProductionPurpose purpose(Farm farm, PurposeType type) {
        ProductionPurpose p = new ProductionPurpose();
        p.setFarm(farm);
        p.setCode("P" + next());
        p.setName(type.name());
        p.setPurposeType(type);
        p.setAvailable(true);
        return save(p);
    }

    protected Cattle cattle(Farm farm, Breed breed, ProductionPurpose purpose, Sex sex, LifeStage stage) {
        Cattle c = new Cattle();
        c.setFarm(farm);
        c.setDisplayCode(String.format("BC-%06d", next()));
        c.setBreed(breed);
        c.setPurpose(purpose);
        c.setSex(sex);
        c.setLifeStage(stage);
        c.setBirthDate(TODAY.minusMonths(30));
        c.setBirthDateAccuracy(BirthDateAccuracy.EXACT);
        c.setHerdStatus(HerdStatus.ACTIVE);
        return save(c);
    }

    protected Growth weight(Cattle cattle, LocalDate date, String kg) {
        Growth g = new Growth();
        g.setCattle(cattle);
        g.setCheckDate(date);
        g.setEntryTime(Instant.now());
        g.setWeightKg(new BigDecimal(kg));
        g.setWeightType("MEASURED");
        g.setBcs(3);
        g.setStatus("VALID");
        return save(g);
    }

    protected TradingPartner partner(Farm farm, AppUser by, boolean seller, boolean buyer) {
        TradingPartner t = new TradingPartner();
        t.setFarm(farm);
        t.setName("Partner " + next());
        t.setSeller(seller);
        t.setBuyer(buyer);
        t.setStatus(ActiveStatus.ACTIVE);
        t.setCreatedBy(by);
        return save(t);
    }

    protected HerdEntryVoucher entryVoucher(Farm farm, AppUser by, TradingPartner seller, long cattleAmount, long transportFee, EntryVoucherStatus status) {
        HerdEntryVoucher v = new HerdEntryVoucher();
        v.setFarm(farm);
        v.setCode("PN-2026-" + String.format("%04d", next()));
        v.setEntryType(EntryType.PURCHASE);
        v.setEntryDate(TODAY.minusDays(3));
        v.setSeller(seller);
        v.setPricingBasis(PricingBasis.PER_KG);
        v.setCattleAmount(cattleAmount);
        v.setTransportFee(transportFee);
        v.setStatus(status);
        v.setCreatedBy(by);
        return save(v);
    }

    protected HerdExitVoucher exitVoucher(Farm farm, AppUser by, TradingPartner buyer, long cattleAmount, long deductions, ExitVoucherStatus status) {
        HerdExitVoucher v = new HerdExitVoucher();
        v.setFarm(farm);
        v.setCode("PX-2026-" + String.format("%04d", next()));
        v.setExitType(ExitType.SALE);
        v.setExitDate(TODAY.minusDays(2));
        v.setBuyer(buyer);
        v.setPricingBasis(PricingBasis.PER_KG);
        v.setCattleAmount(cattleAmount);
        v.setDeductions(deductions);
        v.setStatus(status);
        v.setReportedBy(by);
        return save(v);
    }

    protected HerdExit exitLine(HerdExitVoucher voucher, Cattle cattle, int lineNo, ExitLineStatus status) {
        HerdExit l = new HerdExit();
        l.setFarm(voucher.getFarm());
        l.setVoucher(voucher);
        l.setLineNo(lineNo);
        l.setCattle(cattle);
        l.setStatus(status);
        return save(l);
    }
}
