import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, KV, Note, PageHeader, Select, Textarea, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStock } from '../api/feedStockApi'
import { listFeedSuppliers } from '../api/feedCatalogueApi'
import { getFeedReceiptDemo, postFeedReceiptDemo, saveFeedReceiptDemoDraft } from '../api/feedReceiptApi'
import {
  blankFeedReceiptLine,
  initialFeedReceiptForm,
  toFeedReceiptDraftInput,
  validateFeedReceiptForm,
  type FeedReceiptFormLine,
  type FeedReceiptFormValues,
} from '../data/feedReceiptForm'
import type { FeedReceiptDemoRecord } from '../types/feedReceiptDemo'
import FeedManagementTabs from '../components/FeedManagementTabs'

const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const currencyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

function lineKg(line: FeedReceiptFormLine, feed?: { kgPerPurchaseUnit?: number } | null) {
  const amount = Number(line.quantityPurchase)
  return Number.isFinite(amount) ? amount * (feed?.kgPerPurchaseUnit ?? 1) : 0
}

function lineAmount(line: FeedReceiptFormLine) {
  const quantity = Number(line.quantityPurchase)
  const price = Number(line.unitPrice)
  return Number.isFinite(quantity) && Number.isFinite(price) ? Math.round(quantity * price) : 0
}

export default function FeedReceiptFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialFeedItemId = searchParams.get('feedItemId') ?? ''
  const formQuery = useQuery(async () => {
    if (backendMode === 'backend') return null
    const [stock, suppliers, receipt] = await Promise.all([
      listFeedStock(),
      listFeedSuppliers(),
      id ? getFeedReceiptDemo(id) : Promise.resolve(null),
    ])
    return { stock, suppliers, receipt }
  }, [id, initialFeedItemId])

  if (backendMode === 'backend') {
    return (
      <Layout title="Thức ăn – Phiếu nhập kho" user="manager">
        <PageHeader title="Phiếu nhập kho thức ăn" sub="Một số thông tin chưa sẵn sàng." />
        <FeedManagementTabs />
        <Note tone="warn">Lưu và ghi nhận phiếu hiện chỉ hoạt động trong bản demo.</Note>
        <Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại</Button>
      </Layout>
    )
  }

  if (formQuery.error) {
    return (
      <Layout title="Thức ăn – Phiếu nhập kho" user="manager">
        <div role="alert" className="text-sm text-err-fg">{userFacingError(formQuery.error, 'Không thể mở phiếu nhập kho.')}</div>
        <Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại danh sách</Button>
      </Layout>
    )
  }

  if (formQuery.loading || !formQuery.data) {
    return (
      <Layout title="Thức ăn – Phiếu nhập kho" user="manager">
        <p role="status" className="m-0 text-xs text-muted">Đang tải phiếu…</p>
      </Layout>
    )
  }

  if (id && !formQuery.data.receipt) {
    return (
      <Layout title="Thức ăn – Phiếu nhập kho" user="manager">
        <PageHeader title="Không tìm thấy phiếu nhập kho" />
        <Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại danh sách</Button>
      </Layout>
    )
  }

  return (
    <FeedReceiptForm
      key={id ?? `new-${initialFeedItemId}`}
      record={formQuery.data.receipt}
      stockRows={formQuery.data.stock}
      suppliers={formQuery.data.suppliers}
      initialFeedItemId={initialFeedItemId}
    />
  )
}

function FeedReceiptForm({ record, stockRows, suppliers, initialFeedItemId }: {
  record: FeedReceiptDemoRecord | null
  stockRows: Awaited<ReturnType<typeof listFeedStock>>
  suppliers: Awaited<ReturnType<typeof listFeedSuppliers>>
  initialFeedItemId: string
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FeedReceiptFormValues>(() => {
    const initial = initialFeedReceiptForm(record, initialFeedItemId)
    if (!record && initialFeedItemId) {
      const feed = stockRows.find((row) => row.feedItemId === Number(initialFeedItemId))
      if (initial.lines[0] && feed) initial.lines[0].purchaseUnit = feed.purchaseUnit ?? 'kg'
    }
    return initial
  })
  const [currentRecord, setCurrentRecord] = useState(record)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const readOnly = Boolean(currentRecord && currentRecord.status !== 'DRAFT')
  const title = !currentRecord ? 'Tạo phiếu nhập kho thức ăn' : readOnly ? 'Chi tiết phiếu nhập kho thức ăn' : 'Sửa phiếu nhập kho thức ăn'
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
    return {
      selected,
      itemCount: selected.filter((item) => item.feed).length,
      totalKg: selected.reduce((sum, item) => sum + item.amountKg, 0),
      goodsAmount,
      transportFee,
      totalPayable: goodsAmount + transportFee,
    }
  }, [currentRecord?.status, stockRows, values.lines, values.transportFee])

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
    const validation = validateFeedReceiptForm(values, stockRows, suppliers, undefined, currentRecord?.supplierId, existingFeedIds)
    if (validation) {
      setError(validation)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await saveFeedReceiptDemoDraft(toFeedReceiptDraftInput(values, stockRows, suppliers, currentRecord?.id, currentRecord?.supplierId, existingFeedIds))
      setCurrentRecord(saved)
      if (postNow) {
        await postFeedReceiptDemo(saved.id)
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Đã ghi nhận phiếu ${saved.code} trong bản demo.` } })
      } else {
        navigate('/thuc-an/phieu-nhap', { state: { receiptMessage: `Đã lưu nháp phiếu ${saved.code} trong bản demo.` } })
      }
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu phiếu. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Layout title="Thức ăn – Phiếu nhập kho" user="manager">
      <PageHeader title={title} sub="Nhập thông tin phiếu và các mặt hàng thức ăn nhận được.">
        <Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Quay lại danh sách</Button>
      </PageHeader>

      <Badge tone="info">Dữ liệu minh họa</Badge>
      <FeedManagementTabs />

      {readOnly && <Note tone="info">Phiếu đã ghi nhận; thông tin đang ở chế độ chỉ xem.</Note>}
      {currentRecord?.status === 'VOIDED' && <Note tone="warn">Phiếu đã hủy. Một số thông tin chưa sẵn sàng.</Note>}
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Thông tin phiếu">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Số phiếu" id="feed-receipt-code">
                <input id="feed-receipt-code" readOnly value={currentRecord?.code ?? 'Tạo khi lưu nháp'} className={inputCls} />
              </Field>
              <Field label="Ngày nhập *" id="feed-receipt-date">
                <input id="feed-receipt-date" aria-label="Ngày nhập" type="date" disabled={readOnly} value={values.receiptDate} onChange={(event) => update('receiptDate', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Nhà cung cấp *" id="feed-receipt-supplier">
                <Select id="feed-receipt-supplier" aria-label="Nhà cung cấp" disabled={readOnly} value={values.supplierId} onChange={(event) => update('supplierId', event.target.value)}>
                  <option value="">Chọn nhà cung cấp</option>
                  {suppliers.filter((supplier) => supplier.active || supplier.id === currentRecord?.supplierId).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.active ? '' : ' · Ngừng hoạt động'}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Số hóa đơn / phiếu giao" id="feed-receipt-invoice">
                <input id="feed-receipt-invoice" maxLength={50} disabled={readOnly} value={values.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Người nhận" id="feed-receipt-received-by">
                <input id="feed-receipt-received-by" maxLength={100} disabled={readOnly} value={values.receivedBy} onChange={(event) => update('receivedBy', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Vị trí lưu kho" id="feed-receipt-location">
                <input id="feed-receipt-location" maxLength={100} disabled={readOnly} value={values.storageLocation} onChange={(event) => update('storageLocation', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Phí vận chuyển (đ)" id="feed-receipt-transport">
                <input id="feed-receipt-transport" type="number" min="0" step="1" disabled={readOnly} value={values.transportFee} onChange={(event) => update('transportFee', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Ghi chú" id="feed-receipt-note">
                <Textarea id="feed-receipt-note" aria-label="Ghi chú" maxLength={1000} disabled={readOnly} value={values.note} onChange={(event) => update('note', event.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="Thức ăn nhận được" actions={!readOnly && <Button size="sm" onClick={addLine}>+ Thêm thức ăn</Button>}>
            <div className="flex flex-col gap-4">
              {values.lines.map((line, index) => {
                const lineNumber = index + 1
                const selected = stockRows.find((row) => row.feedItemId === Number(line.feedItemId))
                return (
                  <div key={line.id ?? `new-${index}`} className="rounded-md border border-edge p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <strong className="text-xs">Mặt hàng {lineNumber}</strong>
                      <span className="flex-1" />
                      {!readOnly && <Button size="sm" disabled={values.lines.length === 1} aria-label={`Xóa dòng ${lineNumber}`} onClick={() => removeLine(index)}>Xóa dòng</Button>}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Thức ăn *" id={`feed-receipt-feed-${index}`}>
                        <Select id={`feed-receipt-feed-${index}`} aria-label={`Thức ăn dòng ${lineNumber}`} disabled={readOnly} value={line.feedItemId} onChange={(event) => selectFeed(index, event.target.value)}>
                          <option value="">Chọn thức ăn</option>
                          {stockRows.filter((feed) => feed.available !== false || currentRecord?.lines.some((savedLine) => savedLine.feedItemId === feed.feedItemId)).map((feed) => <option key={feed.feedItemId} value={feed.feedItemId}>{feed.code} · {feed.name}{feed.available === false ? ' · Ngừng hoạt động' : ''}</option>)}
                        </Select>
                      </Field>
                      <Field label="Số lô" id={`feed-receipt-lot-${index}`}>
                        <input id={`feed-receipt-lot-${index}`} aria-label={`Số lô dòng ${lineNumber}`} maxLength={30} disabled={readOnly} value={line.lotNumber} onChange={(event) => updateLine(index, 'lotNumber', event.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Hạn sử dụng" id={`feed-receipt-expiry-${index}`}>
                        <input id={`feed-receipt-expiry-${index}`} aria-label={`Hạn sử dụng dòng ${lineNumber}`} type="date" disabled={readOnly} value={line.expiryDate} min={values.receiptDate} onChange={(event) => updateLine(index, 'expiryDate', event.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Số lượng *" id={`feed-receipt-quantity-${index}`}>
                        <input id={`feed-receipt-quantity-${index}`} aria-label={`Số lượng dòng ${lineNumber}`} type="number" min="0.001" step="0.001" disabled={readOnly} value={line.quantityPurchase} onChange={(event) => updateLine(index, 'quantityPurchase', event.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Đơn vị" id={`feed-receipt-unit-${index}`}>
                        <Select id={`feed-receipt-unit-${index}`} aria-label={`Đơn vị dòng ${lineNumber}`} disabled value={selected?.purchaseUnit ?? line.purchaseUnit}>
                          <option value={selected?.purchaseUnit ?? line.purchaseUnit}>{selected?.purchaseUnit ?? line.purchaseUnit}</option>
                        </Select>
                      </Field>
                      <Field label="Quy đổi (kg)" id={`feed-receipt-conversion-${index}`}>
                        <input id={`feed-receipt-conversion-${index}`} readOnly aria-label={`Quy đổi kg dòng ${lineNumber}`} value={line.quantityPurchase ? quantityFormat.format(lineKg(line, selected)) : '—'} className={inputCls} />
                      </Field>
                      <Field label="Đơn giá (đ) *" id={`feed-receipt-unit-price-${index}`}>
                        <input id={`feed-receipt-unit-price-${index}`} aria-label={`Đơn giá dòng ${lineNumber}`} type="number" min="0" step="1" disabled={readOnly} value={line.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', event.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Thành tiền (đ)" id={`feed-receipt-line-total-${index}`}>
                        <input id={`feed-receipt-line-total-${index}`} readOnly value={currencyFormat.format(lineAmount(line))} className={inputCls} />
                      </Field>
                      <Field label="Tồn trước → sau (kg)" id={`feed-receipt-stock-preview-${index}`}>
                        <input id={`feed-receipt-stock-preview-${index}`} readOnly value={selected ? `${quantityFormat.format(summary.selected[index].before)} → ${quantityFormat.format(summary.selected[index].after)}` : '—'} className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Chứng từ đính kèm">
            <Note>Đính kèm chứng từ chưa sẵn sàng.</Note>
          </Card>

          <Card title="Thanh toán">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Đã thanh toán (đ)" id="feed-receipt-paid">
                <input id="feed-receipt-paid" aria-label="Đã thanh toán" type="number" min="0" step="1" disabled={readOnly} value={values.amountPaid} onChange={(event) => update('amountPaid', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Hình thức thanh toán" id="feed-receipt-payment-method">
                <Select id="feed-receipt-payment-method" aria-label="Hình thức thanh toán" disabled={readOnly} value={values.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value as FeedReceiptFormValues['paymentMethod'])}>
                  <option value="">Chọn hình thức</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </Select>
              </Field>
              <Field label="Ngày thanh toán" id="feed-receipt-payment-date">
                <input id="feed-receipt-payment-date" aria-label="Ngày thanh toán" type="date" disabled={readOnly} value={values.paymentDate} onChange={(event) => update('paymentDate', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Hạn thanh toán" id="feed-receipt-balance-due-date">
                <input id="feed-receipt-balance-due-date" aria-label="Hạn thanh toán" type="date" disabled={readOnly} value={values.balanceDueDate} onChange={(event) => update('balanceDueDate', event.target.value)} className={inputCls} />
              </Field>
            </div>
            <Note tone="info">Thông tin thanh toán chỉ được lưu trong bản demo.</Note>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card title="Tóm tắt phiếu">
            <div className="grid gap-3">
              <KV k="Số mặt hàng">{summary.itemCount}</KV>
              <KV k="Tổng khối lượng">{quantityFormat.format(summary.totalKg)} kg</KV>
              <KV k="Tiền hàng">{currencyFormat.format(summary.goodsAmount)} ₫</KV>
              <KV k="Phí vận chuyển">{currencyFormat.format(summary.transportFee)} ₫</KV>
              <KV k="Tổng phải trả">{currencyFormat.format(summary.totalPayable)} ₫</KV>
              <KV k="Đã thanh toán">{currencyFormat.format(Number(values.amountPaid) || 0)} ₫</KV>
              <KV k="Còn nợ">{currencyFormat.format(Math.max(0, summary.totalPayable - (Number(values.amountPaid) || 0)))} ₫</KV>
            </div>
          </Card>
          <Note tone="info">Số tồn trước và sau là bản xem trước trong dữ liệu minh họa.</Note>
        </aside>
      </div>

      {readOnly ? (
        <div className="flex justify-end"><Button onClick={() => navigate('/thuc-an/phieu-nhap')}>Đóng chi tiết</Button></div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={saving} onClick={() => navigate('/thuc-an/phieu-nhap')}>Hủy</Button>
          <Button disabled={saving} onClick={() => void submit(false)}>{saving ? 'Đang lưu…' : 'Lưu nháp'}</Button>
          <Button variant="primary" disabled={saving} onClick={() => void submit(true)}>{saving ? 'Đang ghi…' : 'Ghi nhận & thêm vào kho'}</Button>
        </div>
      )}
    </Layout>
  )
}
