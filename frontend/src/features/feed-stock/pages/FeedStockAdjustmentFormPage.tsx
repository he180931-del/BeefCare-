import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { AttachmentList, Badge, Button, Card, DateInput, Field, FileDropzone, Foot, Icon, Info, inputCls, Note, PageHeader, Select, Table, Td, Th } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedStock } from '../api/feedStockApi'
import {
  downloadFeedStockAdjustmentAttachment,
  getFeedStockAdjustment,
  listFeedStockAdjustmentAttachments,
  listFeedStockAdjustments,
  postFeedStockAdjustment,
  removeFeedStockAdjustmentAttachment,
  saveFeedStockAdjustmentDraft,
  uploadFeedStockAdjustmentAttachment,
  feedStockAdjustmentServerBacked,
} from '../api/feedStockAdjustmentApi'
import { initialFeedStockAdjustmentForm, localFeedDate, nextFeedAdjustmentCode, previewFeedStockAdjustment } from '../domain/feedStockAdjustmentForm'
import { toFeedStockAdjustmentDraftInput } from '../api/feedStockAdjustmentPayload'
import { validateFeedStockAdjustmentForm } from '../validation/feedStockAdjustmentValidation'
import { formatKg, formatMoney, formatNumber } from '../domain/feedLabels'
import type { FeedReceiptAttachment } from '../types/feedReceipt'
import type { FeedStockAdjustment, FeedStockAdjustmentFormValues, FeedStockAdjustmentType } from '../types/feedStockAdjustment'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { newFeedCommandKey } from '../api/command'

const TITLE = 'Thức ăn › Kiểm kê'
const TYPE_LABELS: Record<FeedStockAdjustmentType, string> = {
  PERIODIC_COUNT: 'Kiểm kê định kỳ',
  LOSS: 'Thất thoát',
  SPOILAGE: 'Hư hỏng',
  OTHER: 'Khác',
}
const REASON_SUGGESTIONS = ['Hao hụt (héo, rơi vãi)', 'Ẩm mốc – hủy bỏ', 'Đếm lại, sai lệch sổ sách', 'Thất thoát']
const FOOT = 'Phiếu điều chỉnh kho khi kiểm kê hoặc hao hụt (Chủ trại, Quản lý). Nhập tồn thực tế; chênh lệch và giá trị tự tính theo giá nhập bình quân. Dòng có chênh lệch được tô nền và bắt buộc có lý do.'
const commandKey = () => newFeedCommandKey('feed-adjustment')

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
    const [stock, record, adjustments, attachments] = await Promise.all([
      listFeedStock(),
      id ? getFeedStockAdjustment(id) : Promise.resolve(null),
      feedStockAdjustmentServerBacked || id ? Promise.resolve([]) : listFeedStockAdjustments(),
      id && feedStockAdjustmentServerBacked ? listFeedStockAdjustmentAttachments(Number(id)) : Promise.resolve([] as FeedReceiptAttachment[]),
    ])
    return { stock, record, attachments, nextCode: feedStockAdjustmentServerBacked ? '' : nextFeedAdjustmentCode(adjustments.map((row) => row.code)) }
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

  if (id && !query.data.record) {
    return (
      <Layout title={TITLE} user="manager">
        <PageHeader title="Không tìm thấy phiếu kiểm kê" />
        <div><Button onClick={() => navigate('/thuc-an/kiem-ke')}>Quay lại danh sách</Button></div>
      </Layout>
    )
  }

  const draftFeedIds = new Set(query.data.record?.status === 'DRAFT' ? query.data.record.lines.map((line) => line.feedItemId) : [])
  const adjustmentStockRows = query.data.stock.filter((row) => row.available !== false || draftFeedIds.has(row.feedItemId))

  return (
    <FeedStockAdjustmentForm
      key={id ?? 'new-adjustment'}
      record={query.data.record}
      stockRows={adjustmentStockRows}
      nextCode={query.data.nextCode}
      initialAttachments={query.data.attachments}
    />
  )
}

function FeedStockAdjustmentForm({ record, stockRows, nextCode, initialAttachments }: {
  record: FeedStockAdjustment | null
  stockRows: Awaited<ReturnType<typeof listFeedStock>>
  nextCode: string
  initialAttachments: FeedReceiptAttachment[]
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FeedStockAdjustmentFormValues>(() => initialFeedStockAdjustmentForm(record, stockRows))
  const [currentRecord, setCurrentRecord] = useState(record)
  const [docs, setDocs] = useState<Array<{ name: string; ext: string }>>([])
  const [attachments, setAttachments] = useState(initialAttachments)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const saveKeyRef = useRef('')
  const postKeyRef = useRef('')
  const uploadKeysRef = useRef(new WeakMap<File, string>())
  const removeKeysRef = useRef(new Map<number, string>())
  const initialValues = initialFeedStockAdjustmentForm(record, stockRows)
  const savedFingerprintRef = useRef(record?.status === 'DRAFT' ? JSON.stringify(initialValues) : '')
  const hasUnavailableDraftLine = currentRecord?.status === 'DRAFT' && currentRecord.lines.some((line) => {
    const stock = stockRows.find((row) => row.feedItemId === line.feedItemId)
    return !stock || stock.available === false
  })
  const readOnly = (currentRecord?.status !== undefined && currentRecord.status !== 'DRAFT') || hasUnavailableDraftLine
  const statusLabel = currentRecord?.status === 'POSTED' ? 'Đã ghi' : currentRecord?.status === 'DRAFT' ? 'Nháp' : 'Mới'
  const title = !currentRecord ? 'Phiếu điều chỉnh kho' : `Phiếu điều chỉnh kho ${currentRecord.code} · ${statusLabel}`
  const previewRows = useMemo(() => {
    if (!currentRecord || currentRecord.status !== 'DRAFT' || currentRecord.countDate !== values.countDate) return stockRows
    const saved = new Map(currentRecord.lines.map((line) => [line.feedItemId, line]))
    return stockRows.map((stock) => {
      const line = saved.get(stock.feedItemId)
      return line ? {
        ...stock,
        onHandKg: line.systemKg,
        stockValue: line.unitCost === null ? stock.stockValue : line.systemKg * line.unitCost,
      } : stock
    })
  }, [currentRecord, stockRows, values.countDate])
  const preview = useMemo(() => previewFeedStockAdjustment(values, previewRows), [values, previewRows])
  const changedFeeds = readOnly && currentRecord
    ? currentRecord.lines.filter((line) => Math.abs(line.differenceKg) > 0.0005).length
    : preview.changedFeeds
  const totalDifferenceKg = readOnly && currentRecord ? currentRecord.totalDifferenceKg : preview.totalDifferenceKg
  const totalValue = readOnly && currentRecord ? currentRecord.totalValue : preview.totalValue

  const update = <K extends Exclude<keyof FeedStockAdjustmentFormValues, 'lines'>>(key: K, value: FeedStockAdjustmentFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    saveKeyRef.current = ''
    postKeyRef.current = ''
    setError('')
  }
  const updateLine = (feedItemId: number, key: 'countedKg' | 'reason', value: string) => {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) => line.feedItemId === feedItemId ? { ...line, [key]: value } : line),
    }))
    saveKeyRef.current = ''
    postKeyRef.current = ''
    setError('')
  }

  const uploadPendingFiles = async (adjustmentId: number) => {
    if (!feedStockAdjustmentServerBacked || newFiles.length === 0) return
    for (const file of newFiles) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: tệp vượt quá 10 MB.`)
      if (!['application/pdf', 'image/jpeg'].includes(file.type)) throw new Error(`${file.name}: chỉ chấp nhận PDF hoặc JPG.`)
      let key = uploadKeysRef.current.get(file)
      if (!key) {
        key = commandKey()
        uploadKeysRef.current.set(file, key)
      }
      const uploaded = await uploadFeedStockAdjustmentAttachment(adjustmentId, file, { key })
      uploadKeysRef.current.delete(file)
      setAttachments((current) => current.some((item) => item.id === uploaded.id) ? current : [...current, uploaded])
      setNewFiles((current) => current.filter((item) => item !== file))
    }
  }

  const viewAttachment = async (attachment: FeedReceiptAttachment) => {
    if (!currentRecord) return
    try {
      const blob = await downloadFeedStockAdjustmentAttachment(currentRecord.id, attachment.id)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (attachmentError) {
      setError(userFacingError(attachmentError, 'Không thể tải chứng từ phiếu kiểm kê.'))
    }
  }

  const removeAttachment = async (attachment: FeedReceiptAttachment) => {
    if (!currentRecord) return
    setError('')
    try {
      let key = removeKeysRef.current.get(attachment.id)
      if (!key) {
        key = commandKey()
        removeKeysRef.current.set(attachment.id, key)
      }
      await removeFeedStockAdjustmentAttachment(currentRecord.id, attachment.id, { key })
      removeKeysRef.current.delete(attachment.id)
      setAttachments((current) => current.filter((item) => item.id !== attachment.id))
    } catch (attachmentError) {
      setError(userFacingError(attachmentError, 'Không thể xóa chứng từ phiếu kiểm kê.'))
    }
  }

  const submit = async (postNow: boolean) => {
    if (savingRef.current || readOnly) return
    const validation = validateFeedStockAdjustmentForm(values, previewRows)
    if (validation) {
      setError(validation)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const fingerprint = JSON.stringify(values)
      let saved = currentRecord
      if (!saved || saved.status !== 'DRAFT' || savedFingerprintRef.current !== fingerprint) {
        if (!saveKeyRef.current) saveKeyRef.current = commandKey()
        saved = await saveFeedStockAdjustmentDraft({
          ...toFeedStockAdjustmentDraftInput(values, currentRecord?.id),
          ...(currentRecord ? { expectedVersion: currentRecord.version } : {}),
        }, { key: saveKeyRef.current })
        setCurrentRecord(saved)
        savedFingerprintRef.current = fingerprint
        saveKeyRef.current = ''
      }
      if (!saved) throw new Error('Không lưu được phiếu kiểm kê.')
      await uploadPendingFiles(saved.id)
      if (postNow) {
        if (!postKeyRef.current) postKeyRef.current = commandKey()
        const posted = await postFeedStockAdjustment(saved.id, saved.version, { key: postKeyRef.current })
        navigate('/thuc-an', { state: { feedStockMessage: `Phiếu điều chỉnh ${posted.code} đã ghi: ${formatNumber(posted.totalDifferenceKg)} kg (${posted.totalValue === null ? '—' : formatMoney(posted.totalValue)} đ).` } })
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
  const attachmentDocs = attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.originalFilename,
    ext: attachment.contentType === 'application/pdf' ? 'PDF' : 'JPG',
  }))
  const displayedDocs = feedStockAdjustmentServerBacked ? attachmentDocs : docs
  const attachmentCount = feedStockAdjustmentServerBacked ? attachments.length + newFiles.length : docs.length

  return (
    <Layout title={TITLE} user="manager">
      <PageHeader title={title} sub="Đối chiếu tồn thực tế với tồn hệ thống" />
      <FeedManagementTabs />
      {hasUnavailableDraftLine
        ? <Note tone="warn">Phiếu nháp có mặt hàng đã ngưng hoạt động; dữ liệu được giữ nguyên và phiếu đang ở chế độ chỉ xem.</Note>
        : readOnly && <Note tone="info">Phiếu đã ghi nhận; thông tin đang ở chế độ chỉ xem.</Note>}
      {error && <div role="alert" className="rounded-md border border-err-bg bg-white p-3 text-sm text-err-fg">{error}</div>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <Card title="Thông tin phiếu">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã phiếu" id="feed-adjustment-code">
              <input id="feed-adjustment-code" readOnly value={currentRecord?.code ?? (feedStockAdjustmentServerBacked ? 'Tự sinh khi lưu' : nextCode)} className={inputCls} />
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
            <Badge tone={currentRecord?.status === 'POSTED' ? 'ok' : 'info'} icon={currentRecord?.status === 'POSTED' ? 'circle-check' : 'pencil'}>{readOnly ? 'ĐÃ GHI' : currentRecord ? 'NHÁP' : 'MỚI'}</Badge>
          </div>
          <Info cols={2} items={[
            ['Thức ăn chênh lệch', `${changedFeeds} / ${lines.length}`],
            ['Tổng chênh lệch', totalDifferenceKg === null ? '—' : `${signed(totalDifferenceKg, 3)} kg`],
            ['Giá trị điều chỉnh', totalValue === null ? '—' : `${signed(totalValue, 0)} đ`],
            ['Chứng từ', `${attachmentCount} tệp`],
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
        {feedStockAdjustmentServerBacked && values.countDate !== currentRecord?.countDate && values.countDate !== localFeedDate() && <Note tone="warn">Máy chủ xác định lại tồn hệ thống tại ngày kiểm kê khi lưu phiếu.</Note>}
        <AdjustmentLinesTable lines={lines} readOnly={readOnly || saving} onChange={updateLine} totalDifferenceKg={totalDifferenceKg} totalValue={totalValue} />
      </Card>

      <Card title="Chứng từ đính kèm">
        {!readOnly && <FileDropzone label="Chọn chứng từ đính kèm" hint="Biên bản kiểm kê, ảnh chụp · PDF, JPG ≤ 10MB · tải lên khi lưu nháp hoặc ghi sổ" onFiles={(files) => feedStockAdjustmentServerBacked
          ? setNewFiles((current) => [...current, ...files])
          : setDocs((current) => [...current, ...files.map((file) => ({ name: file.name, ext: file.name.split('.').pop()?.toUpperCase() ?? 'TỆP' }))])} />}
        <AttachmentList items={displayedDocs.map((doc, index) => ({ key: `${feedStockAdjustmentServerBacked ? 'saved' : 'new'}:${index}`, name: doc.name, extension: doc.ext }))} onView={feedStockAdjustmentServerBacked ? (key) => { const item = attachments[Number(key.split(':')[1])]; if (item) void viewAttachment(item) } : undefined} onRemove={readOnly ? undefined : (key) => { const index = Number(key.split(':')[1]); if (feedStockAdjustmentServerBacked) { const item = attachments[index]; if (item) void removeAttachment(item) } else setDocs((current) => current.filter((_, itemIndex) => itemIndex !== index)) }} />
        {newFiles.map((file, index) => (
          <div className="flex items-center gap-2 text-xs" key={`${file.name}-${index}`}>
            <Badge>{file.type === 'application/pdf' ? 'PDF' : 'JPG'}</Badge><span>{file.name} · chờ tải lên</span><span className="flex-1" />
            <Button variant="link" size="sm" aria-label={`Bỏ tệp ${file.name}`} onClick={() => setNewFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Bỏ</Button>
          </div>
        ))}
        {!feedStockAdjustmentServerBacked && docs.length > 0 && <p className="m-0 text-[11px] text-muted">Tệp chưa được lưu lên máy chủ trong bản demo.</p>}
        {readOnly && displayedDocs.length === 0 && <p className="m-0 text-xs text-muted">Phiếu không có chứng từ đính kèm.</p>}
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
