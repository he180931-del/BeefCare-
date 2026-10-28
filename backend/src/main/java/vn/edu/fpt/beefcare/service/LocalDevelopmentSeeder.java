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
    private final EntityManager em; private final PasswordEncoder encoder; private final StarterCatalogueService starters;
    private final FarmClock clock; private final String password;
    public LocalDevelopmentSeeder(EntityManager em,PasswordEncoder encoder,StarterCatalogueService starters,FarmClock clock,
        @Value("${beefcare.local-seed.password:}") String password) { this.em=em;this.encoder=encoder;this.starters=starters;this.clock=clock;this.password=password; }
    @Override @Transactional
    public void run(ApplicationArguments args) {
        if(password.length()<12 || password.startsWith("replace-with-")) throw new IllegalStateException("Set BEEFCARE_DEV_PASSWORD to a local-only password of at least 12 characters before running the local profile");
        AppUser owner=account("owner@beefcare.local","Local Owner");
        AppUser manager=account("manager@beefcare.local","Local Manager");
        AppUser technician=account("technician@beefcare.local","Local Technician");
        AppUser other=account("other-owner@beefcare.local","Other Farm Owner");
        staff(account("cs@beefcare.local","Local Customer Support"),"CS");
        staff(account("pm@beefcare.local","Local Platform Manager"),"PM");
        AppUser admin=account("sa@beefcare.local","Local System Administrator");staff(admin,"SA");
        Authority documentation=em.find(Authority.class,"ROLE_ADMIN");
        if(documentation==null){documentation=new Authority();documentation.setName("ROLE_ADMIN");em.persist(documentation);}
        User localAdmin=em.createQuery("select u from User u where u.login=:login",User.class).setParameter("login",admin.getEmail()).getSingleResult();
        java.util.HashSet<Authority> roles=new java.util.HashSet<>(localAdmin.getAuthorities());roles.add(documentation);localAdmin.setAuthorities(roles);
        Farm first=farm("BeefCare Local Farm A",owner); Farm second=farm("BeefCare Local Farm B",other);
        member(first,manager,"MANAGER");member(first,technician,"TECHNICIAN");
        // Farm B deliberately has a different owner, so cross-farm checks can be reproduced by the team.
        em.flush();
    }
    private AppUser account(String email,String name) {
        List<User> users=em.createQuery("select u from User u where u.login=:login",User.class).setParameter("login",email).getResultList();
        if(users.isEmpty()) {
            Authority role=em.find(Authority.class,"ROLE_USER");if(role==null){role=new Authority();role.setName("ROLE_USER");em.persist(role);}
            User user=new User();user.setLogin(email);user.setEmail(email);user.setFirstName(name);user.setActivated(true);
            user.setLangKey("vi");user.setPassword(encoder.encode(password));user.setAuthorities(Set.of(role));em.persist(user);
        }
        List<AppUser> existing=em.createQuery("select u from AppUser u where lower(u.email)=:email",AppUser.class).setParameter("email",email).getResultList();
        if(!existing.isEmpty()) return existing.get(0);
        AppUser app=new AppUser();app.setEmail(email);app.setFullName(name);app.setPhone("0900000000");app.setAccountStatus("ACTIVE");
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
        Long count=em.createQuery("select count(m) from FarmMembership m where m.farm.id=:farm and m.user.id=:user",Long.class)
            .setParameter("farm",farm.getId()).setParameter("user",user.getId()).getSingleResult();
        if(count==0){FarmMembership m=new FarmMembership();m.setFarm(farm);m.setUser(user);m.setRole(role);m.setStatus("ACTIVE");em.persist(m);}
    }
    private void staff(AppUser user,String role) {
        Long count=em.createQuery("select count(p) from PlatformStaffAccess p where p.user.id=:u",Long.class).setParameter("u",user.getId()).getSingleResult();
        if(count==0){PlatformStaffAccess p=new PlatformStaffAccess();p.setUser(user);p.setRole(role);p.setStatus("ACTIVE");em.persist(p);}
    }
}
