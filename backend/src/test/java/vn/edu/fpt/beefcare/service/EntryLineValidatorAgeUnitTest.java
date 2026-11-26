package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

class EntryLineValidatorAgeUnitTest {
    @Test
    void tc0619MapsEighteenMonthsAtEntryToEstimatedBirthMonth() {
        long farmId = 619L;
        Pen pen = new Pen();
        pen.setId(1L);
        EntryCatalogLookup catalog = mock(EntryCatalogLookup.class);
        when(catalog.pen(farmId, pen.getId())).thenReturn(Optional.of(pen));
        EntryLineValidator validator = new EntryLineValidator(
            catalog,
            mock(CattleRepository.class),
            mock(ReceptionCriteriaService.class),
            mock(CattleGuardService.class),
            mock(FarmClock.class)
        );
        EntryLineRequest request = new EntryLineRequest(
            "TC-06-19", null, null, null, null, null, null, BirthDateAccuracy.ESTIMATED, 18,
            null, null, null, null, pen.getId(), null, null, null, null, null, null, null
        );

        var result = validator.validate(
            new EntryLineValidator.Header(farmId, EntryType.PURCHASE, LocalDate.of(2026, 11, 6), PricingBasis.PER_KG),
            1,
            request,
            Set.of(),
            false
        );

        assertThat(result.resolved().birthDate()).isEqualTo(LocalDate.of(2025, 5, 1));
        assertThat(result.resolved().accuracy()).isEqualTo(BirthDateAccuracy.ESTIMATED);
        assertThat(result.resolved().data().ageMonths()).isEqualTo(18);
        assertThat(result.errors()).isEmpty();
    }
}
