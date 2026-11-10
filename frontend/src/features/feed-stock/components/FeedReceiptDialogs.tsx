import { useRef, useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Badge, Button, DateInput, Dropzone, ErrorBlock, Field, LoadingBlock, Note, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { saveFeedSupplier } from '../api/feedCatalogueApi'
import { checkFeedReceiptVoid, discardFeedReceiptDraft, recordFeedReceiptPayment, uploadFeedReceiptPaymentAttachment, voidFeedReceipt, voidFeedReceiptPayment } from '../api/feedReceiptApi'
import { formatDate, formatKg, formatMoney, formatVnd } from '../domain/feedLabels'
import { feedReceiptError } from '../domain/feedReceiptErrors'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceipt, FeedReceiptPayment, FeedReceiptPaymentResult } from '../types/feedReceipt'

const newCommandKey = () => globalThis.crypto?.randomUUID?.() ?? `feed-receipt:${Date.now()}:${Math.random().toString(36).slice(2)}`

export function FeedReceiptDiscardDialog({ record, onClose, onDone }: { record: FeedReceipt; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const commandKey = useRef('')

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      if (!commandKey.current) commandKey.current = newCommandKey()
      await discardFeedReceiptDraft(record.id, record.version, { key: commandKey.current })
      onDone()
    } catch (discardError) {
      setError(feedReceiptError(discardError, 'Không thể bỏ nháp phiếu nhập.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Bỏ nháp ${record.code}?`} sub="Tồn kho chưa thay đổi." width={520} onClose={onClose}>
      <p className="m-0 text-sm">Phiếu nháp và chứng từ đính kèm của phiếu sẽ bị xóa. Không thể khôi phục thao tác này.</p>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Giữ lại phiếu</ModalButton>
        <ModalButton variant="danger" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang bỏ nháp…' : 'Bỏ nháp phiếu'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** SCR-78/79: void a posted receipt. Allowed only while the stock of every feed covers the received quantity (GBR-99). */
export function FeedReceiptVoidDialog({ record, onClose, onDone }: { record: FeedReceipt; onClose: () => void; onDone: (record: FeedReceipt) => void }) {
  const check = useQuery(() => checkFeedReceiptVoid(record.id), [record.id])
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const commandKey = useRef('')
  const rows = check.data ?? []
  const blocked = rows.some((row) => !row.ok)
  const totalKg = record.lines.reduce((sum, line) => sum + line.kgReceived, 0)

  const submit = async () => {
    if (!reason.trim()) { setError('Lý do hủy là bắt buộc.'); return }
    setSaving(true)
    setError('')
    try {
      if (!commandKey.current) commandKey.current = newCommandKey()
      const voided = await voidFeedReceipt(record.id, reason.trim(), record.version, { key: commandKey.current })
      onDone(voided)
    } catch (voidError) {
      setError(feedReceiptError(voidError, 'Không thể hủy phiếu. Vui lòng thử lại.'))
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
      {check.error ? <ErrorBlock message={feedReceiptError(check.error, 'Không kiểm tra được tồn kho.')} onRetry={() => check.refetch()} /> : null}
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
      {(record.amountPaid ?? 0) > 0 && (
        <div className="rounded-md bg-warn-bg px-3 py-2.5 text-xs text-warn-fg">
          ! Khoản đã trả {formatVnd(record.amountPaid ?? 0)} vẫn giữ trong lịch sử; hoàn tiền xử lý ngoài hệ thống
        </div>
      )}
      <Field label="Lý do hủy *" id="feed-receipt-void-reason">
        <Textarea id="feed-receipt-void-reason" value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); setError(''); commandKey.current = '' }} placeholder="Ví dụ: Nhập trùng phiếu" />
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
export function FeedReceiptPaymentDialog({ record, onClose, onDone, allowAttachments = backendMode === 'backend' }: { record: FeedReceipt; onClose: () => void; onDone: (result: FeedReceiptPaymentResult) => void; allowAttachments?: boolean }) {
  const outstanding = record.outstanding ?? record.totalPayable - (record.amountPaid ?? 0)
  const [amount, setAmount] = useState(String(outstanding))
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [date, setDate] = useState(localToday())
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const commandKey = useRef('')
  const attachmentKey = useRef('')
  const savedPayment = useRef<FeedReceiptPaymentResult | null>(null)

  const finish = (result: FeedReceiptPaymentResult) => {
    onDone(result)
  }

  const submit = async () => {
    if (!savedPayment.current) {
      const value = Number(amount)
      if (!Number.isInteger(value) || value <= 0) { setError('Số tiền phải là số nguyên lớn hơn 0.'); return }
      if (value > outstanding) { setError(`Số tiền không được vượt quá ${formatMoney(outstanding)} đ.`); return }
      if (!date || date < record.receiptDate || date > localToday()) { setError('Ngày trả phải từ ngày nhập đến hôm nay.'); return }
      if (reference.length > 100 || note.length > 500) { setError('Nội dung chuyển khoản tối đa 100 ký tự; ghi chú tối đa 500 ký tự.'); return }
    }
    setSaving(true)
    setError('')
    try {
      let result = savedPayment.current
      if (!result) {
        if (!commandKey.current) commandKey.current = newCommandKey()
        result = await recordFeedReceiptPayment(record.id, { amount: Number(amount), method, date, reference, note }, { key: commandKey.current })
        const recordedPayment = result.payment
        if (recordedPayment && !result.payments?.some((row) => row.id === recordedPayment.id)) {
          result = { ...result, payments: [...(result.payments ?? []), recordedPayment] }
        }
        savedPayment.current = result
      }
      if (attachment) {
        if (!attachmentKey.current) attachmentKey.current = newCommandKey()
        const payment = result.payment
        if (!payment) throw new Error('Khoản trả đã được gửi nhưng máy chủ chưa trả mã khoản trả; tệp đính kèm chưa tải lên.')
        const uploaded = await uploadFeedReceiptPaymentAttachment(record.id, payment.id, attachment, { key: attachmentKey.current })
        const withAttachment = { ...payment, attachments: [...(payment.attachments ?? []), uploaded] }
        result = {
          ...result,
          payment: withAttachment,
          payments: result.payments?.map((row) => row.id === payment.id ? withAttachment : row) ?? [withAttachment],
        }
      }
      finish(result)
    } catch (paymentError) {
      const saved = savedPayment.current
      setError(saved
        ? `Khoản trả đã được ghi; chứng từ chưa tải lên. Thử lại để chỉ gửi chứng từ, hoặc hoàn tất khoản trả không kèm tệp. ${feedReceiptError(paymentError, 'Tải chứng từ thất bại.')}`
        : feedReceiptError(paymentError, 'Không thể ghi khoản trả. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const chooseAttachment = (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (savedPayment.current) { setError('Khoản trả đã ghi; hãy tải lại đúng tệp đã chọn hoặc hoàn tất không kèm tệp.'); return }
    if (!['application/pdf', 'image/jpeg'].includes(file.type)) { setError('Chỉ chấp nhận tệp PDF hoặc JPG.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Tệp đính kèm không được vượt quá 10 MB.'); return }
    setAttachment(file)
    attachmentKey.current = ''
    setError('')
  }

  const close = () => {
    if (savedPayment.current && attachment) {
      setError('Khoản trả đã được ghi. Hãy thử tải chứng từ lại hoặc chọn “Hoàn tất không kèm chứng từ”.')
      return
    }
    onClose()
  }

  return (
    <Modal title="Ghi trả nhà cung cấp" sub={`${record.code} · còn nợ ${formatVnd(outstanding)}`} width={560} onClose={close}>
      <Note tone="info">Có thể đính kèm biên lai PDF/JPG tối đa 10 MB. Nếu tải tệp lỗi sau khi ghi khoản trả, khoản trả vẫn được lưu và có thể thử tải tệp lại.</Note>
      <Field label="Số tiền (đ) *" id="feed-payment-amount">
        <input id="feed-payment-amount" type="number" min="1" step="1" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); commandKey.current = '' }} className={inputCls} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phương thức" id="feed-payment-method">
          <Select id="feed-payment-method" value={method} onChange={(event) => { setMethod(event.target.value === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH'); commandKey.current = '' }}>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
          </Select>
        </Field>
        <Field label="Ngày trả *" id="feed-payment-date"><DateInput id="feed-payment-date" value={date} onChange={(value) => { setDate(value); setError(''); commandKey.current = '' }} /></Field>
      </div>
      <Field label="Mã / nội dung chuyển khoản" id="feed-payment-reference">
        <input id="feed-payment-reference" maxLength={100} value={reference} onChange={(event) => { setReference(event.target.value); setError(''); commandKey.current = '' }} className={inputCls} />
      </Field>
      <Field label="Ghi chú" id="feed-payment-note">
        <Textarea id="feed-payment-note" maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setError(''); commandKey.current = '' }} />
      </Field>
      {allowAttachments && !savedPayment.current && <Dropzone hint="Biên lai chuyển khoản / phiếu thu · PDF hoặc JPG · tối đa 10 MB" multiple={false} onFiles={chooseAttachment} />}
      {attachment && <div className="flex items-center gap-2 text-xs"><Badge>{attachment.type === 'application/pdf' ? 'PDF' : 'JPG'}</Badge><span>{attachment.name} · {(attachment.size / 1024).toFixed(0)} KB</span>{!savedPayment.current && <Button variant="link" size="sm" onClick={() => { setAttachment(null); attachmentKey.current = '' }}>Bỏ tệp</Button>}</div>}
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        {savedPayment.current && attachment
          ? <ModalButton onClick={() => finish(savedPayment.current!)}>Hoàn tất không kèm chứng từ</ModalButton>
          : <ModalButton onClick={close}>Đóng</ModalButton>}
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang ghi…' : savedPayment.current ? 'Thử tải chứng từ lại' : 'Ghi khoản trả'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

export function FeedReceiptPaymentVoidDialog({ receiptId, payment, onClose, onDone }: {
  receiptId: number
  payment: FeedReceiptPayment
  onClose: () => void
  onDone: (result: FeedReceiptPaymentResult) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const commandKey = useRef('')

  const submit = async () => {
    if (!reason.trim()) { setError('Lý do hủy khoản trả là bắt buộc.'); return }
    setSaving(true)
    setError('')
    try {
      if (!commandKey.current) commandKey.current = newCommandKey()
      onDone(await voidFeedReceiptPayment(receiptId, payment.id, reason.trim(), payment.version ?? undefined, { key: commandKey.current }))
    } catch (voidError) {
      setError(feedReceiptError(voidError, 'Không thể hủy khoản trả. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Hủy khoản trả nhà cung cấp" sub={`${payment.paymentDate} · ${formatVnd(payment.amount)}`} width={560} onClose={onClose}>
      <p className="m-0 text-xs text-muted">Khoản trả sẽ được giữ trong lịch sử với trạng thái đã hủy. Muốn ghi lại, hãy tạo khoản trả mới.</p>
      <Field label="Lý do hủy *" id="feed-payment-void-reason">
        <Textarea id="feed-payment-void-reason" maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); setError(''); commandKey.current = '' }} />
      </Field>
      {error && <div role="alert" className="text-xs text-err-fg">{error}</div>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang hủy…' : 'Hủy khoản trả'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** UC-FE23-02 AF4: add a supplier inline (name, phone). */
export function FeedSupplierQuickDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (supplier: FeedSupplier) => void | Promise<void> }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Tên nhà cung cấp là bắt buộc.'); return }
    setSaving(true)
    setError('')
    try {
      await onAdded(await saveFeedSupplier({ name, phone, area: '', note: '' }))
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
