package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Migration-seeded singleton used only to serialize plan-price publication and withdrawal. */
@Entity
@Table(name = "plan_price_lock")
public class PlanPriceLock {
    @Id
    private Integer id;
}
