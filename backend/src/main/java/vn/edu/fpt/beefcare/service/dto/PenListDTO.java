package vn.edu.fpt.beefcare.service.dto;

import java.util.List;

/** Pen list; the header figures count ACTIVE pens only (used = sum of headcounts, total = sum of capacities). */
public record PenListDTO(List<PenDTO> pens, int penCount, int usedPlaces, int totalPlaces) {}
