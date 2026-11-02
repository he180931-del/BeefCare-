import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Badge, DateInput, ErrorBlock, Field, LoadingBlock, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { saveFeedSupplier } from '../api/feedCatalogueApi'
import { checkFeedReceiptVoid, recordFeedReceiptPayment, voidFeedReceipt } from '../api/feedReceiptApi'
import { formatDate, formatKg, formatMoney, formatVnd } from '../domain/feedLabels'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceiptDemoRecord } from '../types/feedReceiptDemo'

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** SCR-78/79: void a posted receipt. Allowed only while the stock of every feed covers the received quantity (GBR-99). */
export function FeedReceiptVoidDialog({ record, onClose, onDone }: { record: FeedReceiptDemoRecord; onClose: () => void; onDone: (record: FeedReceiptDemoRecord) => void }) {
  const check = useQuery(() => checkFeedReceiptVoid(record.id), [record.id])
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const rows = check.data ?? []
  const blocked = rows.some((row) => !row.ok)
  const totalKg = record.lines.reduce((sum, line) => sum + line.kgReceived, 0)

  const submit = async () => {
    if (!reason.trim()) { setError('Lý do hủy là bắt buộc.'); return }
    setSaving(true)
    setError('')
    try {
      const voided = await voidFeedReceipt(record.id, reason.trim(), record.version)
      if (voided) onDone(voided)
    } catch (voidError) {
      setError(userFacingError(voidError, 'Không thể hủy phiếu. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Hủy phiếu nhập kho ${record.code}`}
      sub={`${formatDate(record.receiptDate)} · ${record.supplierName} · ${record.lines.length} mặt hàng · ${formatKg(totalKg, 0)}`}
      topTitle="Hủy phiếu nhập kho"
      width={640}
      onClose={onClose}
    >
      <h3 className="m-0 text-sm font-semibold">Kiểm tra trước khi hủy</h3>
      {check.loading && !check.data && <LoadingBlock>Đang kiểm tra tồn kho…</LoadingBlock>}
      {check.error ? <ErrorBlock message={userFacingError(check.error, 'Không kiểm tra được tồn kho.')} onRetry={() => check.refetch()} /> : null}
      {rows.length > 0 && (
        <Table scroll stack={false}>
          <thead><tr><Th>Thức ăn</Th><Th>Tồn hiện tại / cần trừ</Th><Th>Kết quả</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feedItemId}>
                <Td className="font-medium">{row.code} {row.name}</Td>
                <Td className="whitespace-nowrap">{formatKg(row.onHandKg, 0)} / {formatKg(row.neededKg, 0)}</Td>
                <Td><Badge tone={row.ok ? 'ok' : 'err'} icon={row.ok ? 'circle-x' : undefined}>{row.ok ? 'Hủy được' : 'Không đủ tồn'}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <h3 className="m-0 text-sm font-semibold">Khi xác nhận hủy</h3>
      {blocked ? (
        <div role="alert" className="rounded-md bg-err-bg px-3 py-2.5 text-xs text-err-fg">
          Tồn kho không còn đủ để trừ lại số đã nhập. Hãy lập phiếu điều chỉnh kho thay vì hủy phiếu.
        </div>
      ) : (
        <div className="rounded-md bg-ok-bg px-3 py-2.5 text-xs text-ok-fg">
          ✓ Trừ lại tồn kho theo số lượng của phiếu, theo giá bình quân hiện tại
        </div>
      )}
      {record.amountPaid > 0 && (
        <div className="rounded-md bg-warn-bg px-3 py-2.5 text-xs text-warn-fg">
          ! Khoản đã trả {formatVnd(record.amountPaid)} vẫn giữ trong lịch sử; hoàn tiền xử lý ngoài hệ thống
        </div>
      )}
      <Field label="Lý do hủy *" id="feed-receipt-void-reason">
        <Textarea id="feed-receipt-void-reason" value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="Ví dụ: Nhập trùng phiếu" />
      </Field>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={saving || blocked || check.loading} onClick={() => void submit()}>
          <span className="inline-flex items-center gap-2"><Icon name="circle-x" size={16} />{saving ? 'Đang hủy…' : 'Hủy phiếu nhập kho'}</span>
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** Popup "Record Voucher Payment" (UC-FE23-02 AF2): amount must not exceed what is still owed (GBR-91). */
export function FeedReceiptPaymentDialog({ record, onClose, onDone }: { record: FeedReceiptDemoRecord; onClose: () => void; onDone: (record: FeedReceiptDemoRecord) => void }) {
  const outstanding = record.totalPayable - record.amountPaid
  const [amount, setAmount] = useState(String(outstanding))
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [date, setDate] = useState(localToday())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const value = Number(amount)
    if (!Number.isInteger(value) || value <= 0) { setError('Số tiền phải là số nguyên lớn hơn 0.'); return }
    if (value > outstanding) { setError(`Số tiền không được vượt quá ${formatMoney(outstanding)} đ.`); return }
    setSaving(true)
    setError('')
    try {
      onDone(await recordFeedReceiptPayment(record.id, value, method, date))
    } catch (paymentError) {
      setError(userFacingError(paymentError, 'Không thể ghi khoản trả. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Ghi trả nhà cung cấp" sub={`${record.code} · còn nợ ${formatVnd(outstanding)}`} width={560} onClose={onClose}>
      <Field label="Số tiền (đ) *" id="feed-payment-amount">
        <input id="feed-payment-amount" type="number" min="1" step="1" value={amount} onChange={(event) => { setAmount(event.target.value); setError('') }} className={inputCls} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phương thức" id="feed-payment-method">
          <Select id="feed-payment-method" value={method} onChange={(event) => setMethod(event.target.value === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH')}>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
          </Select>
        </Field>
        <Field label="Ngày trả *" id="feed-payment-date"><DateInput id="feed-payment-date" value={date} onChange={setDate} /></Field>
      </div>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang ghi…' : 'Ghi khoản trả'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** UC-FE23-02 AF4: add a supplier inline (name, phone). */
export function FeedSupplierQuickDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (supplier: FeedSupplier) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Tên nhà cung cấp là bắt buộc.'); return }
    setSaving(true)
    setError('')
    try {
      onAdded(await saveFeedSupplier({ name, phone, area: '', note: '' }))
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu nhà cung cấp.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Thêm nhà cung cấp" sub="Nhà cung cấp được lưu trong danh bạ đối tác của trại" width={560} onClose={onClose}>
      <Field label="Tên nhà cung cấp *" id="feed-supplier-name"><input id="feed-supplier-name" maxLength={150} value={name} onChange={(event) => { setName(event.target.value); setError('') }} className={inputCls} /></Field>
      <Field label="Điện thoại" id="feed-supplier-phone"><input id="feed-supplier-phone" maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} /></Field>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lưu nhà cung cấp'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
