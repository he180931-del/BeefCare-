import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, Info, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, SummaryStrip, WorkSection } from '../../../components/workspace'
import { initialCows, MANAGER, type CowSeed } from '../../../data/cowsData'
import type { CattleEvent } from '../../../types'
import { loadParameters } from '../../catalogue/catalogueStore'

const STORAGE_KEY = 'beefcare-ui-demo'
const MAX_WEIGHT = 1500
const BCS_MIN = 1
const BCS_MAX = 5
const WEIGHING_INTERVAL_DAYS = 30
const ACTIVE_MEMBERS = ['Trần Quốc Long', 'Nguyễn Văn Hùng', 'Lê Thu Hà']

type GrowthStatus = 'VALID' | 'CORRECTED' | 'EXCLUDED' | 'VOIDED'
type GrowthMethod = 'ELECTRONIC_SCALE' | 'TAPE' | 'OTHER_ESTIMATE'
export type GrowthRecord = {
  id: string
  originalId: string
  version: number
  measuredAt: string
  date?: string
  weightKg?: number | null
  weight?: number | string | null
  bcs?: number | string | null
  method?: GrowthMethod | string
  basis?: 'MEASURED' | 'ESTIMATED' | string
  note?: string
  measuredBy?: string
  measurer?: string
  status: GrowthStatus
  reason?: string
  adg?: string
  correctedAt?: string
  recordedAt?: string
  actor?: string
}
type StoredRoot = { account?: Record<string, unknown>; [key: string]: unknown }

function readRoot(): StoredRoot {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as StoredRoot } catch { return {} }
}
function read<T>(key: string, fallback: T): T { return (readRoot().account?.[key] as T | undefined) ?? fallback }
function write(key: string, value: unknown) {
  const root = readRoot()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...root, account: { ...(root.account || {}), [key]: value } }))
}
const editable = (role?: ScreenRole) => role === 'manager'
const cows = () => read<CowSeed[]>('cattle-preview', initialCows)
const todayInput = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16) }

function parseDate(value: unknown): Date | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(raw)) { const date = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw); return Number.isNaN(date.getTime()) ? null : date }
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?/) 
  if (!match) return null
  const date = new Date(Number(match[3] || new Date().getFullYear()), Number(match[2]) - 1, Number(match[1]))
  return Number.isNaN(date.getTime()) ? null : date
}
const dateKey = (value: unknown) => parseDate(value)?.getTime() || 0
const formatDateTime = (value: string) => { const date = parseDate(value); return date ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) : value || '—' }
const formatDate = (value: string) => { const date = parseDate(value); return date ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : value || '—' }
function toInputDateTime(value?: string) { const date = parseDate(value); if (!date) return todayInput(); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16) }
function numberValue(value: unknown): number | null { if (value == null || String(value).trim() === '' || String(value).trim() === '—') return null; const number = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, '')); return Number.isFinite(number) ? number : null }
const formatNumber = (value: number | null, digits = 1) => value == null ? '—' : value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
function methodLabel(value?: string) { if (value === 'ELECTRONIC_SCALE' || /điện tử|electronic/i.test(value || '')) return 'Cân điện tử'; if (value === 'TAPE' || /thước dây|tape/i.test(value || '')) return 'Thước dây'; return value ? 'Ước tính khác' : '—' }
const basisFor = (method?: string) => method === 'ELECTRONIC_SCALE' || /điện tử|electronic/i.test(method || '') ? 'MEASURED' : 'ESTIMATED'
const basisLabel = (value?: string) => value === 'MEASURED' ? 'Đo thực tế' : 'Ước tính'
const isValidRecord = (record: GrowthRecord) => record.status !== 'EXCLUDED' && record.status !== 'VOIDED'

function normalizeRecord(raw: Partial<GrowthRecord>, cow: CowSeed, index: number): GrowthRecord {
  const measuredAt = String(raw.measuredAt || raw.date || cow.weightDate || '')
  const id = String(raw.id || `${cow.code}-${measuredAt || 'record'}-${index + 1}-v${raw.version || 1}`)
  const originalId = String(raw.originalId || id.replace(/-v\d+$/, ''))
  const method = String(raw.method || raw.basis || 'ELECTRONIC_SCALE')
  const weight = numberValue(raw.weightKg ?? raw.weight)
  const bcs = numberValue(raw.bcs)
  const actor = String(raw.actor || raw.measuredBy || raw.measurer || 'Hệ thống')
  return { ...raw, id, originalId, version: Number(raw.version || 1), measuredAt, date: raw.date || measuredAt, weightKg: weight, weight, bcs, method, basis: raw.basis === 'MEASURED' || raw.basis === 'ESTIMATED' ? raw.basis : basisFor(method), measuredBy: raw.measuredBy || raw.measurer || actor, actor, recordedAt: raw.recordedAt || raw.correctedAt || measuredAt, status: raw.status || 'VALID' }
}
function growthRows(cow: CowSeed): GrowthRecord[] {
  const fallback: Partial<GrowthRecord>[] = cow.weight != null || numberValue(cow.care?.bcs) != null ? [{ id: `${cow.code}-${cow.weightDate || 'seed'}-v1`, originalId: `${cow.code}-${cow.weightDate || 'seed'}`, version: 1, measuredAt: cow.weightDate || '', weightKg: cow.weight, bcs: cow.care?.bcs, method: cow.weightEst ? 'TAPE' : 'ELECTRONIC_SCALE', basis: cow.weightEst ? 'ESTIMATED' : 'MEASURED', measuredBy: 'Hệ thống', status: 'VALID' }] : []
  const stored = read<Partial<GrowthRecord>[]>(`growth-${cow.code}`, fallback)
  return (Array.isArray(stored) ? stored : fallback).map((row, index) => normalizeRecord(row, cow, index))
}
function effectiveRows(rows: GrowthRecord[]) { const latest = new Map<string, GrowthRecord>(); rows.forEach((row) => { const previous = latest.get(row.originalId); if (!previous || row.version > previous.version || (row.version === previous.version && dateKey(row.recordedAt) >= dateKey(previous.recordedAt))) latest.set(row.originalId, row) }); return [...latest.values()].sort((a, b) => dateKey(b.measuredAt) - dateKey(a.measuredAt)) }
const validRows = (rows: GrowthRecord[]) => effectiveRows(rows).filter(isValidRecord)
const latestValid = (rows: GrowthRecord[]) => validRows(rows)[0]
export const latestWeight = (rows: GrowthRecord[]) => { const valid = validRows(rows).filter((row) => numberValue(row.weightKg ?? row.weight) != null); return valid.find((row) => row.basis === 'MEASURED') || valid.find((row) => row.basis !== 'MEASURED') }
const latestBcs = (rows: GrowthRecord[]) => validRows(rows).find((row) => numberValue(row.bcs) != null)
const inPeriod = (value: string, period: number) => { const at = dateKey(value); return Boolean(at) && at >= Date.now() - period * 86_400_000 && at <= Date.now() }
const rowsForPeriod = (rows: GrowthRecord[], period: number) => validRows(rows).filter((row) => inPeriod(row.measuredAt, period))
export function adgBetween(rows: GrowthRecord[]) {
  const ordered = [...rows].filter((row) => numberValue(row.weightKg ?? row.weight) != null).sort((a, b) => dateKey(a.measuredAt) - dateKey(b.measuredAt))
  if (ordered.length < 2) return null
  const first = numberValue(ordered[0].weightKg ?? ordered[0].weight); const last = numberValue(ordered.at(-1)?.weightKg ?? ordered.at(-1)?.weight); const days = (dateKey(ordered.at(-1)?.measuredAt) - dateKey(ordered[0].measuredAt)) / 86_400_000
  return first == null || last == null || days < 14 ? null : (last - first) / days
}
function adgForRecord(record: GrowthRecord, rows: GrowthRecord[]) { const prior = rows.filter((row) => dateKey(row.measuredAt) < dateKey(record.measuredAt) && numberValue(row.weightKg ?? row.weight) != null).sort((a, b) => dateKey(b.measuredAt) - dateKey(a.measuredAt))[0]; const currentWeight = numberValue(record.weightKg ?? record.weight); const priorWeight = numberValue(prior?.weightKg ?? prior?.weight); const days = prior ? (dateKey(record.measuredAt) - dateKey(prior.measuredAt)) / 86_400_000 : 0; return currentWeight == null || priorWeight == null || days < 14 ? null : (currentWeight - priorWeight) / days }
export const entryDate = (cow: CowSeed): number | null => {
  const extended = cow as CowSeed & { entryDate?: string; entryTime?: string; herdEntryDate?: string; createdAt?: string; registeredAt?: string; farmBornRegisteredAt?: string; birthDate?: string }
  const candidates = [cow.importRecord?.date, extended.entryDate, extended.entryTime, extended.herdEntryDate, extended.farmBornRegisteredAt, extended.registeredAt, extended.createdAt, extended.birthDate, cow.birth]
  const value = candidates.map(dateKey).find((item) => item > 0 && item <= Date.now())
  return value || null
}
const entryDateLabel = (cow: CowSeed) => { const date = entryDate(cow); return date ? formatDate(new Date(date).toISOString()) : '—' }
export const largeChangeWithinWindow = (previousWeight: number | null, nextWeight: number | null, nextAt: string, previousAt?: string) => {
  if (previousWeight == null || nextWeight == null || previousWeight <= 0 || !previousAt) return false
  const days = (dateKey(nextAt) - dateKey(previousAt)) / 86_400_000
  return days >= 0 && days <= WEIGHING_INTERVAL_DAYS && Math.abs(nextWeight - previousWeight) / previousWeight > 0.2
}

function growthEvent(record: GrowthRecord, cowCode: string): CattleEvent {
  const weight = numberValue(record.weightKg ?? record.weight)
  const bcs = numberValue(record.bcs)
  const label = record.status === 'EXCLUDED' ? 'Đã loại trừ' : record.status === 'VOIDED' ? 'Đã hủy' : record.status === 'CORRECTED' ? 'Đã chỉnh sửa' : basisLabel(record.basis)
  return { id: `growth-${cowCode}-${record.id}`, sourceId: record.id, status: record.status === 'CORRECTED' || record.status === 'EXCLUDED' || record.status === 'VOIDED' ? record.status : undefined, recordedAt: record.recordedAt, at: record.measuredAt, cat: 'weight', title: `${record.status === 'CORRECTED' ? 'Sửa số đo' : 'Đánh giá tăng trưởng'}${weight == null ? '' : ` · ${formatNumber(weight)} kg`}`, badge: { label, tone: record.status === 'EXCLUDED' || record.status === 'VOIDED' ? 'err' : record.status === 'CORRECTED' ? 'warn' : record.basis === 'MEASURED' ? 'ok' : 'warn' }, detail: `${bcs == null ? 'Chưa ghi BCS' : `BCS ${formatNumber(bcs)} / 5`} · ${methodLabel(record.method)}`, meta: `Xảy ra ${formatDateTime(record.measuredAt)} · ghi ${formatDateTime(record.recordedAt || record.measuredAt)} · ${record.actor || record.measuredBy || 'Hệ thống'}` }
}

function updateLatestCow(code: string, rows: GrowthRecord[]) {
  const valid = validRows(rows)
  const latestWeightRow = latestWeight(rows)
  const latestBcsRow = latestBcs(rows)
  const weight = numberValue(latestWeightRow?.weightKg ?? latestWeightRow?.weight)
  const bcs = numberValue(latestBcsRow?.bcs)
  write('cattle-preview', cows().map((cow) => {
    if (cow.code !== code) return cow
    const existingEvents = (cow.events || []).filter((event) => !event.id.startsWith(`growth-${code}-`))
    const reminders = (cow.care?.reminders || []).filter((reminder) => reminder.title !== 'Cân định kỳ')
    const due = latestWeightRow?.measuredAt ? new Date(dateKey(latestWeightRow.measuredAt) + WEIGHING_INTERVAL_DAYS * 86_400_000).toISOString() : ''
    if (due) reminders.push({ title: 'Cân định kỳ', due: { label: formatDate(due), tone: dateKey(due) < Date.now() ? 'warn' : undefined } })
    const adg = adgBetween(valid)
    return { ...cow, weight, weightEst: latestWeightRow?.basis === 'ESTIMATED', weightDate: latestWeightRow?.measuredAt || '', events: [...existingEvents, ...rows.map((row) => growthEvent(row, code))], care: { ...cow.care, last: latestWeightRow && weight != null ? `${formatNumber(weight)} kg · ${formatDate(latestWeightRow.measuredAt)}` : '—', bcs: latestBcsRow && bcs != null ? `${formatNumber(bcs)} / 5` : '—', adg: adg == null ? '—' : `${formatNumber(adg, 2)} kg/ngày`, reminders } }
  }))
}

function useGrowthCow() {
  const [params] = useSearchParams()
  const queryCode = params.get('code')?.trim() || ''
  const storedCode = read<{ code?: string }>('selected-cattle', {}).code?.trim() || ''
  const code = queryCode || storedCode
  const cow = code ? cows().find((item) => item.code === code) : undefined
  return { cow, code, queryCode }
}
function profileRoute(id: string, code: string) { return `/ui/${id.toLowerCase()}?code=${encodeURIComponent(code)}` }
function ProfileTabs({ screen, cow }: { screen: ScreenDefinition; cow: CowSeed }) {
  const nav = useNavigate()
  const tabs: Array<[string, string, boolean]> = [['SCR-27', 'Tổng quan', true], ['SCR-79', 'Dòng thời gian', true], ['SCR-43', 'Tăng trưởng', true], ['SCR-49', 'Tiêm phòng', true], ['SCR-54', 'Sức khỏe', true], ['SCR-60', 'Sinh sản', cow.sex !== 'Đực'], ['SCR-28', 'Chuồng', true], ['SCR-29', 'QR', true]]
  return <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-rule pb-3" aria-label="Tab hồ sơ bò">{tabs.filter(([, , visible]) => visible).map(([id, label]) => <button key={id} type="button" aria-current={screen.id === id ? 'page' : undefined} className={`border-b-2 px-1 pb-2 text-xs font-semibold ${screen.id === id ? 'border-brand text-brand' : 'border-transparent text-subtle hover:border-brand hover:text-brand'}`} onClick={() => nav(profileRoute(id, cow.code))}>{label}</button>)}</nav>
}
function Shell({ screen, children, actions, cow }: { screen: ScreenDefinition; children: ReactNode; actions?: ReactNode; cow?: CowSeed }) { return <div className="flex w-full min-w-0 flex-col gap-6"><PageHeader title={screen.viTitle} sub="Theo dõi chỉ số tăng trưởng và lịch sử cân đo của đàn bò." badge={<FixtureNotice />}>{actions}</PageHeader>{cow && screen.id === 'SCR-43' && <><div className="border-b border-rule pb-2 text-xs text-subtle"><strong className="text-ink">{cow.code}</strong> · {cow.name || 'Chưa đặt tên'} · {cow.breed || '—'} · {cow.sex || '—'} · Chuồng {cow.barn || '—'}</div><ProfileTabs screen={screen} cow={cow} /></>}{children}</div> }
type RowStatus = { label: string; tone: 'ok' | 'warn' | 'err' | 'outline' }
function rowStatus(cow: CowSeed, period: number, penAverage: number | null): RowStatus { const rows = growthRows(cow); const latest = latestWeight(rows); const adg = adgBetween(rowsForPeriod(rows, period)); const bcs = numberValue(latestBcs(rows)?.bcs); if (!latest || !inPeriod(latest.measuredAt, WEIGHING_INTERVAL_DAYS)) return { label: 'Quá hạn cân', tone: 'warn' }; if (adg != null && penAverage != null && adg < penAverage) return { label: 'ADG thấp', tone: 'warn' }; if (bcs != null && bcs < 2.5) return { label: 'BCS thấp', tone: 'err' }; return { label: 'Bình thường', tone: 'ok' }
}

function GrowthListV2({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const nav = useNavigate(); const [query, setQuery] = useState(''); const [period, setPeriod] = useState(90); const [pen, setPen] = useState('ALL'); const [group, setGroup] = useState('ALL'); const [stage, setStage] = useState('ALL'); const [sort, setSort] = useState<'date' | 'code'>('date'); const [ascending, setAscending] = useState(false); const [recordCode, setRecordCode] = useState(() => read<{ code?: string }>('selected-cattle', {}).code || '')
  const allCows = useMemo(() => cows().filter((cow) => cow.inList !== false && cow.status === 'ACTIVE'), []); const metricsRows = useMemo(() => allCows.map((cow) => ({ cow, rows: growthRows(cow) })), [allCows])
  const penAverages = useMemo(() => { const grouped = new Map<string, number[]>(); metricsRows.forEach(({ cow, rows }) => { const adg = adgBetween(rowsForPeriod(rows, period)); if (adg != null) grouped.set(cow.barn, [...(grouped.get(cow.barn) || []), adg]) }); return new Map([...grouped].map(([barn, values]) => [barn, values.reduce((sum, value) => sum + value, 0) / values.length])) }, [metricsRows, period])
  const filtered = useMemo(() => metricsRows.filter(({ cow }) => { const text = `${cow.code} ${cow.name || ''} ${cow.tag || ''}`.toLowerCase(); return (pen === 'ALL' || cow.barn === pen) && (group === 'ALL' || cow.purpose === group) && (stage === 'ALL' || cow.stage === stage) && (!query.trim() || text.includes(query.trim().toLowerCase())) }).sort((a, b) => { const left = sort === 'code' ? a.cow.code : String(latestWeight(a.rows)?.measuredAt || ''); const right = sort === 'code' ? b.cow.code : String(latestWeight(b.rows)?.measuredAt || ''); return (left.localeCompare(right) || a.cow.code.localeCompare(b.cow.code)) * (ascending ? 1 : -1) }), [metricsRows, query, pen, group, stage, sort, ascending])
  const metrics = useMemo(() => { const rows = metricsRows.flatMap(({ rows }) => rowsForPeriod(rows, 30)); const lowAdg = filtered.filter(({ cow, rows: cowRows }) => { const adg = adgBetween(rowsForPeriod(cowRows, period)); const average = penAverages.get(cow.barn); return adg != null && average != null && adg < average }).length; const lowBcs = filtered.filter(({ rows: cowRows }) => { const bcs = numberValue(latestBcs(cowRows)?.bcs); return bcs != null && bcs < 2.5 }).length; const overdue = filtered.filter(({ rows: cowRows }) => { const latest = latestWeight(cowRows); return !latest || !inPeriod(latest.measuredAt, WEIGHING_INTERVAL_DAYS) }).length; return { overdue, lowAdg, lowBcs, weighings: rows.length } }, [metricsRows, filtered, period, penAverages])
  const open = (code: string, target = '/ui/scr-43') => { write('selected-cattle', { code }); nav(`${target}?code=${encodeURIComponent(code)}`) }
  if (state === 'loading') return <Shell screen={screen}><LoadingState label="Đang tải danh sách tăng trưởng…" /></Shell>
  if (state === 'error') return <Shell screen={screen}><InlineMessage tone="err" title="Không thể tải dữ liệu">Dữ liệu tăng trưởng không đọc được từ thiết bị.</InlineMessage></Shell>
  if (state === 'empty') return <Shell screen={screen}><EmptyState title="Chưa có dữ liệu đàn" description="Khi có bò đang nuôi, danh sách cân và BCS sẽ hiển thị ở đây." /></Shell>
  const canWrite = editable(role) && state !== 'read-only'
  return <Shell screen={screen} actions={canWrite && <div className="flex flex-wrap items-center gap-2"><label htmlFor="growth-record-cattle" className="text-xs text-subtle">Bò ghi số đo</label><select id="growth-record-cattle" className={`${inputCls} w-56`} value={recordCode} onChange={(event) => { setRecordCode(event.target.value); if (event.target.value) write('selected-cattle', { code: event.target.value }) }}><option value="">Chọn bò…</option>{allCows.map((cow) => <option key={cow.code} value={cow.code}>{cow.code} · {cow.name || 'Chưa đặt tên'}</option>)}</select><Button variant="primary" disabled={!recordCode} onClick={() => nav(`/ui/scr-44?code=${encodeURIComponent(recordCode)}`)}>Ghi nhận cân &amp; BCS</Button></div>}>
    {state === 'read-only' && <InlineMessage tone="info">Chế độ chỉ đọc: bạn vẫn có thể lọc và mở hồ sơ, nhưng không thể ghi hay chỉnh sửa số đo.</InlineMessage>}
    <FilterBar><input className={`${inputCls} min-w-[220px] flex-1`} aria-label="Tìm bò" placeholder="Mã bò, tên hoặc số tai" value={query} onChange={(event) => setQuery(event.target.value)} /><select className={`${inputCls} w-44`} aria-label="Chuồng" value={pen} onChange={(event) => setPen(event.target.value)}><option value="ALL">Chuồng: tất cả</option>{[...new Set(allCows.map((cow) => cow.barn))].map((item) => <option key={item}>{item}</option>)}</select><select className={`${inputCls} w-44`} aria-label="Nhóm đàn" value={group} onChange={(event) => setGroup(event.target.value)}><option value="ALL">Nhóm đàn: tất cả</option>{[...new Set(allCows.map((cow) => cow.purpose))].filter(Boolean).map((item) => <option key={item}>{item}</option>)}</select><select className={`${inputCls} w-44`} aria-label="Giai đoạn" value={stage} onChange={(event) => setStage(event.target.value)}><option value="ALL">Giai đoạn: tất cả</option>{[...new Set(allCows.map((cow) => cow.stage))].filter(Boolean).map((item) => <option key={item}>{item}</option>)}</select><select className={`${inputCls} w-36`} aria-label="Khoảng ADG" value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value={30}>ADG: 30 ngày</option><option value={90}>ADG: 90 ngày</option><option value={180}>ADG: 180 ngày</option></select></FilterBar>
    <SummaryStrip items={[{ label: 'Quá hạn cân', value: metrics.overdue, note: `Khoảng nhắc ${WEIGHING_INTERVAL_DAYS} ngày` }, { label: 'ADG dưới trung bình chuồng', value: metrics.lowAdg, note: `${period} ngày` }, { label: 'BCS dưới 2,5', value: metrics.lowBcs, note: 'Số đo hợp lệ gần nhất' }, { label: 'Lần cân 30 ngày', value: metrics.weighings, note: 'Không tính loại trừ' }]} />
    {filtered.length === 0 ? <EmptyState compact title="Không có bò phù hợp" description="Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm." /> : <Table wide scroll><thead><tr><Th>Bò · giống · giới tính</Th><Th>Chuồng · nhóm</Th><Th>Số đo gần nhất</Th><Th><button className="font-semibold text-muted hover:text-ink" onClick={() => { setSort('date'); setAscending((value) => sort === 'date' ? !value : false) }}>Đo ngày {sort === 'date' ? (ascending ? '↑' : '↓') : ''}</button></Th><Th>ADG {period} ngày</Th><Th>BCS</Th><Th>Trạng thái</Th><Th /></tr></thead><tbody>{filtered.map(({ cow, rows }) => { const latest = latestWeight(rows); const adg = adgBetween(rowsForPeriod(rows, period)); const bcs = numberValue(latestBcs(rows)?.bcs); const status = rowStatus(cow, period, penAverages.get(cow.barn) ?? null); return <tr key={cow.code}><Td><button className="font-semibold text-brand hover:underline" onClick={() => open(cow.code)}>{cow.code}</button><span className="block text-xs text-subtle">{cow.name || 'Chưa đặt tên'} · {cow.breed || '—'} · {cow.sex || '—'}</span></Td><Td>{cow.barn || '—'} · {cow.purpose || 'Chưa xác định'}</Td><Td>{latest?.weightKg != null ? `${formatNumber(numberValue(latest.weightKg))} kg · ${basisLabel(latest.basis)}` : 'Chưa có cân'}</Td><Td>{latest ? formatDate(latest.measuredAt) : '—'}</Td><Td>{formatNumber(adg, 2)} kg/ngày</Td><Td>{formatNumber(bcs)} / 5</Td><Td><Badge tone={status.tone}>{status.label}</Badge></Td><Td><Button small onClick={() => open(cow.code)}>Mở hồ sơ</Button></Td></tr> })}</tbody></Table>}
    <p className="m-0 text-xs text-subtle">ADG chỉ tính từ các cân hợp lệ trong khoảng đã chọn; số đo ước tính được ghi rõ cơ sở.</p>
  </Shell>
}

function GrowthChart({ rows }: { rows: GrowthRecord[] }) {
  const points = [...rows].filter((row) => numberValue(row.weightKg ?? row.weight) != null).sort((a, b) => dateKey(a.measuredAt) - dateKey(b.measuredAt))
  if (!points.length) return <EmptyState compact title="Chưa có cân hợp lệ để vẽ biểu đồ" description="Ghi nhận số đo hoặc bỏ bộ lọc loại trừ để xem xu hướng." />
  const values = points.map((row) => numberValue(row.weightKg ?? row.weight) as number); const min = Math.max(0, Math.min(...values) - 10); const max = Math.max(...values) + 10; const width = 680; const height = 220; const x = (index: number) => points.length === 1 ? width / 2 : 36 + (index * (width - 64)) / (points.length - 1); const y = (value: number) => height - 32 - ((value - min) / Math.max(1, max - min)) * (height - 64); const line = points.map((row, index) => `${x(index)},${y(numberValue(row.weightKg ?? row.weight) as number)}`).join(' ')
  return <div className="min-w-0"><div className="overflow-x-auto"><svg role="img" aria-label="Biểu đồ cân nặng theo thời gian" viewBox={`0 0 ${width} ${height}`} className="h-auto min-h-[220px] w-full min-w-[560px]"><line x1="36" y1={height - 32} x2={width - 28} y2={height - 32} stroke="currentColor" className="text-rule" /><polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-brand" points={line} />{points.map((row, index) => { const value = numberValue(row.weightKg ?? row.weight) as number; return <g key={row.id}><circle cx={x(index)} cy={y(value)} r="6" fill={row.basis === 'MEASURED' ? 'currentColor' : 'white'} stroke="currentColor" strokeWidth="3" className="text-brand"><title>{`${formatDate(row.measuredAt)} · ${formatNumber(value)} kg · ${basisLabel(row.basis)}`}</title></circle><text x={x(index)} y={height - 10} textAnchor="middle" className="fill-subtle text-[10px]">{formatDate(row.measuredAt).slice(0, 5)}</text></g>})}</svg></div><div className="mt-2 flex flex-wrap gap-4 text-xs text-subtle"><span><i className="mr-1 inline-block size-2 rounded-full bg-brand" />Đo thực tế</span><span><i className="mr-1 inline-block size-2 rounded-full border-2 border-brand bg-white align-[-1px]" />Ước tính</span><span>Khoảng biểu đồ: {formatNumber(min)}–{formatNumber(max)} kg</span></div></div>
}
function projection(cow: CowSeed, rows: GrowthRecord[]) {
  const params = loadParameters(); const target = numberValue(params.values.targetFinishingWeightKg); const latest = latestWeight(rows); const adg = adgBetween(rows.filter((row) => inPeriod(row.measuredAt, 60)))
  if (cow.purpose !== 'Vỗ béo' && cow.stage !== 'Vỗ béo') return 'Chỉ áp dụng cho bò vỗ béo.'
  if (target == null) return 'Chưa cấu hình khối lượng kết thúc.'
  const weight = numberValue(latest?.weightKg ?? latest?.weight); if (weight == null || adg == null || adg <= 0) return `Mục tiêu ${formatNumber(target)} kg · Chưa đủ số đo để dự phóng.`; if (weight >= target) return `Đã đạt mục tiêu ${formatNumber(target)} kg.`
  const days = Math.ceil((target - weight) / adg); const due = new Date((dateKey(latest?.measuredAt) || Date.now()) + days * 86_400_000); return `Mục tiêu ${formatNumber(target)} kg · dự kiến ${formatDate(due.toISOString())} (${days} ngày) · ADG 60 ngày ${formatNumber(adg, 2)} kg/ngày.`
}

function GrowthProfileV2({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const nav = useNavigate(); const { cow, code } = useGrowthCow(); const rows = cow ? growthRows(cow) : []; const effective = effectiveRows(rows); const valid = validRows(rows); const latest = valid[0]; const latestWeightRow = latestWeight(rows); const latestBcsRow = latestBcs(rows); const readOnly = state === 'read-only'; const canWrite = editable(role) && !readOnly; const corrected = rows.filter((row) => row.status === 'CORRECTED').length
  const openCorrection = (record?: GrowthRecord) => { if (record && cow) write('selected-growth-record', { code: cow.code, id: record.id, date: record.measuredAt }); if (cow) nav(`/ui/scr-45?code=${encodeURIComponent(cow.code)}${record ? `&id=${encodeURIComponent(record.id)}` : ''}`) }
  if (state === 'loading') return <Shell screen={screen}><LoadingState label="Đang tải hồ sơ tăng trưởng…" /></Shell>
  if (state === 'error') return <Shell screen={screen}><InlineMessage tone="err" title="Không thể tải hồ sơ">Dữ liệu tăng trưởng không đọc được từ thiết bị.</InlineMessage></Shell>
  if (state === 'empty') return <Shell screen={screen}><EmptyState title="Chưa có hồ sơ tăng trưởng" description="Chọn một con bò từ danh sách để xem số đo." actionLabel="Về danh sách" onAction={() => nav('/ui/scr-42')} /></Shell>
  if (!cow) return <Shell screen={screen}><EmptyState title="Chưa chọn bò" description={code ? `Không tìm thấy bò ${code} trong đàn.` : 'Mở một con bò từ danh sách tăng trưởng để xem hồ sơ.'} actionLabel="Về danh sách" onAction={() => nav('/ui/scr-42')} /></Shell>
  return <Shell screen={screen} cow={cow} actions={<><Button onClick={() => nav('/ui/scr-42')}>Về danh sách</Button>{canWrite && <><Button onClick={() => nav(`/ui/scr-44?code=${encodeURIComponent(cow.code)}`)}>Ghi số đo</Button><Button variant="primary" disabled={!latest} onClick={() => openCorrection(latest)}>Sửa / loại trừ</Button></>}</>}>
    {readOnly && <InlineMessage tone="info">Chế độ chỉ đọc: lịch sử và biểu đồ vẫn xem được; thao tác ghi, sửa, loại trừ đã khóa.</InlineMessage>}
    <Info items={[['Bò', `${cow.code} · ${cow.name || 'Chưa đặt tên'}`], ['Giống · giới tính', `${cow.breed || '—'} · ${cow.sex || '—'}`], ['Chuồng · nhóm', `${cow.barn || '—'} · ${cow.purpose || 'Chưa xác định'}`], ['Giai đoạn', cow.stage || '—'], ['Ngày nhập đàn', entryDateLabel(cow)]]} />
    <SummaryStrip items={[{ label: 'Cân gần nhất', value: latestWeightRow?.weightKg != null ? `${formatNumber(numberValue(latestWeightRow.weightKg))} kg` : '—', note: latestWeightRow ? `${formatDateTime(latestWeightRow.measuredAt)} · ${basisLabel(latestWeightRow.basis)}` : 'Chưa có' }, { label: 'ADG 90 ngày', value: formatNumber(adgBetween(valid.filter((row) => inPeriod(row.measuredAt, 90))), 2), note: 'kg/ngày' }, { label: 'BCS gần nhất', value: latestBcsRow?.bcs != null ? `${formatNumber(numberValue(latestBcsRow.bcs))} / 5` : '—', note: latestBcsRow ? `Thang BCS trang trại · phiên bản 1 · ${formatDate(latestBcsRow.measuredAt)}` : 'Chưa có' }, { label: 'Số lần đo', value: effective.length, note: corrected ? `${corrected} bản ghi đã chỉnh sửa` : 'Chưa có lần chỉnh sửa' }]} />
    <WorkSection title="Xu hướng cân nặng" description="Chỉ bản ghi hợp lệ được vẽ; chấm rỗng là số đo ước tính."><GrowthChart rows={valid} /></WorkSection>
    <WorkSection title="Dự phóng kết thúc" description="Gợi ý tham khảo, không tự đổi trạng thái đàn."><InlineMessage tone="info">{projection(cow, valid)}</InlineMessage><p className="m-0 mt-3 text-xs text-subtle">Lần cân tiếp theo: {latestWeightRow ? formatDate(new Date(dateKey(latestWeightRow.measuredAt) + WEIGHING_INTERVAL_DAYS * 86_400_000).toISOString()) : 'chưa xác định'}.</p></WorkSection>
    <WorkSection title="Lịch sử số đo" description="Bản ghi gốc luôn được giữ lại; mỗi lần chỉnh sửa tạo một phiên bản mới kèm lý do."><Table wide scroll><thead><tr><Th>Đo lúc</Th><Th>Cân nặng · cơ sở</Th><Th>BCS</Th><Th>ADG từ lần trước</Th><Th>Người đo</Th><Th>Trạng thái · lịch sử</Th><Th /></tr></thead><tbody>{rows.map((row) => { const weight = numberValue(row.weightKg ?? row.weight); const bcs = numberValue(row.bcs); const status = row.status === 'EXCLUDED' ? <Badge tone="err">Đã loại trừ</Badge> : row.status === 'VOIDED' ? <Badge tone="outline">Đã hủy</Badge> : row.status === 'CORRECTED' ? <Badge tone="warn">Đã chỉnh sửa · v{row.version}</Badge> : <Badge tone="ok">Hợp lệ · v{row.version}</Badge>; return <tr key={row.id} className={row.status === 'EXCLUDED' || row.status === 'VOIDED' ? 'text-subtle' : undefined}><Td>{formatDateTime(row.measuredAt)}</Td><Td>{weight == null ? '—' : `${formatNumber(weight)} kg · ${methodLabel(row.method)} · ${basisLabel(row.basis)}`}</Td><Td>{formatNumber(bcs)} / 5</Td><Td>{formatNumber(adgForRecord(row, valid), 2)} kg/ngày</Td><Td>{row.measuredBy || row.measurer || '—'}</Td><Td>{status}{(row.reason || row.note) && <span className="mt-1 block max-w-[240px] text-[11px]">Lý do: {row.reason || row.note}</span>}</Td><Td>{canWrite && row.status !== 'EXCLUDED' && row.status !== 'VOIDED' && <Button small onClick={() => openCorrection(row)}>Sửa / loại</Button>}</Td></tr> })}{!rows.length && <tr><Td colSpan={7}><EmptyState compact title="Chưa có số đo" description="Ghi nhận cân hoặc BCS đầu tiên cho cá thể này." /></Td></tr>}</tbody></Table></WorkSection>
  </Shell>
}

function recordError(weight: string, bcs: string, measuredAt: string, method: string, cow: CowSeed) {
  const weightValue = numberValue(weight); const bcsValue = numberValue(bcs); const at = parseDate(measuredAt)
  if (weightValue == null && bcsValue == null) return 'Nhập cân nặng hoặc BCS.'
  if (weightValue != null && (weightValue < 1 || weightValue > MAX_WEIGHT)) return 'Cân nặng phải từ 1 đến 1.500 kg.'
  if (weightValue != null && !method) return 'Phương pháp là bắt buộc khi nhập cân nặng.'
  if (bcsValue != null && (bcsValue < BCS_MIN || bcsValue > BCS_MAX || Math.round(bcsValue * 2) !== bcsValue * 2)) return 'BCS phải từ 1,0 đến 5,0 theo bước 0,5.'
  if (!at || at.getTime() > Date.now()) return 'Thời điểm đo không được để trống hoặc ở tương lai.'
  const herdEntry = entryDate(cow)
  if (herdEntry && at.getTime() < herdEntry) return 'Thời điểm đo không được trước ngày nhập đàn.'
  return null
}
function RecordMeasurementV2({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const nav = useNavigate(); const { cow, code } = useGrowthCow(); const [weight, setWeight] = useState(''); const [bcs, setBcs] = useState(''); const [measuredAt, setMeasuredAt] = useState(todayInput()); const [method, setMethod] = useState<GrowthMethod>('ELECTRONIC_SCALE'); const [measuredBy, setMeasuredBy] = useState(MANAGER); const [note, setNote] = useState(''); const [error, setError] = useState(''); const [largeChange, setLargeChange] = useState(false); const readOnly = state === 'read-only'
  useEffect(() => { setLargeChange(false) }, [weight, bcs, measuredAt])
  if (state === 'loading') return <Shell screen={screen}><LoadingState label="Đang tải biểu mẫu số đo…" /></Shell>
  if (state === 'error') return <Shell screen={screen}><InlineMessage tone="err">Không thể tải biểu mẫu tăng trưởng.</InlineMessage></Shell>
  if (state === 'empty') return <Shell screen={screen}><EmptyState title="Chưa chọn bò" description="Mở hồ sơ một con bò trước khi ghi nhận số đo." actionLabel="Về danh sách" onAction={() => nav('/ui/scr-42')} /></Shell>
  if (!cow) return <Shell screen={screen}><EmptyState title="Chưa chọn bò" description={code ? `Không tìm thấy bò ${code} trong đàn.` : 'Mở hồ sơ một con bò trước khi ghi nhận số đo.'} actionLabel="Về danh sách" onAction={() => nav('/ui/scr-42')} /></Shell>
  if (!editable(role)) return <Shell screen={screen}><InlineMessage tone="warn" title="Không có quyền ghi">Chỉ Quản lý có thể ghi nhận cân nặng và BCS.</InlineMessage></Shell>
  const save = (event: FormEvent) => { event.preventDefault(); setError(''); if (readOnly) return setError('Chế độ chỉ đọc không cho phép lưu.'); const freshCow = cows().find((item) => item.code === cow.code); if (!freshCow || freshCow.status !== 'ACTIVE') return setError('Chỉ bò đang nuôi mới được ghi nhận số đo.'); const validation = recordError(weight, bcs, measuredAt, method, freshCow); if (validation) return setError(validation); const weightValue = numberValue(weight); const currentRows = growthRows(freshCow); const prior = latestWeight(currentRows); const priorWeight = numberValue(prior?.weightKg ?? prior?.weight); if (!largeChange && largeChangeWithinWindow(priorWeight, weightValue, measuredAt, prior?.measuredAt)) return setLargeChange(true); const originalId = `${freshCow.code}-${measuredAt}-${Date.now()}`; const recordedAt = new Date().toISOString(); const record: GrowthRecord = { id: `${originalId}-v1`, originalId, version: 1, measuredAt, weightKg: weightValue, weight: weightValue, bcs: numberValue(bcs), method, basis: basisFor(method), note: note.trim(), measuredBy, actor: MANAGER, recordedAt, status: 'VALID' }; const nextRows = [record, ...currentRows]; write(`growth-${freshCow.code}`, nextRows); updateLatestCow(freshCow.code, nextRows); write('growth-last-action', { code: freshCow.code, id: record.id, action: 'RECORD', at: recordedAt, actor: MANAGER }); nav(`/ui/scr-43?code=${encodeURIComponent(freshCow.code)}`) }
  return <Shell screen={screen}><Info items={[['Bò', `${cow.code} · ${cow.name || 'Chưa đặt tên'}`], ['Giống · giới tính', `${cow.breed || '—'} · ${cow.sex || '—'}`], ['Chuồng', cow.barn || '—'], ['Ngày nhập đàn', entryDateLabel(cow)]]} />{cow.status !== 'ACTIVE' && <InlineMessage tone="warn" title="Bò không còn trong đàn">Chỉ có thể ghi số đo cho bò đang được nuôi tại trang trại.</InlineMessage>}{readOnly && <InlineMessage tone="info">Chế độ chỉ đọc: các trường đã khóa và không thể lưu.</InlineMessage>}<form onSubmit={save} className="max-w-4xl space-y-5"><WorkSection title="Số đo mới" description="Ít nhất một trong cân nặng hoặc BCS phải được nhập."><div className="grid gap-4 sm:grid-cols-2"><Field id="growth-measured-at" label="Đo lúc *" hint="Không ở tương lai và không trước ngày nhập đàn."><input id="growth-measured-at" className={inputCls} type="datetime-local" value={measuredAt} max={todayInput()} onChange={(event) => setMeasuredAt(event.target.value)} disabled={readOnly} /></Field><Field id="growth-measured-by" label="Người đo *"><select id="growth-measured-by" className={inputCls} value={measuredBy} onChange={(event) => setMeasuredBy(event.target.value)} disabled={readOnly}>{ACTIVE_MEMBERS.map((member) => <option key={member}>{member}</option>)}</select></Field><Field id="growth-weight" label="Cân nặng (kg)" hint="1–1.500 kg; nhập một chữ số thập phân."><input id="growth-weight" className={inputCls} type="number" min="1" max={MAX_WEIGHT} step="0.1" value={weight} onChange={(event) => { setWeight(event.target.value); setLargeChange(false) }} disabled={readOnly} /></Field><Field id="growth-unit" label="Đơn vị"><input id="growth-unit" className={inputCls} value="kg" readOnly /></Field><Field id="growth-method" label="Phương pháp" hint={weight ? `Cơ sở tự động: ${basisLabel(basisFor(method))}.` : 'Chỉ bắt buộc khi có cân nặng.'}><select id="growth-method" className={inputCls} value={method} onChange={(event) => { setMethod(event.target.value as GrowthMethod); setLargeChange(false) }} disabled={readOnly}><option value="ELECTRONIC_SCALE">Cân điện tử</option><option value="TAPE">Thước dây</option><option value="OTHER_ESTIMATE">Ước tính khác</option></select></Field><Field id="growth-bcs" label="BCS (1–5)" hint="Thang BCS của trang trại, bước 0,5."><select id="growth-bcs" className={inputCls} value={bcs} onChange={(event) => { setBcs(event.target.value); setLargeChange(false) }} disabled={readOnly}><option value="">Chưa ghi BCS</option>{Array.from({ length: 9 }, (_, index) => (index + 2) / 2).map((value) => <option key={value} value={value}>{value.toLocaleString('vi-VN', { minimumFractionDigits: 1 })}</option>)}</select></Field></div><Field id="growth-note" label="Ghi chú" hint={`${note.length}/500 ký tự`}><textarea id="growth-note" className={inputCls} rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} disabled={readOnly} /></Field></WorkSection>{largeChange && <InlineMessage tone="warn" title="Chênh lệch lớn">Cân mới lệch hơn 20% so với số đo gần nhất trong 30 ngày. Bấm lưu lần nữa để xác nhận đây là số đo đúng.</InlineMessage>}{error && <InlineMessage tone="err" title="Chưa thể lưu">{error}</InlineMessage>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" onClick={() => nav(`/ui/scr-43?code=${encodeURIComponent(cow.code)}`)}>Hủy</Button><Button variant="primary" type="submit" disabled={readOnly || cow.status !== 'ACTIVE'}>{largeChange ? 'Xác nhận và lưu' : 'Lưu số đo'}</Button></div></form></Shell>
}

function CorrectMeasurementV2({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const nav = useNavigate(); const { cow, code } = useGrowthCow(); const [params] = useSearchParams(); const rows = cow ? growthRows(cow) : []; const selectedParam = params.get('id') || read<{ id?: string }>('selected-growth-record', {}).id; const selectedId = selectedParam?.startsWith(`growth-${code}-`) ? selectedParam.slice(`growth-${code}-`.length) : selectedParam; const selected = { id: selectedId, date: params.get('date') || read<{ date?: string }>('selected-growth-record', {}).date }; const current = rows.find((row) => row.id === selected.id) || rows.find((row) => row.measuredAt === selected.date); const [action, setAction] = useState<'CORRECT' | 'EXCLUDE'>('CORRECT'); const [weight, setWeight] = useState(current?.weightKg == null ? '' : String(current.weightKg)); const [bcs, setBcs] = useState(current?.bcs == null ? '' : String(current.bcs)); const [method, setMethod] = useState(String(current?.method || 'ELECTRONIC_SCALE')); const [measuredAt, setMeasuredAt] = useState(toInputDateTime(current?.measuredAt)); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const readOnly = state === 'read-only'
  if (state === 'loading') return <Shell screen={screen}><LoadingState label="Đang tải biểu mẫu chỉnh sửa…" /></Shell>
  if (state === 'error') return <Shell screen={screen}><InlineMessage tone="err">Không thể tải biểu mẫu chỉnh sửa. Hãy thử lại.</InlineMessage></Shell>
  if (state === 'empty') return <Shell screen={screen}><EmptyState title="Chưa có số đo để chỉnh sửa" description="Mở lịch sử một con bò và chọn bản ghi cần chỉnh sửa." actionLabel="Về danh sách" onAction={() => nav('/ui/scr-42')} /></Shell>
  if (!cow) return <Shell screen={screen}><EmptyState title="Chưa chọn bò" description={code ? `Không tìm thấy bò ${code} trong đàn.` : 'Mở lịch sử một con bò và chọn bản ghi cần chỉnh sửa.'} actionLabel="Về danh sách" onAction={() => nav('/ui/scr-42')} /></Shell>
  if (!editable(role)) return <Shell screen={screen}><InlineMessage tone="warn" title="Không có quyền chỉnh sửa">Chỉ Quản lý có thể sửa hoặc loại trừ số đo.</InlineMessage></Shell>
  if (cow.status !== 'ACTIVE') return <Shell screen={screen} cow={cow}><InlineMessage tone="warn" title="Bò không còn trong đàn">Chỉ có thể chỉnh sửa hoặc loại trừ số đo của bò đang được nuôi tại trang trại.</InlineMessage></Shell>
  if (!current) return <Shell screen={screen}><EmptyState title="Chưa có số đo để chỉnh sửa" description="Ghi nhận số đo trước, sau đó chọn bản ghi trong lịch sử." actionLabel="Ghi số đo" onAction={() => nav('/ui/scr-44')} /></Shell>
  const submit = (event: FormEvent) => { event.preventDefault(); setError(''); if (readOnly) return setError('Chế độ chỉ đọc không cho phép lưu.'); if (!current) return setError('Không tìm thấy bản ghi số đo.'); if (!reason.trim()) return setError('Lý do là bắt buộc.'); if (reason.trim().length > 500) return setError('Lý do không được vượt quá 500 ký tự.'); const freshCow = cows().find((item) => item.code === cow.code); if (!freshCow || freshCow.status !== 'ACTIVE') return setError('Chỉ bò đang nuôi mới được chỉnh sửa số đo.'); const freshRows = growthRows(freshCow); const originalId = current.originalId || current.id; const latestVersion = Math.max(...freshRows.filter((row) => row.originalId === originalId).map((row) => row.version), 0); if (latestVersion !== current.version) return setError('Bản ghi đã được cập nhật ở nơi khác. Tải lại hồ sơ để xem phiên bản mới trước khi lưu.'); const freshCurrent = freshRows.find((row) => row.originalId === originalId && row.version === current.version); if (!freshCurrent) return setError('Không tìm thấy phiên bản hiện tại để chỉnh sửa.'); if (action === 'CORRECT') { const validation = recordError(weight, bcs, measuredAt, method, freshCow); if (validation) return setError(validation) }; const nextVersion = freshCurrent.version + 1; const recordedAt = new Date().toISOString(); const correction: GrowthRecord = { ...freshCurrent, id: `${originalId}-v${nextVersion}`, originalId, version: nextVersion, measuredAt: action === 'EXCLUDE' ? freshCurrent.measuredAt : measuredAt, weightKg: action === 'EXCLUDE' ? freshCurrent.weightKg : numberValue(weight), weight: action === 'EXCLUDE' ? freshCurrent.weight : numberValue(weight), bcs: action === 'EXCLUDE' ? freshCurrent.bcs : numberValue(bcs), method: action === 'EXCLUDE' ? freshCurrent.method : method, basis: action === 'EXCLUDE' ? freshCurrent.basis : basisFor(method), status: action === 'EXCLUDE' ? 'EXCLUDED' : 'CORRECTED', reason: reason.trim(), note: reason.trim(), correctedAt: recordedAt, recordedAt, actor: MANAGER }; const nextRows = [...freshRows, correction]; write(`growth-${freshCow.code}`, nextRows); updateLatestCow(freshCow.code, nextRows); const audit = { id: correction.id, code: freshCow.code, originalId, originalVersion: current.version, version: nextVersion, action, reason: reason.trim(), at: recordedAt, actor: MANAGER, before: { weightKg: freshCurrent.weightKg, bcs: freshCurrent.bcs, method: freshCurrent.method, measuredAt: freshCurrent.measuredAt }, after: { weightKg: correction.weightKg, bcs: correction.bcs, method: correction.method, measuredAt: correction.measuredAt } }; write('growth-corrections', [audit, ...read<Record<string, unknown>[]>('growth-corrections', [])]); write('growth-last-action', audit); nav(`/ui/scr-43?code=${encodeURIComponent(freshCow.code)}`) }
  const newWeight = action === 'EXCLUDE' ? numberValue(current.weightKg ?? current.weight) : numberValue(weight)
  const newBcs = action === 'EXCLUDE' ? numberValue(current.bcs) : numberValue(bcs)
  const standardBcsValues = Array.from({ length: 9 }, (_, index) => (index + 2) / 2)
  const hasLegacyBcs = bcs !== '' && !standardBcsValues.includes(Number(bcs))
  return <Shell screen={screen}><Info items={[['Bò', `${cow.code} · ${cow.name || 'Chưa đặt tên'}`], ['Bản ghi gốc', current ? `${formatDateTime(current.measuredAt)} · ${formatNumber(numberValue(current.weightKg ?? current.weight))} kg · v${current.version}` : 'Chưa có'], ['Cơ sở / người đo', current ? `${methodLabel(current.method)} · ${current.measuredBy || current.measurer || '—'}` : '—'], ['Mã lịch sử', current?.originalId || '—']]} />{readOnly && <InlineMessage tone="info">Chế độ chỉ đọc: biểu mẫu đã khóa và lịch sử không thay đổi.</InlineMessage>}<WorkSection title="Đối chiếu hiện tại / giá trị mới" description="Bản gốc được giữ nguyên; phiên bản mới sẽ ghi rõ giá trị trước, sau và lý do."><Table><thead><tr><Th>Trường</Th><Th>Hiện tại</Th><Th>Giá trị mới</Th></tr></thead><tbody><tr><Td>Cân nặng</Td><Td>{formatNumber(numberValue(current.weightKg ?? current.weight))} kg</Td><Td>{formatNumber(newWeight)} kg</Td></tr><tr><Td>BCS</Td><Td>{formatNumber(numberValue(current.bcs))} / 5</Td><Td>{formatNumber(numberValue(newBcs))} / 5</Td></tr><tr><Td>Phương pháp</Td><Td>{methodLabel(current.method)} · {basisLabel(current.basis)}</Td><Td>{action === 'EXCLUDE' ? `${methodLabel(current.method)} · ${basisLabel(current.basis)}` : `${methodLabel(method)} · ${basisLabel(basisFor(method))}`}</Td></tr><tr><Td>Đo lúc</Td><Td>{formatDateTime(current.measuredAt)}</Td><Td>{action === 'EXCLUDE' ? formatDateTime(current.measuredAt) : formatDateTime(measuredAt)}</Td></tr></tbody></Table></WorkSection><form onSubmit={submit} className="max-w-4xl space-y-5"><WorkSection title="Sửa hoặc loại trừ" description="Bản ghi gốc luôn được giữ; mỗi lần chỉnh sửa tạo một phiên bản lịch sử mới."><Field id="growth-action" label="Thao tác *"><select id="growth-action" className={inputCls} value={action} onChange={(event) => setAction(event.target.value as 'CORRECT' | 'EXCLUDE')} disabled={readOnly}><option value="CORRECT">Chỉnh sửa giá trị</option><option value="EXCLUDE">Loại trừ khỏi chỉ số</option></select></Field><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field id="growth-correction-measured-at" label="Đo lúc *"><input id="growth-correction-measured-at" className={inputCls} type="datetime-local" value={measuredAt} max={todayInput()} onChange={(event) => setMeasuredAt(event.target.value)} disabled={readOnly || action === 'EXCLUDE'} /></Field><Field id="growth-correction-weight" label="Cân nặng mới (kg)"><input id="growth-correction-weight" className={inputCls} type="number" min="1" max={MAX_WEIGHT} step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} disabled={readOnly || action === 'EXCLUDE'} /></Field><Field id="growth-correction-bcs" label="BCS mới (1–5)" hint={hasLegacyBcs ? 'Giá trị cũ không đúng bước 0,5; hãy chọn lại trước khi lưu.' : 'Chọn theo bước 0,5.'}><select id="growth-correction-bcs" className={inputCls} value={bcs} onChange={(event) => setBcs(event.target.value)} disabled={readOnly || action === 'EXCLUDE'}><option value="">Chưa ghi BCS</option>{hasLegacyBcs && <option value={bcs}>{Number(bcs).toLocaleString('vi-VN')} · giá trị cũ</option>}{standardBcsValues.map((value) => <option key={value} value={value}>{value.toLocaleString('vi-VN', { minimumFractionDigits: 1 })}</option>)}</select></Field><Field id="growth-correction-method" label="Phương pháp"><select id="growth-correction-method" className={inputCls} value={method} onChange={(event) => setMethod(event.target.value as GrowthMethod)} disabled={readOnly || action === 'EXCLUDE'}><option value="ELECTRONIC_SCALE">Cân điện tử</option><option value="TAPE">Thước dây</option><option value="OTHER_ESTIMATE">Ước tính khác</option></select></Field></div><Field id="growth-correction-reason" label="Lý do bắt buộc *" hint={`${reason.length}/500 ký tự`}><textarea id="growth-correction-reason" className={inputCls} rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={readOnly} /></Field></WorkSection>{error && <InlineMessage tone="err" title="Chưa thể lưu">{error}</InlineMessage>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" onClick={() => nav(`/ui/scr-43?code=${encodeURIComponent(cow.code)}`)}>Hủy</Button><Button variant={action === 'EXCLUDE' ? 'danger' : 'primary'} type="submit" disabled={readOnly || !current}>{action === 'EXCLUDE' ? 'Loại trừ bản ghi' : 'Lưu chỉnh sửa'}</Button></div></form></Shell>
}

export function GrowthPreviewScreen({ screen, role, state = 'success' }: { screen: ScreenDefinition; role?: ScreenRole; state?: ReviewState }) {
  if (screen.id === 'SCR-42') return <GrowthListV2 screen={screen} role={role} state={state} />
  if (screen.id === 'SCR-43') return <GrowthProfileV2 screen={screen} role={role} state={state} />
  if (screen.id === 'SCR-44') return <RecordMeasurementV2 screen={screen} role={role} state={state} />
  return <CorrectMeasurementV2 screen={screen} role={role} state={state} />
}
