package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.RecordRevision;

/** D42: retained JSON declarations and corrections also keep a catalogue item in use. */
@Service
@Transactional(readOnly = true)
public class CatalogueReferenceService {
    @PersistenceContext private EntityManager em;

    public long entryDeclarations(Long farmId, String field, Long id) {
        return em.createQuery("select h.draftData from HerdEntry h where h.farm.id=:farm and h.draftData is not null", String.class)
            .setParameter("farm", farmId).getResultStream().filter(json -> containsId(json, field, id)).count();
    }

    public Set<Long> revisedSources(Long farmId, String sourceType, String field, Long id) {
        Set<Long> sources = new HashSet<>();
        for (RecordRevision revision : em.createQuery("select r from RecordRevision r where r.farm.id=:farm and r.sourceType=:type", RecordRevision.class)
            .setParameter("farm", farmId).setParameter("type", sourceType).getResultList()) {
            if (containsId(revision.getBeforeSnapshot(), field, id) || containsId(revision.getAfterSnapshot(), field, id)) {
                sources.add(revision.getSourceId());
            }
        }
        return sources;
    }

    public Set<Long> auditedSchedules(Long farmId, Long vaccineId) {
        Set<Long> sources = new HashSet<>();
        for (AuditLog log : em.createQuery("select a from AuditLog a where a.farm.id=:farm and a.targetType='VaccinationSchedule' and a.action in ('VACCINATION_SCHEDULE_CREATE','VACCINATION_SCHEDULE_EDIT')", AuditLog.class)
            .setParameter("farm", farmId).getResultList()) {
            if (containsId(log.getDetails(), "vaccineId", vaccineId)) sources.add(log.getTargetId());
        }
        return sources;
    }

    private boolean containsId(String json, String field, Long id) {
        JsonNode node = JsonSupport.fromJson(json, JsonNode.class);
        return node != null && node.findValues(field).stream().anyMatch(value -> id.toString().equals(value.asText()));
    }
}
