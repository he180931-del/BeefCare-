package vn.edu.fpt.beefcare.service.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * D51: các trường số nguyên người dùng nhập ở phần chăm sóc không được tự làm tròn số thập phân hay đọc chuỗi số.
 * Gửi {@code 2.7} phải bị từ chối (HTTP 400) thay vì bị cắt ngầm thành {@code 2}.
 */
class WholeNumberFieldsTest {

    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    static Stream<Arguments> wholeNumberFields() {
        return Stream.of(
            Arguments.of(ReproductionDtos.PregnancyCheckCommand.class, "estimatedMonths"),
            Arguments.of(ReproductionDtos.CorrectEvent.class, "estimatedMonths"),
            Arguments.of(CareDtos.TreatmentCommand.class, "courseDays"),
            Arguments.of(CareDtos.TreatmentCommand.class, "withdrawalDays"),
            Arguments.of(CareDtos.CorrectTreatment.class, "courseDays"),
            Arguments.of(CareDtos.CorrectTreatment.class, "withdrawalDays"),
            Arguments.of(CareDtos.CreateVaccinationSchedule.class, "doseCount"),
            Arguments.of(CareDtos.CreateVaccinationSchedule.class, "intervalDays"),
            Arguments.of(CareDtos.CreateVaccinationSchedule.class, "boosterIntervalMonths"),
            Arguments.of(CareDtos.EditVaccinationSchedule.class, "doseCount"),
            Arguments.of(CareDtos.EditVaccinationSchedule.class, "intervalDays"),
            Arguments.of(CareDtos.EditVaccinationSchedule.class, "boosterIntervalMonths")
        );
    }

    @ParameterizedTest(name = "{0}.{1} từ chối 2.7 và \"3\"")
    @MethodSource("wholeNumberFields")
    void rejectsDecimalsAndNumericStrings(Class<?> type, String field) {
        assertThatThrownBy(() -> mapper.readValue("{\"" + field + "\":2.7}", type)).isInstanceOf(MismatchedInputException.class);
        assertThatThrownBy(() -> mapper.readValue("{\"" + field + "\":\"3\"}", type)).isInstanceOf(MismatchedInputException.class);
    }

    @ParameterizedTest(name = "{0}.{1} nhận số nguyên và null")
    @MethodSource("wholeNumberFields")
    void acceptsWholeNumbersAndNull(Class<?> type, String field) throws Exception {
        assertThat(mapper.readValue("{\"" + field + "\":3}", type)).hasFieldOrPropertyWithValue(field, 3);
        assertThat(mapper.readValue("{\"" + field + "\":null}", type)).hasFieldOrPropertyWithValue(field, null);
    }

    @Test
    void anOmittedFieldStaysNull() throws Exception {
        assertThat(mapper.readValue("{}", ReproductionDtos.PregnancyCheckCommand.class).estimatedMonths()).isNull();
    }
}
