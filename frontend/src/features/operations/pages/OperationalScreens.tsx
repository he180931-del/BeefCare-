import { useMemo, useState } from 'react'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Button, Field, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import { configForFeature } from '../data/operationalFixtures'
import { createOperationalRow, isPreviewOperationalRow, loadOperationalRows, saveOperationalRows, type PreviewOperationalRow } from '../data/operationalStore'

function toComparableDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.slice(0, 10)
}

function today() { return new Date().toISOString().slice(0, 10) }
function statuses(rows: PreviewOperationalRow[]) { return [...new Set(rows.map((row) => row.status))] }

export function OperationalScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role: Exclude<ScreenRole, 'guest'> }) {
  const config = configForFeature(screen.feature)
  const canWrite = state !== 'read-only' && !(role === 'manager' && screen.feature === 'herd-exit')
  const [rows, setRows] = useState<PreviewOperationalRow[]>(() => loadOperationalRows(screen.feature, config.rows))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [recordDate, setRecordDate] = useState(today)
  const [message, setMessage] = useState<{ tone: 'err' | 'ok'; body: string } | null>(null)

  const visible = useMemo(() => rows.filter((row) => {
    const matchesQuery = !query || `${row.code} ${row.subject} ${row.detail}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === 'ALL' || row.status === status) && (!from || toComparableDate(row.date) >= from)
  }), [from, query, rows, status])
  const selected = rows.find((row) => row.code === selectedCode)
  const selectedPreview = Boolean(selected && isPreviewOperationalRow(selected))
  const resetFilters = () => { setQuery(''); setStatus('ALL'); setFrom('') }
  const openDetails = (row: PreviewOperationalRow) => {
    setSelectedCode(row.code); setMessage(null)
    window.setTimeout(() => document.getElementById(`operational-detail-${screen.feature}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  const create = () => {
    if (!subject.trim() || !detail.trim()) { setMessage({ tone: 'err', body: 'Nhập tên và thông tin chi tiết trước khi lưu.' }); return }
    const saved = createOperationalRow(screen.feature, config.rows, { subject: subject.trim(), detail: detail.trim(), date: recordDate.split('-').reverse().join('/'), status: 'Đang xử lý' })
    setRows(loadOperationalRows(screen.feature, [...config.rows, saved]))
    setSelectedCode(saved.code); setCreating(false); setSubject(''); setDetail(''); setRecordDate(today())
    setMessage({ tone: 'ok', body: `Đã lưu ${saved.code} trong dữ liệu cục bộ.` })
    window.setTimeout(() => document.getElementById(`operational-detail-${screen.feature}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  const closeSelected = () => {
    if (!selected || selectedPreview) return
    const next = rows.map((row) => row.code === selected.code ? { ...row, status: 'Đã hoàn tất' } : row)
    setRows(next); saveOperationalRows(screen.feature, next)
    setMessage({ tone: 'ok', body: `Đã cập nhật ${selected.code} thành Đã hoàn tất.` })
  }

  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} rows={6} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Dữ liệu công việc chưa được cập nhật. Hãy thử tải lại.</InlineMessage>

  return <>
    <PageHeader title={screen.viTitle} sub="Theo dõi công việc theo trạng thái, thời hạn và đối tượng." badge={<FixtureNotice />}>{canWrite && state !== 'empty' && <Button variant="primary" onClick={() => { setCreating((value) => !value); setMessage(null) }}>{creating ? 'Đóng biểu mẫu' : config.primaryAction}</Button>}</PageHeader>
    {creating && <WorkSection title={config.primaryAction} description="Bản ghi được lưu cục bộ trong trình duyệt để duyệt luồng giao diện."><div className="grid max-w-3xl gap-4 md:grid-cols-2"><Field label={config.columns[1]} id={`operational-subject-${screen.feature}`}><input id={`operational-subject-${screen.feature}`} value={subject} onChange={(event) => setSubject(event.target.value)} className={inputCls} placeholder="Nhập nội dung chính" /></Field><Field label="Ngày ghi nhận" id={`operational-date-${screen.feature}`}><input id={`operational-date-${screen.feature}`} type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} className={inputCls} /></Field><div className="md:col-span-2"><Field label="Thông tin chi tiết" id={`operational-detail-${screen.feature}`}><textarea id={`operational-detail-${screen.feature}`} value={detail} onChange={(event) => setDetail(event.target.value)} className={`${inputCls} min-h-24`} placeholder="Ví dụ: chuồng, loại công việc hoặc lưu ý cần theo dõi" /></Field></div></div><div className="mt-4 flex flex-wrap gap-3"><Button variant="primary" onClick={create}>Lưu bản ghi</Button><Button onClick={() => setCreating(false)}>Hủy</Button></div>{message?.tone === 'err' && <InlineMessage className="mt-4" tone="err">{message.body}</InlineMessage>}</WorkSection>}
    <WorkSection title="Danh sách" description="Lọc nhanh trước khi mở từng hồ sơ; không cần chuyển sang màn hình trung gian.">
      <FilterBar actions={<Button small onClick={resetFilters}>Đặt lại</Button>}>
        <input aria-label="Tìm kiếm" value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputCls} min-w-52 flex-1`} placeholder="Tìm theo mã, tên bò hoặc nội dung…" />
        <select aria-label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputCls} w-44`}><option value="ALL">Tất cả trạng thái</option>{statuses(rows).map((item) => <option key={item}>{item}</option>)}</select>
        <label className="text-xs font-semibold text-ink">Từ ngày<input aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputCls} mt-1 w-40`} /></label>
      </FilterBar>
      {state === 'empty' ? <EmptyState title={config.emptyTitle} description="Thử thay đổi bộ lọc hoặc tạo bản ghi đầu tiên." actionLabel={config.primaryAction} onAction={() => setCreating(true)} compact /> : !visible.length ? <EmptyState title="Không có bản ghi khớp bộ lọc" description="Thử xóa từ khóa, trạng thái hoặc mốc ngày để xem lại." actionLabel="Đặt lại bộ lọc" onAction={resetFilters} compact /> : <Table><thead><tr>{config.columns.map((column) => <Th key={column}>{column}</Th>)}<Th /></tr></thead><tbody>{visible.map((row) => <tr key={row.code}><Td>{row.code}</Td><Td><strong>{row.subject}</strong><div className="mt-1 text-[11px] text-subtle">{row.detail}</div></Td><Td>{row.date}</Td><Td><span className="font-medium text-ink">{row.status}</span></Td><Td><Button small onClick={() => openDetails(row)}>Mở</Button></Td></tr>)}</tbody></Table>}
    </WorkSection>
    {selected && <div id={`operational-detail-${screen.feature}`}><WorkSection title={`Chi tiết · ${selected.code}`} description={selectedPreview ? 'Dữ liệu thử để kiểm tra bảng dài; chỉ xem và không lưu.' : 'Bản ghi cục bộ có thể cập nhật khi đang duyệt giao diện.'}><dl className="m-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Nội dung</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{selected.subject}</dd></div><div><dt className="text-xs text-subtle">Chi tiết</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{selected.detail}</dd></div><div><dt className="text-xs text-subtle">Ngày</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{selected.date}</dd></div><div><dt className="text-xs text-subtle">Trạng thái</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{selected.status}</dd></div></dl>{selectedPreview ? <InlineMessage className="mt-4" tone="info" title="Dữ liệu thử · chỉ xem">Chọn một bản ghi thật để cập nhật trạng thái.</InlineMessage> : canWrite && selected.status !== 'Đã hoàn tất' ? <div className="mt-4"><Button onClick={closeSelected}>Đánh dấu hoàn tất</Button></div> : null}{message?.tone === 'ok' && <InlineMessage className="mt-4" tone="ok">{message.body}</InlineMessage>}</WorkSection></div>}
  </>
}
