package vn.edu.fpt.beefcare.service;

import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;

/** Verified account and current platform role read from storage for this request. */
public record PlatformContext(AppUser user, PlatformStaffAccess access, PlatformRole role) {}
