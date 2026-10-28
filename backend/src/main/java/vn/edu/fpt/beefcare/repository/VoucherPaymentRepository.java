package vn.edu.fpt.beefcare.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;

@Repository
public interface VoucherPaymentRepository extends JpaRepository<VoucherPayment, Long> {

    List<VoucherPayment> findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(Long voucherId);

    List<VoucherPayment> findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(Long voucherId);

    List<VoucherPayment> findAllByFeedReceiptIdOrderByPaymentDateAscIdAsc(Long receiptId);

    Optional<VoucherPayment> findByIdAndFarmId(Long id, Long farmId);

    @Query("select coalesce(sum(p.amount), 0) from VoucherPayment p where p.entryVoucher.id = :voucherId and p.status = :status")
    long sumByEntryVoucher(@Param("voucherId") Long voucherId, @Param("status") PaymentRecordStatus status);

    @Query("select coalesce(sum(p.amount), 0) from VoucherPayment p where p.exitVoucher.id = :voucherId and p.status = :status")
    long sumByExitVoucher(@Param("voucherId") Long voucherId, @Param("status") PaymentRecordStatus status);

    @Query("select coalesce(sum(p.amount), 0) from VoucherPayment p where p.feedReceipt.id = :receiptId and p.status = :status")
    long sumByFeedReceipt(@Param("receiptId") Long receiptId, @Param("status") PaymentRecordStatus status);
}
