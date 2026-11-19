import { useState } from 'react'
import { Badge, DateInput, Field, inputCls, KV, Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import { entryPaymentDefaults } from '../api/index'
import { money } from '../../../shared/lib/format'
import { RadioRow } from './parts'
import type { HerdEntry } from '../types'
import type { Payment } from '../../../types'

/**
 * Ghi nhận một khoản thanh toán cho phiếu nhập còn nợ. `record` là phiếu (có detail), `onSave(payment)`
 * nhận { date, by, method, ref, amount } để trang chi tiết ghi vào phiếu.
 */
export default function PayModal({ record, onSave, onClose }: { record: HerdEntry; onSave: (payment: Payment & { note?: string }) => void; onClose: () => void }) {
  const d = { sourceName: record.source, payments: [], ...record.detail }
  const total = record.total ?? 0
  const paid = d.payments?.reduce((s, p) => s + p.amount, 0) ?? 0
  const debt = record.debt ?? 0
  const [defaults] = useState(entryPaymentDefaults)
  const [date, setDate] = useState(defaults.date)
  const [amount, setAmount] = useState(debt)
  const [method, setMethod] = useState('Chuyển khoản')
  const [ref, setRef] = useState(defaults.ref)
  const [note, setNote] = useState(defaults.note)
  const [file, setFile] = useState(defaults.statement)

  const over = amount > debt
  const invalid = amount <= 0 || over || !date
  const projectedPaid = Math.min(total, paid + Math.max(amount, 0))
  const remaining = Math.max(total - projectedPaid, 0)

  return (
    <Modal
      width={600}
      title={`Ghi nhận thanh toán – ${record.id}`}
      sub={`Trả tiền cho nguồn bán: ${d.sourceName}`}
      topTitle="Ghi nhận thanh toán phiếu nhập"
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-4">
        <KV k="Tổng phải trả">{money(total)} đ</KV>
        <KV k="Đã thanh toán">{money(paid)} đ</KV>
        <KV k="Còn nợ">{money(debt)} đ</KV>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ngày thanh toán *">
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field label="Số tiền (đ) *" hint={over ? <span className="text-err-fg">{`Số tiền thanh toán vượt tổng phải trả (${money(debt)} đ còn lại)`}</span> : 'Không vượt số còn phải trả'}>
          <input
            inputMode="numeric"
            className={`${inputCls} ${over ? 'border-err-fg' : ''}`}
            value={money(amount)}
            onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink">Phương thức *</span>
        <RadioRow name="pay-method" value={method} options={['Tiền mặt', 'Chuyển khoản']} onChange={setMethod} />
      </div>

      <Field label="Số tham chiếu / nội dung chuyển khoản">
        <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} />
      </Field>

      {file && (
        <div className="flex items-center gap-2.5 rounded-xl border border-field bg-page px-3 py-2.5">
          <Badge>JPG</Badge>
          <span className="text-xs font-semibold">uy-nhiem-chi-2210.jpg</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setFile(false)} className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-err-fg">Xóa</button>
        </div>
      )}

      <Field label="Ghi chú">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <Note tone="info">
        {remaining > 0
          ? `Sau khi lưu: Còn nợ = ${money(remaining)} đ. Khoản đã ghi chỉ sửa/hủy kèm lý do và giữ lịch sử. Đây là sổ thu chi của trại, không phải hóa đơn thuế.`
          : 'Sau khi lưu: Còn nợ = 0 đ, phiếu hiện "Đã thanh toán đủ". Khoản đã ghi chỉ sửa/hủy kèm lý do và giữ lịch sử.'}
      </Note>

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={invalid} onClick={() => onSave({ date, by: defaults.by, method, ref, amount, note })}>
          Lưu thanh toán
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
