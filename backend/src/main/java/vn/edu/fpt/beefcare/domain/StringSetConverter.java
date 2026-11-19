package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

/** Stores a small set of trusted, code-like values in a portable comma-separated column. */
@Converter
public class StringSetConverter implements AttributeConverter<Set<String>, String> {

    @Override
    public String convertToDatabaseColumn(Set<String> values) {
        if (values == null || values.isEmpty()) return null;
        return values.stream().sorted().collect(Collectors.joining(","));
    }

    @Override
    public Set<String> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) return new LinkedHashSet<>();
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
