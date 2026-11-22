const labels: Record<string, string> = {
  WEIGHT: 'Cân nặng', HEALTH_CASE: 'Ca sức khỏe', HEALTH_OBSERVATION: 'Theo dõi sức khỏe', TREATMENT: 'Điều trị',
  VACCINATION: 'Tiêm phòng', SCHEDULED_DOSE: 'Lịch tiêm', REPRODUCTION: 'Sinh sản', PREGNANCY: 'Thai kỳ',
  CALVING: 'Đẻ', OFFSPRING: 'Có con', PEN_MOVE: 'Chuyển chuồng', QR_REPLACEMENT: 'Thay thẻ QR',
  PROFILE_CHANGE: 'Thay đổi hồ sơ', EXIT: 'Xuất đàn',
}
export const entryEventLabel = (event: string): string => labels[event] ?? event
