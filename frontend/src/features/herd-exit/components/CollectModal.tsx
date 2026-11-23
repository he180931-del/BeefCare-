import { DateInput, Field, Info, inputCls, Modal, ModalButton, ModalFooter, Note, Radio } from '../../../shared/ui'
import { money } from '../../../shared/lib/format'
import { DocRow } from './parts'
import { MoneyInput } from '../../../shared/ui'
import type { HerdExit } from '../types'
import { useExitCollection } from '../hooks/useExitCollection'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'

const METHODS = ['Tiền mặt', 'Chuyển khoản']
const displayError = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error'

export default function CollectModal({ row, onClose, onSaved, onReload }: { row: HerdExit; onClose: () => void; onSaved?: () => void; onReload: () => Promise<unknown> }) {
  const { defaults, collected, total, owed, date, setDate, amount, setAmount, method, setMethod, reference, setReference, showStatement, setShowStatement, note, setNote, valid, left, saving, error, save } = useExitCollection(row, onSaved, onClose)

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
          <MoneyInput value={amount} onChange={setAmount} formatWhileTyping />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
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
      <VoucherCommandError error={error} onReload={onReload} formatError={displayError} />
      <Note tone="info">
        Sau khi lưu: Còn phải thu = {money(left)} đ. Khoản thu ghi sai cần hủy kèm lý do, giữ lịch sử. Đây là sổ thu chi của trại, không phải hóa đơn thuế.
      </Note>
      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!valid || saving} onClick={() => { void save().catch(() => undefined) }}>Lưu khoản thu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
