package vn.edu.fpt.beefcare.service;

import java.util.EnumSet;
import java.util.Set;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;

/**
 * The role matrix of section 1 of the FE-04 / FE-06 / FE-13 specification. A write action is also blocked
 * while the farm service is not ACTIVE (GBR-09, MSG-COM-12).
 */
public enum FarmAction {
    /** Owner access to the farm's own information remains available during service suspension. */
    VIEW_FARM_INFORMATION(false, FarmRole.OWNER),
    /** Owner may maintain the farm's own information regardless of service status. */
    MANAGE_FARM_INFORMATION(true, FarmRole.OWNER),
    /** Catalogue lookups used by farm workflows require an ACTIVE farm and are readable by every farm role. */
    VIEW_CATALOGUES(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    VIEW_CATTLE(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    MANAGE_CATTLE(true, FarmRole.OWNER, FarmRole.MANAGER),
    MANAGE_GROWTH(true, FarmRole.MANAGER),
    MANAGE_CATALOGUES(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** View pens, occupancy, pen history, cattle: every member. */
    VIEW_PENS(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    /** Create / edit pens, change criteria, stop / resume pens. */
    MANAGE_PENS(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** Upload or remove profile photos for active cattle. */
    MANAGE_CATTLE_PHOTOS(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** Read-only health and vaccination history, including for technicians. */
    VIEW_HEALTH(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    /** Record and maintain health cases, observations, treatments and vaccinations; Manager only. */
    MANAGE_HEALTH(true, FarmRole.MANAGER),
    /** Read-only reproduction history and derived reproductive state, including for technicians. */
    VIEW_REPRODUCTION(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    /** Record and maintain estrus, breeding, pregnancy and calving; Manager only. */
    MANAGE_REPRODUCTION(true, FarmRole.MANAGER),
    /** Read reference care catalogues; Owner and Manager only. */
    VIEW_CARE_CATALOGUES(false, FarmRole.OWNER, FarmRole.MANAGER),
    /** Maintain vaccines, medicines and farm parameters; Owner and Manager. */
    MANAGE_CARE_CATALOGUES(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** Move one or several cattle between pens. */
    MOVE_CATTLE(true, FarmRole.OWNER, FarmRole.MANAGER),
    VIEW_ENTRY_VOUCHERS(false, FarmRole.OWNER, FarmRole.MANAGER),
    /** Create / save draft / post / discard / void entry vouchers; correct or void one herd entry. */
    MANAGE_ENTRY_VOUCHERS(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** Record or void a payment to a seller / supplier (PAY). */
    RECORD_ENTRY_PAYMENT(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** Manager has read-only access to exit vouchers; Technician none. */
    VIEW_EXIT_VOUCHERS(false, FarmRole.OWNER, FarmRole.MANAGER),
    /** Create / edit / confirm / dismiss / void exit vouchers and death vouchers: Owner only. */
    MANAGE_EXIT_VOUCHERS(true, FarmRole.OWNER),
    /** Record or void a collection from a buyer (COLLECT): Owner only. */
    RECORD_EXIT_COLLECTION(true, FarmRole.OWNER),
    VIEW_PARTNERS(false, FarmRole.OWNER, FarmRole.MANAGER),
    /** Sellers and feed suppliers. */
    MANAGE_SELLERS(true, FarmRole.OWNER, FarmRole.MANAGER),
    /** Buyers: Owner only. */
    MANAGE_BUYERS(true, FarmRole.OWNER),
    VIEW_FEED(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    MANAGE_FEED(true, FarmRole.OWNER, FarmRole.MANAGER),
    MANAGE_FEEDING(true, FarmRole.MANAGER),
    VIEW_ANNOUNCEMENTS(false, FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN),
    MANAGE_ANNOUNCEMENTS(true, FarmRole.OWNER, FarmRole.MANAGER),
    VIEW_REPORTS(false, FarmRole.OWNER, FarmRole.MANAGER);

    private final boolean write;
    private final Set<FarmRole> roles;

    FarmAction(boolean write, FarmRole first, FarmRole... more) {
        this.write = write;
        this.roles = EnumSet.of(first, more);
    }

    public boolean isWrite() {
        return write;
    }

    public boolean allows(FarmRole role) {
        return roles.contains(role);
    }
}
