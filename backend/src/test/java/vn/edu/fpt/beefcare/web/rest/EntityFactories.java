package vn.edu.fpt.beefcare.web.rest;

import jakarta.persistence.EntityManager;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
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

    /** Replaces the retired generated FarmMembershipResourceIT.createEntity / createUpdatedEntity (the CRUD route is closed). */
    public static FarmMembership farmMembership(EntityManager em, boolean updated) {
        FarmMembership membership = new FarmMembership().role(updated ? "BBBBBBBBBB" : "AAAAAAAAAA").status(updated ? "BBBBBBBBBB" : "AAAAAAAAAA");
        Farm farm;
        if (TestUtil.findAll(em, Farm.class).isEmpty()) {
            farm = updated ? FarmResourceIT.createUpdatedEntity() : FarmResourceIT.createEntity();
            em.persist(farm);
            em.flush();
        } else {
            farm = TestUtil.findAll(em, Farm.class).get(0);
        }
        membership.setFarm(farm);
        AppUser appUser;
        if (TestUtil.findAll(em, AppUser.class).isEmpty()) {
            appUser = updated ? AppUserResourceIT.createUpdatedEntity() : AppUserResourceIT.createEntity();
            em.persist(appUser);
            em.flush();
        } else {
            appUser = TestUtil.findAll(em, AppUser.class).get(0);
        }
        membership.setUser(appUser);
        return membership;
    }
}
