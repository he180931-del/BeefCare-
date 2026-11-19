package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class FarmAccessServiceTest extends DomainTestSupport {

    @Autowired
    FarmAccessService access;

    /** Section 1 of the spec, row by row, written independently of FarmAction. */
    private static final Map<FarmAction, Set<FarmRole>> MATRIX = new EnumMap<>(FarmAction.class);

    static {
        Set<FarmRole> all = EnumSet.of(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN);
        Set<FarmRole> ownerManager = EnumSet.of(FarmRole.OWNER, FarmRole.MANAGER);
        Set<FarmRole> ownerOnly = EnumSet.of(FarmRole.OWNER);
        Set<FarmRole> managerOnly = EnumSet.of(FarmRole.MANAGER);
        MATRIX.put(FarmAction.VIEW_FARM_INFORMATION, ownerOnly);
        MATRIX.put(FarmAction.MANAGE_FARM_INFORMATION, ownerOnly);
        MATRIX.put(FarmAction.VIEW_CATALOGUES, all);
        MATRIX.put(FarmAction.VIEW_CATTLE, all);
        MATRIX.put(FarmAction.MANAGE_CATTLE, ownerManager);
        MATRIX.put(FarmAction.MANAGE_GROWTH, managerOnly);
        MATRIX.put(FarmAction.MANAGE_CATALOGUES, ownerManager);
        MATRIX.put(FarmAction.MANAGE_CATTLE_PHOTOS, ownerManager);
        MATRIX.put(FarmAction.VIEW_HEALTH, all);
        MATRIX.put(FarmAction.MANAGE_HEALTH, managerOnly);
        MATRIX.put(FarmAction.VIEW_REPRODUCTION, all);
        MATRIX.put(FarmAction.MANAGE_REPRODUCTION, managerOnly);
        MATRIX.put(FarmAction.VIEW_CARE_CATALOGUES, ownerManager);
        MATRIX.put(FarmAction.MANAGE_CARE_CATALOGUES, ownerManager);
        MATRIX.put(FarmAction.VIEW_PENS, all); // view pens, headcount, pen history: technician read-only
        MATRIX.put(FarmAction.MANAGE_PENS, ownerManager); // create / edit / criteria / stop / resume
        MATRIX.put(FarmAction.MOVE_CATTLE, ownerManager);
        MATRIX.put(FarmAction.VIEW_ENTRY_VOUCHERS, ownerManager);
        MATRIX.put(FarmAction.MANAGE_ENTRY_VOUCHERS, ownerManager); // create, draft, post, correct, void
        MATRIX.put(FarmAction.RECORD_ENTRY_PAYMENT, ownerManager); // pay seller
        MATRIX.put(FarmAction.VIEW_EXIT_VOUCHERS, ownerManager); // manager read-only
        MATRIX.put(FarmAction.MANAGE_EXIT_VOUCHERS, ownerOnly); // create / edit / confirm / dismiss / void
        MATRIX.put(FarmAction.RECORD_EXIT_COLLECTION, ownerOnly);
        MATRIX.put(FarmAction.VIEW_PARTNERS, ownerManager);
        MATRIX.put(FarmAction.MANAGE_SELLERS, ownerManager);
        MATRIX.put(FarmAction.MANAGE_BUYERS, ownerOnly);
        MATRIX.put(FarmAction.VIEW_FEED, all);
        MATRIX.put(FarmAction.MANAGE_FEED, ownerManager);
        MATRIX.put(FarmAction.MANAGE_FEEDING, managerOnly);
        MATRIX.put(FarmAction.VIEW_ANNOUNCEMENTS, all);
        MATRIX.put(FarmAction.MANAGE_ANNOUNCEMENTS, ownerManager);
        MATRIX.put(FarmAction.VIEW_REPORTS, ownerManager);
    }

    @Test
    void matrixCoversEveryAction() {
        assertThat(MATRIX.keySet()).containsExactlyInAnyOrder(FarmAction.values());
    }

    @Test
    void roleMatrixEveryRow() {
        Farm farm = farm();
        for (FarmRole role : FarmRole.values()) {
            AppUser u = memberWithRole(farm, role);
            actAs(u);
            for (FarmAction action : FarmAction.values()) {
                boolean allowed = MATRIX.get(action).contains(role);
                if (allowed) {
                    FarmContext ctx = access.require(farm.getId(), action);
                    assertThat(ctx.role()).as("%s %s", role, action).isEqualTo(role);
                    assertThat(ctx.user().getId()).isEqualTo(u.getId());
                } else {
                    assertThatThrownBy(() -> access.require(farm.getId(), action))
                        .as("%s must not %s", role, action)
                        .isInstanceOfSatisfying(DomainException.class, e -> {
                            assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01);
                            assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                        });
                }
            }
        }
    }

    @Test
    void nonMemberAndOtherFarmMemberAreForbidden() {
        Farm farm = farm();
        Farm other = farm();
        AppUser outsider = user();
        actAs(outsider);
        assertForbidden(() -> access.require(farm.getId(), FarmAction.VIEW_PENS));
        AppUser ownerOfOther = memberWithRole(other, FarmRole.OWNER);
        actAs(ownerOfOther);
        assertForbidden(() -> access.require(farm.getId(), FarmAction.VIEW_PENS));
        assertThat(access.require(other.getId(), FarmAction.VIEW_PENS).farmId()).isEqualTo(other.getId());
    }

    @Test
    void inactiveMembershipOrAccountIsForbidden() {
        Farm farm = farm();
        AppUser removed = user();
        member(farm, removed, "OWNER", "REMOVED");
        actAs(removed);
        assertForbidden(() -> access.require(farm.getId(), FarmAction.VIEW_PENS));

        AppUser suspended = user("SUSPENDED");
        member(farm, suspended, "OWNER", "ACTIVE");
        actAs(suspended);
        assertForbidden(() -> access.require(farm.getId(), FarmAction.VIEW_PENS));
    }

    @Test
    void unknownRoleValueIsForbidden() {
        Farm farm = farm();
        AppUser u = user();
        member(farm, u, "VISITOR", "ACTIVE");
        actAs(u);
        assertForbidden(() -> access.require(farm.getId(), FarmAction.VIEW_PENS));
    }

    @Test
    void unauthenticatedIs401() {
        Farm farm = farm();
        SecurityContextHolder.clearContext();
        assertThatThrownBy(() -> access.require(farm.getId(), FarmAction.VIEW_PENS))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void serviceNotActiveBlocksOperationalReadsAndWritesButAllowsOwnerFarmInformation() {
        for (String status : new String[] { "EXPIRED", "SUSPENDED", "SUSPENDED_FOR_NONPAYMENT" }) {
            Farm farm = farm(status);
            AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            actAs(owner);
            for (FarmAction action : FarmAction.values()) {
                if (action == FarmAction.VIEW_FARM_INFORMATION || action == FarmAction.MANAGE_FARM_INFORMATION) {
                    assertThat(access.require(farm.getId(), action).farm().getId()).isEqualTo(farm.getId());
                } else if (MATRIX.get(action).contains(FarmRole.OWNER)) {
                    assertThatThrownBy(() -> access.require(farm.getId(), action))
                        .as("%s on %s farm", action, status)
                        .isInstanceOfSatisfying(DomainException.class, e -> {
                            assertThat(e.getCode()).isEqualTo(MessageCodes.COM_12);
                            assertThat(e.getParams()).containsEntry("status", status).containsEntry("farm", farm.getName());
                        });
                } else {
                    assertForbidden(() -> access.require(farm.getId(), action));
                }
            }
        }
    }

    @Test
    void roleCheckComesBeforeServiceStatus() {
        Farm farm = farm("EXPIRED");
        AppUser tech = memberWithRole(farm, FarmRole.TECHNICIAN);
        actAs(tech);
        assertForbidden(() -> access.require(farm.getId(), FarmAction.MANAGE_PENS));
    }

    @Test
    void roleMappingToleratesPrefixAndCase() {
        assertThat(FarmAccessService.parseRole("owner")).isEqualTo(FarmRole.OWNER);
        assertThat(FarmAccessService.parseRole("ROLE_MANAGER")).isEqualTo(FarmRole.MANAGER);
        assertThat(FarmAccessService.parseRole("FARM_TECHNICIAN")).isEqualTo(FarmRole.TECHNICIAN);
        assertThat(FarmAccessService.parseRole(null)).isNull();
    }

    private void assertForbidden(Runnable call) {
        assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
            });
    }
}
