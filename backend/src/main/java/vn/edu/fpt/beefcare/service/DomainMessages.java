package vn.edu.fpt.beefcare.service;

import java.util.Locale;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.ResourceBundle;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/**
 * Resolves the default (English / Vietnamese) text of a message code, substituting {name} placeholders.
 * Clients may ignore the text and use the code.
 */
@Component
public class DomainMessages {

    private static final String BUNDLE = "i18n/domain_messages";

    public String resolve(String code, Map<String, Object> params) {
        return resolve(code, params, LocaleContextHolder.getLocale());
    }

    public String resolve(String code, Map<String, Object> params, Locale locale) {
        String text;
        try {
            text = ResourceBundle.getBundle(
                BUNDLE,
                locale == null ? Locale.ENGLISH : locale,
                ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES)
            ).getString(code);
        } catch (MissingResourceException e) {
            return code;
        }
        if (params != null) {
            for (Map.Entry<String, Object> e : params.entrySet()) {
                text = text.replace("{" + e.getKey() + "}", String.valueOf(e.getValue()));
            }
        }
        return text;
    }
}
