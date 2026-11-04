import { useMemo, useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, SummaryStrip, WorkSection } from '../../../components/workspace'
import { initialCows, STAGES, type CowSeed } from '../../../data/cowsData'
import { seedPens } from '../../../data/pensData'
import { loadNotifications, type Notice } from '../../notifications/notificationStore'
import { loadOrders, loadSelectedFarmId } from '../../subscription/subscriptionStore'
import { loadFeedStore } from '../../feed/feedStore'
import { loadParameters } from '../../catalogue/catalogueStore'

const DEMO_KEY = 'beefcare-ui-demo'
const reportCatalogue = [
  ['RPT-01', 'Tổng hợp đàn'], ['RPT-02', 'Hiệu quả tăng trưởng'], ['RPT-03', 'Tuân thủ tiêm phòng'],
  ['RPT-04', 'Sức khỏe và điều trị'], ['RPT-05', 'Hiệu quả sinh sản'], ['RPT-06', 'Biến động đàn'], ['RPT-07', 'Hiệu quả vỗ béo'],
] as const
const roleCanView = (role?: ScreenRole) => role === 'owner' || role === 'manager'

function accountValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const root = JSON.parse(window.localStorage.getItem(DEMO_KEY) || '{}') as { account?: Record<string, unknown> }
    return (root.account?.[key] as T) ?? fallback
  } catch { return fallback }
}
function accountRows(key: string): Array<Record<string, unknown>> {
  const value = accountValue<unknown>(key, [])
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')) : []
}
function localStorageRows(key: string): Array<Record<string, unknown>> {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null') as unknown
    return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')) : []
  } catch { return [] }
}
function localStorageValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return (JSON.parse(window.localStorage.getItem(key) || 'null') as T) ?? fallback } catch { return fallback }
}
function domainRows(key: string): Array<Record<string, unknown>> {
  const direct = localStorageRows(key)
  const account = accountRows(key)
  return [...direct, ...account.filter((row) => !direct.some((item) => String(item.id || '') === String(row.id || '') && row.id))]
}
function cowsForPreview() { return accountValue<CowSeed[]>('cattle-preview', initialCows) }
function parseNumber(value: string | undefined) { const match = value?.replace(',', '.').match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : undefined }
function dateText(value?: string) {
  if (!value) return ''
  const short = value.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/)
  if (short) return `${short[3] || '2026'}-${short[2]}-${short[1]}`
  return value.slice(0, 10)
}
function inRange(value: string | undefined, from: string, to: string) { const date = dateText(value); return Boolean(date && date >= from && date <= to) }
function subtractDays(date: string, days: number) { const next = new Date(`${date}T00:00:00`); next.setDate(next.getDate() - days + 1); return next.toISOString().slice(0, 10) }
function addDays(date: string, days: number) { const next = new Date(`${date}T00:00:00`); next.setDate(next.getDate() + days); return next.toISOString().slice(0, 10) }
function addMonths(date: string, months: number) { const next = new Date(`${date}T00:00:00`); next.setMonth(next.getMonth() + months); return next.toISOString().slice(0, 10) }
function currentDay() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) }
function rowCode(row: Record<string, unknown>) { return String(row.cattleCode || row.cowCode || row.animalCode || row.code || row.dam || '') }
function rowDate(row: Record<string, unknown>) { return String(row.date || row.at || row.measuredAt || row.administeredAt || row.administered || row.createdAt || row.observedAt || row.checkedAt || row.occurredAt || row.birthAt || row.openedAt || '') }
function isValidRecord(row: Record<string, unknown>) { return !['VOIDED', 'CANCELLED', 'REJECTED', 'DRAFT'].includes(String(row.status || 'VALID').toUpperCase()) }
function normalizePregnancyText(value: unknown) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() }
function normalizeStatus(value: unknown) { return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_') }
function classifyPregnancyResult(row: Record<string, unknown>): 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE' | 'INVALID' {
  if (String(row.status || '').toUpperCase() !== 'VALID') return 'INVALID'
  const value = normalizePregnancyText(row.result || row.outcome || row.statusLabel || row.pregnancyResult)
  if (/^(PREGNANT|CONFIRMED PREGNANT|POSITIVE|CO THAI|CHUA)$/.test(value)) return 'POSITIVE'
  if (/^(NOT PREGNANT|NEGATIVE|KHONG CO THAI|KHONG CHUA)$/.test(value)) return 'NEGATIVE'
  if (/^(INCONCLUSIVE|UNKNOWN|CHUA XAC DINH|KHONG KET LUAN)$/.test(value)) return 'INCONCLUSIVE'
  return 'INVALID'
}
function uniqueRecords(rows: Array<Record<string, unknown>>) { return [...new Map(rows.map((row) => [String(row.id || `${rowCode(row)}|${rowDate(row)}|${row.type || row.eventType || ''}`), row])).values()] }
function herdGroupForCow(cow: CowSeed) {
  if (cow.purpose === 'Sinh sản' || cow.stage === 'Bò cái sinh sản') return 'Bò cái sinh sản'
  if (cow.purpose === 'Đực giống' || cow.stage === 'Đực giống') return 'Đực giống'
  if (cow.purpose === 'Vỗ béo' || cow.stage === 'Vỗ béo') return 'Vỗ béo'
  if (cow.stage === 'Bê') return 'Bê'
  if (cow.stage === 'Bò tơ') return 'Bò tơ'
  return 'Chưa xác định'
}
function serviceSummary() {
  const farm = loadOrders().find((item) => item.id === loadSelectedFarmId()) || loadOrders()[0]
  if (!farm) return { name: 'Trại bò Ba Vì', status: 'Chưa có dịch vụ', end: '—' }
  const status: Record<string, string> = { ACTIVE: 'Đang hoạt động', PENDING_PAYMENT: 'Chờ thanh toán', EXPIRED: 'Đã hết hạn', SUSPENDED: 'Tạm ngừng', NONE: 'Chưa đăng ký' }
  return { name: farm.name, status: status[farm.status] || farm.status, end: farm.currentEnd || farm.confirmedEnd || '—' }
}
function MetricTiles({ items }: { items: Array<{ label: string; value: string; note: string; onClick: () => void }> }) {
  return <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-rule py-4 md:grid-cols-4">{items.map((item) => <div key={item.label} className="min-w-0 border-l-2 border-field pl-3 first:border-brand"><dt><button type="button" className="text-left text-[11px] text-subtle underline-offset-2 hover:text-brand hover:underline" onClick={item.onClick}>{item.label}</button></dt><dd className="m-0 mt-1 text-lg font-bold text-ink">{item.value}</dd><span className="mt-1 block text-[11px] text-muted">{item.note}</span></div>)}</dl>
}
function downloadCsv(filename: string, rows: string[][]) {
  if (typeof window === 'undefined') return
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}

function Dashboard({ screen, role }: { screen: ScreenDefinition; role?: ScreenRole }) {
  const inRouter = useInRouterContext(); const navigate = inRouter ? useNavigate() : (() => undefined); const [period, setPeriod] = useState('30'); const [pen, setPen] = useState('ALL'); const [group, setGroup] = useState('ALL'); const [stage, setStage] = useState('ALL'); const [from, setFrom] = useState('2026-10-04'); const [to, setTo] = useState('2026-11-03'); const [generatedAt] = useState(() => new Date().toISOString())
  const allCows = cowsForPreview(); const notices = loadNotifications().filter((notice) => notice.roles.includes(role || 'owner')); const pens = useMemo(() => [...new Set(allCows.map((cow) => cow.barn).filter(Boolean))], [allCows]); const herdGroups = useMemo(() => [...new Set(allCows.map(herdGroupForCow))], [allCows]); const service = serviceSummary()
  const today = currentDay(); const effectiveTo = period === 'custom' ? to : today; const effectiveFrom = period === 'custom' ? from : subtractDays(effectiveTo, Number(period)); const filtered = useMemo(() => allCows.filter((cow) => cow.status === 'ACTIVE' && (pen === 'ALL' || cow.barn === pen) && (group === 'ALL' || herdGroupForCow(cow) === group) && (stage === 'ALL' || cow.stage === stage)), [allCows, group, pen, stage])
  const active = filtered.length; const filteredCodes = new Set(filtered.map((cow) => cow.code)); const appliesToFiltered = (notice: Notice) => (!notice.pen || pen === 'ALL' || notice.pen === pen) && (!notice.cattleCode || filteredCodes.has(notice.cattleCode)); const health = filtered.filter((cow) => ['Theo dõi', 'Đang điều trị'].includes(cow.health?.label || '')); const treatment = filtered.filter((cow) => cow.health?.label === 'Đang điều trị'); const doses = notices.filter((notice) => notice.domain === 'VACCINATION' && appliesToFiltered(notice) && Boolean(notice.dueAt) && notice.dueAt! <= addDays(today, 7)); const overdueDoses = doses.filter((notice) => notice.dueAt! < today); const calvings = notices.filter((notice) => notice.domain === 'CALVING' && appliesToFiltered(notice) && inRange(notice.dueAt, today, addDays(today, 30))); const femaleRows = filtered.filter((cow) => cow.sex === 'Cái');
  const twelveMonthsFrom = addMonths(today, -12)
  const reproductionState = accountValue<Record<string, unknown>>('reproduction-state', {}); const reproductionSection = (name: string, legacyKey: string) => uniqueRecords([...domainRows(legacyKey), ...(Array.isArray(reproductionState[name]) ? reproductionState[name].filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')) : [])]);
  const persistedBreedings = reproductionSection('events', 'reproduction-events-preview').filter((row) => String(row.status || '').toUpperCase() === 'VALID' && filteredCodes.has(rowCode(row)) && inRange(rowDate(row), twelveMonthsFrom, today) && /breed|phối/i.test(String(row.type || row.eventType || row.title || '')));
  const persistedChecks = reproductionSection('checks', 'pregnancy-checks').filter((row) => isValidRecord(row) && filteredCodes.has(rowCode(row)) && inRange(rowDate(row), twelveMonthsFrom, today) && ['POSITIVE', 'NEGATIVE'].includes(classifyPregnancyResult(row)));
  const linkedBreedingIds = new Set(persistedBreedings.map((row) => String(row.id || row.code || '')));
  const linkedChecks = persistedChecks.filter((row) => { const linked = String(row.linkedBreedingId || row.breedingId || row.breedingCode || ''); return linked && linkedBreedingIds.has(linked) });
  const conceptionNumerator = linkedChecks.filter((row) => classifyPregnancyResult(row) === 'POSITIVE').length;
  const conceptionDenominator = linkedChecks.length; const conceptionRate = conceptionDenominator >= 3 ? `${((conceptionNumerator / conceptionDenominator) * 100).toFixed(1)}%` : `Chưa đủ dữ liệu (n = ${conceptionDenominator})`;
  const allCalvingRecords = reproductionSection('calvings', 'calving-records').filter((row) => isValidRecord(row) && filteredCodes.has(rowCode(row))); const calvingRecords = allCalvingRecords.filter((row) => inRange(rowDate(row), twelveMonthsFrom, today)); const calvingsByCow = new Map<string, string[]>(); allCalvingRecords.forEach((row) => { const code = rowCode(row); const at = dateText(rowDate(row)); if (code && at) calvingsByCow.set(code, [...(calvingsByCow.get(code) || []), at]) }); const intervals = [...calvingsByCow.values()].flatMap((dates) => { const sorted = [...new Set(dates)].sort(); return sorted.slice(1).map((at, index) => Math.round((new Date(`${at}T00:00:00`).getTime() - new Date(`${sorted[index]}T00:00:00`).getTime()) / 86400000)) }).filter((value) => Number.isFinite(value) && value > 0); const calvingInterval = intervals.length ? `${Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)} ngày` : `Chưa đủ dữ liệu (n = ${calvingRecords.length})`; const parameterValues = loadParameters().values as unknown as Record<string, unknown>; const configuredOverdue = parseNumber(String(parameterValues?.overdueConceptionDays ?? parameterValues?.conceptionOverdueDays ?? '')); const postCalvingDays = parseNumber(String(parameterValues?.postCalvingBreedingIntervalDays ?? 45)) ?? 45; const estrusCycleDays = parseNumber(String(parameterValues?.estrusCycleLengthDays ?? 21)) ?? 21; const overdueConceptionDays = configuredOverdue ?? postCalvingDays + 3 * estrusCycleDays; const overdueFemales = femaleRows.filter((cow) => { const dates = calvingsByCow.get(cow.code) || []; const sortedDates = dates.map(dateText).filter(Boolean).sort(); const lastCalving = sortedDates[sortedDates.length - 1]; const pregnant = /thai|pregnant|mang thai/i.test(cow.repro?.label || '') || linkedChecks.some((row) => rowCode(row) === cow.code && classifyPregnancyResult(row) === 'POSITIVE'); if (!lastCalving || pregnant) return false; return Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(`${lastCalving}T00:00:00`).getTime()) / 86400000) > overdueConceptionDays })
  const healthRows = [...domainRows('health-cases-preview'), ...domainRows('health-events-preview')].filter((row) => isValidRecord(row) && rowDate(row).slice(0, 10) === today && (String(row.openedAt || row.occurredAt || row.status || '').slice(0, 10) === today || /open|opened|worsen|nặng|xấu/i.test(String(row.type || row.eventType || row.action || row.title || row.status || ''))));
  const pendingCalfRoot = accountValue<unknown>('pending-calves', null); const pendingCalfObject = pendingCalfRoot && typeof pendingCalfRoot === 'object' && !Array.isArray(pendingCalfRoot) ? pendingCalfRoot as Record<string, unknown> : undefined; const pendingCalfRows = Array.isArray(pendingCalfRoot) ? pendingCalfRoot.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')) : Array.isArray(pendingCalfObject?.outcomes) ? pendingCalfObject.outcomes.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')) : pendingCalfObject ? [pendingCalfObject] : [];
  const isPendingCalf = (row: Record<string, unknown>) => { const status = normalizeStatus(row.status || row.outcomeStatus); const registration = normalizeStatus(row.registration || row.registrationStatus); if (['REGISTERED', 'COMPLETED', 'DEAD', 'DIED', 'VOIDED'].includes(status) || ['REGISTERED', 'COMPLETED', 'DEAD', 'DIED', 'VOIDED'].includes(registration)) return false; if (['DRAFT', 'PENDING_CONFIRMATION', 'PENDING'].includes(status) || registration === 'DRAFT') return true; return !status && !registration && Boolean(row.voucherId || row.calfCode || row.cattleCode || Array.isArray(row.cattleCodes)) };
  const pendingCalves = [...domainRows('pending-calves'), ...pendingCalfRows, ...domainRows('calf-drafts-preview')].filter(isPendingCalf);
  const pendingExits = domainRows('herd-exit-vouchers').filter((row) => String(row.status || '').toUpperCase() === 'PENDING');
  const targetWeight = parseNumber(String(loadParameters().values.targetFinishingWeightKg || ''));
  const finishingRows = targetWeight == null ? [] : filtered.filter((cow) => (cow.purpose === 'Vỗ béo' || cow.stage === 'Vỗ béo') && cow.weight != null && cow.weight >= targetWeight).map((cow) => ({ id: `A04-${cow.code}`, kind: 'REMINDER' as const, type: 'A04', status: 'UNREAD' as const, title: `Đạt khối lượng kết thúc ${targetWeight} kg`, body: 'Đã có cân gần nhất đạt mục tiêu; kiểm tra hồ sơ xuất đàn.', dueAt: undefined, createdAt: cow.weightDate || today, domain: undefined, cattleCode: cow.code, pen: cow.barn, roles: ['owner', 'manager', 'technician'] as ScreenRole[], sourceRoute: '/ui/scr-43', sourceId: cow.code } satisfies Notice));
  const derivedAttention = [
    ...healthRows.map((row) => ({ id: `A01-health-${String(row.id || rowCode(row))}`, kind: 'REMINDER' as const, type: 'A01', status: 'UNREAD' as const, title: `Ca sức khỏe mở/xấu đi hôm nay · ${row.title || row.type || 'cần theo dõi'}`, body: String(row.note || ''), dueAt: today, createdAt: rowDate(row), domain: undefined, cattleCode: rowCode(row), pen: String(row.penId || row.pen || ''), roles: ['owner', 'manager', 'technician'] as ScreenRole[], sourceRoute: '/ui/scr-54', sourceId: String(row.id || rowCode(row)) } satisfies Notice)),
    ...pendingCalves.map((row) => ({ id: `A02-${String(row.id || rowCode(row))}`, kind: 'REMINDER' as const, type: 'A02', status: 'UNREAD' as const, title: 'Kết quả bê chờ xác nhận', body: 'Đối soát kết quả bê trước khi chốt.', dueAt: today, createdAt: rowDate(row) || today, domain: undefined, cattleCode: rowCode(row), pen: String(row.penId || row.pen || ''), roles: ['owner', 'manager', 'technician'] as ScreenRole[], sourceRoute: '/ui/scr-37', sourceId: String(row.id || rowCode(row)) } satisfies Notice)),
    ...pendingExits.map((row) => ({ id: `A03-${String(row.id || rowCode(row))}`, kind: 'REMINDER' as const, type: 'A03', status: 'UNREAD' as const, title: 'Phiếu xuất đàn chờ xử lý', body: 'Phiếu đang chờ xác nhận.', dueAt: today, createdAt: rowDate(row) || today, domain: 'HERD_EXIT' as const, cattleCode: rowCode(row), pen: String(row.penId || row.pen || ''), roles: ['owner', 'manager', 'technician'] as ScreenRole[], sourceRoute: '/ui/scr-110', sourceId: String(row.id || rowCode(row)) } satisfies Notice)),
    ...finishingRows,
  ];
  const attention = useMemo(() => [...notices.filter((notice) => {
    if (notice.kind !== 'REMINDER' || !notice.dueAt || (pen !== 'ALL' && notice.pen && notice.pen !== pen)) return false
    const due = notice.dueAt; return (notice.domain === 'VACCINATION' && due <= today) || (notice.domain === 'BREEDING' && due === today) || (notice.domain === 'PREGNANCY_CHECK' && due <= today) || (notice.domain === 'CALVING' && due >= today && due <= addDays(today, 7))
  }), ...derivedAttention].filter((notice) => appliesToFiltered(notice)).sort((a, b) => (a.dueAt || a.createdAt).localeCompare(b.dueAt || b.createdAt)), [derivedAttention, notices, pen, today, filteredCodes])
  const groups = herdGroups.map((name) => ({ name, cows: filtered.filter((cow) => herdGroupForCow(cow) === name) })).filter((row) => row.cows.length); const penRows = seedPens.filter((item) => item.status === 'ACTIVE' && (pen === 'ALL' || item.code === pen)).map((item) => ({ ...item, head: filtered.filter((cow) => cow.barn === item.code).length })); const periodWeights = filtered.flatMap((cow) => accountRows(`growth-${cow.code}`).filter((row) => isValidRecord(row) && inRange(rowDate(row), effectiveFrom, effectiveTo)).map((row) => ({ cow: cow.code, at: dateText(rowDate(row)), weight: parseNumber(String(row.weightKg ?? row.weight)), adg: parseNumber(String(row.adg ?? row.adgKgPerDay)) }))).filter((row): row is { cow: string; at: string; weight: number; adg: number | undefined } => row.weight != null && Boolean(row.at)); const adgFromWeights = [...new Set(periodWeights.map((row) => row.cow))].flatMap((code) => { const rows = periodWeights.filter((row) => row.cow === code).sort((a, b) => a.at.localeCompare(b.at)); const explicit = rows.map((row) => row.adg).filter((value): value is number => value != null); if (explicit.length) return explicit; return rows.slice(1).map((row, index) => { const days = (new Date(`${row.at}T00:00:00`).getTime() - new Date(`${rows[index].at}T00:00:00`).getTime()) / 86400000; return days > 0 ? (row.weight - rows[index].weight) / days : undefined }).filter((value): value is number => value != null && Number.isFinite(value) && value >= 0) }); const adgValues = adgFromWeights; const customDatesInvalid = period === 'custom' && from > to
  const openSource = (notice: Notice) => notice.sourceRoute && navigate(notice.sourceRoute)
  return <div className="flex flex-col gap-6">
    <PageHeader title={screen.viTitle} sub={`${service.name} · ${active} bò đang nuôi · Dịch vụ: ${service.status} · đến ${service.end} · Tính lúc ${new Date(generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`} badge={<FixtureNotice />} />
    <FilterBar actions={<Button small onClick={() => { setPeriod('30'); setPen('ALL'); setGroup('ALL'); setStage('ALL'); setFrom('2026-10-04'); setTo('2026-11-03') }}>Đặt lại</Button>}>
      <label className="text-xs font-semibold text-ink">Khoảng theo dõi<select aria-label="Khoảng theo dõi" className={`${inputCls} mt-1.5 w-40`} value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7">7 ngày</option><option value="30">30 ngày</option><option value="90">90 ngày</option><option value="custom">Tùy chọn</option></select></label>
      {period === 'custom' && <><label className="text-xs font-semibold text-ink">Từ ngày<input aria-label="Dashboard từ ngày" type="date" className={`${inputCls} mt-1.5`} value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-xs font-semibold text-ink">Đến ngày<input aria-label="Dashboard đến ngày" type="date" className={`${inputCls} mt-1.5`} value={to} onChange={(event) => setTo(event.target.value)} /></label></>}
      <label className="text-xs font-semibold text-ink">Chuồng<select aria-label="Chuồng" className={`${inputCls} mt-1.5 w-40`} value={pen} onChange={(event) => setPen(event.target.value)}><option value="ALL">Tất cả chuồng</option>{pens.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-semibold text-ink">Nhóm đàn<select aria-label="Nhóm đàn" className={`${inputCls} mt-1.5 w-48`} value={group} onChange={(event) => setGroup(event.target.value)}><option value="ALL">Tất cả nhóm đàn</option>{herdGroups.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-semibold text-ink">Giai đoạn<select aria-label="Giai đoạn sống" className={`${inputCls} mt-1.5 w-44`} value={stage} onChange={(event) => setStage(event.target.value)}><option value="ALL">Tất cả</option>{STAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
    </FilterBar>
    {customDatesInvalid && <InlineMessage tone="err" title="Khoảng không hợp lệ">Ngày bắt đầu không được sau ngày kết thúc.</InlineMessage>}
    <MetricTiles items={[{ label: 'M01 · Bò đang trong đàn', value: `${active} con`, note: `${groups.length} nhóm đàn`, onClick: () => navigate('/ui/scr-26') }, { label: 'M02 · Cần chú ý sức khỏe', value: `${health.length} con`, note: `${treatment.length} con đang điều trị`, onClick: () => navigate('/ui/scr-54') }, { label: 'M03 · Mũi tiêm 7 ngày', value: `${doses.length} liều`, note: `${overdueDoses.length} quá hạn · ${today} → ${addDays(today, 7)}`, onClick: () => navigate('/ui/scr-47') }, { label: 'M04 · Dự kiến sinh 30 ngày', value: `${calvings.length} con`, note: `${today} → ${addDays(today, 30)} · chỉ lịch sắp sinh`, onClick: () => navigate('/ui/scr-59') }]} />
    <WorkSection title="Cần chú ý hôm nay" description="A01–A04 từ nhắc việc, hồ sơ sức khỏe và chứng từ; mở nguồn giữ nguyên vai trò hiện tại." actions={<Button variant="link" small onClick={() => navigate('/ui/scr-73')}>Xem tất cả</Button>}>
      {!attention.length ? <EmptyState compact title="Không có cảnh báo phù hợp" description="Thay đổi chuồng hoặc khoảng theo dõi để kiểm tra lại." /> : <Table wide scroll><thead><tr><Th>Bò / Chứng từ</Th><Th>Chuồng</Th><Th>Vấn đề</Th><Th>Trạng thái</Th><Th /></tr></thead><tbody>{attention.map((row) => { const pendingExit = row.domain === 'HERD_EXIT'; const overdue = Boolean(row.dueAt && row.dueAt < today); const tone = overdue ? 'err' : row.kind === 'RECONCILIATION' ? 'info' : 'warn'; return <tr key={row.id}><Td><strong>{row.cattleCode || row.sourceId || row.title}</strong></Td><Td>{row.pen || '—'}</Td><Td>{row.title}</Td><Td><Badge tone={tone}>{overdue ? 'Quá hạn' : pendingExit ? 'Chờ xác nhận' : row.title.includes('Đạt khối lượng') ? 'Đạt mục tiêu' : 'Cần xử lý'}</Badge></Td><Td><Button small onClick={() => openSource(row)}>Mở nguồn</Button>{pendingExit && role === 'owner' && <Button small className="ml-2" onClick={() => navigate('/ui/scr-110')}>Xử lý xuất đàn</Button>}</Td></tr> })}</tbody></Table>}
    </WorkSection>
    <WorkSection title="Cơ cấu đàn" description="M05 · Nhóm đàn và giai đoạn sống được tính độc lập từ hồ sơ hiện tại."><Table><thead><tr><Th>Nhóm đàn</Th><Th>Số con</Th><Th>Trong đó đang chửa</Th></tr></thead><tbody>{groups.map((row) => <tr key={row.name}><Td><button className="font-semibold text-brand underline-offset-2 hover:underline" onClick={() => navigate(`/ui/scr-26?group=${encodeURIComponent(row.name)}`)}>{row.name}</button></Td><Td>{row.cows.length}</Td><Td>{row.name === 'Bò cái sinh sản' ? row.cows.filter((cow) => cow.repro?.label?.includes('thai')).length : '—'}</Td></tr>)}{!groups.length && <tr><Td colSpan={3}><EmptyState compact title="Chưa có nhóm đàn" /></Td></tr>}</tbody><tfoot><tr><Td><strong>Tổng cộng</strong></Td><Td><strong>{active}</strong></Td><Td>{groups.find((row) => row.name === 'Bò cái sinh sản')?.cows.filter((cow) => cow.repro?.label?.includes('thai')).length || 0}</Td></tr></tfoot></Table></WorkSection>
    <WorkSection title="Chỉ số bổ sung"><div className="grid gap-x-8 gap-y-5 md:grid-cols-2">{[
      ['M06 · Tăng trọng bình quân', adgValues.length ? `${(adgValues.reduce((sum, value) => sum + value, 0) / adgValues.length).toFixed(2)} kg/ngày` : 'Chưa đủ dữ liệu', `Trong ${effectiveFrom}–${effectiveTo} · ${adgValues.length} lần ghi nhận`, '/ui/scr-78'], ['M07 · Quá hạn cân', `${notices.filter((notice) => notice.domain === 'WEIGHING' && appliesToFiltered(notice) && (notice.dueAt || '') < today).length} con`, 'Theo chuồng và bộ lọc hiện tại', '/ui/scr-73'], ['M08 · Sức chứa chuồng', `${penRows.reduce((sum, row) => sum + row.head, 0)} / ${penRows.reduce((sum, row) => sum + row.capacity, 0)} chỗ`, pen === 'ALL' ? 'Các chuồng đang sử dụng' : `Chuồng ${pen}`, '/ui/scr-22'], ['M09 · Sinh sản', `${femaleRows.length} cái · ${conceptionRate} thụ thai`, `${calvingInterval} khoảng cách đẻ · ${persistedBreedings.length} lần phối hợp lệ · ${overdueFemales} cái quá hạn`, '/ui/scr-78?report=RPT-05'],
    ].map(([label, value, note, target]) => <article key={label} className="border-t-2 border-field pt-4"><h3 className="m-0 text-sm font-semibold text-ink">{label}</h3><strong className="mt-2 block text-xl text-brand">{value}</strong><p className="mb-0 mt-1 text-xs text-subtle">{note}</p><Button variant="link" small className="mt-2" onClick={() => navigate(target)}>Xem chi tiết</Button></article>)}</div></WorkSection>
    <p className="m-0 border-t border-rule pt-3 text-xs text-subtle">Tính từ các sổ hệ thống · Asia/Ho_Chi_Minh · cập nhật khi mở lại màn hình.</p>
  </div>
}

type ReportRow = { label: string; head: number; metric: string; detail: string; value: number; insufficient?: number; numerator?: number; denominator?: number }
function makeReportRows(report: string, cows: CowSeed[], notices: Notice[], from: string, to: string): ReportRow[] {
  return [...new Set(cows.map((cow) => cow.barn || 'Chưa phân chuồng'))].map((label) => { const rows = cows.filter((cow) => (cow.barn || 'Chưa phân chuồng') === label); const weights = rows.map((cow) => cow.weight).filter((value): value is number => value != null); const weight = weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : 0; const periodNotices = notices.filter((notice) => inRange(notice.dueAt || notice.createdAt, from, to) && notice.pen === label); if (report === 'RPT-03') return { label, head: rows.length, metric: `${periodNotices.filter((notice) => notice.domain === 'VACCINATION').length} liều`, detail: 'đã lên lịch / đã tiêm / hoãn / quá hạn', value: periodNotices.length }; if (report === 'RPT-04') return { label, head: rows.filter((cow) => cow.health?.label !== 'Khỏe').length, metric: `${rows.filter((cow) => cow.health?.label === 'Đang điều trị').length} đang điều trị`, detail: 'ca bệnh / điều trị / thời gian ngưng thuốc', value: rows.length }; if (report === 'RPT-05') return { label, head: rows.filter((cow) => cow.sex === 'Cái').length, metric: `${rows.filter((cow) => cow.repro).length} có dữ liệu`, detail: 'lần phối / khám thai / sinh bê theo hồ sơ', value: rows.length }; if (report === 'RPT-06') return { label, head: rows.length, metric: `${rows.reduce((sum, cow) => sum + (cow.events || []).filter((event) => inRange(event.at, from, to)).length, 0)} sự kiện`, detail: 'nguồn nhập / loại xuất / chuyển chuồng', value: rows.length }; if (report === 'RPT-07') return { label, head: rows.filter((cow) => cow.purpose === 'Vỗ béo').length, metric: weight ? `${weight.toFixed(1)} kg` : 'Chưa đủ dữ liệu', detail: 'tăng trọng bình quân · thức ăn/kg tăng trọng · chi phí/kg tăng trọng', value: weight }; if (report === 'RPT-02') return { label, head: rows.length, metric: weights.length ? `${weight.toFixed(1)} kg` : 'Chưa đủ dữ liệu', detail: `${weights.length} lần cân hợp lệ · tăng trọng bình quân`, value: weight }; return { label, head: rows.length, metric: `${rows.length} con`, detail: `${new Set(rows.map((cow) => cow.stage)).size} giai đoạn sinh trưởng · nhập/xuất đàn`, value: rows.length } })
}

function makeDistinctReportRows(report: string, cows: CowSeed[], notices: Notice[], from: string, to: string): ReportRow[] {
  const feedStore = loadFeedStore()
  const persistedVaccinations = accountRows('vaccination-preview')
  const reproductionState = accountValue<Record<string, unknown>>('reproduction-state', {}); const persistedReproduction = [...domainRows('reproduction-events-preview'), ...domainRows('pregnancy-checks'), ...domainRows('pregnancy-updates'), ...domainRows('calving-records'), ...(['events', 'checks', 'updates', 'calvings'] as const).flatMap((section) => Array.isArray(reproductionState[section]) ? reproductionState[section].filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')) : [])]
  const persistedHealth = [...accountRows('health-cases-preview'), ...accountRows('health-events-preview')]
  const persistedEntryExit = [...accountRows('entry-vouchers'), ...accountRows('herd-entry-vouchers'), ...accountRows('herd-exit-vouchers')]
  const persistedGrowth = (cow: CowSeed) => accountRows(`growth-${cow.code}`)
  const rowCode = (row: Record<string, unknown>) => String(row.cattleCode || row.cowCode || row.animalCode || row.code || '')
  const rowDate = (row: Record<string, unknown>) => String(row.date || row.at || row.measuredAt || row.administeredAt || row.administered || row.createdAt || row.observedAt || row.checkedAt || row.occurredAt || row.birthAt || '')
  const rowsFor = (source: Array<Record<string, unknown>>, rows: CowSeed[]) => source.filter((item) => rows.some((cow) => rowCode(item) === cow.code) && inRange(rowDate(item), from, to))
  const bucket = (cow: CowSeed) => report === 'RPT-01' ? `${herdGroupForCow(cow)} · ${cow.barn || 'Chưa phân chuồng'}` : (cow.barn || 'Chưa phân chuồng')
  const labels = [...new Set(cows.map(bucket))]
  return labels.map((label) => {
    const rows = cows.filter((cow) => bucket(cow) === label)
    const events = rows.flatMap((cow) => (cow.events || []).filter((event) => inRange(event.at, from, to)))
    const periodNotices = notices.filter((notice) => inRange(notice.dueAt || notice.createdAt, from, to) && (!notice.pen || notice.pen === label))
    const weights = rows.filter((cow) => cow.weight != null && inRange(cow.weightDate, from, to)).map((cow) => cow.weight as number)
    const averageWeight = weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : 0
    const females = rows.filter((cow) => cow.sex === 'Cái')
    if (report === 'RPT-01') {
      const entries = events.filter((event) => /nhập đàn|nhập/i.test(event.title)).length
      const exits = events.filter((event) => /xuất|chết|mất/i.test(event.title)).length
      return { label, head: rows.length, metric: `${rows.length} con`, detail: `Nhập ${entries} · xuất ${exits} · ${new Set(rows.map((cow) => cow.breed)).size} giống · ${new Set(rows.map((cow) => cow.stage)).size} giai đoạn`, value: rows.length, numerator: rows.length, denominator: rows.length }
    }
    if (report === 'RPT-02') {
      const estimated = rows.filter((cow) => cow.weight != null && cow.weightEst).length
      const adg = rows.map((cow) => parseNumber(cow.care?.adg)).filter((value): value is number => value != null)
      const persistedWeights = rows.flatMap(persistedGrowth).filter((item) => inRange(rowDate(item), from, to) && parseNumber(String(item.weightKg ?? item.weight)) != null)
      const observedCount = Math.max(weights.length, persistedWeights.length)
      return { label, head: rows.length, metric: `${observedCount} lần cân · ${averageWeight ? `${averageWeight.toFixed(1)} kg` : 'Chưa đủ dữ liệu'} · tăng trọng bình quân ${adg.length ? `${(adg.reduce((sum, value) => sum + value, 0) / adg.length).toFixed(2)} kg/ngày` : 'Chưa đủ dữ liệu'}`, detail: `${estimated}/${observedCount} lần cân ước tính · sổ tăng trọng hệ thống · ${rows.length} con`, value: averageWeight, numerator: observedCount, denominator: rows.length, insufficient: Math.max(rows.length - observedCount, 0) }
    }
    if (report === 'RPT-03') {
      const vaccineNotices = periodNotices.filter((notice) => notice.domain === 'VACCINATION')
      const persistedDoseRows = rowsFor(persistedVaccinations, rows)
      const done = events.filter((event) => event.cat === 'vaccine').length
      const deferred = vaccineNotices.filter((notice) => /hoãn|defer/i.test(`${notice.title} ${notice.body}`)).length
      const overdue = vaccineNotices.filter((notice) => Boolean(notice.dueAt && notice.dueAt < '2026-11-03')).length
      return { label, head: rows.length, metric: `Kế hoạch ${vaccineNotices.length} · đã tiêm ${done + persistedDoseRows.length} · hoãn ${deferred} · quá hạn ${overdue}`, detail: `Theo lịch tiêm và hồ sơ đã lưu · ${vaccineNotices.length + done + persistedDoseRows.length} liều`, value: vaccineNotices.length + done + persistedDoseRows.length, numerator: done + persistedDoseRows.length, denominator: vaccineNotices.length, insufficient: Math.max(rows.length - vaccineNotices.length, 0) }
    }
    if (report === 'RPT-04') {
      const cases = rows.filter((cow) => cow.health && cow.health.label !== 'Khỏe')
      const persistedCaseRows = rowsFor(persistedHealth, rows)
      const chronic = rows.filter((cow) => cow.health?.label === 'Theo dõi').length
      const treatments = rows.filter((cow) => cow.health?.label === 'Đang điều trị').length
      const closed = events.filter((event) => /đóng|khỏi/i.test(event.title)).length
      return { label, head: Math.max(cases.length, persistedCaseRows.length), metric: `Ca mở ${Math.max(cases.length, persistedCaseRows.length)} · theo dõi dài ngày ${chronic} · điều trị ${treatments} · đã đóng ${closed}`, detail: `Tổng hợp từ hồ sơ sức khỏe và thời gian ngưng thuốc · ${rows.length} con`, value: Math.max(cases.length, persistedCaseRows.length), numerator: treatments, denominator: rows.length, insufficient: Math.max(rows.length - Math.max(cases.length, persistedCaseRows.length), 0) }
    }
    if (report === 'RPT-05') {
      const breedings = events.filter((event) => /phối|động dục/i.test(event.title)).length
      const persistedReproRows = uniqueRecords(rowsFor(persistedReproduction, females).filter(isValidRecord))
      const linkedBreedingIds = new Set(persistedReproRows.filter((item) => /breed|phối/i.test(String(item.type || item.eventType || item.title || ''))).map((item) => String(item.id || item.code || '')))
      const checkRows = persistedReproRows.filter((item) => { const linked = String(item.linkedBreedingId || item.breedingId || item.breedingCode || ''); return linked && linkedBreedingIds.has(linked) && (Boolean(item.checkedAt) || /check|khám thai|pregnan/i.test(String(item.type || item.eventType || item.title || ''))) && ['POSITIVE', 'NEGATIVE'].includes(classifyPregnancyResult(item)) })
      const updateRows = persistedReproRows.filter((item) => Boolean(item.occurredAt) || /update|cập nhật|loss|mất thai|sảy/i.test(String(item.type || item.eventType || item.title || item.result || '')))
      const calvingRows = persistedReproRows.filter((item) => Boolean(item.birthAt) || /calv|sinh bê|đẻ/i.test(String(item.type || item.eventType || item.title || '')))
      const actualCalvingEvents = events.filter((event) => /sinh bê|calv|đẻ/i.test(event.title) && !/dự kiến|expected/i.test(event.title))
      const checks = checkRows.length
      const calvings = calvingRows.length + actualCalvingEvents.length
      const conceptions = checkRows.filter((item) => classifyPregnancyResult(item) === 'POSITIVE').length
      const losses = updateRows.filter((item) => /^LOSS$|loss|mất thai|sảy/i.test(String(item.result || item.outcome || item.type || item.title || ''))).length + events.filter((event) => /sảy|mất thai|loss/i.test(event.title)).length
      const denominator = checkRows.length
      const lossRatioDenominator = calvings + losses
      return { label, head: females.length, metric: `Bò cái ${females.length} · phối ${breedings} · khám thai ${checks} · sinh bê ${calvings}`, detail: `Có thai ${conceptions}/${denominator || 0} · tỷ lệ thụ thai ${denominator >= 3 ? `${((conceptions / denominator) * 100).toFixed(1)}%` : `Chưa đủ dữ liệu (${denominator} lần khám)`} · mất thai ${losses}/${lossRatioDenominator} · ${checkRows.length} lần khám thai · ${calvingRows.length + actualCalvingEvents.length} lần sinh bê · khoảng cách lứa đẻ: chưa đủ dữ liệu (${calvingRows.length} lần sinh)`, value: conceptions, numerator: conceptions, denominator, insufficient: denominator >= 3 ? 0 : Math.max(3 - denominator, 1) }
    }
    if (report === 'RPT-06') {
      const persistedMovementRows = rowsFor(persistedEntryExit, rows)
      const entries = events.filter((event) => /nhập đàn|nhập/i.test(event.title)).length + persistedMovementRows.filter((item) => /entry|nhập/i.test(String(item.type || item.entryType || item.status || ''))).length
      const exits = events.filter((event) => /xuất|chết|mất/i.test(event.title)).length + persistedMovementRows.filter((item) => /exit|xuất|chết/i.test(String(item.type || item.exitType || item.status || ''))).length
      const moves = events.filter((event) => /chuyển chuồng/i.test(event.title)).length
      return { label, head: rows.length, metric: `Nhập ${entries} · xuất ${exits} · chuyển chuồng ${moves}`, detail: `Các biến động được ghi nhận từ ${from} đến ${to}`, value: entries + exits + moves, numerator: entries + exits + moves, denominator: rows.length }
    }
    const fattening = rows.filter((cow) => cow.purpose === 'Vỗ béo' || cow.stage === 'Vỗ béo')
    const penAliases = new Set([label, ...rows.map((cow) => cow.barn || ''), ...seedPens.filter((pen) => rows.some((cow) => cow.barn === pen.code || cow.barn === pen.name)).flatMap((pen) => [pen.code, pen.name])])
    const feedingRows = feedStore.feedings.filter((feeding) => (penAliases.has(feeding.penId) || penAliases.has(feeding.penName)) && inRange(feeding.date, from, to) && feeding.status !== 'VOIDED')
    const feedKg = feedingRows.reduce((sum, feeding) => sum + feeding.lines.reduce((lineSum, line) => lineSum + line.actualKg, 0), 0)
    let feedCost: number | undefined = feedingRows.length ? 0 : undefined
    for (const feeding of feedingRows) {
      const linkedMovements = feedStore.movements.filter((item) => item.type === 'FEEDING' && item.sourceDocument === feeding.id)
      const invalidSnapshot = linkedMovements.some((item) => !Number.isFinite(item.unitCost) || !Number.isFinite(item.quantityKg) || item.quantityKg === 0)
      if (!linkedMovements.length || invalidSnapshot) { feedCost = undefined; continue }
      // A correction uses the same feeding sourceDocument: return movements subtract the
      // original ledger entry and consume movements add the replacement snapshot. Aggregate
      // the linked ledger once so a revision is not double-counted as another full feeding.
      const linkedCost = linkedMovements.reduce((sum, movement) => sum - movement.quantityKg * movement.unitCost, 0)
      if (feedCost != null) feedCost += linkedCost
    }
    const gainValues = fattening.flatMap((cow) => { const history = persistedGrowth(cow).filter((item) => inRange(rowDate(item), from, to) && parseNumber(String(item.weightKg ?? item.weight)) != null).map((item) => ({ at: rowDate(item), weight: parseNumber(String(item.weightKg ?? item.weight)) as number })).sort((a, b) => a.at.localeCompare(b.at)); return history.length >= 2 ? [history[history.length - 1].weight - history[0].weight] : [] }).filter((value) => value > 0)
    const gainKg = gainValues.reduce((sum, value) => sum + value, 0)
    const adgValues = fattening.map((cow) => parseNumber(cow.care?.adg)).filter((value): value is number => value != null)
    const feedPerGain = feedKg > 0 && gainKg > 0 ? feedKg / gainKg : undefined
    const costPerGain = feedCost != null && gainKg > 0 ? feedCost / gainKg : undefined
    return { label, head: fattening.length, metric: `Đàn vỗ béo ${fattening.length} · cân cuối ${averageWeight ? `${averageWeight.toFixed(1)} kg` : 'Chưa đủ dữ liệu'} · thức ăn ${feedKg ? `${feedKg.toFixed(1)} kg` : 'Chưa đủ dữ liệu'}`, detail: `Thức ăn/kg tăng trọng: ${feedPerGain != null ? `${feedPerGain.toFixed(2)} kg/kg` : `Chưa đủ dữ liệu (${gainValues.length} lần ghi nhận)`} · chi phí/kg tăng trọng: ${costPerGain != null ? `${costPerGain.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ/kg` : `Chưa đủ dữ liệu (${gainValues.length} lần ghi nhận)`} · tăng trọng bình quân ${adgValues.length ? `${(adgValues.reduce((sum, value) => sum + value, 0) / adgValues.length).toFixed(2)} kg/ngày (${adgValues.length} lần ghi nhận)` : 'Chưa đủ dữ liệu'} · chi phí thức ăn tại thời điểm ghi nhận: ${feedCost != null ? `${feedCost.toLocaleString('vi-VN')} đ` : 'Chưa đủ dữ liệu'} · đủ dữ liệu cân: ${weights.length}/${fattening.length}`, value: feedCost ?? 0, numerator: gainValues.length, denominator: fattening.length, insufficient: gainValues.length ? 0 : Math.max(fattening.length, 1) }
  }).filter((row) => row.head > 0 || report === 'RPT-03')
}

function ReportChart({ rows, report }: { rows: ReportRow[]; report: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  const metricLabel: Record<string, string> = { 'RPT-01': 'Số bò theo nhóm / chuồng', 'RPT-02': 'Khối lượng cân trung bình (kg)', 'RPT-03': 'Tổng liều tiêm theo lịch', 'RPT-04': 'Ca sức khỏe đang theo dõi', 'RPT-05': 'Số bò cái có thai', 'RPT-06': 'Số biến động đàn', 'RPT-07': 'Chi phí thức ăn tại thời điểm ghi nhận (đ)' }
  return <div className="border-y border-rule py-3" aria-label={`Biểu đồ ${metricLabel[report] || report}`}><div className="flex items-center justify-between"><strong className="text-xs text-ink">{metricLabel[report] || `Chỉ số ${report}`}</strong><span className="text-[11px] text-subtle">Theo từng dòng kết quả trong kỳ báo cáo</span></div><svg className="mt-2 h-24 w-full" viewBox="0 0 720 96" role="img" aria-label={`Biểu đồ ${metricLabel[report] || report}`} preserveAspectRatio="none"><line x1="0" x2="720" y1="88" y2="88" stroke="currentColor" strokeOpacity=".25" />{rows.slice(0, 18).map((row, index) => { const width = 720 / Math.max(rows.slice(0, 18).length, 1) - 6; const height = row.value > 0 ? Math.max((row.value / max) * 76, 3) : 2; return <rect key={row.label} x={index * (width + 6) + 3} y={88 - height} width={width} height={height} rx="1" fill="currentColor" opacity=".7"><title>{row.label}: {row.metric}</title></rect> })}</svg></div>
}

function ReportLegacy({ screen, role }: { screen: ScreenDefinition; role?: ScreenRole }) {
  const location = useLocation(); const queryReport = new URLSearchParams(location.search).get('report'); const initialReport = reportCatalogue.some(([code]) => code === queryReport) ? queryReport as string : 'RPT-07'
  const [report, setReport] = useState(initialReport); const [from, setFrom] = useState('2026-10-04'); const [to, setTo] = useState('2026-11-03'); const [pens, setPens] = useState<string[]>([]); const [breeds, setBreeds] = useState<string[]>([]); const [groups, setGroups] = useState<string[]>([]); const [stages, setStages] = useState<string[]>([]); const [generated, setGenerated] = useState(true); const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString())
  const allCows = cowsForPreview(); const notices = loadNotifications().filter((notice) => notice.roles.includes(role || 'owner')); const options = { pens: [...new Set(allCows.map((cow) => cow.barn).filter((value): value is string => Boolean(value)))], breeds: [...new Set(allCows.map((cow) => cow.breed).filter((value): value is string => Boolean(value)))], groups: [...new Set(allCows.map(herdGroupForCow))], stages: [...new Set(allCows.map((cow) => cow.stage).filter((value): value is string => Boolean(value)))] }; const invalidPeriod = from > to || (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) > 24 * 31 * 24 * 60 * 60 * 1000 * 24
  const filtered = useMemo(() => allCows.filter((cow) => (!pens.length || pens.includes(cow.barn || '')) && (!breeds.length || breeds.includes(cow.breed || '')) && (!groups.length || groups.includes(herdGroupForCow(cow))) && (!stages.length || stages.includes(cow.stage || ''))), [allCows, breeds, groups, pens, stages]); const rows = useMemo(() => makeDistinctReportRows(report, filtered, notices, from, to), [filtered, from, notices, report, to]); const toggle = (setter: (value: string[]) => void, current: string[], value: string) => setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); const regenerate = () => { setGeneratedAt(new Date().toISOString()); setGenerated(true) }; const exportReport = () => downloadCsv(`${report}-management-report.csv`, [['Report', report], ['From', from], ['To', to], ['Generated at', generatedAt], ['Row', 'Head', 'Metric', 'Detail'], ...rows.map((row) => [row.label, String(row.head), row.metric, row.detail])])
  return <div className="flex flex-col gap-6"><PageHeader title={screen.viTitle} sub="Báo cáo được tính lại từ các sổ hệ thống; kết quả hiển thị có thể in hoặc tải CSV." badge={<FixtureNotice />} /><WorkSection title="Tiêu chí báo cáo"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-ink md:col-span-2">Loại báo cáo *<select aria-label="Loại báo cáo" className={`${inputCls} mt-1.5`} value={report} onChange={(event) => { setReport(event.target.value); setGenerated(false) }}>{reportCatalogue.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></label><label className="text-xs font-semibold text-ink">Từ ngày *<input aria-label="Từ ngày" className={`${inputCls} mt-1.5`} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setGenerated(false) }} /></label><label className="text-xs font-semibold text-ink">Đến ngày *<input aria-label="Đến ngày" className={`${inputCls} mt-1.5`} type="date" value={to} onChange={(event) => { setTo(event.target.value); setGenerated(false) }} /></label></div><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{([['Pens', options.pens, pens, setPens], ['Breeds', options.breeds, breeds, setBreeds], ['Herd groups', options.groups, groups, setGroups], ['Life stages', options.stages, stages, setStages]] as const).map(([label, values, selected, setter]) => <fieldset key={label} className="min-w-0"><legend className="text-xs font-semibold text-ink">{label} · multi-select</legend><div className="mt-2 max-h-32 space-y-1 overflow-auto border-b border-rule pb-2">{values.map((value) => <label key={value} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(setter, selected, value)} />{value}</label>)}</div></fieldset>)}</div>{invalidPeriod && <InlineMessage className="mt-4" tone="err" title="Kỳ báo cáo không hợp lệ">Từ ngày không được sau đến ngày và khoảng tối đa là 24 tháng.</InlineMessage>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button onClick={() => { setPens([]); setBreeds([]); setGroups([]); setStages([]); setFrom('2026-10-04'); setTo('2026-11-03'); setGenerated(false) }}>Đặt lại</Button><Button variant="primary" disabled={invalidPeriod} onClick={() => setGenerated(true)}>Xem báo cáo</Button></div></WorkSection>{generated && !invalidPeriod && <WorkSection title={`Kết quả · ${reportCatalogue.find(([code]) => code === report)?.[1] || report}`} description={`${from}–${to} · ${filtered.length} cattle theo bộ lọc hiện tại`} actions={<><Button small onClick={() => window.print()}>In báo cáo</Button><Button small onClick={exportReport}>Xuất CSV hiển thị</Button></>}><SummaryStrip items={[{ label: 'Số con / dòng', value: `${filtered.length}`, note: `n = ${rows.reduce((sum, row) => sum + row.head, 0)}` }, { label: 'Số dòng kết quả', value: `${rows.length}`, note: 'theo chuồng' }, { label: 'Kỳ', value: `${from} → ${to}`, note: 'Asia/Ho_Chi_Minh' }, { label: 'Bộ lọc', value: `${pens.length + breeds.length + groups.length + stages.length}`, note: 'giá trị đã chọn' }]} />{!rows.length ? <EmptyState title="Chưa có kết quả báo cáo" description="Không có dữ liệu phù hợp với kỳ và bộ lọc hiện tại." /> : <Table wide scroll><thead><tr><Th>Chuồng / nhóm</Th><Th>Số con</Th><Th>Chỉ số chính</Th><Th>Chi tiết theo SRS</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><Td><strong>{row.label}</strong></Td><Td>{row.head}</Td><Td>{row.metric}</Td><Td>{row.detail}</Td></tr>)}</tbody><tfoot><tr><Td><strong>Tổng</strong></Td><Td><strong>{rows.reduce((sum, row) => sum + row.head, 0)}</strong></Td><Td colSpan={2}>Kết quả lấy từ dữ liệu đã lọc, thiếu dữ liệu hiển thị là “Chưa đủ dữ liệu”.</Td></tr></tfoot></Table>}</WorkSection>}{!generated && <InlineMessage tone="info">Chọn tiêu chí rồi bấm “Xem báo cáo” để tạo kết quả hiện tại.</InlineMessage>}</div>
}

function Report({ screen, role }: { screen: ScreenDefinition; role?: ScreenRole }) {
  const inRouter = useInRouterContext()
  const location = inRouter ? useLocation() : { search: '' }
  const queryReport = new URLSearchParams(location.search).get('report')
  const initialReport = reportCatalogue.some(([code]) => code === queryReport) ? queryReport as string : 'RPT-07'
  const [report, setReport] = useState(initialReport)
  const [from, setFrom] = useState('2026-10-04')
  const [to, setTo] = useState('2026-11-03')
  const [pens, setPens] = useState<string[]>([])
  const [breeds, setBreeds] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [generated, setGenerated] = useState(true)
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString())
  const allCows = cowsForPreview()
  const notices = loadNotifications().filter((notice) => notice.roles.includes(role || 'owner'))
  const options = { pens: [...new Set(allCows.map((cow) => cow.barn).filter((value): value is string => Boolean(value)))], breeds: [...new Set(allCows.map((cow) => cow.breed).filter((value): value is string => Boolean(value)))], groups: [...new Set(allCows.map(herdGroupForCow))], stages: [...new Set(allCows.map((cow) => cow.stage).filter((value): value is string => Boolean(value)))] }
  const invalidPeriod = from > to || to > addMonths(from, 24)
  const filtered = useMemo(() => allCows.filter((cow) => (!pens.length || pens.includes(cow.barn || '')) && (!breeds.length || breeds.includes(cow.breed || '')) && (!groups.length || groups.includes(herdGroupForCow(cow))) && (!stages.length || stages.includes(cow.stage || ''))), [allCows, breeds, groups, pens, stages])
  const rows = useMemo(() => makeDistinctReportRows(report, filtered, notices, from, to), [filtered, from, notices, report, to])
  const toggle = (setter: (value: string[]) => void, current: string[], value: string) => setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  const regenerate = () => { setGeneratedAt(new Date().toISOString()); setGenerated(true) }
  const reset = () => { setPens([]); setBreeds([]); setGroups([]); setStages([]); setFrom('2026-10-04'); setTo('2026-11-03'); setReport('RPT-07'); setGenerated(false) }
  const exportReport = () => downloadCsv(`${report}-management-report.csv`, [['Report', report], ['From', from], ['To', to], ['Generated at', generatedAt], ['Row', 'Head', 'Metric', 'Detail'], ...rows.map((row) => [row.label, String(row.head), row.metric, row.detail])])
  const filterSet = (label: string, values: string[], selected: string[], setter: (value: string[]) => void) => <fieldset key={label} className="min-w-0"><legend className="text-xs font-semibold text-ink">{label} · có thể chọn nhiều</legend><div className="mt-2 max-h-32 space-y-1 overflow-auto border-b border-rule pb-2">{values.map((value) => <label key={value} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(setter, selected, value)} />{value}</label>)}</div></fieldset>
  return <div className="flex flex-col gap-6"><PageHeader title={screen.viTitle} sub={`Báo cáo ${report} tính từ các sổ hệ thống · Tạo lúc ${new Date(generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`} badge={<FixtureNotice />} /><WorkSection title="Tiêu chí báo cáo"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-ink md:col-span-2">Loại báo cáo *<select aria-label="Loại báo cáo" className={`${inputCls} mt-1.5`} value={report} onChange={(event) => { setReport(event.target.value); setGenerated(false) }}>{reportCatalogue.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></label><label className="text-xs font-semibold text-ink">Từ ngày *<input aria-label="Từ ngày" className={`${inputCls} mt-1.5`} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setGenerated(false) }} /></label><label className="text-xs font-semibold text-ink">Đến ngày *<input aria-label="Đến ngày" className={`${inputCls} mt-1.5`} type="date" value={to} onChange={(event) => { setTo(event.target.value); setGenerated(false) }} /></label></div><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{filterSet('Chuồng', options.pens, pens, setPens)}{filterSet('Giống', options.breeds, breeds, setBreeds)}{filterSet('Nhóm đàn', options.groups, groups, setGroups)}{filterSet('Giai đoạn sinh trưởng', options.stages, stages, setStages)}</div>{invalidPeriod && <InlineMessage className="mt-4" tone="err" title="Kỳ báo cáo không hợp lệ">Từ ngày không được sau ngày kết thúc và khoảng tối đa là 24 tháng.</InlineMessage>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button onClick={reset}>Đặt lại</Button><Button variant="primary" disabled={invalidPeriod} onClick={regenerate}>Xem báo cáo</Button></div></WorkSection>{generated && !invalidPeriod && <WorkSection title={`Kết quả · ${reportCatalogue.find(([code]) => code === report)?.[1] || report}`} description={`${from}–${to} · ${filtered.length} con theo bộ lọc hiện tại`} actions={<><Button small onClick={() => window.print()}>In báo cáo</Button><Button small onClick={exportReport}>Xuất CSV hiển thị</Button></>}><SummaryStrip items={[{ label: 'Số con / dòng', value: `${filtered.length}`, note: `n = ${rows.reduce((sum, row) => sum + row.head, 0)}` }, { label: 'Số dòng kết quả', value: `${rows.length}`, note: 'theo chuồng / nhóm phù hợp' }, { label: 'Kỳ', value: `${from} → ${to}`, note: 'Múi giờ Việt Nam' }, { label: 'Bộ lọc', value: `${pens.length + breeds.length + groups.length + stages.length}`, note: 'giá trị đã chọn' }]} /><ReportChart rows={rows} report={report} />{!rows.length ? <EmptyState title="Chưa có kết quả báo cáo" description="Không có dữ liệu phù hợp với kỳ và bộ lọc hiện tại." /> : <Table wide scroll><thead><tr><Th>{report === 'RPT-03' ? 'Lịch / chuồng' : report === 'RPT-04' ? 'Chuồng / thuốc' : report === 'RPT-05' ? 'Chuồng / trạng thái' : 'Chuồng / nhóm'}</Th><Th>Số con / n</Th><Th>Chỉ số chính</Th><Th>Tử số / mẫu số · chi tiết</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><Td><strong>{row.label}</strong></Td><Td>{row.head}</Td><Td>{row.metric}</Td><Td>{row.detail}{row.insufficient != null && row.insufficient > 0 ? ` · Chưa đủ dữ liệu (${row.insufficient} con)` : ''}</Td></tr>)}</tbody><tfoot><tr><Td><strong>Tổng</strong></Td><Td><strong>{rows.reduce((sum, row) => sum + row.head, 0)}</strong></Td><Td colSpan={2}>Mỗi báo cáo dùng công thức riêng theo danh mục báo cáo; dữ liệu thiếu được ghi rõ theo số con.</Td></tr></tfoot></Table>}</WorkSection>}{!generated && <InlineMessage tone="info">Chọn tiêu chí rồi bấm “Xem báo cáo” để tạo kết quả hiện tại.</InlineMessage>}</div>
}

export function InsightScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role?: ScreenRole }) {
  const effectiveRole = role ?? 'owner'
  if (state === 'loading') return <LoadingState label={`Đang tổng hợp ${screen.viTitle.toLowerCase()}…`} rows={6} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tổng hợp ${screen.id === 'SCR-77' ? 'dashboard' : 'báo cáo'}.`}>Giữ nguyên bộ lọc và thử tải lại.</InlineMessage>
  if (!roleCanView(effectiveRole)) return <InlineMessage tone="warn" title="Không có quyền truy cập">Trang tổng quan và báo cáo chỉ dành cho Chủ trại hoặc Quản lý.</InlineMessage>
  if (state === 'empty') return <div className="flex flex-col gap-6"><PageHeader title={screen.viTitle} sub="Chưa có dữ liệu để tổng hợp; bộ lọc và trạng thái được giữ khi tải lại." badge={<FixtureNotice />} /><EmptyState title={screen.id === 'SCR-77' ? 'Trang trại chưa có dữ liệu tổng quan' : 'Chưa có kết quả báo cáo'} description="Nhập dữ liệu hoặc thay đổi kỳ và bộ lọc để xem lại." actionLabel="Mở danh sách bò" onAction={() => { window.location.href = '/ui/scr-26' }} /></div>
  return screen.id === 'SCR-77' ? <Dashboard screen={screen} role={effectiveRole} /> : <Report screen={screen} role={effectiveRole} />
}
