import { userFacingError } from '../../../shared/api/userFacingError'
import { dmy } from '../../../shared/lib/format'
import { entryEventLabel } from '../domain/entryEventLabel'

export function herdEntryError(error: unknown, fallback = 'Không thể hoàn tất thao tác. Vui lòng thử lại.'): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown>; message?: string } : {}
  const p = value.params ?? {}
  const events = (Array.isArray(p.events) ? p.events.map(String) : String(p.events ?? 'không xác định').split(',')).map(event => entryEventLabel(event.trim())).join(', ')
  const cattle = String(p.cattle_code ?? 'bò này')
  switch (value.code) {
    case 'MSG-FE06-02': return value.message || `Bê này đã được đăng ký${p.cattle_code ? ` thành ${p.cattle_code}` : ''}. Vui lòng tải lại danh sách.`
    case 'MSG-FE06-04': return value.message || 'Chỉ áp dụng với bê sống. Bê chết khi sinh không được đăng ký vào đàn.'
    case 'MSG-COM-05': return value.message || 'Dữ liệu đã thay đổi. Vui lòng tải lại để kiểm tra trạng thái mới nhất.'
    case 'MSG-FE06-07': {
      const reasons: Record<string, string> = {
        BIRTH_DATE_AFTER_ENTRY_DATE: 'ngày sinh không được sau ngày nhập',
        ENTRY_DATE_BEFORE_BIRTH_DATE: `ngày nhập mới trước ngày sinh của ${cattle}`,
        EVENT_BEFORE_ENTRY_DATE: `ngày nhập mới sau sự kiện đã ghi ngày ${dmy(String(p.date ?? ''))} của ${cattle}`,
        PAYMENT_BEFORE_ENTRY_DATE: `đã có thanh toán ngày ${dmy(String(p.date ?? ''))} trước ngày nhập mới`,
        ENTRY_DATE_AFTER_FIRST_PLACEMENT_END: 'ngày nhập mới sau ngày kết thúc lần xếp chuồng đầu',
        SEX_CHANGE_WITH_REPRODUCTIVE_EVENTS: 'bò đã có sự kiện sinh sản nên không thể đổi giới tính',
        FARM_BORN_DATA_COMES_FROM_THE_CALVING: 'dữ liệu bê sinh tại trại lấy từ lần đẻ; chỉ được sửa cân nhập và cơ sở cân',
      }
      const reason = reasons[String(p.reason)]
      return reason ? `Không thể sửa: ${reason}.` : value.message || userFacingError(error, fallback)
    }
    case 'MSG-FE06-09': return `Không thể hủy vì ${cattle} đã có sự kiện được ghi: ${events}.`
    case 'MSG-FE06-20': if (p.action === 'VOID_VOUCHER') return 'Đây là con cuối cùng còn hiệu lực của phiếu. Hãy dùng Hủy phiếu.'; return userFacingError(error, fallback)
    case 'MSG-FE06-03': return 'Ngày nhập không được ở tương lai hoặc trước ngày sinh.'
    case 'MSG-FE06-13': return `Số tiền thanh toán không được vượt quá ${p.amount ?? 0} đ.`
    default: return userFacingError(error, fallback)
  }
}
