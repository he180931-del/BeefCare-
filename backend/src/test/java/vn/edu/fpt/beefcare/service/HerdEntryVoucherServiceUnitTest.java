package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for {@link HerdEntryVoucherService#list}, the main function of
 * UC-FE06-02 View Herd Entry Vouchers: summary tiles, status counts and filtered rows of SCR-23. The row mapping is a
 * mock that echoes the voucher; the tiles and filters are computed by the service.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HerdEntryVoucherServiceUnitTest {

    private static final long FARM_ID = 501L;

    @Mock HerdEntryVoucherRepository vouchers;
    @Mock HerdEntryRepository entries;
    @Mock TradingPartnerRepository partners;
    @Mock FarmAccessService access;
    @Mock CodeSequenceService codes;
    @Mock AuditService audit;
    @Mock TradingPartnerService partnerService;
    @Mock EntryLineValidator lineValidator;
    @Mock EntryVoucherRules rules;
    @Mock EntryVoucherMapper mapper;
    @Mock PenOccupancyService occupancy;

    private HerdEntryVoucherService service;
    private Farm farm;
    private TradingPartner ban;
    private TradingPartner cuong;
    private final List<HerdEntryVoucher> all = new ArrayList<>();
    private final List<HerdEntry> lines = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new HerdEntryVoucherService(vouchers, entries, partners, access, codes, audit, partnerService, lineValidator, rules, mapper, occupancy,
            new FarmClock(Clock.fixed(Instant.parse("2026-11-27T03:00:00Z"), ZoneOffset.UTC)));
        farm = new Farm();
        farm.setId(FARM_ID);
        AppUser manager = new AppUser();
        manager.setId(31L);
        when(access.require(FARM_ID, FarmAction.VIEW_ENTRY_VOUCHERS)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        ban = partner(41L, "Nguyen Van Ban");
        cuong = partner(42L, "Le Van Cuong");
        when(vouchers.findAllByFarmIdOrderByEntryDateDescIdDesc(FARM_ID)).thenReturn(all);
        when(entries.findAllByVoucherIdIn(anyCollection())).thenAnswer(inv -> {
            Collection<Long> ids = inv.getArgument(0);
            return lines.stream().filter(l -> ids.contains(l.getVoucher().getId())).toList();
        });
        when(mapper.row(any(HerdEntryVoucher.class), anyList())).thenAnswer(inv -> {
            HerdEntryVoucher v = inv.getArgument(0);
            List<HerdEntry> ls = inv.getArgument(1);
            return new EntryDtos.Row(v.getId(), v.getCode(), v.getEntryDate(), v.getEntryType(), v.getStatus(), null, null, List.of(), ls.size(), 0, null,
                v.getTotalPayable(), v.getOutstandingAmount(), null, null, v.getVersion());
        });
    }

    private static TradingPartner partner(long id, String name) {
        TradingPartner p = new TradingPartner();
        p.setId(id);
        p.setName(name);
        p.setSeller(true);
        return p;
    }

    private HerdEntryVoucher voucher(long id, EntryType type, EntryVoucherStatus status, LocalDate date, TradingPartner seller, long amount, long paid,
        EntryLineStatus... lineStatuses) {
        HerdEntryVoucher v = new HerdEntryVoucher();
        v.setId(id);
        v.setFarm(farm);
        v.setCode("PN-" + id);
        v.setEntryType(type);
        v.setStatus(status);
        v.setEntryDate(date);
        v.setSeller(seller);
        v.setCattleAmount(amount);
        v.setTransportFee(0L);
        v.setAmountPaid(paid);
        v.setVersion(1);
        all.add(v);
        int no = 1;
        for (EntryLineStatus s : lineStatuses) {
            HerdEntry l = new HerdEntry();
            l.setId(id * 10 + no);
            l.setVoucher(v);
            l.setLineNo(no++);
            l.setStatus(s);
            lines.add(0, l);
        }
        return v;
    }

    private void typicalPeriod() {
        voucher(1L, EntryType.PURCHASE, EntryVoucherStatus.POSTED, LocalDate.of(2026, 11, 20), ban, 24_000_000L, 24_000_000L,
            EntryLineStatus.VALID, EntryLineStatus.VALID, EntryLineStatus.VOID);
        voucher(2L, EntryType.PURCHASE, EntryVoucherStatus.POSTED, LocalDate.of(2026, 11, 15), cuong, 16_000_000L, 6_000_000L,
            EntryLineStatus.VALID, EntryLineStatus.VALID);
        voucher(3L, EntryType.FARM_BORN, EntryVoucherStatus.POSTED, LocalDate.of(2026, 11, 12), null, 0L, 0L, EntryLineStatus.VALID);
        voucher(4L, EntryType.PURCHASE, EntryVoucherStatus.DRAFT, LocalDate.of(2026, 11, 10), ban, 8_000_000L, 0L, EntryLineStatus.DRAFT);
        voucher(5L, EntryType.PURCHASE, EntryVoucherStatus.VOIDED, LocalDate.of(2026, 11, 1), cuong, 9_000_000L, 9_000_000L, EntryLineStatus.VOID);
    }

    private EntryDtos.VoucherList list(EntryVoucherStatus status, EntryType type, LocalDate from, LocalDate to, Long sellerId) {
        return service.list(FARM_ID, status, type, from, to, sellerId);
    }

    @Test
    void tcAnnt060201TheTilesCountPostedCattleAmountsAndWhatIsStillOwed() {
        typicalPeriod();

        EntryDtos.VoucherList result = list(null, null, null, null, null);

        EntryDtos.Tiles tiles = result.tiles();
        assertThat(tiles.postedVouchers()).isEqualTo(3);
        assertThat(tiles.draftVouchers()).isEqualTo(1);
        assertThat(tiles.cattlePurchased()).isEqualTo(4);
        assertThat(tiles.cattleFarmBorn()).isEqualTo(1);
        assertThat(tiles.cattleEntered()).isEqualTo(5);
        assertThat(tiles.purchaseAmount()).isEqualTo(40_000_000L);
        assertThat(tiles.owedToSellers()).isEqualTo(10_000_000L);
        assertThat(tiles.owedVouchers()).singleElement().satisfies(o -> {
            assertThat(o.code()).isEqualTo("PN-2");
            assertThat(o.outstanding()).isEqualTo(10_000_000L);
        });
        assertThat(result.statusCounts()).containsEntry("ALL", 5).containsEntry("POSTED", 3).containsEntry("DRAFT", 1).containsEntry("VOIDED", 1);
        assertThat(result.items()).extracting(EntryDtos.Row::id).containsExactly(1L, 2L, 3L, 4L, 5L);
    }

    @Test
    void tcAnnt060202TheStatusFilterNarrowsTheRowsButNotTheCountsOrTiles() {
        typicalPeriod();

        EntryDtos.VoucherList result = list(EntryVoucherStatus.DRAFT, null, null, null, null);

        assertThat(result.items()).extracting(EntryDtos.Row::id).containsExactly(4L);
        assertThat(result.statusCounts()).containsEntry("ALL", 5);
        assertThat(result.tiles().postedVouchers()).isEqualTo(3);
    }

    @Test
    void tcAnnt060203TypeAndSellerFiltersApplyToRowsCountsAndTiles() {
        typicalPeriod();

        EntryDtos.VoucherList farmBorn = list(null, EntryType.FARM_BORN, null, null, null);
        EntryDtos.VoucherList fromCuong = list(null, null, null, null, 42L);

        assertThat(farmBorn.items()).extracting(EntryDtos.Row::id).containsExactly(3L);
        assertThat(farmBorn.tiles().cattleEntered()).isEqualTo(1);
        assertThat(farmBorn.tiles().purchaseAmount()).isZero();
        assertThat(fromCuong.items()).extracting(EntryDtos.Row::id).containsExactly(2L, 5L);
        assertThat(fromCuong.statusCounts()).containsEntry("ALL", 2);
    }

    @Test
    void tcAnnt060204ThePeriodIncludesBothBoundaryDates() {
        typicalPeriod();

        EntryDtos.VoucherList result = list(null, null, LocalDate.of(2026, 11, 12), LocalDate.of(2026, 11, 15), null);

        assertThat(result.items()).extracting(EntryDtos.Row::id).containsExactly(2L, 3L);
        assertThat(list(null, null, LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 20), null).items()).extracting(EntryDtos.Row::id).containsExactly(1L);
    }

    @Test
    void tcAnnt060205AStartAfterTheEndIsRejected() {
        Throwable thrown = catchThrowable(() -> list(null, null, LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 19), null));

        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(MessageCodes.COM_11);
        verifyNoInteractions(vouchers);
    }

    @Test
    void tcAnnt060206AnEmptyPeriodGivesZeroTilesWithoutReadingLines() {
        EntryDtos.VoucherList result = list(null, null, null, null, null);

        assertThat(result.items()).isEmpty();
        assertThat(result.statusCounts()).containsEntry("ALL", 0).containsEntry("POSTED", 0);
        assertThat(result.tiles().cattleEntered()).isZero();
        assertThat(result.tiles().owedVouchers()).isEmpty();
        verify(entries, never()).findAllByVoucherIdIn(any());
    }

    @Test
    void tc0637ATechnicianCannotViewEntryVouchers() {
        when(access.require(FARM_ID, FarmAction.VIEW_ENTRY_VOUCHERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> list(null, null, null, null, null));

        assertThat(((DomainException) thrown).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(FarmAction.VIEW_ENTRY_VOUCHERS.allows(FarmRole.TECHNICIAN)).isFalse();
        verifyNoInteractions(vouchers, entries);
    }
}
