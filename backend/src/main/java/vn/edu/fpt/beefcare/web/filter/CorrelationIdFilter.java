package vn.edu.fpt.beefcare.web.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.edu.fpt.beefcare.service.CorrelationId;

/**
 * D34: every request gets a correlation ID before security runs. A valid {@code X-Request-Id} from the client is kept,
 * otherwise a new one is made; it is returned in the same header, written to the log lines and stored with the audit.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String id = CorrelationId.acceptOrNew(request.getHeader(CorrelationId.HEADER));
        response.setHeader(CorrelationId.HEADER, id);
        String previous = org.slf4j.MDC.get(CorrelationId.MDC_KEY);
        org.slf4j.MDC.put(CorrelationId.MDC_KEY, id);
        try {
            chain.doFilter(request, response);
        } finally {
            if (previous == null) org.slf4j.MDC.remove(CorrelationId.MDC_KEY);
            else org.slf4j.MDC.put(CorrelationId.MDC_KEY, previous);
        }
    }
}
