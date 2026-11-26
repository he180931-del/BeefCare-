package vn.edu.fpt.beefcare.domain.enumeration;

public enum CodeType {
    CATTLE,
    HERD_ENTRY,
    HERD_EXIT,
    QR_TAG,
    FEED_ITEM,
    FEED_RECEIPT,
    STOCK_ADJUSTMENT,
    /** Mã ca sức khỏe HC-nnnn, đếm theo trại (D64). */
    HEALTH_CASE,
}
