import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, DateInput, Docs, Dropzone, Field, Foot, Info, Note, PageHeader, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStock } from '../api/feedStockApi'
import { listFeedSuppliers } from '../api/feedCatalogueApi'
import { createAndPostFeedReceipt, downloadFeedReceiptAttachment, downloadFeedReceiptPaymentAttachment, getFeedReceipt, listFeedReceiptAttachments, listFeedReceipts, postFeedReceipt, removeFeedReceiptAttachment, saveFeedReceiptDraft, uploadFeedReceiptAttachment } from '../api/feedReceiptApi'
import {
  blankFeedReceiptLine,
  initialFeedReceiptForm,
  todayIso,
  toFeedReceiptDraftInput,
  validateFeedReceiptForm,
  type FeedReceiptFormLine,
  type FeedReceiptFormValues,
} from '../data/feedReceiptForm'
import { deriveFeedStockStatus } from '../domain/feedStockStatus'
import { feedReceiptError } from '../domain/feedReceiptErrors'
import { feedGroupLabel, formatDate, formatKg, formatMoney, formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceipt, FeedReceiptAttachment, FeedReceiptPayment, FeedReceiptPaymentResult } from '../types/feedReceipt'
import type { FeedReceiptDemoRecord } from '../types/feedReceiptDemo'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { FeedReceiptAudit } from '../components/FeedReceiptAudit'
import { FeedReceiptDiscardDialog, FeedReceiptPaymentDialog, FeedReceiptPaymentVoidDialog, FeedReceiptVoidDialog, FeedSupplierQuickDialog } from '../components/FeedReceiptDialogs'

const FOOT = 'Tạo phiếu nhập kho thức ăn (Chủ trại, Quản lý). “Lưu nháp” chưa cộng kho; “Lưu & cộng kho” cộng tồn từng thức ăn và cập nhật giá nhập bình quân. Số lô và hạn dùng dùng để cảnh báo lô sắp hết hạn; phần còn nợ được theo dõi như công nợ nhà cung cấp.'
const TITLE = 'Thức ăn › Phiếu nhập kho'
const newReceiptCommandKey = () => globalThis.crypto?.randomUUID?.() ?? `feed-receipt:${Date.now()}:${Math.random().toString(36).slice(2)}`

const withPaymentResult = (receipt: FeedReceipt, result: FeedReceiptPaymentResult): FeedReceipt => ({
  ...receipt,
  amountPaid: result.summary.paid,
  outstanding: result.summary.outstanding,
  payments: result.payments ?? receipt.payments,
})

const unitText = (unit: string | undefined, kgPer: number | undefined) => (!unit || unit.toLocaleLowerCase('vi') === 'kg') ? 'kg' : `${unit.toLocaleLowerCase('vi')} ${formatNumber(kgPer ?? 1)} kg`

function lineKg(line: FeedReceiptFormLine, feed?: { kgPerPurchaseUnit?: number; purchaseUnit?: string } | null) {
  const amount = Number(line.quantityPurchase)
  const unit = line.purchaseUnit.trim().toLocaleLowerCase('vi')
  const purchaseUnit = feed?.purchaseUnit?.trim().toLocaleLowerCase('vi')
  const conversion = unit !== 'kg' && purchaseUnit && unit === purchaseUnit ? feed?.kgPerPurchaseUnit ?? 1 : 1
  return Number.isFinite(amount) ? amount * conversion : 0
}

function lineAmount(line: FeedReceiptFormLine) {
  const quantity = Number(line.quantityPurchase)
  const price = Number(line.unitPrice)
  return Number.isFinite(quantity) && Number.isFinite(price) ? Math.round(quantity * price) : 0
}

const STATUS_BADGE: Record<string, { label: string; tone: 'info' | 'ok' | 'outline'; icon?: 'pencil' | 'circle-check' }> = {
  DRAFT: { label: 'NHÁP', tone: 'info', icon: 'pencil' },
  POSTED: { label: 'ĐÃ GHI', tone: 'info', icon: 'pencil' },
  VOIDED: { label: 'ĐÃ HỦY', tone: 'outline' },
}

function nextReceiptCode(codes: readonly string[]) {
  const prefix = `PNK-${new Date().getFullYear()}-`
  const max = Math.max(0, ...codes.filter((code) => code.startsWith(prefix)).map((code) => Number(code.slice(prefix.length)) || 0))
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export default function FeedReceiptFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialFeedItemId = searchParams.get('feedItemId') ?? ''
  const formQuery = useQuery(async () => {
    const [stock, suppliers, receipt, receipts, attachments] = await Promise.all([
      listFeedStock(),
      listFeedSuppliers(),
      id ? getFeedReceipt(id) : Promise.resolve(null),
      listFeedReceipts(),
      id ? listFeedReceiptAttachments(Number(id)) : Promise.resolve([] as FeedReceiptAttachment[]),
    ])
    return { stock, suppliers, receipt, attachments, nextCode: backendMode === 'backend' ? 'Tự sinh khi lưu' : nextReceiptCode(receipts.map((row) => row.code)) }
  }, [id, initialFeedItemId])

  if (formQuery.error) {
    return (
      <Layout title={TITLE} user="manager">
        <div role="alert" className="text-sm text-err-fg">{feedReceiptError(formQuery.error, 'Không thể mở phiếu nhập kho.')}</div>
        <div><Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại danh sách</Button></div>
      </Layout>
    )
  }

  if (formQuery.loading || !formQuery.data) {
    return (
      <Layout title={TITLE} user="manager">
        <p role="status" className="m-0 text-xs text-muted">Đang tải phiếu…</p>
      </Layout>
    )
  }

  if (id && !formQuery.data.receipt) {
    return (
      <Layout title={TITLE} user="manager">
        <PageHeader title="Không tìm thấy phiếu nhập kho" />
        <div><Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại danh sách</Button></div>
      </Layout>
    )
  }

  return (
    <FeedReceiptForm
      key={id ?? `new-${initialFeedItemId}`}
      record={formQuery.data.receipt}
      stockRows={formQuery.data.stock}
      initialSuppliers={formQuery.data.suppliers}
      initialAttachments={formQuery.data.attachments}
      initialFeedItemId={initialFeedItemId}
      nextCode={formQuery.data.nextCode}
      onChanged={() => formQuery.refetch()}
    />
  )
}

function MoneyBox({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <div className="relative">
      <input id={id} aria-label={label} readOnly value={value} className={`${inputCls} pr-8`} />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">đ</span>
    </div>
  )
}

function CheckLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={`flex gap-2 text-xs ${ok ? 'text-ink' : 'text-err-fg'}`}>
      <span aria-hidden="true" className={`font-bold ${ok ? 'text-brand' : 'text-err-fg'}`}>{ok ? '✓' : '✗'}</span>
      <span>{children}</span>
    </div>
  )
}

function FeedReceiptForm({ record, stockRows, initialSuppliers, initialAttachments, initialFeedItemId, nextCode, onChanged }: {
  record: FeedReceipt | FeedReceiptDemoRecord | null
  stockRows: Awaited<ReturnType<typeof listFeedStock>>
  initialSuppliers: FeedSupplier[]
  initialAttachments: FeedReceiptAttachment[]
  initialFeedItemId: string
  nextCode: string
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const [modal, openModal, closeModal] = useModalParam()
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [values, setValues] = useState<FeedReceiptFormValues>(() => {
    const initial = initialFeedReceiptForm(record, initialFeedItemId)
    if (!record && initialFeedItemId) {
      const feed = stockRows.find((row) => row.feedItemId === Number(initialFeedItemId))
      if (initial.lines[0] && feed) initial.lines[0].purchaseUnit = feed.purchaseUnit ?? 'kg'
    }
    return initial
  })
  const [currentRecord, setCurrentRecord] = useState<FeedReceipt | null>(record)
  const [docs, setDocs] = useState<Array<{ name: string; ext: string }>>([])
  const [attachments, setAttachments] = useState(initialAttachments)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [paymentToVoid, setPaymentToVoid] = useState<FeedReceiptPayment | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const saveCommandKey = useRef('')
  const pendingPost = useRef<{ id: number; version: number; key: string } | null>(null)
  const readOnly = Boolean(currentRecord && currentRecord.status !== 'DRAFT')
  const status = currentRecord?.status ?? 'DRAFT'
  const title = !currentRecord ? 'Phiếu nhập kho mới' : `Phiếu nhập kho ${currentRecord.code} · ${status === 'POSTED' ? 'Đã ghi' : status === 'VOIDED' ? 'Đã hủy' : 'Nháp'}`
  const sub = !currentRecord
    ? 'Lưu phiếu sẽ cộng tồn kho từng thức ăn theo đơn vị kg'
    : status === 'POSTED'
      ? 'Phiếu đã ghi chỉ xem. Ghi trả nhà cung cấp, in phiếu, hoặc hủy phiếu khi tồn kho còn đủ để trừ lại.'
      : status === 'VOIDED' ? 'Phiếu đã hủy chỉ xem. Lý do hủy được lưu trong lịch sử phiếu.' : 'Phiếu nháp chưa cộng kho; sửa rồi lưu hoặc cộng kho khi đã nhận đủ hàng.'
  const supplier = suppliers.find((item) => item.id === Number(values.supplierId))

  const summary = useMemo(() => {
    const totalsByFeed = new Map<number, number>()
    for (const line of values.lines) {
      const feed = stockRows.find((row) => row.feedItemId === Number(line.feedItemId))
      if (feed) totalsByFeed.set(feed.feedItemId, (totalsByFeed.get(feed.feedItemId) ?? 0) + lineKg(line, feed))
    }
    const selected = values.lines.map((line) => {
      const feed = stockRows.find((row) => row.feedItemId === Number(line.feedItemId))
      const amountKg = lineKg(line, feed)
      const current = feed?.onHandKg ?? 0
      const after = current + (feed ? totalsByFeed.get(feed.feedItemId) ?? 0 : 0)
      return { line, feed, amountKg, before: current, after }
    })
    const goodsAmount = values.lines.reduce((sum, line) => sum + lineAmount(line), 0)
    const transportFee = Number(values.transportFee) || 0
    const totalPayable = goodsAmount + transportFee
    return {
      selected,
      itemCount: selected.filter((item) => item.feed).length,
      totalKg: selected.reduce((sum, item) => sum + item.amountKg, 0),
      goodsAmount,
      transportFee,
      totalPayable,
      owed: Math.max(0, totalPayable - (Number(values.amountPaid) || 0)),
    }
  }, [currentRecord?.status, stockRows, values.amountPaid, values.lines, values.transportFee])

  const stockSummary = summary.selected.filter((item, index, rows) => item.feed && rows.findIndex((other) => other.feed?.feedItemId === item.feed?.feedItemId) === index)
  const recovered = readOnly ? [] : stockSummary.filter((item) => item.feed && item.feed.status !== 'SUFFICIENT'
    && deriveFeedStockStatus(item.after, item.feed.minimumStockKg, item.feed.averageDailyUseKg) === 'SUFFICIENT')
  const checks = {
    feeds: values.lines.every((line) => !line.feedItemId || stockRows.find((row) => row.feedItemId === Number(line.feedItemId))?.available !== false),
    quantities: values.lines.every((line) => Number(line.quantityPurchase) > 0 && line.unitPrice !== '' && Number(line.unitPrice) >= 0),
    expiry: values.lines.every((line) => !line.expiryDate || line.expiryDate > values.receiptDate),
    date: Boolean(values.receiptDate) && values.receiptDate <= todayIso(),
  }

  const update = <K extends keyof Omit<FeedReceiptFormValues, 'lines'>,>(key: K, value: FeedReceiptFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    saveCommandKey.current = ''
    pendingPost.current = null
    setError('')
  }
  const updateLine = <K extends Exclude<keyof FeedReceiptFormLine, 'id'>,>(index: number, key: K, value: FeedReceiptFormLine[K]) => {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, itemIndex) => itemIndex === index ? { ...line, [key]: value } : line),
    }))
    saveCommandKey.current = ''
    pendingPost.current = null
    setError('')
  }
  const selectFeed = (index: number, feedItemId: string) => {
    const feed = stockRows.find((row) => row.feedItemId === Number(feedItemId))
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, itemIndex) => itemIndex === index
        ? { ...line, feedItemId, purchaseUnit: feed?.purchaseUnit ?? 'kg' }
        : line),
    }))
    saveCommandKey.current = ''
    pendingPost.current = null
    setError('')
  }
  const addLine = () => { saveCommandKey.current = ''; pendingPost.current = null; setValues((current) => ({ ...current, lines: [...current.lines, blankFeedReceiptLine()] })) }
  const removeLine = (index: number) => { saveCommandKey.current = ''; pendingPost.current = null; setValues((current) => ({ ...current, lines: current.lines.filter((_, itemIndex) => itemIndex !== index) })) }

  const uploadPendingFiles = async (receiptId: number) => {
    if (backendMode !== 'backend') return
    for (const file of newFiles) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: tệp vượt quá 10 MB.`)
      if (!['application/pdf', 'image/jpeg'].includes(file.type)) throw new Error(`${file.name}: chỉ chấp nhận PDF hoặc JPG.`)
      await uploadFeedReceiptAttachment(receiptId, file)
      setNewFiles((current) => current.filter((item) => item !== file))
    }
    setAttachments(await listFeedReceiptAttachments(receiptId))
  }

  const viewAttachment = async (attachment: FeedReceiptAttachment) => {
    if (!currentRecord) return
    try {
      const blob = await downloadFeedReceiptAttachment(currentRecord.id, attachment.id)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (attachmentError) {
      setError(feedReceiptError(attachmentError, 'Không thể tải chứng từ phiếu nhập.'))
    }
  }

  const viewPaymentAttachment = async (paymentId: number, attachment: FeedReceiptAttachment) => {
    if (!currentRecord) return
    try {
      const blob = await downloadFeedReceiptPaymentAttachment(currentRecord.id, paymentId, attachment.id)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (attachmentError) {
      setError(feedReceiptError(attachmentError, 'Không thể tải chứng từ khoản trả.'))
    }
  }

  const removeAttachment = async (attachment: FeedReceiptAttachment) => {
    if (!currentRecord) return
    setError('')
    try {
      await removeFeedReceiptAttachment(currentRecord.id, attachment.id)
      saveCommandKey.current = ''
      pendingPost.current = null
      setAttachments((current) => current.filter((item) => item.id !== attachment.id))
    } catch (attachmentError) {
      setError(feedReceiptError(attachmentError, 'Không thể xóa chứng từ phiếu nhập.'))
    }
  }

  const submit = async (postNow: boolean) => {
    if (savingRef.current) return
    const pending = pendingPost.current
    if (postNow && currentRecord?.status === 'DRAFT' && pending && pending.id === currentRecord.id && pending.version === currentRecord.version) {
      savingRef.current = true
      setSaving(true)
      setError('')
      try {
        const posted = await postFeedReceipt(pending.id, pending.version, { key: pending.key })
        pendingPost.current = null
        setCurrentRecord(posted)
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Phiếu ${posted.code} đã ghi. ${formatNumber(summary.totalKg)} kg đã cộng vào kho.` } })
      } catch (postError) {
        setError(feedReceiptError(postError, 'Không thể ghi sổ phiếu. Vui lòng thử lại.'))
      } finally {
        savingRef.current = false
        setSaving(false)
      }
      return
    }
    const existingFeedIds = currentRecord?.lines.map((line) => line.feedItemId) ?? []
    // The backend uses the receipt date when an initial payment has no separate date.
    const submitValues = { ...values, paymentDate: values.paymentDate || (Number(values.amountPaid) > 0 ? values.receiptDate : '') }
    const validation = validateFeedReceiptForm(submitValues, stockRows, suppliers, undefined, currentRecord?.supplierId, existingFeedIds)
    if (validation) {
      setError(validation)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const input = toFeedReceiptDraftInput(submitValues, stockRows, suppliers, currentRecord?.id, currentRecord?.supplierId, existingFeedIds)
      if (postNow && !currentRecord && newFiles.length === 0) {
        if (!saveCommandKey.current) saveCommandKey.current = newReceiptCommandKey()
        const posted = await createAndPostFeedReceipt(input, { key: saveCommandKey.current })
        saveCommandKey.current = ''
        setCurrentRecord(posted)
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Phiếu ${posted.code} đã ghi. ${formatNumber(summary.totalKg)} kg đã cộng vào kho.` } })
        return
      }
      if (!saveCommandKey.current) saveCommandKey.current = newReceiptCommandKey()
      const saved = await saveFeedReceiptDraft(input, { key: saveCommandKey.current })
      saveCommandKey.current = ''
      setCurrentRecord(saved)
      await uploadPendingFiles(saved.id)
      if (postNow) {
        const key = newReceiptCommandKey()
        pendingPost.current = { id: saved.id, version: saved.version, key }
        const posted = await postFeedReceipt(saved.id, saved.version, { key })
        pendingPost.current = null
        setCurrentRecord(posted)
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Phiếu ${posted.code} đã ghi. ${formatNumber(summary.totalKg)} kg đã cộng vào kho.` } })
      } else {
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `${saved.code} đã lưu nháp. Tồn kho chưa thay đổi.` } })
      }
    } catch (saveError) {
      setError(feedReceiptError(saveError, 'Không thể lưu phiếu. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const badge = STATUS_BADGE[status]
  const paidShown = currentRecord && readOnly ? currentRecord.amountPaid ?? 0 : Number(values.amountPaid) || 0
  const owedShown = readOnly && currentRecord ? currentRecord.outstanding ?? currentRecord.totalPayable - (currentRecord.amountPaid ?? 0) : summary.owed
  const attachmentDocs = attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.originalFilename,
    ext: attachment.contentType === 'application/pdf' ? 'PDF' : 'JPG',
  }))

  return (
    <Layout title={TITLE} user="manager">
      <PageHeader title={title} sub={sub} />
      <FeedManagementTabs />
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="1. Thông tin phiếu">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Mã phiếu" id="feed-receipt-code">
                <input id="feed-receipt-code" readOnly value={currentRecord?.code ?? nextCode} className={inputCls} />
              </Field>
              <Field label="Ngày nhập kho *" id="feed-receipt-date">
                <DateInput id="feed-receipt-date" readOnly={readOnly} value={values.receiptDate} onChange={(value) => update('receiptDate', value)} />
              </Field>
              <Field
                label="Nhà cung cấp *"
                id="feed-receipt-supplier"
                hint={<>{supplier?.phone ? `${supplier.phone} · ` : ''}{!readOnly && <button type="button" onClick={() => openModal('ncc')} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-brand">+ Thêm nhà cung cấp</button>}</>}
              >
                <Select id="feed-receipt-supplier" aria-label="Nhà cung cấp" disabled={readOnly} value={values.supplierId} onChange={(event) => update('supplierId', event.target.value)}>
                  <option value="">Chọn nhà cung cấp</option>
                  {suppliers.filter((item) => item.active || item.id === currentRecord?.supplierId).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' · Ngừng hoạt động'}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Số hóa đơn / phiếu giao" id="feed-receipt-invoice">
                <input id="feed-receipt-invoice" maxLength={50} readOnly={readOnly} value={values.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Người nhận hàng" id="feed-receipt-received-by">
                <input id="feed-receipt-received-by" maxLength={100} readOnly={readOnly} value={values.receivedBy} onChange={(event) => update('receivedBy', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Nơi để" id="feed-receipt-location">
                <input id="feed-receipt-location" maxLength={100} readOnly={readOnly} value={values.storageLocation} onChange={(event) => update('storageLocation', event.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Ghi chú" id="feed-receipt-note">
              <input id="feed-receipt-note" maxLength={1000} readOnly={readOnly} value={values.note} onChange={(event) => update('note', event.target.value)} className={inputCls} />
            </Field>
          </Card>

          {currentRecord && <FeedReceiptAudit receipt={currentRecord} />}

          <Card
            title="2. Danh sách thức ăn"
            sub={`${summary.itemCount} mặt hàng · quy đổi về kg theo quy cách trong Danh mục`}
            actions={!readOnly && <Button size="sm" onClick={addLine}><span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Thêm mặt hàng</span></Button>}
          >
            <Table scroll stack={false}>
              <thead>
                <tr><Th>#</Th><Th>Thức ăn</Th><Th className="whitespace-nowrap">Số lô · HSD</Th><Th className="whitespace-nowrap">Số lượng</Th><Th className="whitespace-nowrap">Đơn vị</Th><Th className="whitespace-nowrap">Quy đổi</Th><Th className="whitespace-nowrap">Đơn giá</Th><Th className="whitespace-nowrap">Thành tiền</Th>{!readOnly && <Th aria-label="Xóa" />}</tr>
              </thead>
              <tbody>
                {values.lines.map((line, index) => {
                  const lineNumber = index + 1
                  const selected = stockRows.find((row) => row.feedItemId === Number(line.feedItemId))
                  const chosenUnit = line.purchaseUnit || selected?.purchaseUnit || 'kg'
                  const unit = unitText(chosenUnit, selected?.kgPerPurchaseUnit)
                  const perUnit = chosenUnit.toLocaleLowerCase('vi') === 'kg' ? 'kg' : chosenUnit.toLocaleLowerCase('vi')
                  return (
                    <tr key={line.id ?? `new-${index}`}>
                      <Td className="font-medium">{lineNumber}</Td>
                      <Td className="min-w-[150px]">
                        {readOnly
                          ? <><div className="font-medium">{selected?.name ?? '—'}</div><div className="text-[11px] text-muted">{selected ? `${feedGroupLabel(selected.group)} · ${selected.code}` : ''}</div></>
                          : (
                            <Select id={`feed-receipt-feed-${index}`} aria-label={`Thức ăn dòng ${lineNumber}`} value={line.feedItemId} onChange={(event) => selectFeed(index, event.target.value)}>
                              <option value="">Chọn thức ăn</option>
                              {stockRows.filter((feed) => feed.available !== false || currentRecord?.lines.some((savedLine) => savedLine.feedItemId === feed.feedItemId)).map((feed) => <option key={feed.feedItemId} value={feed.feedItemId}>{feed.code} · {feed.name}{feed.available === false ? ' · Ngừng hoạt động' : ''}</option>)}
                            </Select>
                          )}
                      </Td>
                      <Td className="min-w-[120px]">
                        {readOnly
                          ? <><div className="font-medium">{line.lotNumber || '—'}</div>{line.expiryDate && <div className="whitespace-nowrap text-[11px] text-muted">HSD {formatDate(line.expiryDate)}</div>}</>
                          : (
                            <div className="flex flex-col gap-1">
                              <input aria-label={`Số lô dòng ${lineNumber}`} placeholder="Số lô" maxLength={30} value={line.lotNumber} onChange={(event) => updateLine(index, 'lotNumber', event.target.value)} className="h-8 w-full rounded-lg border border-field bg-white px-2 text-xs outline-none focus:border-brand" />
                              <input aria-label={`Hạn sử dụng dòng ${lineNumber}`} type="date" min={values.receiptDate} value={line.expiryDate} onChange={(event) => updateLine(index, 'expiryDate', event.target.value)} className="h-8 w-full rounded-lg border border-field bg-white px-2 text-xs outline-none focus:border-brand" />
                            </div>
                          )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {readOnly
                          ? line.quantityPurchase
                          : <input aria-label={`Số lượng dòng ${lineNumber}`} type="number" min="0.001" step="0.001" value={line.quantityPurchase} onChange={(event) => updateLine(index, 'quantityPurchase', event.target.value)} className="h-10 w-[72px] rounded-xl border border-field bg-white px-2 text-sm outline-none focus:border-brand" />}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {readOnly
                          ? <span aria-label={`Đơn vị dòng ${lineNumber}`}>{unit}</span>
                          : (
                            <Select aria-label={`Đơn vị dòng ${lineNumber}`} value={chosenUnit} onChange={(event) => updateLine(index, 'purchaseUnit', event.target.value)}>
                              {selected?.purchaseUnit && selected.purchaseUnit.toLocaleLowerCase('vi') !== 'kg' && <option value={selected.purchaseUnit}>{selected.purchaseUnit}</option>}
                              <option value="kg">kg</option>
                            </Select>
                          )}
                      </Td>
                      <Td className="whitespace-nowrap" aria-label={`Quy đổi kg dòng ${lineNumber}`}>{line.quantityPurchase ? formatKg(lineKg(line, selected), 0) : '—'}</Td>
                      <Td className="whitespace-nowrap">
                        {readOnly
                          ? `${formatMoney(Number(line.unitPrice))}/${perUnit}`
                          : (
                            <div className="flex items-center gap-1">
                              <input aria-label={`Đơn giá dòng ${lineNumber}`} type="number" min="0" step="1" value={line.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', event.target.value)} className="h-10 w-[92px] rounded-xl border border-field bg-white px-2 text-sm outline-none focus:border-brand" />
                              <span className="text-[11px] text-muted">/{perUnit}</span>
                            </div>
                          )}
                      </Td>
                      <Td className="whitespace-nowrap">{formatMoney(lineAmount(line))}</Td>
                      {!readOnly && <Td><Button variant="link" size="sm" disabled={values.lines.length === 1} aria-label={`Xóa dòng ${lineNumber}`} onClick={() => removeLine(index)}>Xóa</Button></Td>}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <Td />
                  <Td className="font-semibold">Tổng</Td>
                  <Td /><Td /><Td />
                  <Td className="whitespace-nowrap font-semibold">{formatKg(summary.totalKg, 0)}</Td>
                  <Td />
                  <Td className="whitespace-nowrap font-semibold">{formatMoney(summary.goodsAmount)}</Td>
                  {!readOnly && <Td />}
                </tr>
              </tfoot>
            </Table>
          </Card>

          <div className="grid items-start gap-4 md:grid-cols-2">
            <Card title="3. Chứng từ đính kèm">
              {backendMode === 'backend' ? (
                <>
                  {!readOnly && <Dropzone hint="Hóa đơn, phiếu giao · PDF, JPG ≤ 10MB · tải lên khi lưu nháp" onFiles={(files) => { saveCommandKey.current = ''; pendingPost.current = null; setNewFiles((current) => [...current, ...files]) }} />}
                  <Docs docs={attachmentDocs} onView={(index) => { const item = attachments[index]; if (item) void viewAttachment(item) }} onRemove={readOnly ? undefined : (index) => { const item = attachments[index]; if (item) void removeAttachment(item) }} />
                  {newFiles.map((file, index) => (
                    <div className="flex items-center gap-2 text-xs" key={`${file.name}-${index}`}>
                      <Badge>{file.type === 'application/pdf' ? 'PDF' : 'JPG'}</Badge><span>{file.name} · chờ tải lên</span><span className="flex-1" />
                      <Button variant="link" size="sm" aria-label={`Bỏ tệp ${file.name}`} onClick={() => { saveCommandKey.current = ''; pendingPost.current = null; setNewFiles((current) => current.filter((item) => item !== file)) }}>Bỏ</Button>
                    </div>
                  ))}
                  {readOnly && attachments.length === 0 && <p className="m-0 text-xs text-muted">Phiếu không có chứng từ đính kèm.</p>}
                </>
              ) : (
                <>
                  {!readOnly && <Dropzone hint="Hóa đơn, phiếu giao · PDF, JPG ≤ 10MB" onFiles={(files) => setDocs((current) => [...current, ...files.map((file) => ({ name: file.name, ext: file.name.split('.').pop()?.toUpperCase() ?? 'TỆP' }))])} />}
                  <Docs docs={docs} onRemove={readOnly ? undefined : (index) => setDocs((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                  {docs.length > 0 && <p className="m-0 text-[11px] text-muted">Tệp chưa được lưu lên máy chủ trong bản demo.</p>}
                  {readOnly && docs.length === 0 && <p className="m-0 text-xs text-muted">Phiếu không có chứng từ đính kèm.</p>}
                </>
              )}
            </Card>
            <Card title="4. Thanh toán">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tiền hàng" id="feed-receipt-goods"><MoneyBox id="feed-receipt-goods" label="Tiền hàng" value={formatMoney(summary.goodsAmount)} /></Field>
                <Field label="Phí vận chuyển" id="feed-receipt-transport">
                  <div className="relative">
                    <input id="feed-receipt-transport" type="number" min="0" step="1" readOnly={readOnly} value={values.transportFee} onChange={(event) => update('transportFee', event.target.value)} className={`${inputCls} pr-8`} />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">đ</span>
                  </div>
                </Field>
                <Field label="Đã thanh toán" id="feed-receipt-paid">
                  <div className="relative">
                    <input id="feed-receipt-paid" aria-label="Đã thanh toán" type="number" min="0" step="1" readOnly={readOnly} value={readOnly && currentRecord ? String(currentRecord.amountPaid) : values.amountPaid} onChange={(event) => update('amountPaid', event.target.value)} className={`${inputCls} pr-8`} />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">đ</span>
                  </div>
                </Field>
                <Field label="Còn nợ" id="feed-receipt-owed"><MoneyBox id="feed-receipt-owed" label="Còn nợ" value={formatMoney(owedShown)} /></Field>
                <Field label="Phương thức" id="feed-receipt-payment-method">
                  <Select id="feed-receipt-payment-method" aria-label="Phương thức thanh toán" disabled={readOnly} value={values.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value as FeedReceiptFormValues['paymentMethod'])}>
                    <option value="">Chọn phương thức</option>
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                  </Select>
                </Field>
                <Field label="Hạn trả phần nợ" id="feed-receipt-balance-due-date">
                  <DateInput id="feed-receipt-balance-due-date" readOnly={readOnly} value={values.balanceDueDate} onChange={(value) => update('balanceDueDate', value)} />
                </Field>
                {Number(values.amountPaid) > 0 && <Field label="Ngày trả lần đầu" id="feed-receipt-payment-date">
                  <DateInput id="feed-receipt-payment-date" readOnly={readOnly} value={values.paymentDate || values.receiptDate} onChange={(value) => update('paymentDate', value)} />
                </Field>}
              </div>
              {currentRecord?.payments?.length ? (
                <div className="mt-4 flex flex-col gap-2">
                  <h4 className="m-0 text-xs font-semibold">Lịch sử trả nhà cung cấp</h4>
                  <Table scroll stack={false}>
                    <thead><tr><Th>Ngày</Th><Th>Phương thức</Th><Th>Số tiền</Th><Th>Nội dung / người ghi</Th><Th>Trạng thái</Th><Th aria-label="Thao tác" /></tr></thead>
                    <tbody>
                      {currentRecord.payments.map((payment) => (
                        <tr key={payment.id} className={payment.status === 'VOIDED' ? 'text-faint line-through' : ''}>
                          <Td className="whitespace-nowrap">{formatDate(payment.paymentDate)}</Td>
                          <Td>{payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</Td>
                          <Td className="whitespace-nowrap">{formatMoney(payment.amount)}</Td>
                          <Td className="min-w-[150px]">
                            {payment.reference || payment.note || '—'}
                            <div className="text-[11px] text-muted">{payment.recordedByName ?? ''}</div>
                            {payment.attachments?.map((attachment) => <div key={attachment.id}><Button variant="link" size="sm" onClick={() => void viewPaymentAttachment(payment.id, attachment)}>{attachment.originalFilename} · {Math.ceil(attachment.fileSize / 1024)} KB</Button></div>)}
                          </Td>
                          <Td>{payment.status === 'VOIDED' ? `Đã hủy${payment.voidReason ? ` · ${payment.voidReason}` : ''}` : 'Đã ghi'}</Td>
                          <Td>{payment.status === 'RECORDED' && backendMode === 'backend' && <Button variant="link" size="sm" onClick={() => { setPaymentToVoid(payment); openModal('huy-tra') }}>Hủy</Button>}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : currentRecord?.status !== 'DRAFT' ? <p className="mb-0 mt-3 text-xs text-muted">Chưa có khoản trả nào trong lịch sử.</p> : null}
            </Card>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <h3 className="m-0 flex-1 text-sm font-semibold">Tóm tắt phiếu nhập kho</h3>
              {badge && <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>}
            </div>
            <Info cols={2} items={[
              ['Số mặt hàng', summary.itemCount],
              ['Tổng khối lượng', formatKg(summary.totalKg, 0)],
              ['Tổng phải trả', formatVnd(summary.totalPayable)],
              ['Còn nợ', formatVnd(owedShown)],
            ]} />
            {paidShown > 0 && <p className="m-0 text-[11px] text-muted">Đã thanh toán {formatVnd(paidShown)}</p>}
            <h4 className="m-0 text-xs font-semibold">{readOnly ? 'Tồn kho hiện tại' : 'Tồn sau khi nhập'}</h4>
            <Table stack={false}>
              <thead><tr><Th>Thức ăn</Th><Th>{readOnly ? 'Tồn hiện tại' : 'Trước → sau'}</Th></tr></thead>
              <tbody>
                {stockSummary.map((item, index) => (
                  <tr key={`${item.feed?.feedItemId}-${index}`}>
                    <Td className="font-medium">{item.feed?.name}</Td>
                    <Td className="whitespace-nowrap">{readOnly ? formatKg(item.before, 0) : <>{formatNumber(item.before, 0)} → {formatKg(item.after, 0)}</>}</Td>
                  </tr>
                ))}
                {summary.itemCount === 0 && <tr><Td colSpan={2} className="text-muted">Chọn thức ăn để xem tồn sau khi nhập.</Td></tr>}
              </tbody>
            </Table>
            {recovered.length > 0 && (
              <Note tone="ok">
                {recovered.map((item) => `${item.feed?.name} hết cảnh báo “Sắp hết” sau khi nhập (${formatKg(item.after, 0)} > mức tối thiểu ${formatKg(item.feed?.minimumStockKg ?? 0, 0)}).`).join(' ')}
              </Note>
            )}
          </Card>

          <Card>
            <h3 className="m-0 text-[13px] font-semibold">Kiểm tra trước khi lưu</h3>
            <CheckLine ok={checks.feeds}>Thức ăn đang dùng trong danh mục</CheckLine>
            <CheckLine ok={checks.quantities}>Số lượng &gt; 0, đơn giá ≥ 0</CheckLine>
            <CheckLine ok={checks.expiry}>Hạn dùng sau ngày nhập kho</CheckLine>
            <CheckLine ok={checks.date}>Ngày nhập không ở tương lai</CheckLine>
          </Card>

          {!readOnly ? (
            <div className="flex flex-col gap-2.5">
              <Button variant="primary" block disabled={saving} onClick={() => void submit(true)}>{saving ? 'Đang ghi…' : 'Lưu & cộng kho'}</Button>
              <Button block disabled={saving} onClick={() => void submit(false)}>{saving ? 'Đang lưu…' : 'Lưu nháp phiếu'}</Button>
              {currentRecord?.status === 'DRAFT' && backendMode === 'backend'
                ? <Button variant="danger" block disabled={saving} onClick={() => openModal('bo-nhap')}>Bỏ nháp</Button>
                : <Button block disabled={saving} onClick={() => navigate('/thuc-an/phieu-nhap')}>Hủy</Button>}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {status === 'POSTED' && (
                <Button variant="primary" block disabled={owedShown <= 0} title={owedShown <= 0 ? 'Phiếu đã trả đủ' : undefined} onClick={() => openModal('tra')}>
                  <span className="inline-flex items-center gap-1.5"><Icon name="cash" size={16} />Ghi trả nhà cung cấp</span>
                </Button>
              )}
              <Button block onClick={() => window.print()}><span className="inline-flex items-center gap-1.5"><Icon name="printer" size={16} />In phiếu</span></Button>
              {status === 'POSTED' && <Button block onClick={() => openModal('huy')}><span className="inline-flex items-center gap-1.5"><Icon name="circle-x" size={16} />Hủy phiếu</span></Button>}
              <Button block onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại danh sách</Button>
            </div>
          )}
        </aside>
      </div>

      <Foot>{FOOT}</Foot>

      {modal === 'ncc' && !readOnly && (
        <FeedSupplierQuickDialog
          onClose={closeModal}
          onAdded={async (added) => {
            const refreshed = await listFeedSuppliers().catch(() => null)
            setSuppliers((current) => {
              if (refreshed) return refreshed.some((supplier) => supplier.id === added.id) ? refreshed : [...refreshed, added]
              return current.some((supplier) => supplier.id === added.id) ? current : [...current, added]
            })
            update('supplierId', String(added.id))
            closeModal()
          }}
        />
      )}
      {modal === 'bo-nhap' && currentRecord?.status === 'DRAFT' && backendMode === 'backend' && (
        <FeedReceiptDiscardDialog
          record={currentRecord}
          onClose={closeModal}
          onDone={() => navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Đã bỏ nháp ${currentRecord.code}.` } })}
        />
      )}
      {modal === 'huy' && currentRecord && status === 'POSTED' && (
        <FeedReceiptVoidDialog
          record={currentRecord}
          onClose={closeModal}
          onDone={(voided) => navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Phiếu ${voided.code} đã được hủy.` } })}
        />
      )}
      {modal === 'tra' && currentRecord && status === 'POSTED' && (
        <FeedReceiptPaymentDialog
          record={currentRecord}
          onClose={closeModal}
          onDone={(result) => { setCurrentRecord(withPaymentResult(currentRecord, result)); closeModal(); onChanged() }}
        />
      )}
      {modal === 'huy-tra' && currentRecord && paymentToVoid && (
        <FeedReceiptPaymentVoidDialog
          receiptId={currentRecord.id}
          payment={paymentToVoid}
          onClose={() => { setPaymentToVoid(null); closeModal() }}
          onDone={(result) => { setCurrentRecord(withPaymentResult(currentRecord, result)); setPaymentToVoid(null); closeModal(); onChanged() }}
        />
      )}
    </Layout>
  )
}
