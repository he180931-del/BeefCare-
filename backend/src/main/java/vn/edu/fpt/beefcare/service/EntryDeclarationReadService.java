package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationCategory;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.PreEntryHistoryDeclarationRepository;
import vn.edu.fpt.beefcare.service.dto.CattleDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/**
 * D82: đọc lại khai báo lịch sử trước nhập đàn (GBR-30) để hồ sơ bò và tab Sinh sản đi tiếp từ dữ liệu đã khai lúc nhập.
 * Khai báo chỉ là thông tin tham khảo: không mở giai đoạn mang thai, không tạo ca sức khỏe (FE-06 §3.3).
 */
@Service
@Transactional(readOnly = true)
public class EntryDeclarationReadService {

    /** Thứ tự hiển thị cố định: Tiêm phòng, Bệnh, Sinh sản. */
    private static final Comparator<PreEntryHistoryDeclaration> BY_CATEGORY = Comparator.comparing(PreEntryHistoryDeclaration::getCategory);

    @PersistenceContext
    private EntityManager em;

    private final PreEntryHistoryDeclarationRepository declarations;
    private final FarmClock clock;

    public EntryDeclarationReadService(PreEntryHistoryDeclarationRepository declarations, FarmClock clock) {
        this.declarations = declarations;
        this.clock = clock;
    }

    /**
     * SCR-19 #11 "Khai báo khi nhập" của một dòng nhập. Trả {@code null} khi dòng không có khai báo (bò sinh tại trại),
     * để giao diện ẩn hẳn mục thay vì hiện danh sách rỗng.
     */
    public List<CattleDtos.Declaration> forEntry(HerdEntry entry) {
        List<PreEntryHistoryDeclaration> rows = declarations.findAllByHerdEntryId(entry.getId());
        if (rows.isEmpty()) {
            return null;
        }
        Long farmId = rows.get(0).getFarm().getId();
        return rows.stream().sorted(BY_CATEGORY).map(d -> toDto(farmId, d)).toList();
    }

    /** Khai báo mang thai chưa khám của một bò (SCR-39 #3); rỗng khi không có hoặc đã có khám thai / đẻ sau ngày nhập. */
    public Optional<ReproductionDtos.DeclaredPregnancy> pendingPregnancy(Long farmId, Long cattleId) {
        return Optional.ofNullable(pending(farmId, cattleId).get(cattleId));
    }

    /** Như {@link #pendingPregnancy}, cho cả trại trong một truy vấn – dùng ở danh sách sinh sản SCR-38. */
    public Map<Long, ReproductionDtos.DeclaredPregnancy> pendingPregnancies(Long farmId) {
        return pending(farmId, null);
    }

    /**
     * Bò cái đang nuôi được khai "mang thai: Có" lúc nhập. Khai báo hết tác dụng khi bò đã có lần khám thai hoặc lần đẻ
     * hợp lệ từ ngày nhập trở đi – từ đó trạng thái sinh sản đi theo sự kiện thật.
     */
    private Map<Long, ReproductionDtos.DeclaredPregnancy> pending(Long farmId, Long cattleId) {
        var query = em.createQuery("""
                select h.cattle.id, h.entryDate, d.estMonthsPregnant from PreEntryHistoryDeclaration d join d.herdEntry h
                where d.farm.id=:farm and d.category=:category and d.status=:status and d.pregnantAtEntry=:yes
                and h.cattle.herdStatus=:active and h.cattle.sex=:female
                """ + (cattleId == null ? "" : " and h.cattle.id=:cattle"), Object[].class)
            .setParameter("farm", farmId).setParameter("category", DeclarationCategory.REPRODUCTION).setParameter("status", DeclarationStatus.KNOWN)
            .setParameter("yes", YesNoUnknown.YES).setParameter("active", HerdStatus.ACTIVE).setParameter("female", Sex.FEMALE);
        if (cattleId != null) {
            query.setParameter("cattle", cattleId);
        }
        List<Object[]> rows = query.getResultList();
        Map<Long, ReproductionDtos.DeclaredPregnancy> out = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Long id = (Long) row[0];
            LocalDate entryDate = (LocalDate) row[1];
            if (!resolvedSince(id, entryDate.atStartOfDay(clock.zone()).toInstant())) {
                out.put(id, new ReproductionDtos.DeclaredPregnancy((Integer) row[2], entryDate));
            }
        }
        return out;
    }

    private boolean resolvedSince(Long cattleId, Instant since) {
        Long checks = em.createQuery("""
                select count(e) from ReproductionEvent e where e.cattle.id=:c and upper(e.type)='PREGNANCY_CHECK'
                and upper(e.status)='VALID' and e.eventTime>=:since
                """, Long.class).setParameter("c", cattleId).setParameter("since", since).getSingleResult();
        if (checks > 0) {
            return true;
        }
        return em.createQuery("select count(c) from CalvingEvent c where c.dam.id=:c and upper(c.status)='VALID' and c.birthTime>=:since", Long.class)
            .setParameter("c", cattleId).setParameter("since", since).getSingleResult() > 0;
    }

    private CattleDtos.Declaration toDto(Long farmId, PreEntryHistoryDeclaration d) {
        boolean known = d.getStatus() == DeclarationStatus.KNOWN;
        List<CattleDtos.DeclaredVaccine> vaccines = null;
        String description = null;
        if (known && d.getCategory() == DeclarationCategory.VACCINATION) {
            EntryLineRequest.VaccinationItem[] items = JsonSupport.fromJson(d.getItems(), EntryLineRequest.VaccinationItem[].class);
            vaccines = items == null ? List.of() : Arrays.stream(items).map(i -> new CattleDtos.DeclaredVaccine(vaccineName(farmId, i), i.date())).toList();
        } else if (known) {
            Map<?, ?> items = JsonSupport.fromJson(d.getItems(), Map.class);
            Object text = items == null ? null : items.get("description");
            description = text == null || text.toString().isBlank() ? null : text.toString();
        }
        return new CattleDtos.Declaration(
            d.getCategory().name(),
            d.getStatus().name(),
            vaccines,
            description,
            d.getInformationSource(),
            d.getCategory() == DeclarationCategory.REPRODUCTION ? d.getEarlierCalvings() : null,
            d.getPregnantAtEntry() == null ? null : d.getPregnantAtEntry().name(),
            d.getEstMonthsPregnant()
        );
    }

    /** Tên đã gõ khi khai báo; mũi chọn từ danh mục không lưu tên thì lấy tên vắc-xin của chính trại. */
    private String vaccineName(Long farmId, EntryLineRequest.VaccinationItem item) {
        if (item.vaccineName() != null && !item.vaccineName().isBlank()) {
            return item.vaccineName().trim();
        }
        Vaccine vaccine = item.vaccineId() == null ? null : em.find(Vaccine.class, item.vaccineId());
        return vaccine != null && vaccine.getFarm() != null && farmId.equals(vaccine.getFarm().getId()) ? vaccine.getName() : null;
    }
}
