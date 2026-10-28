package vn.edu.fpt.beefcare.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PenAssignment;

@Repository
public interface PenAssignmentRepository extends JpaRepository<PenAssignment, Long> {

    Optional<PenAssignment> findFirstByCattleIdAndToDateIsNull(Long cattleId);

    long countByPenIdAndToDateIsNull(Long penId);

    @Query("select count(a) from PenAssignment a where a.pen.id=:penId and a.fromDate<=:day and (a.toDate is null or a.toDate>=:day)")
    long countAssignedAt(@Param("penId") Long penId,@Param("day") LocalDate day);

    boolean existsByPenId(Long penId);

    List<PenAssignment> findAllByCattleIdOrderByFromDateAscIdAsc(Long cattleId);

    List<PenAssignment> findAllByPenIdAndToDateIsNull(Long penId);

    @Query("select a.pen.id, count(a) from PenAssignment a where a.toDate is null and a.pen.id in :ids group by a.pen.id")
    List<Object[]> countOpenGroupedByPen(@Param("ids") Collection<Long> ids);

    /** True when an assignment of the cattle still covers a day on or after {@code from} (open, or ending after it). */
    @Query("select count(a) > 0 from PenAssignment a where a.cattle.id = :cattleId and (a.toDate is null or a.toDate > :from)")
    boolean existsOverlappingFrom(@Param("cattleId") Long cattleId, @Param("from") LocalDate from);
}
