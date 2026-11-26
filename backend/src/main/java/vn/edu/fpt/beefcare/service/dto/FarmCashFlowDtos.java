package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class FarmCashFlowDtos {
    private FarmCashFlowDtos() {}

    public record FarmCashFlowView(
        Instant generatedAt,
        BigDecimal totalIncome,
        BigDecimal totalExpense,
        BigDecimal netCashFlow,
        long totalElements,
        List<CashFlowItem> items
    ) {
        public FarmCashFlowView {
            items = List.copyOf(items);
        }
    }

    public record CashFlowItem(
        String id,
        String source,
        String direction,
        LocalDate cashDate,
        BigDecimal amountVnd,
        Long documentId,
        String documentCode,
        String method
    ) {}
}
