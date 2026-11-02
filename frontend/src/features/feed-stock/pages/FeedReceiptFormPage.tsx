import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, DateInput, Docs, Dropzone, Field, Foot, Info, Note, PageHeader, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStock } from '../api/feedStockApi'
import { listFeedSuppliers } from '../api/feedCatalogueApi'
import { getFeedReceiptDemo, listFeedReceipts, postFeedReceiptDemo, saveFeedReceiptDemoDraft } from '../api/feedReceiptApi'
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
import { feedGroupLabel, formatDate, formatKg, formatMoney, formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceiptDemoRecord } from '../types/feedReceiptDemo'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { FeedReceiptPaymentDialog, FeedReceiptVoidDialog, FeedSupplierQuickDialog } from '../components/FeedReceiptDialogs'

const FOOT = 'Tạo phiếu nhập kho thức ăn (Chủ trại, Quản lý). “Lưu nháp” chưa cộng kho; “Lưu & cộng kho” cộng tồn từng thức ăn và cập nhật giá nhập bình quân. Số lô và hạn dùng dùng để cảnh báo lô sắp hết hạn; phần còn nợ được theo dõi như công nợ nhà cung cấp.'
const TITLE = 'Thức ăn › Phiếu nhập kho'

const unitText = (unit: string | undefined, kgPer: number | undefined) => (!unit || unit.toLocaleLowerCase('vi') === 'kg' || !kgPer || kgPer === 1) ? 'kg' : `${unit.toLocaleLowerCase('vi')} ${formatNumber(kgPer)} kg`

function lineKg(line: FeedReceiptFormLine, feed?: { kgPerPurchaseUnit?: number } | null) {
  const amount = Number(line.quantityPurchase)
  return Number.isFinite(amount) ? amount * (feed?.kgPerPurchaseUnit ?? 1) : 0
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
    if (backendMode === 'backend') return null
    const [stock, suppliers, receipt, receipts] = await Promise.all([
      listFeedStock(),
      listFeedSuppliers(),
      id ? getFeedReceiptDemo(id) : Promise.resolve(null),
      id ? Promise.resolve([]) : listFeedReceipts(),
    ])
    return { stock, suppliers, receipt, nextCode: nextReceiptCode(receipts.map((row) => row.code)) }
  }, [id, initialFeedItemId])

  if (backendMode === 'backend') {
    return (
      <Layout title={TITLE} user="manager">
        <PageHeader title="Phiếu nhập kho" sub="Một số thông tin chưa sẵn sàng." />
        <FeedManagementTabs />
        <Note tone="warn">Lưu và ghi nhận phiếu hiện chỉ hoạt động trong bản demo.</Note>
        <div><Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại</Button></div>
      </Layout>
    )
  }

  if (formQuery.error) {
    return (
      <Layout title={TITLE} user="manager">
        <div role="alert" className="text-sm text-err-fg">{userFacingError(formQuery.error, 'Không thể mở phiếu nhập kho.')}</div>
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

function FeedReceiptForm({ record, stockRows, initialSuppliers, initialFeedItemId, nextCode, onChanged }: {
  record: FeedReceiptDemoRecord | null
  stockRows: Awaited<ReturnType<typeof listFeedStock>>
  initialSuppliers: FeedSupplier[]
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
  const [currentRecord, setCurrentRecord] = useState(record)
  const [docs, setDocs] = useState<Array<{ name: string; ext: string }>>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
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
    const selected = values.lines.map((line) => {
      const feed = stockRows.find((row) => row.feedItemId === Number(line.feedItemId))
      const amountKg = lineKg(line, feed)
      const current = feed?.onHandKg ?? 0
      const before = currentRecord?.status === 'POSTED' ? Math.max(0, current - amountKg) : current
      const after = currentRecord?.status === 'POSTED' ? current : current + amountKg
      return { line, feed, amountKg, before, after }
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

  const recovered = summary.selected.filter((item) => item.feed && item.feed.status !== 'SUFFICIENT'
    && deriveFeedStockStatus(item.after, item.feed.minimumStockKg, item.feed.averageDailyUseKg) === 'SUFFICIENT')
  const checks = {
    feeds: values.lines.every((line) => !line.feedItemId || stockRows.find((row) => row.feedItemId === Number(line.feedItemId))?.available !== false),
    quantities: values.lines.every((line) => Number(line.quantityPurchase) > 0 && line.unitPrice !== '' && Number(line.unitPrice) >= 0),
    expiry: values.lines.every((line) => !line.expiryDate || line.expiryDate > values.receiptDate),
    date: Boolean(values.receiptDate) && values.receiptDate <= todayIso(),
  }

  const update = <K extends keyof Omit<FeedReceiptFormValues, 'lines'>,>(key: K, value: FeedReceiptFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError('')
  }
  const updateLine = <K extends Exclude<keyof FeedReceiptFormLine, 'id'>,>(index: number, key: K, value: FeedReceiptFormLine[K]) => {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, itemIndex) => itemIndex === index ? { ...line, [key]: value } : line),
    }))
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
    setError('')
  }
  const addLine = () => setValues((current) => ({ ...current, lines: [...current.lines, blankFeedReceiptLine()] }))
  const removeLine = (index: number) => setValues((current) => ({ ...current, lines: current.lines.filter((_, itemIndex) => itemIndex !== index) }))

  const submit = async (postNow: boolean) => {
    if (savingRef.current) return
    const existingFeedIds = currentRecord?.lines.map((line) => line.feedItemId) ?? []
    // The payment date is not asked on this screen: a payment made with the receipt is dated the receipt date.
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
      const saved = await saveFeedReceiptDemoDraft(toFeedReceiptDraftInput(submitValues, stockRows, suppliers, currentRecord?.id, currentRecord?.supplierId, existingFeedIds))
      setCurrentRecord(saved)
      if (postNow) {
        await postFeedReceiptDemo(saved.id)
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Phiếu ${saved.code} đã ghi. ${formatNumber(summary.totalKg)} kg đã cộng vào kho.` } })
      } else {
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `${saved.code} đã lưu nháp. Tồn kho chưa thay đổi.` } })
      }
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu phiếu. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const badge = STATUS_BADGE[status]
  const paidShown = currentRecord && readOnly ? currentRecord.amountPaid : Number(values.amountPaid) || 0
  const owedShown = readOnly && currentRecord ? currentRecord.totalPayable - currentRecord.amountPaid : summary.owed

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

          <Card
            title="2. Danh sách thức ăn"
            sub={`${summary.itemCount} mặt hàng · quy đổi về kg theo quy cách trong Danh mục`}
            actions={!readOnly && <Button size="sm" onClick={addLine}><span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Thêm mặt hàng</span></Button>}
          >
            <Table scroll stack={false}>
              <thead>
                <tr><Th>#</Th><Th>Thức ăn</Th><Th className="whitespace-nowrap">Số lô · HSD</Th><Th className="whitespace-nowrap">Số lượng</Th><Th className="whitespace-nowrap">Đơn vị</Th><Th className="whitespace-nowrap">Quy đổi</Th><Th className="whitespace-nowrap">Đơn giá</Th><Th className="whitespace-nowrap">Thành tiền</Th>{!readOnly && <Th><span className="sr-only">Xóa</span></Th>}</tr>
              </thead>
              <tbody>
                {values.lines.map((line, index) => {
                  const lineNumber = index + 1
                  const selected = stockRows.find((row) => row.feedItemId === Number(line.feedItemId))
                  const unit = unitText(selected?.purchaseUnit ?? line.purchaseUnit, selected?.kgPerPurchaseUnit)
                  const perUnit = unit === 'kg' ? 'kg' : (selected?.purchaseUnit ?? line.purchaseUnit).toLocaleLowerCase('vi')
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
                      <Td className="whitespace-nowrap"><span aria-label={`Đơn vị dòng ${lineNumber}`}>{unit}</span></Td>
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
              {!readOnly && <Dropzone hint="Hóa đơn, phiếu giao · PDF, JPG ≤ 10MB" onFiles={(files) => setDocs((current) => [...current, ...files.map((file) => ({ name: file.name, ext: file.name.split('.').pop()?.toUpperCase() ?? 'TỆP' }))])} />}
              <Docs docs={docs} onRemove={readOnly ? undefined : (index) => setDocs((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
              {docs.length > 0 && <p className="m-0 text-[11px] text-muted">Tệp chưa được lưu lên máy chủ trong bản demo.</p>}
              {readOnly && docs.length === 0 && <p className="m-0 text-xs text-muted">Phiếu không có chứng từ đính kèm.</p>}
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
              </div>
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
            <h4 className="m-0 text-xs font-semibold">{readOnly && status === 'POSTED' ? 'Tồn trước → sau khi nhập' : 'Tồn sau khi nhập'}</h4>
            <Table stack={false}>
              <thead><tr><Th>Thức ăn</Th><Th>Trước → sau</Th></tr></thead>
              <tbody>
                {summary.selected.filter((item) => item.feed).map((item, index) => (
                  <tr key={`${item.feed?.feedItemId}-${index}`}>
                    <Td className="font-medium">{item.feed?.name}</Td>
                    <Td className="whitespace-nowrap">{formatNumber(item.before, 0)} → {formatKg(item.after, 0)}</Td>
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
              <Button block disabled={saving} onClick={() => navigate('/thuc-an/phieu-nhap')}>Hủy</Button>
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
          onAdded={(added) => { setSuppliers((current) => [...current, added]); update('supplierId', String(added.id)); closeModal() }}
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
          onDone={(paid) => { setCurrentRecord(paid); closeModal(); onChanged() }}
        />
      )}
    </Layout>
  )
}
