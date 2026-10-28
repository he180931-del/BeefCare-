package vn.edu.fpt.beefcare.domain.enumeration;

public enum AttachmentOwnerType {
    CATTLE,
    HERD_ENTRY,
    /** Invoice or delivery note of a feed receipt (SCR-79). */
    FEED_RECEIPT,
    /** Count record or photos of a feed stock adjustment (SCR-80). */
    FEED_ADJUSTMENT,
}
