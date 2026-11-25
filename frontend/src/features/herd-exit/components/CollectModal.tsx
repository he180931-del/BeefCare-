import type { ReactNode } from 'react'
import { DateInput, Field, Info, inputCls, Modal, ModalButton, ModalFooter, Note, Radio } from '../../../shared/ui'
import { money } from '../../../shared/lib/format'
import { MoneyInput } from '../../../shared/ui'
import type { HerdExit } from '../types'
import { MAX_NOTE, MAX_REFERENCE, useExitCollection } from '../hooks/useExitCollection'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'

const METHODS = ['Tiền mặt', 'Chuyển khoản']
const displayError = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error'
const FieldError = ({ id, children }: { id: string; children?: ReactNode }) => children ? <span id={id} role="alert" className="text-[11px] text-err-fg">{children}</span> : null

/** Popup "Ghi thu tiền" dùng chung (FE-06 §6, UC-FE13-04). Tệp đính kèm khoản thu (#7) chưa có API cho phiếu xuất. */
export default function CollectModal({ row, onClose, onSaved, onReload }: { row: HerdExit; onClose: () => void; onSaved?: (message: string) => void; onReload: () => Promise<unknown> }) {
  const { collected, total, owed, date, setDate, amount, setAmount, method, setMethod, reference, setReference, note, setNote, errors, left, saving, error, save } = useExitCollection(row, onSaved, onClose)
  const buyer = row.detail?.buyer || row.who

  return (
    <Modal width={600} title={`Ghi thu tiền – ${row.id}`} sub={buyer ? `Thu tiền từ người mua: ${buyer}` : undefined} topTitle="Ghi thu tiền phiếu xuất" onClose={saving ? () => undefined : onClose}>
      <Info
        items={[
          ['Tổng phải thu', `${money(total)} đ`],
          ['Đã thu', `${money(collected)} đ`],
          ['Còn phải thu', `${money(owed)} đ`],
        ]}
      />
      <div className="grid grid-cols-1 gap-4 -mt-2 sm:grid-cols-2">
        <Field label="Ngày thu *">
          <DateInput label="Chọn ngày thu" value={date} onChange={setDate} />
          <FieldError id="collect-date-error">{errors.date}</FieldError>
        </Field>
        <Field label="Số tiền (đ) *" hint={errors.amount ? undefined : 'Không vượt số còn phải thu'}>
          <MoneyInput value={amount} onChange={setAmount} formatWhileTyping />
          <FieldError id="collect-amount-error">{errors.amount}</FieldError>
        </Field>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Hình thức">
        <span className="text-xs font-medium text-ink">Hình thức *</span>
        <div className="flex gap-[18px]">
          {METHODS.map((m) => (
            <Radio key={m} name="method" checked={method === m} onChange={() => setMethod(m)}>{m}</Radio>
          ))}
        </div>
        <FieldError id="collect-method-error">{errors.method}</FieldError>
      </div>
      <Field label="Tham chiếu" id="collect-reference" hint={`Tối đa ${MAX_REFERENCE} ký tự`}>
        <input id="collect-reference" className={inputCls} maxLength={MAX_REFERENCE} value={reference}
          placeholder={method === 'Tiền mặt' ? 'Số phiếu thu' : 'Mã giao dịch / nội dung chuyển khoản'} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Field label="Ghi chú" id="collect-note" hint={`Tối đa ${MAX_NOTE} ký tự`}>
        <input id="collect-note" className={inputCls} maxLength={MAX_NOTE} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <VoucherCommandError error={error} onReload={onReload} formatError={displayError} />
      <Note tone="info">
        Sau khi lưu: Còn phải thu = {money(left)} đ. Khoản thu đã ghi chỉ hủy được kèm lý do và vẫn nằm trong lịch sử. Đây là sổ tiền của trại, không phải hóa đơn thuế.
      </Note>
      <ModalFooter>
        <ModalButton className="text-ink" disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => { void save().catch(() => undefined) }}>Lưu khoản thu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
