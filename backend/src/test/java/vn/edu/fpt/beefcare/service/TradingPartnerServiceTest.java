package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.TradingPartnerRequest;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** Trading partners (GBR-97): roles, unique names, status instead of deletion. */
@ServiceIntegrationTest
@Transactional
class TradingPartnerServiceTest extends HerdEntryTestBase {

    @Autowired
    TradingPartnerService partners;

    private static DomainException thrown(Runnable r) {
        try {
            r.run();
        } catch (DomainException e) {
            return e;
        }
        throw new AssertionError("expected a DomainException");
    }

    private TradingPartnerRequest req(String name, boolean seller, boolean buyer, boolean supplier) {
        return new TradingPartnerRequest(name, seller, buyer, supplier, "0909", "Dong Nai", null, null);
    }

    @Test
    void namesAreUniqueIgnoringCase_andRolesAreRequired() {
        partners.create(farm.getId(), req("Ong Nam", true, false, false));
        DomainException dup = thrown(() -> partners.create(farm.getId(), req("  ONG nam ", true, false, false)));
        assertThat(dup.getCode()).isEqualTo(HerdEntryCodes.PARTNER_DUPLICATE);
        assertThat(dup.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(thrown(() -> partners.create(farm.getId(), req("No role", false, false, false))).getCode()).isEqualTo(MessageCodes.COM_06);
        // the same name in another farm is fine
        var other = farm();
        actAs(memberWithRole(other, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER));
        partners.create(other.getId(), req("Ong Nam", true, false, false));
    }

    @Test
    void buyersAreOwnerOnly_sellersAndSuppliersOwnerAndManager() {
        actAs(manager);
        assertThat(partners.create(farm.getId(), req("Seller M", true, false, false)).seller()).isTrue();
        assertThat(partners.create(farm.getId(), req("Supplier M", false, false, true)).supplier()).isTrue();
        assertThat(thrown(() -> partners.create(farm.getId(), req("Buyer M", false, true, false))).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> partners.create(farm.getId(), req("Both M", true, true, false))).getCode()).isEqualTo(MessageCodes.COM_01);
        actAs(owner);
        EntryDtos.Partner buyer = partners.create(farm.getId(), req("Buyer O", false, true, false));
        actAs(manager);
        assertThat(thrown(() -> partners.update(farm.getId(), buyer.id(), req("Buyer O2", false, true, false))).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> partners.changeStatus(farm.getId(), buyer.id(), new TradingPartnerRequest.StatusRequest(ActiveStatus.INACTIVE, null))).getCode()).isEqualTo(MessageCodes.COM_01);
        // a manager cannot turn a seller into a buyer either
        EntryDtos.Partner seller = partners.create(farm.getId(), req("Seller M2", true, false, false));
        assertThat(thrown(() -> partners.update(farm.getId(), seller.id(), req("Seller M2", true, true, false))).getCode()).isEqualTo(MessageCodes.COM_01);
        actAs(technician);
        assertThat(thrown(() -> partners.create(farm.getId(), req("T", true, false, false))).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> partners.list(farm.getId(), null, null, null)).getCode()).isEqualTo(MessageCodes.COM_01);
    }

    @Test
    void partnersAreDeactivatedNeverDeleted_andFiltered() {
        EntryDtos.Partner p = partners.create(farm.getId(), req("Cho Bo", true, false, false));
        EntryDtos.Partner updated = partners.update(farm.getId(), p.id(), new TradingPartnerRequest("Cho Bo 2", true, false, true, "0911", null, "note", p.version()));
        assertThat(updated.name()).isEqualTo("Cho Bo 2");
        assertThat(updated.supplier()).isTrue();
        assertThat(thrown(() -> partners.update(farm.getId(), p.id(), new TradingPartnerRequest("Cho Bo 3", true, false, false, null, null, null, p.version()))).getCode()).isEqualTo(MessageCodes.COM_05);

        EntryDtos.Partner inactive = partners.changeStatus(farm.getId(), p.id(), new TradingPartnerRequest.StatusRequest(ActiveStatus.INACTIVE, null));
        assertThat(inactive.status()).isEqualTo("INACTIVE");
        List<EntryDtos.Partner> activeSellers = partners.list(farm.getId(), "SELLER", ActiveStatus.ACTIVE, null);
        assertThat(activeSellers).extracting(EntryDtos.Partner::id).doesNotContain(p.id()).contains(seller.getId());
        assertThat(partners.list(farm.getId(), "SELLER", ActiveStatus.INACTIVE, "cho")).hasSize(1);
        assertThat(thrown(() -> partners.list(farm.getId(), "WIZARD", null, null)).getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(thrown(() -> partners.get(farm.getId(), 987_654L)).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);

        // an inactive partner cannot be chosen as the seller of a new voucher
        var draft = vouchers.create(farm.getId(), new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(
            vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY, p.id(), null, null, null, null, null, 0L, 0L, null, null, List.of(line("PT-1", penA, "100", 1)), null));
        assertThat(thrown(() -> posting.post(farm.getId(), draft.id(), null)).getCode()).isEqualTo(MessageCodes.COM_08);
    }

    @Test
    void otherFarmPartnerIsNotFoundAndCannotBeUsedAsSeller() {
        var other = farm();
        var otherOwner = memberWithRole(other, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        actAs(otherOwner);
        EntryDtos.Partner foreign = partners.create(other.getId(), req("Foreign", true, false, false));
        actAs(owner);
        assertThat(thrown(() -> partners.get(farm.getId(), foreign.id())).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        var request = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(
            vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY, foreign.id(), null, null, null, null, null, 0L, 0L, null, null, List.of(), null);
        assertThat(thrown(() -> vouchers.create(farm.getId(), request)).getCode()).isEqualTo(MessageCodes.COM_08);
    }
}
