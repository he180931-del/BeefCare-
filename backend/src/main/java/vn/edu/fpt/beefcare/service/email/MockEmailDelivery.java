package vn.edu.fpt.beefcare.service.email;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Development/test mail sink. Messages, including verification links, stay in memory and are not logged or persisted. */
@Component
@Profile({ "dev", "local", "test", "testh2" })
@ConditionalOnProperty(name = "beefcare.email.provider", havingValue = "mock", matchIfMissing = true)
public class MockEmailDelivery implements EmailDelivery {

    private static final int MAX_MESSAGES = 1000;
    private final ConcurrentLinkedDeque<MailboxMessage> messages = new ConcurrentLinkedDeque<>();
    private final AtomicInteger forcedFailures = new AtomicInteger();

    @Override
    public void deliver(OutboundEmail message) {
        if (forcedFailures.getAndUpdate(current -> Math.max(0, current - 1)) > 0) throw new IllegalStateException("Simulated local mail provider failure");
        messages.addFirst(new MailboxMessage(UUID.randomUUID().toString(), message.to(), message.subject(), message.content(), message.html(), message.plainText(), message.createdAt()));
        while (messages.size() > MAX_MESSAGES) messages.pollLast();
    }

    public List<MailboxMessage> findMessagesFor(String email) {
        return messages.stream().filter(message -> message.to().equalsIgnoreCase(email)).toList();
    }

    /** Test hook for exercising durable retry behavior. It is not exposed over HTTP. */
    public void failNextDeliveries(int count) {
        if (count < 0) throw new IllegalArgumentException("Failure count cannot be negative");
        forcedFailures.set(count);
    }

    public record MailboxMessage(String id, String to, String subject, String content, boolean html, String plainText, java.time.Instant createdAt) {}
}
