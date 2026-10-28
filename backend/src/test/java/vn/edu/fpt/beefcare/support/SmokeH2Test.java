package vn.edu.fpt.beefcare.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;

@ServiceIntegrationTest
class SmokeH2Test {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void contextStartsAndSchemaExists() {
        assertThat(jdbc.queryForObject("select count(*) from herd_entry_voucher", Integer.class)).isNotNull();
    }
}
