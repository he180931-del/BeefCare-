package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

/** SCR-29 herd growth view. A pen comparison always uses all computable cattle of that pen. */
@Service
public class GrowthOverviewService {
    public record Row(Long cattleId,String code,String earTag,String breed,Sex sex,LifeStage lifeStage,String herdGroup,
        Long penId,String penCode,String penName,BigDecimal weightKg,String basis,LocalDate weighedOn,BigDecimal adg,
        BigDecimal penAverageAdg,BigDecimal bcs,LocalDate nextWeighing,List<String> flags) {}
    /**
     * {@code activeCount} (GAP-FE08-03): ACTIVE cattle of the whole farm, independent of the filters; {@code total} is after filtering.
     * Schema name GrowthHerdPage: the plain name Page is shared by several list DTOs in the OpenAPI contract.
     */
    @io.swagger.v3.oas.annotations.media.Schema(name = "GrowthHerdPage")
    public record Page(List<Row> items,long total,int page,int size,Map<String,Long> summary,int windowDays,long activeCount) {}

    /** Các cờ tình trạng của một con bò; cũng là giá trị hợp lệ của tham số lọc {@code flag} (D74). */
    static final List<String> FLAGS = List.of("WEIGHING_OVERDUE", "LOW_ADG", "LOW_BCS");

    private final EntityManager em;private final FarmAccessService access;private final GrowthAssessmentService growth;
    private final CattleProfileService profiles;private final FarmClock clock;
    public GrowthOverviewService(EntityManager em,FarmAccessService access,GrowthAssessmentService growth,CattleProfileService profiles,FarmClock clock) {
        this.em=em;this.access=access;this.growth=growth;this.profiles=profiles;this.clock=clock;
    }
    /**
     * Danh sách tăng trưởng cấp đàn (SCR-23).
     *
     * <p>Số đếm trong {@code summary} tính theo các bộ lọc tìm kiếm / chuồng / nhóm đàn / giai đoạn nhưng <b>không</b>
     * theo {@code flag}, để số trên từng tab giữ nguyên khi đổi tab (D74). {@code total} là số dòng sau mọi bộ lọc.
     *
     * @param farmId    trại đang xem
     * @param q         từ khóa mã hiển thị hoặc số tai; {@code null} là không lọc
     * @param penId     chuồng hiện tại; {@code null} là tất cả
     * @param herdGroup nhóm đàn; {@code null} là tất cả
     * @param lifeStage giai đoạn; {@code null} là tất cả
     * @param flag      chỉ lấy bò có cờ này ({@link #FLAGS}); {@code null} là tất cả, giá trị khác → MSG-COM-10
     * @param window    kỳ tính ADG: 30, 90 hoặc 180 ngày
     * @param page      trang, bắt đầu từ 0
     * @param size      số dòng mỗi trang, 1–200
     * @param sort      {@code code}, {@code weighedOn} hoặc {@code adg}; thêm {@code -} để giảm dần
     * @return trang kết quả kèm số đếm theo cờ
     */
    @Transactional(readOnly=true)
    public Page list(Long farmId,String q,Long penId,String herdGroup,LifeStage lifeStage,String flag,int window,int page,int size,String sort) {
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_CATTLE);
        if(!Set.of(30,90,180).contains(window))throw DomainException.invalid("windowDays");
        if (flag != null && !FLAGS.contains(flag)) {
            throw DomainException.invalid("flag");
        }
        if(page<0||page>100000||size<1||size>200)throw DomainException.invalid("pagination");
        ZoneId zone=clock.zone();LocalDate today=LocalDate.ofInstant(clock.now(),zone);
        List<Cattle> all=em.createQuery("select c from Cattle c where c.farm.id=:f and c.herdStatus=:s order by c.displayCode",Cattle.class)
            .setParameter("f",farmId).setParameter("s",HerdStatus.ACTIVE).getResultList();
        Map<Long,PenAssignment> penByCattle=new HashMap<>();
        em.createQuery("select p from PenAssignment p join fetch p.pen where p.farm.id=:f and p.toDate is null",PenAssignment.class)
            .setParameter("f",farmId).getResultList().forEach(p->penByCattle.put(p.getCattle().getId(),p));
        Map<Long,GrowthDtos.Summary> summaries=new HashMap<>();Map<Long,List<BigDecimal>> penAdgs=new HashMap<>();
        for(Cattle c:all) {
            GrowthDtos.Summary summary=growth.summary(c,window);summaries.put(c.getId(),summary);
            PenAssignment p=penByCattle.get(c.getId());
            if(p!=null&&summary.adg()!=null)penAdgs.computeIfAbsent(p.getPen().getId(),k->new ArrayList<>()).add(summary.adg());
        }
        Map<Long,BigDecimal> averages=new HashMap<>();penAdgs.forEach((id,values)->averages.put(id,values.stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(values.size()),3,RoundingMode.HALF_UP)));
        List<Row> rows=new ArrayList<>();long weighings=0;
        String search=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        for(Cattle c:all) {
            PenAssignment p=penByCattle.get(c.getId());String group=profiles.herdGroup(c);
            if(penId!=null&&(p==null||!penId.equals(p.getPen().getId()))||lifeStage!=null&&lifeStage!=c.getLifeStage()||herdGroup!=null&&!herdGroup.equals(group))continue;
            if(!search.isEmpty()&&!(c.getDisplayCode()+" "+Objects.toString(c.getEarTagNumber(),"")).toLowerCase(Locale.ROOT).contains(search))continue;
            GrowthDtos.Summary s=summaries.get(c.getId());BigDecimal average=p==null?null:averages.get(p.getPen().getId());
            List<String> flags=new ArrayList<>();if(s.nextWeighing()==null||s.nextWeighing().isBefore(today))flags.add("WEIGHING_OVERDUE");
            if(s.adg()!=null&&average!=null&&s.adg().compareTo(average)<0)flags.add("LOW_ADG");
            if(s.latestBcs()!=null&&s.latestBcs().compareTo(new BigDecimal("2.5"))<0)flags.add("LOW_BCS");
            weighings+=s.records().stream().filter(r->r.weightKg()!=null&&Set.of("VALID","CORRECTED").contains(r.status())&&!r.measuredAt().atZone(zone).toLocalDate().isBefore(today.minusDays(30))).count();
            rows.add(new Row(c.getId(),c.getDisplayCode(),c.getEarTagNumber(),c.getBreed().getName(),c.getSex(),c.getLifeStage(),group,
                p==null?null:p.getPen().getId(),p==null?null:p.getPen().getCode(),p==null?null:p.getPen().getName(),
                s.currentWeight()==null?null:s.currentWeight().weightKg(),s.currentWeight()==null?null:s.currentWeight().basis(),
                s.currentWeight()==null?null:s.currentWeight().measuredAt().atZone(zone).toLocalDate(),s.adg(),average,s.latestBcs(),s.nextWeighing(),List.copyOf(flags)));
        }
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String counted : FLAGS) {
            counts.put(counted, rows.stream().filter(r -> r.flags().contains(counted)).count());
        }
        counts.put("WEIGHINGS_30_DAYS", weighings);
        // D74: lọc theo cờ sau khi đã đếm, để số trên các tab không đổi theo tab đang chọn.
        if (flag != null) {
            rows.removeIf(r -> !r.flags().contains(flag));
        }
        String order=sort==null?"code":sort;boolean desc=order.startsWith("-");String field=desc?order.substring(1):order;
        Comparator<Row> comparator=switch(field) {
            case "code"->Comparator.comparing(Row::code);
            case "weighedOn"->Comparator.comparing(Row::weighedOn,Comparator.nullsLast(Comparator.naturalOrder()));
            case "adg"->Comparator.comparing(Row::adg,Comparator.nullsLast(Comparator.naturalOrder()));
            default->throw DomainException.invalid("sort");
        };
        rows.sort(desc?comparator.reversed():comparator);int start=Math.min(page*size,rows.size());
        return new Page(List.copyOf(rows.subList(start,Math.min(start+size,rows.size()))),rows.size(),page,size,counts,window,all.size());
    }
}
