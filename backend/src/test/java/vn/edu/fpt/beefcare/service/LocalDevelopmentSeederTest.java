package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;

class LocalDevelopmentSeederTest {

    @Test
    void localFixtureInventoryHasTwoAccountsPerFarmRole() {
        Map<String, String> roles = LocalDevelopmentSeeder.localFixtureAccounts().stream()
            .collect(Collectors.toMap(LocalDevelopmentSeeder.LocalAccount::login, LocalDevelopmentSeeder.LocalAccount::role));

        assertThat(roles).containsExactlyInAnyOrderEntriesOf(Map.of(
            "owner@beefcare.local", "OWNER",
            "owner-2@beefcare.local", "OWNER",
            "manager@beefcare.local", "MANAGER",
            "manager-2@beefcare.local", "MANAGER",
            "technician@beefcare.local", "TECHNICIAN",
            "technician-2@beefcare.local", "TECHNICIAN"
        ));
        assertThat(roles.values()).containsExactlyInAnyOrder("OWNER", "OWNER", "MANAGER", "MANAGER", "TECHNICIAN", "TECHNICIAN");
    }

    @Test
    void everyLocalIdentityUsesTheExpectedFarmActionMatrix() {
        Map<String, FarmRole> roles = LocalDevelopmentSeeder.localFixtureAccounts().stream()
            .collect(Collectors.toMap(LocalDevelopmentSeeder.LocalAccount::login, account -> FarmRole.valueOf(account.role())));

        Set<FarmAction> ownerActions = EnumSet.of(
            FarmAction.VIEW_FARM_INFORMATION, FarmAction.MANAGE_FARM_INFORMATION, FarmAction.VIEW_CATALOGUES,
            FarmAction.VIEW_CATTLE, FarmAction.MANAGE_CATTLE, FarmAction.MANAGE_CATALOGUES, FarmAction.VIEW_PENS,
            FarmAction.MANAGE_PENS, FarmAction.MANAGE_CATTLE_PHOTOS, FarmAction.VIEW_HEALTH,
            FarmAction.VIEW_REPRODUCTION, FarmAction.VIEW_CARE_CATALOGUES, FarmAction.MANAGE_CARE_CATALOGUES,
            FarmAction.MOVE_CATTLE, FarmAction.VIEW_ENTRY_VOUCHERS, FarmAction.MANAGE_ENTRY_VOUCHERS,
            FarmAction.RECORD_ENTRY_PAYMENT, FarmAction.VIEW_EXIT_VOUCHERS, FarmAction.MANAGE_EXIT_VOUCHERS,
            FarmAction.RECORD_EXIT_COLLECTION, FarmAction.VIEW_PARTNERS, FarmAction.MANAGE_SELLERS,
            FarmAction.MANAGE_BUYERS, FarmAction.VIEW_FEED, FarmAction.MANAGE_FEED, FarmAction.VIEW_ANNOUNCEMENTS,
            FarmAction.MANAGE_ANNOUNCEMENTS, FarmAction.VIEW_REPORTS
        );
        Set<FarmAction> managerActions = EnumSet.of(
            FarmAction.VIEW_CATALOGUES, FarmAction.VIEW_CATTLE, FarmAction.MANAGE_CATTLE, FarmAction.MANAGE_GROWTH,
            FarmAction.MANAGE_CATALOGUES, FarmAction.VIEW_PENS, FarmAction.MANAGE_PENS, FarmAction.MANAGE_CATTLE_PHOTOS,
            FarmAction.VIEW_HEALTH, FarmAction.MANAGE_HEALTH, FarmAction.VIEW_REPRODUCTION, FarmAction.MANAGE_REPRODUCTION,
            FarmAction.VIEW_CARE_CATALOGUES, FarmAction.MANAGE_CARE_CATALOGUES, FarmAction.MOVE_CATTLE,
            FarmAction.VIEW_ENTRY_VOUCHERS, FarmAction.MANAGE_ENTRY_VOUCHERS, FarmAction.RECORD_ENTRY_PAYMENT,
            FarmAction.VIEW_EXIT_VOUCHERS, FarmAction.MANAGE_SELLERS, FarmAction.VIEW_PARTNERS, FarmAction.VIEW_FEED,
            FarmAction.MANAGE_FEED, FarmAction.MANAGE_FEEDING, FarmAction.VIEW_ANNOUNCEMENTS, FarmAction.MANAGE_ANNOUNCEMENTS,
            FarmAction.VIEW_REPORTS
        );
        Set<FarmAction> technicianActions = EnumSet.of(
            FarmAction.VIEW_CATALOGUES, FarmAction.VIEW_CATTLE, FarmAction.VIEW_PENS, FarmAction.VIEW_HEALTH,
            FarmAction.VIEW_REPRODUCTION, FarmAction.VIEW_FEED, FarmAction.VIEW_ANNOUNCEMENTS
        );

        Map<FarmRole, Set<FarmAction>> expected = Map.of(
            FarmRole.OWNER, ownerActions,
            FarmRole.MANAGER, managerActions,
            FarmRole.TECHNICIAN, technicianActions
        );

        assertThat(roles).hasSize(6);
        assertThat(roles.entrySet()).allSatisfy(entry -> {
            Set<FarmAction> actual = EnumSet.noneOf(FarmAction.class);
            for (FarmAction action : FarmAction.values()) {
                if (action.allows(entry.getValue())) actual.add(action);
            }
            assertThat(actual).as(entry.getKey()).isEqualTo(expected.get(entry.getValue()));
        });
    }
}
