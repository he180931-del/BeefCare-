package vn.edu.fpt.beefcare.service;

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;

/**
 * Guards every write that touches a cattle (GBR-26, GBR-24, BR-D35):
 * EXITED (MSG-COM-13) and VOIDED (MSG-COM-18) cattle are read-only; a cattle on a PENDING exit voucher accepts no new
 * event, pen move, profile change or exit line (MSG-COM-17). "Exit pending" is derived, never stored, and only a
 * PENDING voucher causes it: a DRAFT exit line merely forbids adding the cattle to another voucher.
 */
@Service
public class CattleGuardService {

    private static final Set<ExitLineStatus> OPEN_EXIT_LINE = EnumSet.of(ExitLineStatus.DRAFT, ExitLineStatus.PENDING, ExitLineStatus.CONFIRMED);

    private final HerdExitRepository exitRepository;
    private final CattleRepository cattleRepository;
    private final FarmClock clock;

    public CattleGuardService(HerdExitRepository exitRepository, CattleRepository cattleRepository, FarmClock clock) {
        this.exitRepository = exitRepository;
        this.cattleRepository = cattleRepository;
        this.clock = clock;
    }

    /** Loads the cattle of the farm with a row lock; unknown id gives MSG-COM-08 (404). */
    @Transactional(propagation = Propagation.MANDATORY)
    public Cattle lockCattle(Long farmId, Long cattleId) {
        return cattleRepository.lockByIdAndFarmId(farmId, cattleId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "cattle_id", cattleId));
    }

    /** Locks and checks a cattle that is about to be written. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Cattle lockWritable(Long farmId, Long cattleId) {
        Cattle cattle = lockCattle(farmId, cattleId);
        assertWritable(cattle);
        return cattle;
    }

    /** Throws MSG-COM-13 / MSG-COM-18 / MSG-COM-17 unless the cattle is ACTIVE and not exit-pending. */
    @Transactional(readOnly = true)
    public void assertWritable(Cattle cattle) {
        assertActive(cattle);
        pendingExitLine(cattle.getId()).ifPresent(line -> {
            HerdExitVoucher v = line.getVoucher();
            throw DomainException.unprocessable(
                MessageCodes.COM_17,
                "cattle_code",
                cattle.getDisplayCode(),
                "loss_kind",
                v.getLossKind() == null ? v.getExitType() : v.getLossKind(),
                "date",
                v.getExitDate()
            );
        });
    }

    /** ACTIVE check only (used by operations that stay allowed on an exit-pending cattle, e.g. correcting records). */
    public void assertActive(Cattle cattle) {
        if (cattle.getHerdStatus() == HerdStatus.EXITED) {
            throw DomainException.unprocessable(
                MessageCodes.COM_13,
                "cattle_code",
                cattle.getDisplayCode(),
                "date",
                cattle.getExitDate(),
                "exit_type",
                cattle.getExitType()
            );
        }
        if (cattle.getHerdStatus() == HerdStatus.VOIDED) {
            throw DomainException.unprocessable(
                MessageCodes.COM_18,
                "cattle_code",
                cattle.getDisplayCode(),
                "date",
                cattle.getUpdatedAt() == null ? null : clock.toFarmDate(cattle.getUpdatedAt()),
                "reason",
                cattle.getVoidReason()
            );
        }
    }

    @Transactional(readOnly = true)
    public boolean isExitPending(Long cattleId) {
        return pendingExitLine(cattleId).isPresent();
    }

    /** The cattle's line on a PENDING exit voucher (death / missing proposed from a health case), if any. */
    @Transactional(readOnly = true)
    public Optional<HerdExit> pendingExitLine(Long cattleId) {
        return exitRepository.findFirstByCattleIdAndStatus(cattleId, ExitLineStatus.PENDING);
    }

    /** The cattle's DRAFT / PENDING / CONFIRMED exit line (BR-D35), if any. */
    @Transactional(readOnly = true)
    public Optional<HerdExit> openExitLine(Long cattleId) {
        return exitRepository.findFirstByCattleIdAndStatusIn(cattleId, OPEN_EXIT_LINE);
    }

    /**
     * Whether the cattle may be put on an exit voucher: ACTIVE, not exit-pending (MSG-COM-17) and on no other open
     * exit line (MSG-FE13-08). {@code voucherId} is the voucher being edited, whose own line does not count.
     */
    @Transactional(readOnly = true)
    public void assertCanJoinExitVoucher(Cattle cattle, Long voucherId) {
        assertWritable(cattle);
        openExitLine(cattle.getId())
            .filter(line -> voucherId == null || !line.getVoucher().getId().equals(voucherId))
            .ifPresent(line -> {
                throw DomainException.unprocessable(
                    MessageCodes.FE13_08,
                    "cattle_code",
                    cattle.getDisplayCode(),
                    "voucher_code",
                    line.getVoucher().getCode()
                );
            });
    }
}
