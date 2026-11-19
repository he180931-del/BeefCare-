package vn.edu.fpt.beefcare.service.payment;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;

/** Read-only SePay API lookup. A token is required at call time and is never logged or returned. */
@Component
public class SePayTransactionLookupClient {
    private final RestClient client;
    private final String apiToken;

    public SePayTransactionLookupClient(
        @Value("$" + "{beefcare.sepay.api-base-url:https://my.sepay.vn/userapi}") String baseUrl,
        @Value("$" + "{beefcare.sepay.api-token:}") String apiToken,
        @Value("$" + "{beefcare.sepay.api-timeout:5s}") Duration timeout
    ) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        // Select the configured transport directly; do not initialize an unused JDK HTTP client first.
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.apiToken = apiToken;
    }

    public SePayPayload find(Long transactionId) {
        if (transactionId == null || transactionId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid transaction id");
        if (!StringUtils.hasText(apiToken)) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SePay lookup is not configured");
        try {
            TransactionResponse response = client.get()
                .uri("/transactions/details/{transactionId}", transactionId)
                .header("Authorization", "Bearer " + apiToken)
                .retrieve()
                .body(TransactionResponse.class);
            if (response == null || response.transaction() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found");
            Transaction tx = response.transaction();
            BigDecimal amountIn = decimal(tx.amountIn());
            BigDecimal amountOut = decimal(tx.amountOut());
            boolean incoming = amountIn.signum() > 0;
            return new SePayPayload(
                tx.id() == null ? transactionId : Long.valueOf(tx.id()),
                tx.bankBrandName(),
                tx.transactionDate(),
                tx.accountNumber(),
                tx.code(),
                tx.transactionContent(),
                incoming ? "IN" : "OUT",
                incoming ? amountIn : amountOut,
                tx.referenceNumber()
            );
        } catch (ResponseStatusException status) {
            throw status;
        } catch (RuntimeException failure) {
            // Keep provider response and bearer token out of API responses and logs.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "SePay transaction lookup failed");
        }
    }

    private static BigDecimal decimal(String value) {
        try {
            return value == null || value.isBlank() ? BigDecimal.ZERO : new BigDecimal(value);
        } catch (NumberFormatException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "SePay returned an invalid amount");
        }
    }

    public record TransactionResponse(Integer status, Object error, Messages messages, Transaction transaction) {}
    public record Messages(Boolean success) {}
    public record Transaction(
        String id,
        @JsonProperty("transaction_date")
        String transactionDate,
        @JsonProperty("account_number")
        String accountNumber,
        @JsonProperty("amount_in")
        String amountIn,
        @JsonProperty("amount_out")
        String amountOut,
        String code,
        @JsonProperty("transaction_content")
        String transactionContent,
        @JsonProperty("reference_number")
        String referenceNumber,
        @JsonProperty("bank_brand_name")
        String bankBrandName
    ) {}
}
