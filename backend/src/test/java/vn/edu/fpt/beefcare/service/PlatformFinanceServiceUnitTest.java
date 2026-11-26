package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceBankClaimRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceHistoryRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.ReportLine;

class PlatformFinanceServiceUnitTest {
    @Test
    void tc2110RequiresAReasonBeforeLoadingOrVoidingAPostedRecord() {
        PlatformAccessService access = mock(PlatformAccessService.class);
        ManualFinanceRecordRepository records = mock(ManualFinanceRecordRepository.class);
        when(access.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(new vn.edu.fpt.beefcare.domain.AppUser(), null, PlatformRole.PM));
        PlatformFinanceService service = new PlatformFinanceService(
            access,
            records,
            mock(ManualFinanceHistoryRepository.class),
            mock(ManualFinanceBankClaimRepository.class),
            mock(CashReportSnapshotRepository.class),
            mock(BankTransferEvidenceRepository.class),
            mock(PaymentRepository.class),
            mock(FarmRepository.class),
            mock(AuditService.class),
            mock(JdbcTemplate.class),
            mock(FarmClock.class),
            new ObjectMapper(),
            List.of(),
            List.of()
        );

        assertThatThrownBy(() -> service.voidPosted(2110L, new PlatformFinanceService.VersionedAction(3L, " ")))
            .isInstanceOf(DomainException.class)
            .extracting(failure -> ((DomainException) failure).getCode())
            .isEqualTo(MessageCodes.COM_06);
        verify(records, never()).findById(2110L);
        verify(records, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void tc2115ExcludesReceiptAt2330VietnamTimeOnOctoberThirtyFirstFromNovemberReport() throws Exception {
        BankTransferEvidenceRepository evidence = mock(BankTransferEvidenceRepository.class);
        BankTransferEvidence row = new BankTransferEvidence();
        row.setBankPaidAt(Instant.parse("2026-10-31T16:30:00Z")); // 23:30 on 31/10 in Asia/Ho_Chi_Minh.
        row.setReviewStatus("ACCEPTED");
        row.setProvider("SEPAY");
        row.setEnvironment("MOCK");
        row.setAccountNamespace("TEST");
        row.setProviderTxnId(2115L);
        row.setAmount(new BigDecimal("1200000"));
        row.setVersion(1L);

        Farm farm = new Farm();
        farm.setId(7L);
        farm.setName("Farm 7");
        Subscription subscription = new Subscription();
        subscription.setFarm(farm);
        Payment payment = new Payment();
        payment.setState("PAID");
        payment.setReceiptCode("RCPT-2115");
        payment.setDurationYears(1);
        payment.setAmountVnd(new BigDecimal("1200000"));
        payment.setSubscription(subscription);
        row.setPayment(payment);
        when(evidence.findAllByReviewStatusIgnoreCaseOrderByBankPaidAtAscIdAsc("ACCEPTED")).thenReturn(List.of(row));

        PlatformFinanceService service = new PlatformFinanceService(
            null,
            mock(ManualFinanceRecordRepository.class),
            mock(ManualFinanceHistoryRepository.class),
            mock(ManualFinanceBankClaimRepository.class),
            mock(CashReportSnapshotRepository.class),
            evidence,
            mock(PaymentRepository.class),
            mock(FarmRepository.class),
            null,
            mock(JdbcTemplate.class),
            null,
            new ObjectMapper(),
            List.of(),
            List.of()
        );

        Method addReceipts = PlatformFinanceService.class.getDeclaredMethod("addReceipts", List.class, LocalDate.class, LocalDate.class, Farm.class);
        addReceipts.setAccessible(true);
        List<ReportLine> novemberLines = new ArrayList<>();
        addReceipts.invoke(service, novemberLines, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), null);
        assertThat(novemberLines).isEmpty();

        List<ReportLine> octoberLines = new ArrayList<>();
        addReceipts.invoke(service, octoberLines, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), null);
        assertThat(octoberLines).singleElement().satisfies(line -> assertThat(line.cashDate()).isEqualTo(LocalDate.of(2026, 10, 31)));
    }
}
