import { useEffect, useRef } from 'react'
import { Field, Icon, inputCls, Modal, ModalButton, ModalFooter, Note, Select, Textarea } from '../../../shared/ui'
import { dmy, money } from '../../../shared/lib/format'
import { penCode, restoreCounts } from '../domain/occupancy'
import type { ExitVoidOutcome, HerdExit } from '../types'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import { useExitVoid } from '../hooks/useExitVoid'
import { exitVoidError } from '../api/exitVoidError'
import { exitPaymentTotals } from '../domain/exitPaymentTotals'

const MAX_REASON = 500

export default function CancelModal({ row, onClose, onCancelled, onReload }: { row: HerdExit; onClose: () => void; onCancelled: (outcome: ExitVoidOutcome) => void; onReload: () => Promise<unknown> }) {
  const form = useExitVoid(row, onCancelled)
  const { canonicalPens, check, cancelReason, setCancelReason } = form
  const warningInputs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  useEffect(() => {
    if (form.choices.focusCattleId) warningInputs.current[form.choices.focusCattleId]?.focus()
  }, [form.error, form.choices.focusCattleId])
  const { collected } = exitPaymentTotals(row)
  const barnCount = row.count
  const restoringByPen = restoreCounts(row.detail?.cows ?? [])
  const barnNames = Object.keys(restoringByPen)
  const occupancyText = check
    ? check.occupancyAfter.map((pen) => `${pen.penCode} (${pen.before}/${pen.capacity} → ${pen.after}/${pen.capacity})`).join(' · ')
    : canonicalPens
    ? barnNames.map((code) => {
      const pen = canonicalPens.find((item) => item.code === code)
      const restoring = restoringByPen[penCode(code)] ?? 0
      return pen ? `${code} (${pen.count}/${pen.capacity} → ${pen.count + restoring}/${pen.capacity})` : code
    }).join(' · ')
    : 'Chuồng sẽ được kiểm tra theo dữ liệu hiện tại'

  return (
    <Modal width={640} title={`Hủy phiếu xuất ${row.id}`} sub={[row.type, dmy(row.date), `${barnCount ?? 0} con`, row.who].filter(Boolean).join(' · ')} topTitle="Hủy phiếu xuất" onClose={form.saving ? () => undefined : onClose}>
      <div className="flex flex-col gap-2.5">
        <div className="text-sm font-semibold">Khi xác nhận hủy</div>
        <Note tone="ok">
          <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />{barnCount} con trở lại ACTIVE và mở lại phân chuồng cuối {occupancyText || 'theo từng con'}.</div>
          <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />Phiếu giữ nguyên trong lịch sử với trạng thái ĐÃ HỦY và lý do.</div>
        </Note>
        <Note tone="warn">
          <div className="flex items-start gap-1.5"><Icon name="alert-triangle" size={14} className="mt-px shrink-0" />Mũi tiêm, nhắc việc đã hủy do xuất đàn KHÔNG tự khôi phục – Quản lý lập lại nếu cần.</div>
          <div className="flex items-start gap-1.5"><Icon name="alert-triangle" size={14} className="mt-px shrink-0" />Tiền đã thu {money(collected)} đ vẫn giữ trong lịch sử – hoàn trả xử lý ngoài hệ thống.</div>
        </Note>
      </div>
      {form.loading && <Note>Đang kiểm tra chuồng…</Note>}
      {Boolean(form.checkError) && <div className="flex flex-col gap-2"><Note tone="err">{exitVoidError(form.checkError)}</Note><ModalButton onClick={() => { void form.retry() }}>Thử lại</ModalButton></div>}
      {check?.message?.text && <Note tone={check.voidable ? 'warn' : 'err'}>{check.message.text}</Note>}
      {form.choices.selectionNotice && <Note tone="warn">{form.choices.selectionNotice}</Note>}
      {form.required.length > 0 && <div className="flex flex-col gap-2" aria-label="Chuồng cho từng con">
        {form.required.map((cow) => {
          const invalid = form.choices.invalidCodes.includes(cow.cattleCode)
          const warning = form.choices.criteria[cow.cattleId]
          return <div key={cow.cattleId} className={`flex flex-col gap-2 rounded-xl border p-3 ${invalid ? 'border-err-fg' : 'border-field'}`}>
            <div className="text-sm font-semibold">{cow.cattleCode}</div>
            <div className="text-xs text-muted">Chuồng cuối: {cow.lastPen ? `${cow.lastPen.penCode} (${cow.lastPen.active ? 'hết chỗ' : 'ngưng'})` : 'không có'}</div>
            <Field label={`Chuồng cho ${cow.cattleCode} *`} id={`exit-void-pen-${cow.cattleId}`}>
              <Select id={`exit-void-pen-${cow.cattleId}`} aria-label={`Chuồng cho ${cow.cattleCode}`} aria-invalid={invalid} disabled={form.loading || form.saving}
                value={form.choices.pens[cow.cattleId] ?? ''} onChange={(event) => form.changePen(cow.cattleId, Number(event.target.value))}>
                <option value="">Chọn chuồng</option>
                {form.optionsFor(cow.cattleId).map((pen) => <option key={pen.id} value={pen.id}>{form.occupancyLabel(pen)}</option>)}
              </Select>
            </Field>
            {warning !== undefined && <Field label={`Lý do cảnh báo ${cow.cattleCode} *`} id={`exit-void-warning-${cow.cattleId}`}>
              <textarea ref={(element) => { warningInputs.current[cow.cattleId] = element }} id={`exit-void-warning-${cow.cattleId}`} aria-label={`Lý do cảnh báo ${cow.cattleCode}`}
                aria-describedby={`exit-void-criteria-${cow.cattleId}`} aria-invalid={invalid} className={`${inputCls} resize-none`} rows={2} maxLength={MAX_REASON}
                value={form.choices.reasons[cow.cattleId] ?? ''} disabled={form.loading || form.saving} onChange={(event) => form.changeWarningReason(cow.cattleId, event.target.value)} />
              <span id={`exit-void-criteria-${cow.cattleId}`} className="text-xs text-err-fg">{warning}</span>
            </Field>}
          </div>
        })}
      </div>}
      {form.noPlaces && <Note tone="warn">Không còn chuồng ACTIVE đủ chỗ. Hãy mở thêm chuồng hoặc tăng sức chứa trước khi hủy.</Note>}
      <Field label="Lý do hủy *" id="exit-void-reason" hint={`Tối đa ${MAX_REASON} ký tự`}>
        <Textarea
          id="exit-void-reason"
          className="!leading-[normal] h-14"
          rows={1}
          maxLength={MAX_REASON}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Field>
      <Note>Chỉ Chủ trại hủy được phiếu đã xuất. Nếu chuồng cuối ngưng sử dụng hoặc không đủ chỗ, hệ thống yêu cầu chọn chuồng khác cho từng con trước khi hủy (MSG-FE13-09).</Note>
      <VoucherCommandError error={form.error} onReload={onReload} formatError={exitVoidError} />
      <ModalFooter>
        <ModalButton className="text-ink" disabled={form.saving} onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={!form.canSubmit} onClick={() => { void form.confirm() }}><Icon name="circle-x" />Hủy phiếu xuất</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
