package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

/** Dry run of a pen move: nothing is written. {@code moveDate} defaults to today. */
public record PenMoveCheckRequest(@NotEmpty List<@NotNull Long> cattleIds, @NotNull Long toPenId, LocalDate moveDate) {}
