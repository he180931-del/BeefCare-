package vn.edu.fpt.beefcare.service;

import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;

/** The verified caller of a request: the farm, the ACTIVE account and its current role in that farm. */
public record FarmContext(Farm farm, AppUser user, FarmRole role) {
    public Long farmId() {
        return farm.getId();
    }

    public boolean isOwner() {
        return role == FarmRole.OWNER;
    }
}
