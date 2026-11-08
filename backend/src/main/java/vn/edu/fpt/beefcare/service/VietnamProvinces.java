package vn.edu.fpt.beefcare.service;

import java.util.List;

/**
 * Provinces and centrally-run cities of Viet Nam offered on SCR-10 / SCR-11 (34 units after the 2025 merger, decision
 * FE-02 Q3). The farm stores the name; this list must stay identical to {@code frontend/src/features/farm-workspace/data/provinces.ts}.
 */
public final class VietnamProvinces {

    public static final List<String> NAMES = List.of(
        "Hà Nội",
        "Huế",
        "Lai Châu",
        "Điện Biên",
        "Sơn La",
        "Lạng Sơn",
        "Quảng Ninh",
        "Thanh Hóa",
        "Nghệ An",
        "Hà Tĩnh",
        "Cao Bằng",
        "Tuyên Quang",
        "Lào Cai",
        "Thái Nguyên",
        "Phú Thọ",
        "Bắc Ninh",
        "Hưng Yên",
        "Hải Phòng",
        "Ninh Bình",
        "Quảng Trị",
        "Đà Nẵng",
        "Quảng Ngãi",
        "Gia Lai",
        "Khánh Hòa",
        "Lâm Đồng",
        "Đắk Lắk",
        "TP. Hồ Chí Minh",
        "Đồng Nai",
        "Tây Ninh",
        "Cần Thơ",
        "Vĩnh Long",
        "Đồng Tháp",
        "Cà Mau",
        "An Giang"
    );

    private VietnamProvinces() {}

    /** The trimmed name when it is in the list; otherwise MSG-COM-10 on {@code field}. */
    public static String require(String value, String field) {
        String name = value == null ? "" : value.trim();
        if (!NAMES.contains(name)) throw DomainException.invalid(field);
        return name;
    }
}
