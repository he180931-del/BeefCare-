import type { NotificationView } from '../types'

/** Thời điểm "hiện tại" của bản mock, khớp frame (5 phút trước, 12 phút trước, Hôm qua 16:05 ...). */
export const NOTIFICATIONS_DEMO_NOW = '2026-10-18T09:52:00'

const FARM = 'Trại bò Yên Bài – Ba Vì'
let nextId = 5001
const n = (
  category: NotificationView['category'],
  targetType: NotificationView['targetType'],
  targetId: number,
  createdTime: string,
  title: string,
  summary: string,
  readTime: string | null = createdTime,
): NotificationView => ({ id: nextId++, category, title, summary, targetType, targetId, createdTime, readTime })

// Frame hiển thị 6 mục đầu; số đếm 9 / 5 / 4 của các tab được đủ nhờ 3 thông báo cũ hơn ở cuối.
export const NOTIFICATIONS_SEED: NotificationView[] = [
  n('SUBSCRIPTION_PAYMENT', 'PAYMENT_REQUEST', 7, '2026-10-18T09:47:00', 'Yêu cầu thanh toán BCF7K2Q9 đang chờ chuyển khoản', `${FARM} · hết hạn 08:42 19/10`, null),
  n('SUPPORT', 'TICKET', 1042, '2026-10-18T09:40:00', 'Bộ phận hỗ trợ đã trả lời ticket TK-1042', 'Thanh toán · Phạm Thu Hà', null),
  n('SUPPORT', 'TICKET', 1031, '2026-10-17T16:05:00', 'TK-1031 đã được giải quyết – chờ bạn xác nhận', 'Kết quả phiên bản 2'),
  n('SUBSCRIPTION_PAYMENT', 'SUBSCRIPTION', 1, '2026-10-17T07:00:00', `Gói ${FARM} sẽ hết hạn sau 27 ngày`, 'Kỳ hiện tại kết thúc 14/11/2026'),
  n('SUBSCRIPTION_PAYMENT', 'PAYMENT_REQUEST', 5, '2026-10-03T21:10:00', 'Yêu cầu thanh toán BCE3P8L2 đã hết hạn', FARM),
  n('SUBSCRIPTION_PAYMENT', 'FARM_SERVICE', 2, '2026-09-28T15:00:00', 'Trại Suối Hai đang bị tạm ngưng dịch vụ', 'Trại Suối Hai'),
  n('SUPPORT', 'TICKET', 988, '2026-09-02T11:30:00', 'TK-0988 đã được đóng', 'Sử dụng hệ thống · Trại bò Tản Lĩnh'),
  n('SUPPORT', 'TICKET', 988, '2026-09-02T09:00:00', 'TK-0988 đã được giải quyết – chờ bạn xác nhận', 'Kết quả phiên bản 1'),
  n('SUBSCRIPTION_PAYMENT', 'PAYMENT_REQUEST', 3, '2025-11-15T10:05:00', 'Thanh toán BCD2M4X8 đã được xác nhận', `${FARM} · kỳ mua 15/11/2025 – 14/11/2026`),
]
