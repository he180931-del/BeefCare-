package vn.edu.fpt.beefcare.config;

import org.hibernate.boot.model.FunctionContributions;
import org.hibernate.boot.model.FunctionContributor;
import org.hibernate.dialect.PostgreSQLDialect;
import org.hibernate.type.StandardBasicTypes;

/**
 * {@code vi_sort(text)}: an ORDER BY key that sorts Vietnamese names alphabetically (a, ă, â, …, d, đ, …), case being
 * only a final tie-break. PostgreSQL uses the ICU collation {@code vi-x-icu} shipped with postgres:16.15; other
 * databases (H2 in fast tests) fall back to {@code lower()}, which keeps ASCII order only (D31, SCR-16).
 */
public class VietnameseSortFunctionContributor implements FunctionContributor {

    public static final String NAME = "vi_sort";

    @Override
    public void contributeFunctions(FunctionContributions contributions) {
        String pattern = contributions.getDialect() instanceof PostgreSQLDialect ? "(?1) collate \"vi-x-icu\"" : "lower(?1)";
        contributions
            .getFunctionRegistry()
            .registerPattern(NAME, pattern, contributions.getTypeConfiguration().getBasicTypeRegistry().resolve(StandardBasicTypes.STRING));
    }
}
