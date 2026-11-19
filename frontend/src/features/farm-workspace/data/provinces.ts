/** Tỉnh, thành phố trực thuộc trung ương (danh sách chọn ở SCR-10 và SCR-11). */
export const PROVINCES = [
  'Hà Nội', 'Huế', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Lạng Sơn', 'Quảng Ninh', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Cao Bằng',
  'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'Hải Phòng', 'Ninh Bình', 'Quảng Trị', 'Đà Nẵng',
  'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk', 'TP. Hồ Chí Minh', 'Đồng Nai', 'Tây Ninh', 'Cần Thơ', 'Vĩnh Long',
  'Đồng Tháp', 'Cà Mau', 'An Giang',
] as const

export const TIME_ZONES: ReadonlyArray<readonly [string, string]> = [
  ['Asia/Ho_Chi_Minh', 'Việt Nam · UTC+07:00 (Asia/Ho_Chi_Minh)'],
  ['Asia/Bangkok', 'Thái Lan · UTC+07:00 (Asia/Bangkok)'],
  ['Asia/Vientiane', 'Lào · UTC+07:00 (Asia/Vientiane)'],
]

export const HERD_SIZES: ReadonlyArray<readonly [string, string]> = [
  ['UNDER_50', 'Dưới 50 con'], ['50_149', '50–149 con'], ['150_300', '150–300 con'], ['OVER_300', 'Trên 300 con'],
]
