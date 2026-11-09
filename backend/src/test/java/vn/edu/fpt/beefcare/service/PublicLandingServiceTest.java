package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PublicLandingServiceTest {

    @Test
    void publishedLandingContainsSpecContentAndOfficialContactDefaults() {
        PlanPriceService prices = mock(PlanPriceService.class);
        when(prices.current()).thenReturn(new PlanPriceService.PriceVersion(
            7L, BigDecimal.valueOf(1_200_000), BigDecimal.valueOf(2_160_000), BigDecimal.valueOf(3_060_000),
            Instant.parse("2026-11-09T00:00:00Z"), "Giá trọn kỳ"
        ));

        PublicLandingService service = new PublicLandingService(prices, "", "");
        PublicLandingService.LandingContent landing = service.get();

        assertThat(landing.features()).hasSize(6);
        assertThat(landing.faq()).hasSize(5);
        assertThat(landing.contactEmail()).isEqualTo("tuanpqhe181869@fpt.edu.vn");
        assertThat(landing.contactPhone()).isEqualTo("0386 671 863");
        assertThat(landing.prices().price1y()).isEqualByComparingTo("1200000");
        assertThat(landing.prices().price3y()).isEqualByComparingTo("3060000");
    }
}
