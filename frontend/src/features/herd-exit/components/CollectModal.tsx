import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { DateInput, Field, Info, Note, Radio, inputCls } from '../../../components/ui'
import { herdExitApi } from '../api/index'
import { useMutation } from '../../../hooks/useApi'
import { TODAY } from '../data/exportsData'
import { dmy, money } from '../../../data/format'
import { DocRow, MoneyInput } from './parts'
import type { HerdExit } from '../../../types'

const METHODS = ['Tiền mặt', 'Chuyển khoản']
const displayError = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error'

export default function CollectModal({ row, onClose, onSaved }: { row: HerdExit; onClose: () => void; onSaved?: () => void }) {
  const { mutate: recordPayment, loading: saving, error } = useMutation<{ id: string; payment: { date: string; amount: number; method: string; ref: string; note?: string } }, HerdExit>(({ id, payment }) => herdExitApi.recordPayment(id, payment))
  const payments = row.detail?.payments ?? []
  const collected = payments.reduce((s, p) => s + p.amount, 0)
  const total = row.total
  const owed = row.due ?? 0
  const [date, setDate] = useState(TODAY)
  const [amount, setAmount] = useState(owed)
  const [method, setMethod] = useState('Chuyển khoản')
  const [reference, setReference] = useState('MBVCB.8841207 · LO MO HA DONG TT PX-2026-0007')
  const [showStatement, setShowStatement] = useState(true)
  const [note, setNote] = useState('Thu đủ phần còn lại')

  const valid = amount > 0 && amount <= owed
  const left = owed - amount

  const save = async () => {
    await recordPayment({
      id: row.id,
      payment: { date, method, ref: method === 'Tiền mặt' ? 'PT-2210-01' : reference, amount, note },
    })
    onSaved?.()
    onClose()
  }

  return (
    <Modal width={600} title={`Ghi nhận thu tiền – ${row.id}`} sub={`Thu tiền từ người mua: ${row.detail?.buyer ?? row.who}`} topTitle="Ghi nhận thu tiền phiếu xuất" onClose={onClose}>
      <Info
        items={[
          ['Tổng phải thu', `${money(total)} đ`],
          ['Đã thu', `${money(collected)} đ`],
          ['Còn phải thu', `${money(owed)} đ`],
        ]}
      />
      <div className="grid grid-cols-2 gap-4 -mt-2">
        <Field label="Ngày thu *"><DateInput value={date} onChange={setDate} /></Field>
        <Field label="Số tiền (đ) *" hint={valid ? 'Không vượt số còn phải thu' : 'Số tiền phải lớn hơn 0 và không vượt số còn phải thu'}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
      </div>
      <div className="-mt-2 flex flex-col gap-2">
        <span className="text-xs font-medium text-ink">Phương thức *</span>
        <div className="flex gap-[18px]">
          {METHODS.map((m) => (
            <Radio key={m} name="method" checked={method === m} onChange={() => setMethod(m)}>{m}</Radio>
          ))}
        </div>
      </div>
      {method === 'Chuyển khoản' && (
        <Field label="Số tham chiếu / nội dung chuyển khoản">
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      )}
      {method === 'Chuyển khoản' && showStatement && (
        <div className="-mt-2">
          <DocRow ext="PDF" name="sao-ke-2210.pdf" />
          <button type="button" className="ml-auto block cursor-pointer p-1 text-xs font-semibold text-err-fg" onClick={() => setShowStatement(false)}>Xóa</button>
        </div>
      )}
      <Field label="Ghi chú">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {Boolean(error) && <Note tone="err">{displayError(error)}</Note>}
      <Note tone="info">
        Sau khi lưu: Còn phải thu = {money(left)} đ. Khoản thu đã ghi chỉ sửa/hủy kèm lý do, giữ lịch sử. Đây là sổ thu chi của trại, không phải hóa đơn thuế.
      </Note>
      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!valid || saving} onClick={save}>Lưu khoản thu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
