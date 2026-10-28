package vn.edu.fpt.beefcare.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.CodeSequence;
import vn.edu.fpt.beefcare.domain.enumeration.CodeType;
import vn.edu.fpt.beefcare.repository.CodeSequenceRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;

/**
 * BR-D34 / BR-D07: business codes are generated from a per-farm (and per-year) counter and are never reused.
 * The farm row is locked first, so concurrent callers of one farm are serialised and cannot draw the same number.
 */
@Service
public class CodeSequenceService {

    private final CodeSequenceRepository repository;
    private final FarmRepository farmRepository;
    private final FarmClock clock;

    public CodeSequenceService(CodeSequenceRepository repository, FarmRepository farmRepository, FarmClock clock) {
        this.repository = repository;
        this.farmRepository = farmRepository;
        this.clock = clock;
    }

    /** Next raw counter value; {@code year} is 0 for codes that do not reset yearly. */
    @Transactional(propagation = Propagation.MANDATORY)
    public long next(Long farmId, CodeType type, int year) {
        farmRepository.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        CodeSequence seq = repository
            .findByFarmIdAndCodeTypeAndPeriodYear(farmId, type, year)
            .orElseGet(() -> {
                CodeSequence created = new CodeSequence();
                created.setFarmId(farmId);
                created.setCodeType(type);
                created.setPeriodYear(year);
                created.setLastValue(0L);
                return created;
            });
        seq.setLastValue(seq.getLastValue() + 1);
        return repository.save(seq).getLastValue();
    }

    /** PN-YYYY-nnnn (herd entry voucher). */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextHerdEntryCode(Long farmId) {
        int year = clock.today().getYear();
        return String.format("PN-%d-%04d", year, next(farmId, CodeType.HERD_ENTRY, year));
    }

    /** PX-YYYY-nnnn (herd exit voucher). */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextHerdExitCode(Long farmId) {
        int year = clock.today().getYear();
        return String.format("PX-%d-%04d", year, next(farmId, CodeType.HERD_EXIT, year));
    }

    /** BC-nnnnnn (cattle display code, one farm sequence). */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextCattleCode(Long farmId) {
        return String.format("BC-%06d", next(farmId, CodeType.CATTLE, 0));
    }

    /** QR tag code; globally unique, so the farm id is part of it. */
    @Transactional(propagation = Propagation.MANDATORY)
    public String nextQrTagCode(Long farmId) {
        return String.format("QR-%d-%06d", farmId, next(farmId, CodeType.QR_TAG, 0));
    }
}
