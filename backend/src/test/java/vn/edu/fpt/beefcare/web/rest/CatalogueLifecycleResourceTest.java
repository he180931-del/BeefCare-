package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.CareCatalogueCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** TC-18-30: unsupported deletions are rejected by the real secured HTTP stack, including for managers. */
@ServiceIntegrationTest
@Transactional
class CatalogueLifecycleResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired CareCatalogueCommandService care;

    @ParameterizedTest
    @EnumSource(value = FarmRole.class, names = {"OWNER", "MANAGER"})
    void onlyVaccinesExposeADeleteCommand(FarmRole role) throws Exception {
        var farm = farm();
        var actor = memberWithRole(farm, role);
        actAs(actor);
        var unusedBreed = breed(farm);
        var usedBreed = breed(farm);
        var usedPurpose = purpose(farm, PurposeType.FATTENING);
        var unusedPurpose = purpose(farm, PurposeType.UNDECIDED);
        var cattle = cattle(farm, usedBreed, usedPurpose, Sex.MALE, LifeStage.ADULT);
        var medicine = care.saveMedicine(farm.getId(), null, UUID.randomUUID().toString(),
            new CareDtos.MedicineCommand(null, "TH-TEST", "Thuốc thử", null, null, null, 0, true));
        long audits = em.createQuery("select count(a) from AuditLog a where a.farm.id=:farm", Long.class).setParameter("farm", farm.getId()).getSingleResult();
        for (String suffix : List.of("catalogues/breeds/" + unusedBreed.getId(), "catalogues/breeds/" + usedBreed.getId(),
            "catalogues/production-purposes/" + unusedPurpose.getId(), "catalogues/production-purposes/" + usedPurpose.getId(), "medicines/" + medicine.id())) {
            mvc.perform(delete("/api/farms/" + farm.getId() + "/" + suffix).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf())
                .header("Idempotency-Key", UUID.randomUUID().toString()).header("If-Match", "0"))
                .andExpect(status().isMethodNotAllowed());
        }
        em.clear();
        assertThat(em.find(Breed.class, unusedBreed.getId())).isNotNull();
        assertThat(em.find(Breed.class, usedBreed.getId())).isNotNull();
        assertThat(em.find(ProductionPurpose.class, unusedPurpose.getId())).isNotNull();
        assertThat(em.find(ProductionPurpose.class, usedPurpose.getId())).isNotNull();
        assertThat(em.find(Medicine.class, medicine.id())).isNotNull();
        assertThat(em.find(vn.edu.fpt.beefcare.domain.Cattle.class, cattle.getId()).getPurpose().getId()).isEqualTo(usedPurpose.getId());
        assertThat(em.createQuery("select count(a) from AuditLog a where a.farm.id=:farm", Long.class).setParameter("farm", farm.getId()).getSingleResult()).isEqualTo(audits);
    }
}
