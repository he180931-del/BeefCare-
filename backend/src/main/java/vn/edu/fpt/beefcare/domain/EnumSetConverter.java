package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.AttributeConverter;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Stores an enum set as a comma separated string (the spec's text[] column, kept portable across H2 and PostgreSQL).
 */
public abstract class EnumSetConverter<E extends Enum<E>> implements AttributeConverter<Set<E>, String> {

    private final Class<E> type;

    protected EnumSetConverter(Class<E> type) {
        this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(Set<E> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        return attribute.stream().sorted().map(Enum::name).collect(Collectors.joining(","));
    }

    @Override
    public Set<E> convertToEntityAttribute(String dbData) {
        Set<E> result = EnumSet.noneOf(type);
        if (dbData != null && !dbData.isBlank()) {
            Arrays.stream(dbData.split(",")).map(String::trim).filter(s -> !s.isEmpty()).forEach(s -> result.add(Enum.valueOf(type, s)));
        }
        return result;
    }
}
