package vn.edu.fpt.beefcare.service;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * A business rule or permission failure carrying a spec message code (see {@link MessageCodes}) and its parameters.
 * Rendered by the ExceptionTranslator as {"code": "MSG-...", "params": {...}}.
 */
public class DomainException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String code;
    private final transient Map<String, Object> params;
    private final HttpStatus status;

    public DomainException(String code, Map<String, Object> params, HttpStatus status) {
        super(code + (params == null || params.isEmpty() ? "" : " " + params));
        this.code = code;
        this.params = params == null ? Map.of() : Map.copyOf(params);
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public Map<String, Object> getParams() {
        return params;
    }

    public HttpStatus getStatus() {
        return status;
    }

    /** Builds a parameter map from alternating name / value arguments (null values are skipped). */
    public static Map<String, Object> params(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            if (keyValues[i + 1] != null) {
                map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
            }
        }
        return map;
    }

    public static DomainException badRequest(String code, Object... kv) {
        return new DomainException(code, params(kv), HttpStatus.BAD_REQUEST);
    }

    public static DomainException forbidden(String code, Object... kv) {
        return new DomainException(code, params(kv), HttpStatus.FORBIDDEN);
    }

    public static DomainException notFound(String code, Object... kv) {
        return new DomainException(code, params(kv), HttpStatus.NOT_FOUND);
    }

    public static DomainException conflict(String code, Object... kv) {
        return new DomainException(code, params(kv), HttpStatus.CONFLICT);
    }

    /** Business-rule violation (HTTP 422). */
    public static DomainException unprocessable(String code, Object... kv) {
        return new DomainException(code, params(kv), HttpStatus.UNPROCESSABLE_ENTITY);
    }

    public static DomainException required(String field) {
        return badRequest(MessageCodes.COM_06, "field", field);
    }

    public static DomainException invalid(String field) {
        return badRequest(MessageCodes.COM_10, "field", field);
    }
}
