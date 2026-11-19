package vn.edu.fpt.beefcare.service.email;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class MockEmailDeliveryTest {

    @Test
    void keepsDevelopmentLinksInAnInMemoryMailboxAndFiltersByRecipient() {
        MockEmailDelivery inbox = new MockEmailDelivery();
        inbox.deliver(new OutboundEmail("owner@example.test", "Verify", "https://local/activate?token=secret", false, Instant.now()));
        inbox.deliver(new OutboundEmail("other@example.test", "Reset", "https://local/reset?token=other", false, Instant.now()));

        assertThat(inbox.findMessagesFor("owner@example.test")).singleElement().satisfies(message -> {
            assertThat(message.subject()).isEqualTo("Verify");
            assertThat(message.content()).contains("token=secret");
        });
        assertThat(inbox.findMessagesFor("Owner@Example.Test")).hasSize(1);
        assertThat(inbox.findMessagesFor("nobody@example.test")).isEmpty();
    }

    @Test
    void keepsTheNewestThousandDevelopmentMessagesOnly() {
        MockEmailDelivery inbox = new MockEmailDelivery();
        for (int i = 0; i < 1005; i++) {
            inbox.deliver(new OutboundEmail("owner@example.test", "Message " + i, "body", false, Instant.now()));
        }

        assertThat(inbox.findMessagesFor("owner@example.test")).hasSize(1000);
        assertThat(inbox.findMessagesFor("owner@example.test").getFirst().subject()).isEqualTo("Message 1004");
    }
}
