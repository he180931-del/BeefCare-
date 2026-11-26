import { useState } from 'react'
import { Badge, MoneyInput, DateInput, Field, inputCls, KV, Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import { entryPaymentDefaults } from '../api/index'
import { money } from '../../../shared/lib/format'
import { RadioRow } from './parts'
import type { EntryPayment, HerdEntry } from '../types'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import { entryPaymentTotals } from '../domain/entryPaymentTotals'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { PAYMENT_NOTE_MAX, PAYMENT_REF_MAX, validateEntryPayment, type EntryPaymentErrors } from '../validation/entryPaymentValidation'

/**
 * Ghi nhận một khoản thanh toán cho phiếu nhập còn nợ. `record` là phiếu (có detail), `onSave(payment)`
 * nhận { date, by, method, ref, amount } để trang chi tiết ghi vào phiếu.
 */
type PaymentInput = EntryPayment & { note?: string }
type DraftPayment = {
  freight: number
  cattleAmount: number
  onSave: (freight: number, payment: PaymentInput) => void
}

export default function PayModal({ record, onSave, draftPayment, onClose, error, saving, onReload }: {
  record: HerdEntry
  onSave?: (payment: PaymentInput) => void | Promise<void>
  draftPayment?: DraftPayment
  onClose: () => void
  error?: unknown
  saving?: boolean
  onReload?: () => Promise<unknown>
}) {
  const d = { sourceName: record.source, payments: [], ...record.detail }
  const { paid, outstanding } = entryPaymentTotals(record)
  const [freight, setFreight] = useState(draftPayment?.freight ?? 0)
  const total = draftPayment ? draftPayment.cattleAmount + freight : record.total ?? 0
  const debt = draftPayment ? Math.max(total - paid, 0) : outstanding
  const [defaults] = useState(entryPaymentDefaults)
  const [date, setDate] = useState(defaults.date)
  const [amount, setAmount] = useState(draftPayment ? paid : debt)
  const [method, setMethod] = useState(draftPayment && d.payments[0]?.method ? d.payments[0].method : 'Chuyển khoản')
  const [ref, setRef] = useState(defaults.ref)
  const [note, setNote] = useState(defaults.note)
  const [file, setFile] = useState(defaults.statement)

  const [submitted, setSubmitted] = useState(false)

  const ceiling = draftPayment ? total : debt
  const over = amount > ceiling
  // Draft payment card (SCR-24) keeps its own rules; a recorded payment follows R-06-17.
  const errors: EntryPaymentErrors = draftPayment ? {} : validateEntryPayment({ date, amount, ref, note }, { today: businessDate(), voucherDate: record.date, outstanding: debt })
  const shown = (field: keyof EntryPaymentErrors) => (submitted || (field === 'amount' && over)) ? errors[field] : undefined
  const invalid = draftPayment ? over || (amount > 0 && !date) : Object.keys(errors).length > 0
  const remaining = Math.max(ceiling - amount, 0)
  const save = () => {
    setSubmitted(true)
    if (invalid) return
    const payment = { date, by: defaults.by, method, ref, amount, note }
    if (draftPayment) draftPayment.onSave(freight, payment)
    else void Promise.resolve(onSave?.(payment)).catch(() => undefined)
  }
  const errorHint = (message?: string) => message ? <span className="text-err-fg">{message}</span> : undefined

  return (
    <Modal
      width={600}
      title={`Ghi thanh toán – ${record.id}`}
      sub={`Người bán: ${d.sourceName || '—'}`}
      topTitle="Ghi nhận thanh toán phiếu nhập"
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-4">
        <KV k="Tổng phải trả">{money(total)} đ</KV>
        <KV k="Đã thanh toán">{money(paid)} đ</KV>
        <KV k="Còn nợ">{money(debt)} đ</KV>
      </div>

      {draftPayment && (
        <Field id="entry-payment-freight" label="Phí vận chuyển (đ)">
          <MoneyInput id="entry-payment-freight" value={freight} onChange={setFreight} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ngày thanh toán *" hint={errorHint(shown('date'))}>
          <DateInput label="Ngày thanh toán" value={date} onChange={setDate} />
        </Field>
        <Field label={draftPayment ? 'Số tiền (đ)' : 'Số tiền (đ) *'} hint={draftPayment
          ? (over ? errorHint(`Số tiền thanh toán vượt tổng phải trả (${money(ceiling)} đ còn lại)`) : 'Không vượt số còn phải trả')
          : errorHint(shown('amount')) ?? 'Không vượt số còn nợ'}>
          <MoneyInput aria-label="Số tiền (đ)" inputClassName={`${inputCls} ${over || shown('amount') ? 'border-err-fg' : ''}`} value={amount} onChange={setAmount} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink">Phương thức *</span>
        <RadioRow name="pay-method" value={method} options={['Tiền mặt', 'Chuyển khoản']} onChange={setMethod} />
      </div>

      <Field id="entry-payment-ref" label="Số tham chiếu / nội dung chuyển khoản" hint={errorHint(shown('ref'))}>
        <input id="entry-payment-ref" className={inputCls} maxLength={PAYMENT_REF_MAX} value={ref} onChange={(e) => setRef(e.target.value)} />
      </Field>

      {file && (
        <div className="flex items-center gap-2.5">
          <Badge>JPG</Badge>
          <span className="text-xs font-semibold">uy-nhiem-chi-2210.jpg</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setFile(false)} className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-err-fg">Xóa</button>
        </div>
      )}

      <Field id="entry-payment-note" label="Ghi chú" hint={errorHint(shown('note'))}>
        <input id="entry-payment-note" className={inputCls} maxLength={PAYMENT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <Note tone="info">
        {remaining > 0
          ? `Sau khi lưu: Còn nợ = ${money(remaining)} đ. Khoản ghi sai cần hủy kèm lý do và giữ lịch sử. Đây là sổ thu chi của trại, không phải hóa đơn thuế.`
          : 'Sau khi lưu: Còn nợ = 0 đ, phiếu hiện "Đã thanh toán đủ". Khoản ghi sai cần hủy kèm lý do và giữ lịch sử.'}
      </Note>

      {onReload && <VoucherCommandError error={error} onReload={onReload} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={(draftPayment ? invalid : submitted && invalid) || saving} onClick={save}>
          Lưu thanh toán
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
