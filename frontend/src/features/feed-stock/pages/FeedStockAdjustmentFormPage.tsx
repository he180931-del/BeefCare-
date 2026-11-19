import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, DateInput, Docs, Dropzone, Field, Foot, Info, Note, PageHeader, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStock } from '../api/feedStockApi'
import { getFeedStockAdjustment, listFeedStockAdjustments, postFeedStockAdjustmentDemo, saveFeedStockAdjustmentDemoDraft } from '../api/feedStockAdjustmentApi'
import {
  initialFeedStockAdjustmentForm,
  nextFeedAdjustmentCode,
  previewFeedStockAdjustment,
  toFeedStockAdjustmentDraftInput,
  validateFeedStockAdjustmentForm,
} from '../data/feedStockAdjustmentForm'
import { formatKg, formatMoney, formatNumber } from '../domain/feedLabels'
import type { FeedStockAdjustment, FeedStockAdjustmentFormValues, FeedStockAdjustmentType } from '../types/feedStockAdjustment'
import FeedManagementTabs from '../components/FeedManagementTabs'

const TITLE = 'Thức ăn › Kiểm kê'
const TYPE_LABELS: Record<FeedStockAdjustmentType, string> = {
  PERIODIC_COUNT: 'Kiểm kê định kỳ',
  LOSS: 'Thất thoát',
  SPOILAGE: 'Hư hỏng',
  OTHER: 'Khác',
}
const REASON_SUGGESTIONS = ['Hao hụt (héo, rơi vãi)', 'Ẩm mốc – hủy bỏ', 'Đếm lại, sai lệch sổ sách', 'Thất thoát']
const FOOT = 'Phiếu điều chỉnh kho khi kiểm kê hoặc hao hụt (Chủ trại, Quản lý). Nhập tồn thực tế; chênh lệch và giá trị tự tính theo giá nhập bình quân. Dòng có chênh lệch được tô nền và bắt buộc có lý do.'

const signed = (value: number, digits = 3) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)}`

type Line = {
  code: string
  name: string
  systemKg: number
  countedKg: number | null
  differenceKg: number | null
  reason: string
  differenceValue: number | null
  feedItemId?: number
}

export default function FeedStockAdjustmentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useQuery(async () => {
    if (backendMode === 'backend') {
      return { stock: [], record: id ? await getFeedStockAdjustment(id) : null, nextCode: '' }
    }
    const [stock, record, adjustments] = await Promise.all([
      listFeedStock(),
      id ? getFeedStockAdjustment(id) : Promise.resolve(null),
      id ? Promise.resolve([]) : listFeedStockAdjustments(),
    ])
    return { stock, record, nextCode: nextFeedAdjustmentCode(adjustments.map((row) => row.code)) }
  }, [id])

  if (query.error) {
    return (
      <Layout title={TITLE} user="manager">
        <PageHeader title="Không thể mở phiếu kiểm kê" />
        <div role="alert" className="mb-4 text-sm text-err-fg">{userFacingError(query.error, 'Không thể mở phiếu kiểm kê.')}</div>
        <div><Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button></div>
      </Layout>
    )
  }

  if (query.loading || !query.data) {
    return <Layout title={TITLE} user="manager"><p role="status" className="m-0 text-xs text-muted">Đang tải phiếu kiểm kê…</p></Layout>
  }

  if (backendMode === 'backend') {
    if (!query.data.record) {
      return (
        <Layout title={TITLE} user="manager">
          <PageHeader title="Phiếu điều chỉnh kho" sub="Một số thông tin chưa sẵn sàng." />
          <FeedManagementTabs />
          <Note tone="warn">Lưu nháp và ghi nhận kiểm kê hiện chỉ hoạt động trong bản demo.</Note>
          <div><Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button></div>
        </Layout>
      )
    }
    return <BackendAdjustmentDetail record={query.data.record} />
  }

  if (id && !query.data.record) {
    return (
      <Layout title={TITLE} user="manager">
        <PageHeader title="Không tìm thấy phiếu kiểm kê" />
        <div><Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button></div>
      </Layout>
    )
  }

  return (
    <FeedStockAdjustmentForm
      key={id ?? 'new-adjustment'}
      record={query.data.record}
      stockRows={query.data.stock}
      nextCode={query.data.nextCode}
    />
  )
}

function BackendAdjustmentDetail({ record }: { record: FeedStockAdjustment }) {
  const navigate = useNavigate()
  return (
    <Layout title={TITLE} user="manager">
      <PageHeader title={`Phiếu điều chỉnh kho ${record.code}`} sub="Phiếu đang ở chế độ chỉ xem.">
        <Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button>
      </PageHeader>
      <FeedManagementTabs />
      <Card title="Thông tin phiếu">
        <dl className="m-0 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Ngày kiểm kê</dt><dd className="m-0 font-medium">{record.countDate}</dd></div>
          <div><dt className="text-muted">Loại</dt><dd className="m-0 font-medium">{TYPE_LABELS[record.adjustmentType as FeedStockAdjustmentType] ?? record.adjustmentType}</dd></div>
          <div><dt className="text-muted">Người kiểm kê</dt><dd className="m-0 font-medium">{record.countedBy || '—'}</dd></div>
          <div><dt className="text-muted">Trạng thái</dt><dd className="m-0 font-medium">{record.status}</dd></div>
        </dl>
      </Card>
      <Card title="Đối chiếu tồn kho">
        <AdjustmentLinesTable
          totalDifferenceKg={record.totalDifferenceKg}
          totalValue={record.totalValue}
          readOnly
          lines={record.lines.map((line) => ({
            code: line.feedCode,
            name: line.feedName,
            systemKg: line.systemKg,
            countedKg: line.countedKg,
            differenceKg: line.differenceKg,
            reason: line.reason ?? '',
            differenceValue: line.differenceValue,
          }))}
        />
      </Card>
      <Foot>{FOOT}</Foot>
    </Layout>
  )
}

function FeedStockAdjustmentForm({ record, stockRows, nextCode }: {
  record: FeedStockAdjustment | null
  stockRows: Awaited<ReturnType<typeof listFeedStock>>
  nextCode: string
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FeedStockAdjustmentFormValues>(() => initialFeedStockAdjustmentForm(record, stockRows))
  const [currentRecord, setCurrentRecord] = useState(record)
  const [docs, setDocs] = useState<Array<{ name: string; ext: string }>>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const readOnly = currentRecord?.status !== undefined && currentRecord.status !== 'DRAFT'
  const title = !currentRecord ? 'Phiếu điều chỉnh kho' : `Phiếu điều chỉnh kho ${currentRecord.code} · ${readOnly ? 'Đã ghi' : 'Nháp'}`
  const preview = useMemo(() => previewFeedStockAdjustment(values, stockRows), [values, stockRows])
  const changedFeeds = readOnly && currentRecord
    ? currentRecord.lines.filter((line) => Math.abs(line.differenceKg) > 0.0005).length
    : preview.changedFeeds
  const totalDifferenceKg = readOnly && currentRecord ? currentRecord.totalDifferenceKg : preview.totalDifferenceKg
  const totalValue = readOnly && currentRecord ? currentRecord.totalValue : preview.totalValue

  const update = <K extends Exclude<keyof FeedStockAdjustmentFormValues, 'lines'>>(key: K, value: FeedStockAdjustmentFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError('')
  }
  const updateLine = (feedItemId: number, key: 'countedKg' | 'reason', value: string) => {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) => line.feedItemId === feedItemId ? { ...line, [key]: value } : line),
    }))
    setError('')
  }

  const submit = async (postNow: boolean) => {
    if (savingRef.current || readOnly) return
    const validation = validateFeedStockAdjustmentForm(values, stockRows)
    if (validation) {
      setError(validation)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await saveFeedStockAdjustmentDemoDraft(toFeedStockAdjustmentDraftInput(values, currentRecord?.id))
      setCurrentRecord(saved)
      if (postNow) {
        await postFeedStockAdjustmentDemo(saved.id)
        navigate('/thuc-an', { state: { feedStockMessage: `Phiếu điều chỉnh ${saved.code} đã ghi: ${formatNumber(saved.totalDifferenceKg)} kg (${saved.totalValue === null ? '—' : formatMoney(saved.totalValue)} đ).` } })
      } else {
        navigate('/thuc-an/kiem-ke', { state: { adjustmentMessage: `${saved.code} đã lưu nháp. Tồn kho chưa thay đổi.` } })
      }
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu phiếu kiểm kê. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const lines: Line[] = readOnly && currentRecord
    ? currentRecord.lines.map((line) => ({
      code: line.feedCode,
      name: line.feedName,
      systemKg: line.systemKg,
      countedKg: line.countedKg,
      differenceKg: line.differenceKg,
      reason: line.reason ?? '',
      differenceValue: line.differenceValue,
      feedItemId: line.feedItemId,
    }))
    : preview.lines.map((line) => ({
      code: line.stock.code,
      name: line.stock.name,
      systemKg: line.stock.onHandKg,
      countedKg: line.countedKg,
      differenceKg: line.differenceKg,
      reason: values.lines.find((item) => item.feedItemId === line.stock.feedItemId)?.reason ?? '',
      differenceValue: line.differenceValue,
      feedItemId: line.stock.feedItemId,
    }))

  return (
    <Layout title={TITLE} user="manager">
      <PageHeader title={title} sub="Đối chiếu tồn thực tế với tồn hệ thống" />
      <FeedManagementTabs />
      {readOnly && <Note tone="info">Phiếu đã ghi nhận; thông tin đang ở chế độ chỉ xem.</Note>}
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <Card title="Thông tin phiếu">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã phiếu" id="feed-adjustment-code">
              <input id="feed-adjustment-code" readOnly value={currentRecord?.code ?? nextCode} className={inputCls} />
            </Field>
            <Field label="Ngày kiểm kê *" id="feed-adjustment-date">
              <DateInput id="feed-adjustment-date" readOnly={readOnly || saving} value={values.countDate} onChange={(value) => update('countDate', value)} />
            </Field>
            <Field label="Loại điều chỉnh *" id="feed-adjustment-type">
              <Select id="feed-adjustment-type" aria-label="Loại điều chỉnh" disabled={readOnly || saving} value={values.adjustmentType} onChange={(event) => update('adjustmentType', event.target.value as FeedStockAdjustmentType)}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Người kiểm kê" id="feed-adjustment-counted-by">
              <input id="feed-adjustment-counted-by" maxLength={200} readOnly={readOnly || saving} value={values.countedBy} onChange={(event) => update('countedBy', event.target.value)} className={inputCls} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <h3 className="m-0 flex-1 text-sm font-semibold">Tóm tắt điều chỉnh</h3>
            <Badge tone="info" icon="pencil">{readOnly ? 'ĐÃ GHI' : 'NHÁP'}</Badge>
          </div>
          <Info cols={2} items={[
            ['Thức ăn chênh lệch', `${changedFeeds} / ${lines.length}`],
            ['Tổng chênh lệch', totalDifferenceKg === null ? '—' : `${signed(totalDifferenceKg, 3)} kg`],
            ['Giá trị điều chỉnh', totalValue === null ? '—' : `${signed(totalValue, 0)} đ`],
            ['Chứng từ', `${docs.length} tệp`],
          ]} />
          {totalValue === null && <Note tone="warn">Chưa đủ dữ liệu để tính giá trị cho một số mặt hàng.</Note>}
          {!readOnly && (
            <>
              <Button variant="primary" block disabled={saving} onClick={() => void submit(true)}>{saving ? 'Đang lưu…' : 'Lưu điều chỉnh'}</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={saving} onClick={() => void submit(false)}>Lưu nháp</Button>
                <Button disabled={saving} onClick={() => navigate('/thuc-an')}>Hủy</Button>
              </div>
            </>
          )}
          {readOnly && <Button block onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button>}
        </Card>
      </div>

      <Card title="Đối chiếu tồn kho" sub={`${lines.length} thức ăn · dòng có chênh lệch bắt buộc chọn lý do`}>
        <Note tone="info">Điều chỉnh không sửa phiếu nhập hay nhật ký cho ăn đã ghi; mỗi dòng chênh lệch tạo 1 bút toán kho kèm lý do, người lập và thời điểm. Tồn sau điều chỉnh không âm.</Note>
        <AdjustmentLinesTable lines={lines} readOnly={readOnly || saving} onChange={updateLine} totalDifferenceKg={totalDifferenceKg} totalValue={totalValue} />
      </Card>

      <Card title="Chứng từ đính kèm">
        {!readOnly && <Dropzone hint="Biên bản kiểm kê, ảnh chụp · PDF, JPG ≤ 10MB" onFiles={(files) => setDocs((current) => [...current, ...files.map((file) => ({ name: file.name, ext: file.name.split('.').pop()?.toUpperCase() ?? 'TỆP' }))])} />}
        <Docs docs={docs} onRemove={readOnly ? undefined : (index) => setDocs((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
        {docs.length > 0 && <p className="m-0 text-[11px] text-muted">Tệp chưa được lưu lên máy chủ trong bản demo.</p>}
      </Card>

      <Foot>{FOOT}</Foot>
    </Layout>
  )
}

function AdjustmentLinesTable({ lines, readOnly, onChange, totalDifferenceKg, totalValue }: {
  lines: Line[]
  readOnly: boolean
  onChange?: (feedItemId: number, key: 'countedKg' | 'reason', value: string) => void
  totalDifferenceKg: number | null
  totalValue: number | null
}) {
  return (
    <>
      <datalist id="feed-adjustment-reasons">{REASON_SUGGESTIONS.map((reason) => <option key={reason} value={reason} />)}</datalist>
      <Table scroll stack={false}>
        <thead>
          <tr><Th>Thức ăn</Th><Th>Tồn hệ thống</Th><Th>Tồn thực tế</Th><Th>Chênh lệch</Th><Th>Lý do</Th><Th>Giá trị (đ)</Th></tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const changed = line.differenceKg !== null && Math.abs(line.differenceKg) > 0.0005
            return (
              <tr key={line.feedItemId ?? line.code} className={changed ? 'bg-warn-bg' : undefined}>
                <Td className="min-w-[130px] font-medium">{line.name}</Td>
                <Td className="whitespace-nowrap">{formatKg(line.systemKg, 3)}</Td>
                <Td className="min-w-[120px]">
                  {readOnly ? formatNumber(line.countedKg ?? 0, 3) : (
                    <input
                      aria-label={`Số đếm ${line.code}`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={line.countedKg ?? ''}
                      onChange={(event) => line.feedItemId !== undefined && onChange?.(line.feedItemId, 'countedKg', event.target.value)}
                      className={`${inputCls} w-[110px]`}
                    />
                  )}
                </Td>
                <Td className={`whitespace-nowrap ${changed ? 'text-err-fg' : ''}`}>
                  {line.differenceKg === null ? '—' : changed ? `${signed(line.differenceKg)} kg` : '0'}
                </Td>
                <Td className="min-w-[200px]">
                  {readOnly ? line.reason || '—' : changed ? (
                    <div className="relative">
                      <input
                        aria-label={`Lý do ${line.code}`}
                        list="feed-adjustment-reasons"
                        maxLength={500}
                        value={line.reason}
                        placeholder="Chọn hoặc nhập lý do"
                        onChange={(event) => line.feedItemId !== undefined && onChange?.(line.feedItemId, 'reason', event.target.value)}
                        className={`${inputCls} w-[240px] max-w-full pr-8`}
                      />
                      <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                  ) : '—'}
                </Td>
                <Td className="whitespace-nowrap">{line.differenceValue === null ? '—' : line.differenceValue === 0 ? '0' : signed(line.differenceValue, 0)}</Td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <Td className="font-semibold">Tổng</Td><Td /><Td />
            <Td className="whitespace-nowrap font-semibold">{totalDifferenceKg === null ? '—' : `${signed(totalDifferenceKg)} kg`}</Td>
            <Td />
            <Td className="whitespace-nowrap font-semibold">{totalValue === null ? '—' : signed(totalValue, 0)}</Td>
          </tr>
        </tfoot>
      </Table>
    </>
  )
}
