package vn.edu.fpt.beefcare.service;

import java.util.Locale;

/** Which voucher a payment belongs to: path segment {type} of /vouchers/{type}/{id}/payments. */
public enum VoucherKind {
    ENTRY,
    EXIT;

    /** Accepts entry | exit | entry-vouchers | exit-vouchers (case-insensitive). */
    public static VoucherKind parse(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (s) {
            case "entry", "entry-vouchers", "entry-voucher" -> ENTRY;
            case "exit", "exit-vouchers", "exit-voucher" -> EXIT;
            default -> throw DomainException.notFound(MessageCodes.COM_08, "type", raw);
        };
    }
}
