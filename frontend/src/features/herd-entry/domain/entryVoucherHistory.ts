import { asRecord, numberValue, textValue } from '../../../shared/api/parse'
import { toBusinessTime } from '../../../shared/lib/date/farmTime'
import { dmy, money } from '../../../shared/lib/format'

/**
 * SCR-75 #11 "Lịch sử phiếu": one Vietnamese line per EntryDtos.HistoryItem
 * `{at, kind, actor, details}`. Kinds and detail fields come from the audit
 * entries written by HerdEntryVoucherService, HerdEntryImportService,
 * HerdEntryPostingService, HerdEntryCorrectionService and the payment rows of
 * EntryVoucherMapper.history. An unknown kind never shows its raw code.
 */
const methodLabel = (value: unknown) => value === 'CASH' ? 'Tiền mặt' : value === 'BANK_TRANSFER' ? 'Chuyển khoản' : textValue(value)
const list = (value: unknown) => Array.isArray(value) ? value.map(item => textValue(item)).filter(Boolean).join(', ') : textValue(value)
const withReason = (action: string, reason: unknown) => textValue(reason) ? `${action} · ${textValue(reason)}` : action

function action(kind: string, details: Record<string, unknown>): string {
  switch (kind) {
    case 'ENTRY_DRAFT_CREATE': return 'Tạo phiếu nháp'
    case 'ENTRY_DRAFT_UPDATE': return `Sửa phiếu nháp (${numberValue(details.lines)} con)`
    case 'ENTRY_IMPORT': return `Nhập Excel: thêm ${numberValue(details.added)}/${numberValue(details.rows)} dòng`
    case 'ENTRY_POST': {
      const cattle = list(details.cattle)
      return `Ghi sổ, tạo ${numberValue(details.count)} con${cattle ? `: ${cattle}` : ''}`
    }
    case 'ENTRY_VOID': return withReason('Hủy phiếu', details.reason)
    case 'ENTRY_LINE_CORRECT': return withReason(`Sửa bản ghi nhập ${textValue(details.cattle)}`.trim(), details.reason)
    case 'ENTRY_LINE_VOID': return withReason(`Hủy bản ghi nhập ${textValue(details.cattle)}`.trim(), details.reason)
    case 'PAYMENT_RECORDED': {
      const method = methodLabel(details.method)
      const date = textValue(details.date)
      return `Ghi thanh toán ${money(numberValue(details.amount))} đ${method ? ` (${method})` : ''}${date ? ` ngày ${dmy(date)}` : ''}`
    }
    case 'PAYMENT_VOIDED': return withReason(`Hủy thanh toán ${money(numberValue(details.amount))} đ`, details.reason)
    default: return 'Thao tác khác'
  }
}

export function formatEntryHistoryItem(value: unknown): string {
  const item = asRecord(value)
  const at = toBusinessTime(item.at)
  const when = at ? `${dmy(at.slice(0, 10))} ${at.slice(11, 16)}` : ''
  return [when, textValue(item.actor), action(textValue(item.kind), asRecord(item.details))].filter(Boolean).join(' · ')
}
