package vn.edu.fpt.beefcare.web.rest;

import jakarta.persistence.EntityManager;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

/**
 * Replaces the removed generated CattleResourceIT helpers used by the remaining generated entity tests.
 */
public final class EntityFactories {

    private EntityFactories() {}

    public static Cattle cattle(EntityManager em) {
        Cattle cattle = new Cattle();
        cattle.setDisplayCode("BC-000001");
        cattle.setSex(Sex.FEMALE);
        cattle.setLifeStage(LifeStage.ADULT);
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        cattle.setFarm(farm);
        Breed breed;
        if (TestUtil.findAll(em, Breed.class).isEmpty()) {
            breed = BreedResourceIT.createEntity(em);
            em.persist(breed);
            em.flush();
        } else {
            breed = TestUtil.findAll(em, Breed.class).get(0);
        }
        cattle.setBreed(breed);
        ProductionPurpose purpose;
        if (TestUtil.findAll(em, ProductionPurpose.class).isEmpty()) {
            purpose = ProductionPurposeResourceIT.createEntity(em);
            em.persist(purpose);
            em.flush();
        } else {
            purpose = TestUtil.findAll(em, ProductionPurpose.class).get(0);
        }
        cattle.setPurpose(purpose);
        return cattle;
    }
}
