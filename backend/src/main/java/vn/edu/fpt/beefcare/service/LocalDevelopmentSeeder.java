package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;

/** Repeatable local fixtures, isolated from normal farm registration and never active in prod. */
@Component
@Profile("local")
@ConditionalOnProperty(name="beefcare.local-seed.enabled",havingValue="true")
public class LocalDevelopmentSeeder implements ApplicationRunner {
    record LocalAccount(String login, String role, String name) {}

    static List<LocalAccount> localFixtureAccounts() {
        return List.of(
            new LocalAccount("owner@beefcare.local", "OWNER", "Local Owner"),
            new LocalAccount("owner-2@beefcare.local", "OWNER", "Local Owner 2"),
            new LocalAccount("manager@beefcare.local", "MANAGER", "Local Manager"),
            new LocalAccount("manager-2@beefcare.local", "MANAGER", "Local Manager 2"),
            new LocalAccount("technician@beefcare.local", "TECHNICIAN", "Local Technician"),
            new LocalAccount("technician-2@beefcare.local", "TECHNICIAN", "Local Technician 2")
        );
    }

    private final EntityManager em; private final PasswordEncoder encoder; private final StarterCatalogueService starters;
    private final FarmClock clock; private final String password;
    public LocalDevelopmentSeeder(EntityManager em,PasswordEncoder encoder,StarterCatalogueService starters,FarmClock clock,
        @Value("${beefcare.local-seed.password:}") String password) { this.em=em;this.encoder=encoder;this.starters=starters;this.clock=clock;this.password=password; }
    @Override @Transactional
    public void run(ApplicationArguments args) {
        if(password.length()<12 || password.startsWith("replace-with-")) throw new IllegalStateException("Set BEEFCARE_DEV_PASSWORD to a local-only password of at least 12 characters before running the local profile");
        AppUser owner=account("owner@beefcare.local","Local Owner");
        AppUser owner2=account("owner-2@beefcare.local","Local Owner 2");
        AppUser manager=account("manager@beefcare.local","Local Manager");
        AppUser manager2=account("manager-2@beefcare.local","Local Manager 2");
        AppUser technician=account("technician@beefcare.local","Local Technician");
        AppUser technician2=account("technician-2@beefcare.local","Local Technician 2");
        AppUser other=account("other-owner@beefcare.local","Other Farm Owner");
        staff(account("cs@beefcare.local","Nhân viên hỗ trợ"),"CS");
        staff(account("pm@beefcare.local","Local Platform Manager"),"PM");
        AppUser admin=account("sa@beefcare.local","Local System Administrator");staff(admin,"SA");
        Authority documentation=em.find(Authority.class,"ROLE_ADMIN");
        if(documentation==null){documentation=new Authority();documentation.setName("ROLE_ADMIN");em.persist(documentation);}
        User localAdmin=em.createQuery("select u from User u where u.login=:login",User.class).setParameter("login",admin.getEmail()).getSingleResult();
        java.util.HashSet<Authority> roles=new java.util.HashSet<>(localAdmin.getAuthorities());roles.add(documentation);localAdmin.setAuthorities(roles);
        Farm first=farm("BeefCare Local Farm A",owner); farm("BeefCare Local Farm B",other); farm("BeefCare Local Farm C",owner2);
        member(first,manager,"MANAGER");member(first,manager2,"MANAGER");
        member(first,technician,"TECHNICIAN");member(first,technician2,"TECHNICIAN");
        // Farm B deliberately has a different owner, so cross-farm checks can be reproduced by the team.
        em.flush();
    }
    private AppUser account(String email,String name) {
        List<User> users=em.createQuery("select u from User u where u.login=:login",User.class).setParameter("login",email).getResultList();
        if(users.isEmpty()) {
            Authority role=em.find(Authority.class,"ROLE_USER");if(role==null){role=new Authority();role.setName("ROLE_USER");em.persist(role);}
            User user=new User();user.setLogin(email);user.setEmail(email);user.setFirstName(name);user.setActivated(true);
            user.setLangKey("vi");user.setPassword(encoder.encode(password));user.setAuthorities(Set.of(role));em.persist(user);
        } else {
            User user = users.get(0);
            user.setFirstName(name);
            user.setPassword(encoder.encode(password));
            user.setActivated(true);
            user.setFailedPasswordAttempts(0);
            user.setPasswordLockedUntil(null);
            em.merge(user);
        }
        List<AppUser> existing=em.createQuery("select u from AppUser u where lower(u.email)=:email",AppUser.class).setParameter("email",email).getResultList();
        // Local accounts sign in with the shared local password; repair rows seeded before this flag was set.
        if(!existing.isEmpty()){
            existing.get(0).setFullName(name);
            if(!existing.get(0).isPasswordLoginEnabled()) existing.get(0).setPasswordLoginEnabled(true);
            return existing.get(0);
        }
        AppUser app=new AppUser();app.setEmail(email);app.setFullName(name);app.setPhone("0900000000");app.setAccountStatus("ACTIVE");app.setPasswordLoginEnabled(true);
        app.setOwnerRegistrationCompleted(true);app.setOwnerRegistrationCompletedAt(clock.now());em.persist(app);return app;
    }
    private Farm farm(String name,AppUser owner) {
        List<Farm> existing=em.createQuery("select f from Farm f where f.name=:name",Farm.class).setParameter("name",name).getResultList();
        if(!existing.isEmpty()) return existing.get(0);
        Farm farm=new Farm();farm.setName(name);farm.setLocation("Hà Nội");farm.setContact("0900000000");farm.setProvince("Hà Nội");farm.setCommune("Demo");
        farm.setContactPerson(owner.getFullName());farm.setContactPhone(owner.getPhone());farm.setServiceStatus("ACTIVE");farm.setTimeZone("Asia/Ho_Chi_Minh");em.persist(farm);
        member(farm,owner,"OWNER");starters.create(farm,owner,Set.of("LAISIND","ZEBU-D"));return farm;
    }
    private void member(Farm farm,AppUser user,String role) {
        List<FarmMembership> memberships=em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user",FarmMembership.class)
            .setParameter("farm",farm.getId()).setParameter("user",user.getId()).getResultList();
        if(memberships.isEmpty()){FarmMembership m=new FarmMembership();m.setFarm(farm);m.setUser(user);m.setRole(role);m.setStatus("ACTIVE");em.persist(m);}
        else { FarmMembership m=memberships.get(0); m.setRole(role); m.setStatus("ACTIVE"); }
    }
    private void staff(AppUser user,String role) {
        Long count=em.createQuery("select count(p) from PlatformStaffAccess p where p.user.id=:u",Long.class).setParameter("u",user.getId()).getSingleResult();
        if(count==0){PlatformStaffAccess p=new PlatformStaffAccess();p.setUser(user);p.setRole(role);p.setStatus("ACTIVE");em.persist(p);}
    }
}
