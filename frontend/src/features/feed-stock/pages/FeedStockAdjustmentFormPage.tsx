import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, Note, PageHeader, Select, Table, Td, Th, Tile, Textarea, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStock } from '../api/feedStockApi'
import { getFeedStockAdjustment, postFeedStockAdjustmentDemo, saveFeedStockAdjustmentDemoDraft } from '../api/feedStockAdjustmentApi'
import {
  initialFeedStockAdjustmentForm,
  localFeedDate,
  previewFeedStockAdjustment,
  toFeedStockAdjustmentDraftInput,
  validateFeedStockAdjustmentForm,
} from '../data/feedStockAdjustmentForm'
import type { FeedStockAdjustment, FeedStockAdjustmentFormValues, FeedStockAdjustmentType } from '../types/feedStockAdjustment'
import FeedManagementTabs from '../components/FeedManagementTabs'

const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const currencyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const TYPE_LABELS: Record<FeedStockAdjustmentType, string> = {
  PERIODIC_COUNT: 'Kiểm kê định kỳ',
  LOSS: 'Thất thoát',
  SPOILAGE: 'Hư hỏng',
  OTHER: 'Khác',
}
const STATUS_LABELS: Record<string, string> = { DRAFT: 'Nháp', POSTED: 'Đã ghi nhận' }

export default function FeedStockAdjustmentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useQuery(async () => {
    if (backendMode === 'backend') {
      return { stock: [], record: id ? await getFeedStockAdjustment(id) : null }
    }
    const [stock, record] = await Promise.all([
      listFeedStock(),
      id ? getFeedStockAdjustment(id) : Promise.resolve(null),
    ])
    return { stock, record }
  }, [id])

  if (query.error) {
    return (
      <Layout title="Thức ăn – Kiểm kê" user="manager">
        <PageHeader title="Không thể mở phiếu kiểm kê" />
        <div role="alert" className="mb-4 text-sm text-err-fg">{userFacingError(query.error, 'Không thể mở phiếu kiểm kê.')}</div>
        <Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button>
      </Layout>
    )
  }

  if (query.loading || !query.data) {
    return <Layout title="Thức ăn – Kiểm kê" user="manager"><p role="status" className="m-0 text-xs text-muted">Đang tải phiếu kiểm kê…</p></Layout>
  }

  if (backendMode === 'backend') {
    if (!query.data.record) {
      return (
        <Layout title="Thức ăn – Kiểm kê" user="manager">
          <PageHeader title="Kiểm kê / điều chỉnh tồn kho" sub="Một số thông tin chưa sẵn sàng." />
          <FeedManagementTabs />
          <Note tone="warn">Lưu nháp và ghi nhận kiểm kê hiện chỉ hoạt động trong bản demo.</Note>
          <Button className="mt-4" onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button>
        </Layout>
      )
    }
    return <BackendAdjustmentDetail record={query.data.record} />
  }

  if (id && !query.data.record) {
    return (
      <Layout title="Thức ăn – Kiểm kê" user="manager">
        <PageHeader title="Không tìm thấy phiếu kiểm kê" />
        <Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button>
      </Layout>
    )
  }

  return (
    <FeedStockAdjustmentForm
      key={id ?? 'new-adjustment'}
      record={query.data.record}
      stockRows={query.data.stock}
    />
  )
}

function BackendAdjustmentDetail({ record }: { record: FeedStockAdjustment }) {
  const navigate = useNavigate()
  return (
    <Layout title="Thức ăn – Kiểm kê" user="manager">
      <PageHeader title="Chi tiết phiếu kiểm kê / điều chỉnh" sub={record.code}>
        <Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button>
      </PageHeader>
      <FeedManagementTabs />
      <Card title="Thông tin phiếu">
        <dl className="m-0 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Ngày kiểm kê</dt><dd className="m-0 font-medium">{record.countDate}</dd></div>
          <div><dt className="text-muted">Loại</dt><dd className="m-0 font-medium">{TYPE_LABELS[record.adjustmentType as FeedStockAdjustmentType] ?? record.adjustmentType}</dd></div>
          <div><dt className="text-muted">Người kiểm kê</dt><dd className="m-0 font-medium">{record.countedBy || '—'}</dd></div>
          <div><dt className="text-muted">Trạng thái</dt><dd className="m-0 font-medium">{STATUS_LABELS[record.status] ?? record.status}</dd></div>
        </dl>
      </Card>
      <div className="mt-4">
        <AdjustmentLinesTable lines={record.lines.map((line) => ({
          code: line.feedCode,
          name: line.feedName,
          systemKg: line.systemKg,
          countedKg: line.countedKg,
          differenceKg: line.differenceKg,
          reason: line.reason ?? '',
          differenceValue: line.differenceValue,
        }))} readOnly />
      </div>
      <Note tone="warn">Phiếu đang ở chế độ chỉ xem. Ghi nhận và lưu nháp hiện chỉ hoạt động trong bản demo.</Note>
    </Layout>
  )
}

function FeedStockAdjustmentForm({ record, stockRows }: {
  record: FeedStockAdjustment | null
  stockRows: Awaited<ReturnType<typeof listFeedStock>>
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FeedStockAdjustmentFormValues>(() => initialFeedStockAdjustmentForm(record, stockRows))
  const [currentRecord, setCurrentRecord] = useState(record)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const readOnly = currentRecord?.status !== undefined && currentRecord.status !== 'DRAFT'
  const title = !currentRecord ? 'Tạo phiếu kiểm kê / điều chỉnh' : readOnly ? 'Chi tiết phiếu kiểm kê / điều chỉnh' : 'Sửa phiếu kiểm kê / điều chỉnh'
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
        navigate('/thuc-an', { state: { feedStockMessage: `Đã ghi nhận phiếu ${saved.code} trong bản demo.` } })
      } else {
        navigate('/thuc-an/kiem-ke', { state: { adjustmentMessage: `Đã lưu nháp phiếu ${saved.code} trong bản demo.` } })
      }
    } catch (saveError) {
      setError(userFacingError(saveError, 'Không thể lưu phiếu kiểm kê. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const previewLines = readOnly && currentRecord
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
    <Layout title="Thức ăn – Kiểm kê" user="manager">
      <PageHeader title={title} sub="Đối chiếu số đếm thực tế với lượng tồn hiện tại.">
        <Button disabled={saving} onClick={() => navigate('/thuc-an')}>Quay lại tồn kho</Button>
        <Button disabled={saving} onClick={() => navigate('/thuc-an/kiem-ke')}>Danh sách phiếu</Button>
      </PageHeader>

      <Badge tone="info">Dữ liệu minh họa</Badge>
      <FeedManagementTabs />
      {readOnly && <Note tone="info">Phiếu đã ghi nhận; thông tin đang ở chế độ chỉ xem.</Note>}
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Thông tin phiếu">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Số phiếu" id="feed-adjustment-code">
                <input id="feed-adjustment-code" readOnly value={currentRecord?.code ?? 'Tạo khi lưu nháp'} className={inputCls} />
              </Field>
              <Field label="Ngày kiểm kê *" id="feed-adjustment-date">
                <input id="feed-adjustment-date" aria-label="Ngày kiểm kê" type="date" max={localFeedDate()} disabled={readOnly || saving} value={values.countDate} onChange={(event) => update('countDate', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Loại kiểm kê *" id="feed-adjustment-type">
                <Select id="feed-adjustment-type" aria-label="Loại kiểm kê" disabled={readOnly || saving} value={values.adjustmentType} onChange={(event) => update('adjustmentType', event.target.value as FeedStockAdjustmentType)}>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Người kiểm kê" id="feed-adjustment-counted-by">
                <input id="feed-adjustment-counted-by" aria-label="Người kiểm kê" maxLength={200} disabled={readOnly || saving} value={values.countedBy} onChange={(event) => update('countedBy', event.target.value)} className={inputCls} />
              </Field>
            </div>
          </Card>

          <Card title="Đối chiếu tồn kho" sub="Nhập số lượng đếm được. Chênh lệch âm được phép.">
            <AdjustmentLinesTable lines={previewLines} readOnly={readOnly || saving} onChange={updateLine} />
          </Card>
          <Note>Việc ghi nhận kiểm kê chỉ điều chỉnh tồn kho hiện tại, không thay đổi phiếu nhập hoặc nhật ký cho ăn trước đó.</Note>
        </div>

        <aside className="flex flex-col gap-3">
          <Tile label="Mặt hàng chênh lệch" value={changedFeeds} note="Mặt hàng cần đối chiếu" />
          <Tile label="Tổng chênh lệch" value={totalDifferenceKg === null ? '—' : `${quantityFormat.format(totalDifferenceKg)} kg`} note="Tổng số đếm trừ tồn hệ thống" />
          <Tile label="Giá trị điều chỉnh" value={totalValue === null ? '—' : `${currencyFormat.format(totalValue)} đ`} note="Theo giá trị tồn hiện có" />
          {totalValue === null && <Note tone="warn">Chưa đủ dữ liệu để tính giá trị cho một số mặt hàng.</Note>}
          <div className="flex flex-col gap-2 rounded-md border border-edge bg-white p-4">
            <strong className="text-xs">Hoàn tất phiếu</strong>
            <span className="text-xs text-muted">Sau khi ghi nhận, phiếu sẽ không thể sửa.</span>
            <Button variant="primary" disabled={saving || readOnly} onClick={() => submit(true)}>{saving ? 'Đang lưu…' : 'Ghi nhận điều chỉnh'}</Button>
            <Button disabled={saving || readOnly} onClick={() => submit(false)}>{saving ? 'Đang lưu…' : 'Lưu nháp'}</Button>
            <Button disabled={saving} onClick={() => navigate('/thuc-an')}>Hủy</Button>
          </div>
        </aside>
      </div>
    </Layout>
  )
}

function AdjustmentLinesTable({ lines, readOnly, onChange }: {
  lines: Array<{
    code: string
    name: string
    systemKg: number
    countedKg: number | null
    differenceKg: number | null
    reason: string
    differenceValue: number | null
    feedItemId?: number
  }>
  readOnly: boolean
  onChange?: (feedItemId: number, key: 'countedKg' | 'reason', value: string) => void
}) {
  return (
    <Table scroll>
      <thead><tr>
        <Th>Mã / Thức ăn</Th><Th>Tồn hệ thống (kg)</Th><Th>Số đếm (kg)</Th><Th>Chênh lệch (kg)</Th><Th>Lý do</Th><Th>Giá trị (đ)</Th>
      </tr></thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.feedItemId ?? line.code}>
            <Td><strong>{line.code}</strong><span className="block text-muted">{line.name}</span></Td>
            <Td>{quantityFormat.format(line.systemKg)}</Td>
            <Td>
              {readOnly ? quantityFormat.format(line.countedKg ?? 0) : (
                <input
                  aria-label={`Số đếm ${line.code}`}
                  type="number"
                  min="0"
                  step="0.001"
                  value={line.countedKg ?? ''}
                  onChange={(event) => line.feedItemId !== undefined && onChange?.(line.feedItemId, 'countedKg', event.target.value)}
                  className={`${inputCls} min-w-[110px]`}
                />
              )}
            </Td>
            <Td className={line.differenceKg !== null && line.differenceKg < 0 ? 'text-err-fg' : 'text-ok-fg'}>
              {line.differenceKg === null ? '—' : `${line.differenceKg > 0 ? '+' : ''}${quantityFormat.format(line.differenceKg)}`}
            </Td>
            <Td>
              {readOnly ? line.reason || '—' : (
                <Textarea
                  aria-label={`Lý do ${line.code}`}
                  value={line.reason}
                  placeholder={line.differenceKg === 0 ? 'Không bắt buộc' : 'Nhập lý do chênh lệch'}
                  onChange={(event) => line.feedItemId !== undefined && onChange?.(line.feedItemId, 'reason', event.target.value)}
                  className="min-w-[180px]"
                />
              )}
            </Td>
            <Td>{line.differenceValue === null ? '—' : currencyFormat.format(line.differenceValue)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
