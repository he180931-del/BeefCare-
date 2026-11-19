export type SupportErrorCode = 'VALIDATION' | 'CLOSED' | 'RESULT_CHANGED' | 'STATE_CHANGED' | 'NOT_FOUND' | 'FORBIDDEN'

/** Lỗi nghiệp vụ của ticket; `code` để màn hình chọn hộp thoại phù hợp, `fields` là lỗi theo trường. */
export class SupportError extends Error {
  constructor(
    readonly code: SupportErrorCode,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'SupportError'
  }
}

export const MESSAGES = {
  closed: 'Ticket đã đóng và chỉ đọc. Hãy tạo ticket mới nếu bạn cần hỗ trợ thêm.', // MSG-FE20-06
  resultChanged: 'Ticket vừa có kết quả mới hơn phiên bản bạn đang xem.', // MSG-FE20-05
  stateChanged: 'Ticket đã thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.', // MSG-COM-05
  forbidden: 'Bạn không có quyền thực hiện thao tác này.', // MSG-COM-01
  notFound: 'Không tìm thấy ticket.',
  saveFailed: 'Không lưu được dữ liệu. Vui lòng thử lại.', // MSG-COM-02
} as const
