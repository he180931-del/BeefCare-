package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FeedItem;
import vn.edu.fpt.beefcare.domain.FeedStockAdjustment;
import vn.edu.fpt.beefcare.domain.FeedStockAdjustmentLine;
import vn.edu.fpt.beefcare.domain.FeedStockMovement;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.FeedItemRepository;
import vn.edu.fpt.beefcare.repository.FeedStockAdjustmentLineRepository;
import vn.edu.fpt.beefcare.repository.FeedStockAdjustmentRepository;
import vn.edu.fpt.beefcare.repository.FeedStockMovementRepository;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.StockAdjustmentLine;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.StockAdjustmentRequest;

class FeedStockAdjustmentServiceUnitTest {

    @Test
    void tc2312RejectsA190KgCountAgainst200KgWithoutAReason() {
        Long farmId = 23L;
        Long feedId = 2301L;
        Farm farm = new Farm();
        farm.setId(farmId);
        AppUser user = new AppUser();
        FarmContext context = new FarmContext(farm, user, FarmRole.MANAGER);

        FarmAccessService access = mock(FarmAccessService.class);
        FarmClock clock = new FarmClock(Clock.fixed(Instant.parse("2026-11-05T05:00:00Z"), ZoneOffset.UTC));
        FeedItemRepository feeds = mock(FeedItemRepository.class);
        FeedStockMovementRepository movements = mock(FeedStockMovementRepository.class);
        FeedStockAdjustmentRepository adjustments = mock(FeedStockAdjustmentRepository.class);
        FeedStockAdjustmentLineRepository lines = mock(FeedStockAdjustmentLineRepository.class);
        CodeSequenceService codes = mock(CodeSequenceService.class);
        OutboxService outbox = mock(OutboxService.class);

        FeedItem feed = new FeedItem();
        feed.setId(feedId);
        feed.setFarm(farm);
        feed.setCode("TA-2301");
        feed.setName("Cỏ khô");
        feed.setAvailable(true);
        feed.setOnHandKg(new BigDecimal("200.000"));
        feed.setAvgUnitCost(new BigDecimal("100.00"));

        when(access.require(farmId, FarmAction.MANAGE_FEED)).thenReturn(context);
        when(codes.nextStockAdjustmentCode(farmId)).thenReturn("ĐCK-2026-0023");
        when(feeds.findByIdAndFarm_Id(feedId, farmId)).thenReturn(Optional.of(feed));
        when(feeds.lockByIdAndFarm(feedId, farmId)).thenReturn(Optional.of(feed));
        when(movements.findByFarm_IdAndFeedItem_IdAndOccurredAtGreaterThanEqual(any(), any(), any())).thenReturn(List.of());
        AtomicReference<FeedStockAdjustmentLine> savedLine = new AtomicReference<>();
        when(lines.save(any(FeedStockAdjustmentLine.class))).thenAnswer(invocation -> {
            FeedStockAdjustmentLine line = invocation.getArgument(0);
            savedLine.set(line);
            return line;
        });
        when(lines.findByAdjustment_IdOrderByIdAsc(44L)).thenAnswer(invocation -> List.of(savedLine.get()));
        when(adjustments.saveAndFlush(any(FeedStockAdjustment.class))).thenAnswer(invocation -> {
            FeedStockAdjustment adjustment = invocation.getArgument(0);
            ReflectionTestUtils.setField(adjustment, "id", 44L);
            return adjustment;
        });

        FeedStockAdjustmentService service = new FeedStockAdjustmentService(access, clock, feeds, movements, adjustments, lines, codes, outbox);
        StockAdjustmentRequest request = new StockAdjustmentRequest(
            LocalDate.of(2026, 11, 5),
            "PERIODIC_COUNT",
            "Tổ kho",
            List.of(new StockAdjustmentLine(feedId, new BigDecimal("190.000"), null)),
            true
        );

        assertThatThrownBy(() -> service.create(farmId, request))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE23_08));

        verify(feeds, never()).saveAndFlush(any(FeedItem.class));
        verify(movements, never()).save(any(FeedStockMovement.class));
        verify(outbox, never()).enqueue(any(), any(), any(), any(), any());
    }
}
