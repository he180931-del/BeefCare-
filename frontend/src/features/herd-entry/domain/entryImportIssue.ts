/** One issue of a row of the Excel import (POST …/entry-vouchers/{id}/import → rows[].issues[]). */
export type EntryImportIssue = { code?: string; field?: string; severity?: string; message?: string; params?: Record<string, unknown> }

/** Field names of the issue → the column names of the BeefCare template ("Hướng dẫn" sheet). */
const FIELD_LABELS: Record<string, string> = {
  earTagNumber: 'Số tai', breed: 'Giống', sex: 'Giới tính', birthDate: 'Ngày sinh', ageMonths: 'Tuổi', birthDateAccuracy: 'Độ chính xác',
  lifeStage: 'Giai đoạn sống', purposeId: 'Mục đích', entryWeightKg: 'Cân', weightBasis: 'Cơ sở cân', penId: 'Chuồng', unitPrice: 'Đơn giá',
  quarantineUntil: 'Cách ly đến', warningReason: 'Lý do',
}

/**
 * Vietnamese text of an import issue built from its code and field, so the row says which column is wrong whatever the
 * language of the server message; codes not listed keep the server message.
 */
export function entryImportIssueText(issue: EntryImportIssue): string {
  const field = String(issue.field ?? '').trim()
  const label = FIELD_LABELS[field] ?? field
  const p = issue.params ?? {}
  switch (issue.code) {
    case 'MSG-COM-06': return `Thiếu ${label}`
    case 'MSG-COM-08': return `${label} không có trong danh mục của trại`
    case 'MSG-COM-10': return `${label} không hợp lệ`
    case 'MSG-COM-15': return `${label} không được trước ngày nhập`
    case 'MSG-FE18-08': return `${label} không còn hoạt động trong danh mục`
    case 'MSG-FE04-05': return `Chuồng ${String(p.pen_code ?? '')} không nhận thêm được: ngừng sử dụng hoặc chỉ còn ${String(p.free ?? 0)} chỗ`
    case 'MSG-FE04-06': return `Không đạt tiêu chí nhận của chuồng ${String(p.pen_code ?? '')}`
    case 'MSG-FE05-02': return `Số tai ${String(p.ear_tag ?? '')} đã có trong phiếu hoặc ở bò đang nuôi`
    case 'MSG-FE05-12': return 'Mục đích đực giống chỉ cho bò đực, sinh sản chỉ cho bò cái'
    case 'CHK-ESTIMATED-WEIGHT': return 'Cân ước tính (UT)'
    case 'CHK-BIRTH-UNKNOWN': return 'Không rõ ngày sinh'
    case 'CHK-LIFE-STAGE-DEFAULTED': return 'Không rõ tuổi, giai đoạn lấy Trưởng thành'
    case 'CHK-PURPOSE-DEFAULTED': return 'Chưa ghi mục đích, lấy mục đích mặc định'
    case 'CHK-WEIGHT-BASIS-DEFAULTED': return 'Chưa ghi cơ sở cân, lấy Ước tính'
    case 'CHK-NO-PRICE': return 'Chưa có đơn giá'
  }
  const message = String(issue.message ?? '').trim()
  if (message && message !== issue.code) return message
  return label ? `Vui lòng kiểm tra cột ${label}.` : ''
}
