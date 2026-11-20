package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;

/** Resolves the current support recipients without depending on the outbox dispatcher. */
@Service
public class SupportTicketNotificationRecipientResolver {
    private final EntityManager entityManager;

    public SupportTicketNotificationRecipientResolver(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Assigned available CS gets the event; otherwise the available CS queue receives it. */
    public List<AppUser> currentCsRecipients(SupportTicket ticket) {
        if (available(ticket.getAssignedCs(), PlatformRole.CS)) return List.of(ticket.getAssignedCs());
        return entityManager.createQuery(
                "select p.user from PlatformStaffAccess p where upper(p.role)='CS' and upper(p.status)='ACTIVE' order by p.id", AppUser.class
            ).getResultList().stream().filter(user -> available(user, PlatformRole.CS)).toList();
    }

    public boolean available(AppUser user, PlatformRole role) {
        if (user == null || user.getId() == null || !"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) return false;
        long accessCount = entityManager.createQuery(
                "select count(p) from PlatformStaffAccess p where p.user.id=:userId and upper(p.status)='ACTIVE' and upper(p.role)=:role", Long.class
            ).setParameter("userId", user.getId()).setParameter("role", role.name()).getSingleResult();
        if (accessCount == 0) return false;
        String email = user.getEmail();
        if (email == null) return false;
        long inactiveIdentityCount = entityManager.createQuery(
                "select count(u) from User u where lower(u.email)=:email and u.activated=false", Long.class
            ).setParameter("email", email.toLowerCase(Locale.ROOT)).getSingleResult();
        return inactiveIdentityCount == 0;
    }
}
