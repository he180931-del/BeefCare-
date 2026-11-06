import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, Info, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, InlineMessage, LoadingState, SummaryStrip, WorkSection } from '../../../components/workspace'
import { BREEDS, initialCows, newQrCode, PURPOSES, type CowSeed } from '../../../data/cowsData'
import { seedPens } from '../../../data/pensData'
import { expandLocalTable } from '../../../app/localStressData'

const KEY = 'beefcare-ui-demo'
const readDemo = <T,>(key: string, fallback: T): T => { if (typeof window === 'undefined') return fallback; try { const root = JSON.parse(window.localStorage.getItem(KEY) || '{}'); return (root.account?.[key] as T) ?? fallback } catch { return fallback } }
const writeDemo = (key: string, value: unknown) => { if (typeof window === 'undefined') return; try { const root = JSON.parse(window.localStorage.getItem(KEY) || '{}'); window.localStorage.setItem(KEY, JSON.stringify({ ...root, account: { ...(root.account || {}), [key]: value } })) } catch { /* demo storage is best effort */ } }
const canChange = (role?: ScreenRole) => role === 'owner' || role === 'manager'
const purposeOptionsForSex = (sex: string, current?: string) => { const options = PURPOSES.filter((purpose) => purpose === 'Chưa xác định' || purpose === 'Vỗ béo' || (purpose === 'Sinh sản' && sex === 'Cái') || (purpose === 'Đực giống' && sex === 'Đực')); return current && !options.includes(current) ? [current, ...options] : options }
const cowsForPreview = () => expandLocalTable('cattle', readDemo<CowSeed[]>('cattle-preview', initialCows))
const isPreviewStressRow = (cow: CowSeed) => Boolean((cow as CowSeed & { __stressGenerated?: true }).__stressGenerated)
const LIFE_STAGES = ['Bê theo mẹ', 'Bê cai sữa', 'Bò tơ', 'Bò trưởng thành'] as const
const lifeStageOf = (cow: CowSeed) => cow.lifeStage || (cow.months <= 6 ? 'Bê theo mẹ' : cow.months <= 12 ? 'Bê cai sữa' : cow.months <= 24 ? 'Bò tơ' : 'Bò trưởng thành')
const cattleStatusText = (status: CowSeed['status']) => status === 'ACTIVE' ? 'Đang nuôi' : status === 'EXIT_PENDING' ? 'Chờ xuất đàn' : status === 'EXITED' ? 'Đã xuất đàn' : 'Đã hủy'
const today = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = (name: string) => parts.find((part) => part.type === name)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}
const parseDate = (value?: string) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  const monthMatch = value.match(/^(\d{1,2})\/(\d{4})/)
  return monthMatch ? `${monthMatch[2]}-${monthMatch[1].padStart(2, '0')}-01` : ''
}
const entryDateOf = (cow: CowSeed) => {
  const extended = cow as CowSeed & { entryDate?: string; createdAt?: string; birthDate?: string; birthDateAccuracy?: string }
  return parseDate(cow.importRecord?.date) || parseDate(extended.entryDate) || parseDate(extended.createdAt) || parseDate(extended.birthDate) || parseDate(cow.birth)
}
const birthAccuracyOf = (cow: CowSeed) => {
  const extended = cow as CowSeed & { birthDateAccuracy?: string }
  const birth = (cow.birth || '').toLowerCase()
  const accuracy = extended.birthDateAccuracy || (/ước tính|estimated/.test(birth) ? 'Estimated' : /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})(?:\s|$)/.test(birth) ? 'Exact' : 'Estimated')
  return accuracy === 'Exact' ? 'Chính xác' : accuracy === 'Estimated' ? 'Ước tính' : accuracy
}
const selectedCode = () => {
  if (typeof window !== 'undefined') {
    const queryCode = new URLSearchParams(window.location.search).get('code')
    if (queryCode) return queryCode
  }
  return readDemo<{ code?: string }>('selected-cattle', {}).code || 'BC-000125'
}
const profileRoute = (id: string, code: string) => `/ui/${id.toLowerCase()}?code=${encodeURIComponent(code)}`
type ChangeHistory = { value: string; oldValue?: string; newValue?: string; effectiveDate: string; reason: string; changedAt: string; by: string }

function Shell({ screen, children, actions, code, role }: { screen: ScreenDefinition; children: ReactNode; actions?: ReactNode; code?: string; role?: ScreenRole }) {
  const navigate = useNavigate()
  const cow = code ? cowsForPreview().find((row) => row.code === code) : undefined
  const profileTabs: Array<[string, string, boolean]> = [['SCR-27', 'Tổng quan', true], ['SCR-79', 'Timeline', true], ['SCR-43', 'Tăng trưởng', true], ['SCR-49', 'Tiêm phòng', true], ['SCR-54', 'Sức khỏe', true], ['SCR-60', 'Sinh sản', cow?.sex !== 'Đực'], ['SCR-28', 'Chuồng', true], ['SCR-29', 'QR', true]]
  return <div className="flex w-full flex-col gap-6"><PageHeader title={screen.viTitle} sub="Tra cứu, cập nhật hồ sơ và quản lý trạng thái đàn bò." badge={<span className="text-xs font-semibold text-subtle">Quản lý đàn</span>}>{actions}</PageHeader>{screen.parentId === 'SCR-27' || screen.id === 'SCR-27' ? <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-rule pb-3" aria-label="Tab hồ sơ bò">{profileTabs.filter(([, , visible]) => visible).map(([id, label]) => <button key={id} aria-current={screen.id === id ? 'page' : undefined} className={`border-b-2 px-1 pb-2 text-xs font-semibold ${screen.id === id ? 'border-brand text-brand' : 'border-transparent text-subtle hover:border-brand hover:text-brand'}`} onClick={() => navigate(code ? profileRoute(id, code) : `/ui/${id.toLowerCase()}`)}>{label}</button>)}</nav> : null}{children}</div>
}

const herdGroupOf = (cow: CowSeed) => {
  if (cow.status === 'EXITED') return 'Đã xuất'
  if (cow.status !== 'ACTIVE') return 'Khác'
  if (lifeStageOf(cow) === 'Bê theo mẹ' || lifeStageOf(cow) === 'Bê cai sữa') return 'Bê'
  if (cow.purpose === 'Đực giống') return 'Đực giống'
  if (cow.purpose === 'Vỗ béo') return 'Vỗ béo'
  if (cow.sex === 'Cái' && cow.purpose === 'Sinh sản' && lifeStageOf(cow) === 'Bò tơ') return 'Bò tơ'
  if (cow.sex === 'Cái' && cow.purpose === 'Sinh sản') return 'Bò cái sinh sản'
  return 'Khác'
}
const GROUPS = ['Tất cả', 'Bò cái sinh sản', 'Bò tơ', 'Vỗ béo', 'Bê', 'Đực giống', 'Khác', 'Đã xuất']

function CattleList({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate(); const [params] = useSearchParams(); const routeQuery = params.get('q') || ''; const [cows] = useState(cowsForPreview); const [loading, setLoading] = useState(true); const saved = readDemo<Record<string, string>>('cattle-filter', {}); const [query, setQuery] = useState(routeQuery || saved.query || ''); const [breed, setBreed] = useState(saved.breed || 'ALL'); const [sex, setSex] = useState(saved.sex || 'ALL'); const [pen, setPen] = useState(saved.pen || saved.barn || 'ALL'); const [purpose, setPurpose] = useState(saved.purpose || 'ALL'); const [stage, setStage] = useState(saved.stage || 'ALL'); const [group, setGroup] = useState(saved.group || 'Tất cả'); const [health, setHealth] = useState(saved.health || 'ALL'); const [status, setStatus] = useState(saved.status || 'ACTIVE'); const [sort, setSort] = useState(saved.sort || 'code'); const pens = readDemo<typeof seedPens>('pens-preview', seedPens)
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 120); return () => window.clearTimeout(timer) }, [])
  useEffect(() => { if (routeQuery) setQuery(routeQuery) }, [routeQuery])
  useEffect(() => { writeDemo('cattle-filter', { query, breed, sex, pen, purpose, stage, group, health, status, sort }) }, [query, breed, sex, pen, purpose, stage, group, health, status, sort])
  const rows = useMemo(() => cows.filter((cow) => (!query || `${cow.code} ${cow.tag || ''} ${cow.name || ''} ${cow.qr || ''}`.toLowerCase().includes(query.toLowerCase())) && (breed === 'ALL' || cow.breed === breed) && (sex === 'ALL' || cow.sex === sex) && (pen === 'ALL' || cow.barn === pen) && (purpose === 'ALL' || cow.purpose === purpose) && (stage === 'ALL' || lifeStageOf(cow) === stage) && (group === 'Tất cả' || herdGroupOf(cow) === group) && (health === 'ALL' || (health === 'Cách ly thịt' ? Boolean(cow.withdrawalUntil) : cow.health?.label === health)) && (status === 'ALL' || cow.status === status)), [cows, query, breed, sex, pen, purpose, stage, group, health, status])
  const sorted = [...rows].sort((a, b) => sort === 'weight' ? (b.weight || 0) - (a.weight || 0) : sort === 'name' ? (a.name || a.code).localeCompare(b.name || b.code) : a.code.localeCompare(b.code))
  const operationalCows = cows.filter((cow) => !isPreviewStressRow(cow))
  const visibleOperationalCows = sorted.filter((cow) => !isPreviewStressRow(cow))
  const visibleStressCowCount = sorted.length - visibleOperationalCows.length
  const stressCowCount = cows.length - operationalCows.length
  const active = operationalCows.filter((cow) => cow.status === 'ACTIVE').length
  const groupCount = (label: string) => label === 'Tất cả' ? active : label === 'Đã xuất' ? operationalCows.filter((cow) => cow.status === 'EXITED').length : operationalCows.filter((cow) => cow.status === 'ACTIVE' && herdGroupOf(cow) === label).length
  const statusLabel = (cow: CowSeed) => cow.status === 'EXIT_PENDING' ? `Chờ xuất / xác nhận${cow.exitStatusLabel ? ` · ${cow.exitStatusLabel}` : ''}${cow.date ? ` · ${cow.date}` : ''}` : cow.status === 'EXITED' ? `Đã xuất${cow.exitStatusLabel ? ` · ${cow.exitStatusLabel}` : ''}${cow.date ? ` · ${cow.date}` : ''}` : cow.status === 'VOIDED' ? 'Nhập nhầm – đã hủy' : 'Đang nuôi'
  const clearFilters = () => { setQuery(''); setBreed('ALL'); setSex('ALL'); setPen('ALL'); setPurpose('ALL'); setStage('ALL'); setGroup('Tất cả'); setHealth('ALL'); setStatus('ACTIVE'); setSort('code') }
  const hasAppliedFilter = Boolean(query) || breed !== 'ALL' || sex !== 'ALL' || pen !== 'ALL' || purpose !== 'ALL' || stage !== 'ALL' || group !== 'Tất cả' || health !== 'ALL' || status !== 'ACTIVE' || sort !== 'code'
  return <Shell screen={screen} role={role} actions={canChange(role) && <Button variant="primary" onClick={() => navigate('/ui/scr-34')}>+ Tạo phiếu nhập đàn</Button>}><SummaryStrip items={[{ label: 'Đang nuôi', value: `${active} con` }, { label: 'Đã xuất', value: `${operationalCows.filter((cow) => cow.status === 'EXITED').length} con` }, { label: 'Chờ xuất / xác nhận', value: `${operationalCows.filter((cow) => cow.status === 'EXIT_PENDING').length} con` }, { label: 'Đang hiển thị', value: `${visibleOperationalCows.length} con` }]} />{stressCowCount > 0 && <p className="m-0 text-xs text-subtle">Chỉ số và số ở tab nhóm chỉ tính dữ liệu nghiệp vụ.{visibleStressCowCount > 0 ? ` ${visibleStressCowCount} dòng thử đang được hiển thị trong bảng và đã gắn nhãn riêng để kiểm tra mật độ.` : ` ${stressCowCount} dòng thử được gắn nhãn riêng để kiểm tra mật độ.`}</p>}<nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-rule" aria-label="Nhóm đàn">{GROUPS.map((label) => <button key={label} className={`border-b-2 px-1 pb-2 text-xs font-semibold ${group === label ? 'border-brand text-brand' : 'border-transparent text-subtle hover:text-ink'}`} onClick={() => { setGroup(label); if (label === 'Đã xuất') setStatus('EXITED'); else if (status === 'EXITED') setStatus('ACTIVE') }}>{label} <span className="font-normal">{groupCount(label)}</span></button>)}</nav><FilterBar><input className={`${inputCls} min-w-64 flex-1`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã hiển thị, số tai phụ hoặc tên gọi…" aria-label="Tìm bò" /><select className={`${inputCls} w-40`} value={breed} onChange={(event) => setBreed(event.target.value)} aria-label="Giống"><option value="ALL">Giống: tất cả</option>{BREEDS.map((item) => <option key={item}>{item}</option>)}</select><select className={`${inputCls} w-36`} value={sex} onChange={(event) => setSex(event.target.value)} aria-label="Giới tính"><option value="ALL">Giới tính: tất cả</option><option>Cái</option><option>Đực</option></select><select className={`${inputCls} w-48`} value={pen} onChange={(event) => setPen(event.target.value)} aria-label="Chuồng"><option value="ALL">Chuồng: tất cả</option>{pens.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}{item.status === 'INACTIVE' ? ' · ngừng nhận' : ''}</option>)}</select><select className={`${inputCls} w-40`} value={purpose} onChange={(event) => setPurpose(event.target.value)} aria-label="Mục đích"><option value="ALL">Mục đích: tất cả</option>{PURPOSES.map((item) => <option key={item}>{item}</option>)}</select><select className={`${inputCls} w-40`} value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Giai đoạn"><option value="ALL">Giai đoạn: tất cả</option>{LIFE_STAGES.map((item) => <option key={item}>{item}</option>)}</select><select className={`${inputCls} w-44`} value={health} onChange={(event) => setHealth(event.target.value)} aria-label="Sức khỏe"><option value="ALL">Sức khỏe: tất cả</option><option>Khỏe</option><option>Theo dõi</option><option>Đang điều trị</option><option>Cách ly thịt</option></select><select className={`${inputCls} w-44`} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Trạng thái đàn"><option value="ACTIVE">Đang nuôi</option><option value="EXIT_PENDING">Chờ xuất / xác nhận</option><option value="EXITED">Đã xuất</option><option value="VOIDED">Đã hủy</option><option value="ALL">Tất cả trạng thái</option></select><select className={`${inputCls} w-36`} value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp"><option value="code">Sắp xếp: mã</option><option value="name">Sắp xếp: tên</option><option value="weight">Sắp xếp: cân</option></select></FilterBar>{loading && <div className="border-y border-rule py-5 text-xs text-subtle" role="status">Đang tải danh sách đàn…</div>}{!loading && <Table wide scroll><thead><tr><Th>Bò</Th><Th>Giống</Th><Th>Giới tính · tuổi</Th><Th>Chuồng</Th><Th>Mục đích · giai đoạn</Th><Th>Cân gần nhất</Th><Th>Trạng thái</Th><Th>Sức khỏe</Th><Th>Sinh sản</Th><Th /></tr></thead><tbody>{sorted.map((cow) => { const stressRow = isPreviewStressRow(cow); return <tr key={cow.code}><Td>{stressRow ? <><strong>{cow.code}</strong>{cow.name && <span className="block font-normal text-subtle">{cow.name}</span>}<Badge className="mt-1" tone="outline">Dữ liệu thử · chỉ xem</Badge></> : <button className="font-semibold text-brand hover:underline" onClick={() => { writeDemo('selected-cattle', { code: cow.code }); navigate(profileRoute('SCR-27', cow.code)) }}>{cow.code}{cow.name && <span className="block font-normal text-subtle">{cow.name}</span>}</button>}</Td><Td>{cow.breed}</Td><Td>{cow.sex} · {cow.ageLong || cow.ageShort}</Td><Td>{cow.barn ? `${cow.barn} · ${pens.find((item) => item.code === cow.barn)?.name || ''}` : '—'}</Td><Td>{cow.purpose || '—'} · {lifeStageOf(cow)}</Td><Td>{cow.weight == null ? '—' : `${cow.weight} kg${cow.weightEst ? '*' : ''} · ${cow.weightDate}`}</Td><Td><Badge tone={cow.status === 'ACTIVE' ? 'ok' : cow.status === 'VOIDED' ? 'err' : cow.status === 'EXIT_PENDING' ? 'warn' : 'outline'}>{statusLabel(cow)}</Badge></Td><Td>{cow.status === 'ACTIVE' ? <div className="flex flex-col items-start gap-1">{cow.health ? <Badge tone={cow.health.tone === 'err' ? 'err' : cow.health.tone === 'warn' ? 'warn' : 'ok'}>{cow.health.label}</Badge> : <span>—</span>}{cow.withdrawalUntil && <span className="text-[11px] font-medium text-warn-fg">Cách ly thịt đến {cow.withdrawalUntil}</span>}</div> : '—'}</Td><Td>{cow.status === 'ACTIVE' ? cow.repro?.label || '—' : '—'}</Td><Td>{stressRow ? <Badge tone="outline">Chỉ xem</Badge> : <Button small onClick={() => { writeDemo('selected-cattle', { code: cow.code }); navigate(profileRoute('SCR-27', cow.code)) }}>Mở hồ sơ</Button>}</Td></tr> })}{!sorted.length && <tr><Td colSpan={10}><EmptyState title="Không có bò phù hợp" description={hasAppliedFilter ? `Đang có ${operationalCows.length} bò nghiệp vụ trong đàn, nhưng không dòng nào khớp bộ lọc hiện tại.` : 'Chưa có bò nào trong trạng thái đang chọn.'} actionLabel={hasAppliedFilter ? 'Xóa bộ lọc' : undefined} onAction={hasAppliedFilter ? clearFilters : undefined} compact /></Td></tr>}</tbody></Table>}<p className="m-0 text-xs text-subtle">* Cân ước tính · nhóm đàn được suy ra từ mục đích nuôi, giới tính và giai đoạn sinh trưởng.</p></Shell>
}

function Profile({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate()
  const [copiedId, setCopiedId] = useState(false)
  const cows = cowsForPreview()
  const code = selectedCode()
  const cow = cows.find((row) => row.code === code) || cows[0]
  const purposeHistory = (cow as CowSeed & { purposeHistory?: ChangeHistory[] }).purposeHistory || []
  const lifeStageHistory = (cow as CowSeed & { lifeStageHistory?: ChangeHistory[] }).lifeStageHistory || []
  const editable = canChange(role) && cow.status === 'ACTIVE' && state !== 'read-only'
  const statusMessage = cow.status === 'EXITED' ? 'Hồ sơ đã xuất đàn, chỉ xem.' : cow.status === 'VOIDED' ? 'Hồ sơ đã hủy do nhập nhầm, chỉ xem.' : cow.status === 'EXIT_PENDING' ? 'Bò đang nằm trong quy trình xuất đàn; thao tác cập nhật tạm khóa.' : ''
  const internalId = cow.internalId || '—'
  const shortInternalId = internalId.length > 14 ? `${internalId.slice(0, 8)}…${internalId.slice(-4)}` : internalId
  const purposeType = cow.purpose === 'Sinh sản' ? 'Bò sinh sản' : cow.purpose === 'Đực giống' ? 'Bò đực giống' : cow.purpose === 'Vỗ béo' ? 'Bò vỗ béo' : 'Chưa xác định'
  const activeBadges: Array<[string, 'ok' | 'warn' | 'info' | 'err']> = cow.status === 'ACTIVE'
    ? [['Đang nuôi', 'ok'], [herdGroupOf(cow), 'info'], ...(cow.health ? [[cow.health.label, cow.health.tone === 'err' ? 'err' : cow.health.tone === 'warn' ? 'warn' : 'ok'] as [string, 'ok' | 'warn' | 'info' | 'err']] : []), ...(cow.withdrawalUntil ? [[`Cách ly thịt đến ${cow.withdrawalUntil}`, 'warn'] as [string, 'ok' | 'warn' | 'info' | 'err']] : []), ...(cow.sex !== 'Đực' && cow.repro ? [[cow.repro.label, cow.repro.tone === 'err' ? 'err' : cow.repro.tone === 'warn' ? 'warn' : 'ok'] as [string, 'ok' | 'warn' | 'info' | 'err']] : [])]
    : [[cow.status === 'EXITED' ? `Đã xuất · ${cow.exitStatusLabel || '—'} · ${cow.date || '—'}` : cow.status === 'EXIT_PENDING' ? `Chờ xuất / xác nhận · ${cow.exitStatusLabel || 'Chưa xác nhận'}` : 'Nhập nhầm – đã hủy', cow.status === 'VOIDED' ? 'err' : 'warn']]
  return <Shell screen={screen} role={role} code={cow.code} actions={<><Button onClick={() => navigate(profileRoute('SCR-28', cow.code))}>Lịch sử chuồng</Button><Button onClick={() => navigate(profileRoute('SCR-29', cow.code))}>Thẻ QR</Button>{editable && <><Button onClick={() => navigate(profileRoute('SCR-31', cow.code))}>Cấp / thay QR</Button><Button variant="primary" onClick={() => navigate(profileRoute('SCR-30', cow.code))}>Cập nhật hồ sơ</Button></>}</>}>
    <div className="border-y border-rule py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="m-0 text-xs font-semibold text-brand">{cow.code}</p><h2 className="mb-0 mt-1 text-2xl font-bold text-ink">{cow.name || 'Chưa đặt tên'}</h2><p className="mb-0 mt-2 text-sm text-subtle">{cow.tag || 'Chưa có thẻ phụ'} · {cow.breed} · {cow.sex} · {cow.ageLong || cow.ageShort} · Chuồng {cow.barn || '—'}</p></div><div className="flex flex-wrap gap-2">{activeBadges.map(([label, tone], index) => <Badge key={`${label}-${index}`} tone={tone}>{label}</Badge>)}</div></div>{statusMessage && <InlineMessage tone="info" className="mt-4">{statusMessage}</InlineMessage>}</div>
    <WorkSection title="Thông tin cá thể"><Info items={[["ID nội bộ", shortInternalId], ['Mã hiển thị · tai phụ', `${cow.code} · ${cow.tag || '—'}`], ['QR hiện tại · trạng thái', `${cow.qr || 'Chưa cấp'} · ${cow.qr ? 'Đang sử dụng' : 'Chưa cấp'}`], ['Giống · giới tính', `${cow.breed} · ${cow.sex}`], ['Ngày sinh · độ chính xác', `${cow.birth || '—'} · ${birthAccuracyOf(cow)}`], ['Tuổi', cow.ageLong || cow.ageShort || '—'], ['Nguồn nhập', cow.source || '—'], ['Mục đích · loại · từ', `${cow.purpose || '—'} · ${purposeType} · ${cow.purposeSince || '—'}`], ['Giai đoạn sinh lý', `${lifeStageOf(cow)} · từ ${(cow as CowSeed & { lifeStageSince?: string }).lifeStageSince || cow.stageSince || '—'}`], ['Chuồng hiện tại', `${cow.barn || '—'} · từ ${cow.barnSince || '—'}`], ['Mẹ', cow.mother || '—'], ['Bố', cow.father || '—'], ['Màu và dấu hiệu', cow.colourMarkings || cow.description || '—']]} /><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-subtle">ID nội bộ đầy đủ</span><code>{shortInternalId}</code><Button small aria-label="Sao chép ID nội bộ" onClick={() => { void navigator.clipboard?.writeText(internalId); setCopiedId(true) }}>{copiedId ? 'Đã sao chép' : 'Sao chép'}</Button></div></WorkSection>
    {cow.status === 'ACTIVE' && <InlineMessage tone="info">Gợi ý cập nhật giai đoạn chỉ là nhắc việc; hệ thống không tự động thay đổi hồ sơ.</InlineMessage>}
    <WorkSection title="Tóm tắt chăm sóc"><SummaryStrip items={[{ label: 'Cân gần nhất', value: cow.care?.last || '—' }, { label: 'ADG 90 ngày', value: cow.care?.adg || '—' }, { label: 'BCS', value: cow.care?.bcs || '—' }, { label: 'Sức khỏe', value: cow.care?.healthCase || '—' }]} /><div className="mt-4 grid gap-4 md:grid-cols-3"><div><p className="m-0 text-xs text-subtle">Sinh sản</p><p className="mb-0 mt-1 text-sm font-semibold">{cow.sex === 'Đực' ? 'Không áp dụng' : cow.care?.repro || 'Không áp dụng'}</p></div><div><p className="m-0 text-xs text-subtle">Tiêm phòng</p><p className="mb-0 mt-1 text-sm font-semibold">{cow.care?.vaccine?.label || '—'}</p></div><div><p className="m-0 text-xs text-subtle">Nhắc việc</p>{cow.care?.reminders?.length ? <ul className="m-0 mt-1 list-none space-y-1 p-0 text-sm font-semibold">{cow.care.reminders.slice(0, 5).map((item) => <li key={item.title}><button className="text-left text-brand hover:underline" onClick={() => navigate('/ui/scr-73')}>{item.title} · {item.due.label}</button></li>)}</ul> : <p className="mb-0 mt-1 text-sm font-semibold">Không có nhắc việc</p>}</div></div></WorkSection>
    {(purposeHistory.length > 0 || lifeStageHistory.length > 0) && <WorkSection title="Lịch sử mục đích và giai đoạn"><Table><thead><tr><Th>Trường</Th><Th>Giá trị cũ → mới</Th><Th>Ngày hiệu lực</Th><Th>Lý do</Th><Th>Người ghi</Th></tr></thead><tbody>{[...purposeHistory.map((item) => ({ ...item, field: 'Mục đích' })), ...lifeStageHistory.map((item) => ({ ...item, field: 'Giai đoạn sinh lý' }))].map((item, index) => <tr key={`${item.field}-${item.changedAt}-${index}`}><Td>{item.field}</Td><Td>{item.oldValue ? `${item.oldValue} → ${item.newValue || item.value}` : item.value}</Td><Td>{item.effectiveDate}</Td><Td>{item.reason}</Td><Td>{item.by}</Td></tr>)}</tbody></Table></WorkSection>}
  </Shell>
}

function PenHistory({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate(); const cow = cowsForPreview().find((row) => row.code === selectedCode()) || initialCows[0]; const editable = canChange(role) && cow.status === 'ACTIVE' && state !== 'read-only'; const penRows = readDemo<typeof seedPens>('pens-preview', seedPens); const pen = penRows.find((row) => row.code === cow.barn); const occupancy = pen ? `${pen.count}/${pen.capacity}` : '—'; const criteria = pen ? `${pen.accept} · ${pen.sex} · ${pen.minAge ? `${pen.minAge} tháng` : 'mọi tuổi'}` : 'Không xác định'
  return <Shell screen={screen} role={role} code={cow.code} actions={editable && <Button variant="primary" onClick={() => navigate('/ui/scr-25')}>Chuyển chuồng</Button>}><WorkSection title="Chuồng hiện tại"><Info items={[["Chuồng", cow.barn || '—'], ['Từ ngày', cow.barnSince || '—'], ['Đang có / sức chứa', occupancy], ['Tiêu chí tiếp nhận', criteria]]} /></WorkSection>{!editable && <InlineMessage tone="info">Hồ sơ này chỉ xem; quyền chuyển chuồng dành cho Chủ trại hoặc Quản lý.</InlineMessage>}<WorkSection title="Lịch sử chuồng">{cow.barnHistory?.length ? <Table wide scroll><thead><tr><Th>Chuồng</Th><Th>Từ</Th><Th>Đến</Th><Th>Lý do</Th><Th>Ghi bởi</Th></tr></thead><tbody>{cow.barnHistory.map((row, index) => <tr key={`${row.barn}-${index}`}><Td>{row.barn}</Td><Td>{row.from}</Td><Td>{row.to}</Td><Td>{row.reason}</Td><Td>{row.by}</Td></tr>)}</tbody></Table> : <EmptyState compact title="Chưa có lịch sử chuồng" description="Lịch sử sẽ xuất hiện sau khi bò được phân chuồng." />}</WorkSection></Shell>
}

function QrTab({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate()
  const cow = cowsForPreview().find((row) => row.code === selectedCode()) || initialCows[0]
  const editable = canChange(role) && cow.status === 'ACTIVE' && state !== 'read-only'
  const canPrint = canChange(role) && state !== 'read-only' && Boolean(cow.qr)
  return <Shell screen={screen} role={role} code={cow.code} actions={canPrint ? <><Button onClick={() => window.print()}>In thẻ QR</Button>{editable && <Button variant="primary" onClick={() => navigate(profileRoute('SCR-31', cow.code))}>Thay thẻ QR</Button>}</> : undefined}>
    <div className="border-y border-rule py-6"><div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center"><div className="grid aspect-square place-items-center border-2 border-brand bg-page text-center text-xs font-semibold text-brand">Mã QR<br />{cow.qr || 'Chưa cấp'}</div><Info items={[["Mã thẻ", cow.qr || 'Chưa cấp'], ['Trạng thái', cow.qr ? 'Đang sử dụng' : 'Chưa cấp'], ['Mã in trên thẻ', cow.code], ['Cấp lúc · bởi', `${cow.qrFrom || '—'} · ${cow.qrFromWho || '—'}`]]} /></div></div>
    {!cow.qr && <InlineMessage tone="warn">Bò chưa có thẻ QR để in. Chủ trại hoặc Quản lý có thể cấp thẻ mới.</InlineMessage>}
    {!canPrint && cow.qr && <InlineMessage tone="info">Chế độ chỉ đọc hoặc kỹ thuật viên: in hoặc thay thẻ QR do Chủ trại hoặc Quản lý thực hiện.</InlineMessage>}
    <WorkSection title="Lịch sử thẻ QR">{cow.qrHistory?.length ? <Table wide scroll><thead><tr><Th>Mã thẻ</Th><Th>Đã cấp</Th><Th>Kết thúc</Th><Th>Lý do / ghi chú</Th><Th>Người thực hiện</Th></tr></thead><tbody>{cow.qrHistory.map((row) => <tr key={row.code}><Td>{row.code}</Td><Td>{row.from}</Td><Td>{row.to}</Td><Td>{row.reason}{(row as typeof row & { note?: string }).note ? ` · ${(row as typeof row & { note?: string }).note}` : ''}</Td><Td>{row.by}</Td></tr>)}</tbody></Table> : <EmptyState compact title="Chưa có lịch sử thẻ" description="Bò chưa được cấp thẻ QR." />}</WorkSection>
  </Shell>
}

function UpdateProfile({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate(); const cows = cowsForPreview(); const code = selectedCode(); const cow = cows.find((row) => row.code === code) || cows[0]; const entryDate = entryDateOf(cow); const maxDate = today(); const [tab, setTab] = useState<'identity' | 'purpose' | 'stage'>('identity'); const [tag, setTag] = useState(cow.tag || ''); const [name, setName] = useState(cow.name || ''); const [colour, setColour] = useState(cow.colourMarkings || ''); const [notes, setNotes] = useState(cow.notes || ''); const [purpose, setPurpose] = useState(cow.purpose || 'Sinh sản'); const [stage, setStage] = useState(lifeStageOf(cow)); const [purposeDate, setPurposeDate] = useState(maxDate); const [purposeReason, setPurposeReason] = useState(''); const [stageDate, setStageDate] = useState(maxDate); const [stageReason, setStageReason] = useState(''); const [error, setError] = useState(''); const [confirmRepro, setConfirmRepro] = useState(false)
  if (state === 'read-only' || !canChange(role) || cow.status !== 'ACTIVE') return <Shell screen={screen} role={role} code={cow.code}><InlineMessage tone="warn">Hồ sơ chỉ xem; chỉ Chủ trại hoặc Quản lý mới có thể cập nhật bò đang nuôi.</InlineMessage></Shell>
  const persist = (patch: Partial<typeof cow>) => { writeDemo('cattle-preview', cows.map((row) => row.code === cow.code ? { ...row, ...patch } : row)); navigate(profileRoute('SCR-27', cow.code)) }
  const saveIdentity = (event: FormEvent) => { event.preventDefault(); setError(''); if (tag.length > 30 || name.length > 50) return setError('Số tai phụ tối đa 30 ký tự và tên gọi tối đa 50 ký tự.'); if (cows.some((row) => row.code !== cow.code && row.status === 'ACTIVE' && row.tag === tag && tag)) return setError('Số tai đã tồn tại ở một bò đang nuôi khác.'); persist({ tag, name, colourMarkings: colour, notes }) }
  const savePurpose = (event: FormEvent) => { event.preventDefault(); setError(''); if (role !== 'owner') return setError('Chỉ Chủ trại được thay đổi mục đích sản xuất.'); if (!purposeOptionsForSex(cow.sex || '', cow.purpose).includes(purpose)) return setError(cow.sex === 'Đực' ? 'Mục đích Sinh sản chỉ áp dụng cho bò cái; chọn Đực giống hoặc Vỗ béo.' : 'Mục đích Đực giống chỉ áp dụng cho bò đực; chọn Sinh sản hoặc Vỗ béo.'); if (cow.sex === 'Cái' && cow.purpose === 'Sinh sản' && purpose !== 'Sinh sản' && !confirmRepro) { setConfirmRepro(true); return setError('Thay đổi này làm sinh sản chuyển thành Không áp dụng. Xác nhận rồi bấm lưu lại.'); } if (!purposeDate || !purposeReason.trim()) return setError('Cần nhập ngày hiệu lực và lý do thay đổi.'); if (purposeDate > maxDate || (entryDate && purposeDate < entryDate)) return setError(`Ngày hiệu lực phải từ ${entryDate || 'ngày nhập đàn'} đến hôm nay.`); const oldValue = cow.purpose || '—'; const history = ([...(((cow as CowSeed & { purposeHistory?: ChangeHistory[] }).purposeHistory) || []), { value: purpose, oldValue, newValue: purpose, effectiveDate: purposeDate, reason: purposeReason.trim(), changedAt: new Date().toISOString(), by: role }]) as ChangeHistory[]; persist({ purpose, purposeSince: purposeDate, purposeHistory: history, herdGroup: herdGroupOf({ ...cow, purpose } as CowSeed), reproductiveApplicability: cow.sex === 'Cái' && purpose === 'Sinh sản' ? 'APPLICABLE' : 'NOT_APPLICABLE' } as Partial<typeof cow>) }
  const saveStage = (event: FormEvent) => { event.preventDefault(); setError(''); if (!stageDate || !stageReason.trim()) return setError('Cần nhập ngày hiệu lực và lý do thay đổi.'); if (stageDate > maxDate || (entryDate && stageDate < entryDate)) return setError(`Ngày hiệu lực phải từ ${entryDate || 'ngày nhập đàn'} đến hôm nay.`); if (stage === lifeStageOf(cow)) return setError('Giai đoạn mới phải khác giai đoạn hiện tại.'); const stageMakesReproNA = cow.sex === 'Cái' && ['Bê theo mẹ', 'Bê cai sữa'].includes(stage) && !['Bê theo mẹ', 'Bê cai sữa'].includes(lifeStageOf(cow)); if (stageMakesReproNA && !confirmRepro) { setConfirmRepro(true); return setError('Thay đổi giai đoạn này làm sinh sản chuyển thành Không áp dụng. Xác nhận rồi bấm lưu lại.'); } const oldValue = lifeStageOf(cow); const history = ([...(((cow as CowSeed & { lifeStageHistory?: ChangeHistory[] }).lifeStageHistory) || []), { value: stage, oldValue, newValue: stage, effectiveDate: stageDate, reason: stageReason.trim(), changedAt: new Date().toISOString(), by: role }]) as ChangeHistory[]; persist({ lifeStage: stage, lifeStageSince: stageDate, lifeStageHistory: history, herdGroup: herdGroupOf({ ...cow, lifeStage: stage } as CowSeed), reproductiveApplicability: stageMakesReproNA ? 'NOT_APPLICABLE' : cow.sex === 'Cái' ? 'APPLICABLE' : 'NOT_APPLICABLE' } as Partial<typeof cow>) }
  return <Shell screen={screen} role={role} code={cow.code}><div className="max-w-3xl space-y-6"><nav className="flex flex-wrap gap-2 border-b border-rule pb-3" aria-label="Nhóm cập nhật hồ sơ"><Button small variant={tab === 'identity' ? 'primary' : 'default'} onClick={() => { setError(''); setTab('identity') }}>Định danh & mô tả</Button><Button small variant={tab === 'purpose' ? 'primary' : 'default'} onClick={() => { setError(''); setTab('purpose') }}>Mục đích sản xuất</Button><Button small variant={tab === 'stage' ? 'primary' : 'default'} onClick={() => { setError(''); setTab('stage') }}>Giai đoạn</Button></nav>{tab === 'identity' && <form onSubmit={saveIdentity} className="space-y-6"><WorkSection title="Định danh và mô tả"><div className="grid gap-4 sm:grid-cols-2"><Field label="Số tai phụ" id="update-tag" hint="Tối đa 30 ký tự, duy nhất trong số bò đang nuôi."><input id="update-tag" className={inputCls} maxLength={30} value={tag} onChange={(event) => setTag(event.target.value)} /></Field><Field label="Tên gọi" id="update-name"><input id="update-name" className={inputCls} maxLength={50} value={name} onChange={(event) => setName(event.target.value)} /></Field></div><Field label="Màu và dấu hiệu" id="update-colour"><input id="update-colour" className={inputCls} maxLength={255} value={colour} onChange={(event) => setColour(event.target.value)} /></Field><Field label="Ghi chú" id="update-notes"><textarea id="update-notes" className={inputCls} maxLength={1000} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></WorkSection><div className="flex justify-end gap-2"><Button type="button" onClick={() => navigate(profileRoute('SCR-27', cow.code))}>Hủy</Button><Button variant="primary" type="submit">Lưu thay đổi</Button></div></form>}{tab === 'purpose' && <form onSubmit={savePurpose} className="space-y-6"><WorkSection title="Mục đích sản xuất"><div className="grid gap-4 sm:grid-cols-2"><Field label="Mục đích hiện tại" id="purpose-current"><input id="purpose-current" className={inputCls} value={cow.purpose || '—'} readOnly /></Field><Field label="Mục đích mới *" id="purpose-new"><select id="purpose-new" className={inputCls} value={purpose} disabled={role !== 'owner'} onChange={(event) => setPurpose(event.target.value)}>{purposeOptionsForSex(cow.sex || '', cow.purpose).map((item) => <option key={item}>{item}</option>)}</select></Field></div><p className="m-0 text-xs text-subtle">{cow.sex === 'Đực' ? 'Đực giống chỉ áp dụng cho bò đực.' : 'Sinh sản chỉ áp dụng cho bò cái.'}</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Ngày hiệu lực *" id="purpose-date"><input id="purpose-date" type="date" min={entryDate || undefined} max={maxDate} className={inputCls} value={purposeDate} onChange={(event) => setPurposeDate(event.target.value)} /></Field><Field label="Lý do *" id="purpose-reason"><textarea id="purpose-reason" className={inputCls} rows={3} maxLength={1000} value={purposeReason} onChange={(event) => setPurposeReason(event.target.value)} /></Field></div></WorkSection><div className="flex justify-end gap-2"><Button type="button" onClick={() => navigate(profileRoute('SCR-27', cow.code))}>Hủy</Button><Button variant="primary" type="submit" disabled={role !== 'owner'}>Lưu mục đích</Button></div></form>}{tab === 'stage' && <form onSubmit={saveStage} className="space-y-6"><WorkSection title="Giai đoạn"><div className="grid gap-4 sm:grid-cols-2"><Field label="Giai đoạn hiện tại" id="stage-current"><input id="stage-current" className={inputCls} value={`${lifeStageOf(cow)} · từ ${(cow as CowSeed & { lifeStageSince?: string }).lifeStageSince || cow.stageSince || '—'}`} readOnly /></Field><Field label="Giai đoạn mới *" id="stage-new"><select id="stage-new" className={inputCls} value={stage} onChange={(event) => setStage(event.target.value)}>{LIFE_STAGES.map((item) => <option key={item}>{item}</option>)}</select></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Ngày hiệu lực *" id="stage-date"><input id="stage-date" type="date" min={entryDate || undefined} max={maxDate} className={inputCls} value={stageDate} onChange={(event) => setStageDate(event.target.value)} /></Field><Field label="Lý do *" id="stage-reason"><textarea id="stage-reason" className={inputCls} rows={3} maxLength={1000} value={stageReason} onChange={(event) => setStageReason(event.target.value)} /></Field></div></WorkSection><div className="flex justify-end gap-2"><Button type="button" onClick={() => navigate(profileRoute('SCR-27', cow.code))}>Hủy</Button><Button variant="primary" type="submit">Lưu giai đoạn</Button></div></form>}{error && <InlineMessage tone="err">{error}</InlineMessage>}{confirmRepro && <InlineMessage tone="warn">Sinh sản sẽ được đánh dấu Không áp dụng sau thay đổi này. <Button small type="button" onClick={() => setError('')}>Xác nhận</Button></InlineMessage>}</div></Shell>
}

function QrIssue({ screen, role, state }: { screen: ScreenDefinition; role?: ScreenRole; state: ReviewState }) {
  const navigate = useNavigate(); const cows = cowsForPreview(); const code = selectedCode(); const cow = cows.find((row) => row.code === code) || cows[0]; const editable = canChange(role) && cow.status === 'ACTIVE' && state !== 'read-only'; const firstIssue = !(cow.qrHistory || []).length || !cow.qr; const [newCode, setNewCode] = useState(cow.qr ? newQrCode(cow) : `QR-DEMO-${cow.code.slice(-4)}`); const [reason, setReason] = useState('DAMAGED'); const [note, setNote] = useState(''); const [printed, setPrinted] = useState(false); const [error, setError] = useState('')
  if (!editable) return <Shell screen={screen} role={role} code={cow.code}><InlineMessage tone="warn">Chỉ Chủ trại hoặc Quản lý mới có thể cấp hoặc thay thẻ QR của bò đang nuôi.</InlineMessage></Shell>
  const save = () => { const candidate = newCode.trim(); if (!candidate || candidate.length > 40) return setError('Mã QR phải có, tối đa 40 ký tự và duy nhất trong đàn.'); if (!firstIssue && candidate === cow.qr) return setError('Mã QR mới phải khác mã đang sử dụng.'); if (cows.some((row) => row.code !== cow.code && row.qr === candidate)) return setError('Mã QR đã được cấp cho một bò khác.'); const issuedAt = today().slice(0, 7); const history = [{ code: candidate, status: 'ACTIVE', from: issuedAt, to: '—', reason: firstIssue ? 'Cấp lần đầu' : reason, note, by: 'Người quản lý' }, ...(cow.qrHistory || []).map((row) => row.status === 'ACTIVE' ? { ...row, status: 'RETIRED', to: issuedAt } : row)]; writeDemo('cattle-preview', cows.map((row) => row.code === cow.code ? { ...row, qr: candidate, qrHistory: history, qrFrom: issuedAt, qrFromWho: 'Người quản lý', qrNote: note } : row)); writeDemo('qr-record', { code: cow.code, note, reason }); navigate(profileRoute('SCR-29', cow.code)) }
  return <Shell screen={screen} role={role} code={cow.code}><div className="max-w-2xl space-y-5"><Info items={[["Bò", `${cow.code} · ${cow.name || 'Chưa đặt tên'}`], ['Thẻ hiện tại', firstIssue ? 'Chưa cấp' : `${cow.qr} · đang sử dụng`], ['Chế độ', firstIssue ? 'Cấp lần đầu' : 'Thay thẻ']]} /><Field id="qr-reason" label="Lý do thay thẻ *"><select id="qr-reason" className={inputCls} value={reason} disabled={firstIssue} onChange={(event) => setReason(event.target.value)}><option value="LOST">Mất</option><option value="DAMAGED">Hỏng</option><option value="OTHER">Khác</option></select></Field><Field id="qr-new-code" label="Mã thẻ mới"><input id="qr-new-code" className={inputCls} value={newCode} onChange={(event) => setNewCode(event.target.value)} /><span className="text-[11px] text-subtle">Nhập mã thẻ in sẵn hoặc dùng mã mới được gợi ý.</span></Field><Field id="qr-note" label="Ghi chú"><textarea id="qr-note" className={inputCls} rows={3} maxLength={255} value={note} onChange={(event) => setNote(event.target.value)} /></Field>{error && <InlineMessage tone="err">{error}</InlineMessage>}<div className="flex flex-wrap justify-end gap-2"><Button onClick={() => setPrinted(true)}>In thử thẻ</Button><Button onClick={() => navigate(profileRoute('SCR-29', cow.code))}>Hủy</Button><Button variant="primary" onClick={save}>Xác nhận cấp thẻ</Button></div>{printed && <InlineMessage tone="ok">Đã tạo bản xem trước để kiểm tra mã {newCode}.</InlineMessage>}</div></Shell>
}

function ScanQr({ screen, role }: { screen: ScreenDefinition; role?: ScreenRole }) {
  const navigate = useNavigate()
  const cows = cowsForPreview()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<{ stop: () => void } | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<CowSeed | null>(null)
  const [message, setMessage] = useState('')
  const [foreignPrompt, setForeignPrompt] = useState(false)
  const [farmSwitched, setFarmSwitched] = useState(false)
  const [camera, setCamera] = useState<'idle' | 'starting' | 'ready' | 'blocked'>('idle')
  const [cameraError, setCameraError] = useState('')

  const stopCamera = () => {
    scannerRef.current?.stop()
    scannerRef.current = null
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCamera('idle')
  }

  useEffect(() => () => {
    scannerRef.current?.stop()
    if (videoRef.current?.srcObject instanceof MediaStream) videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
  }, [])

  const resolve = (raw = query) => {
    const normalized = raw.trim()
    const value = normalized.toLowerCase()
    setQuery(normalized)
    if (!value) { setFound(null); setMessage('Nhập mã bò, số tai hoặc mã QR để nhận diện.'); return }
    if (value === 'foreign' || value === 'foreign-farm') { setFound(null); setForeignPrompt(true); setFarmSwitched(false); setMessage('Thẻ thuộc trang trại khác hoặc chưa được chia sẻ trong trang trại hiện tại.'); return }
    if (value === 'accessible-farm' || value === 'switch-farm') { const next = cows[0]; setFound(next); writeDemo('selected-farm', { code: 'FARM-ACCESSIBLE', name: 'Trại được cấp quyền' }); writeDemo('selected-cattle', { code: next.code }); setForeignPrompt(false); setFarmSwitched(true); setMessage(`Đã chuyển sang trang trại được cấp quyền. Có thể mở hồ sơ ${next.code}.`); return }
    if (value === 'draft' || value === 'draft-calf') { setFound(null); setForeignPrompt(false); setMessage('Thẻ của bê đang chờ đăng ký, chưa có hồ sơ đàn. Hãy hoàn tất phiếu bê sinh tại trại.'); return }
    if (value === 'replaced') { setFound(null); setForeignPrompt(false); setMessage('Thẻ đã được thay thế. Hãy dùng mã thẻ đang hoạt động để quét lại.'); return }
    const retired = cows.find((cow) => cow.qrHistory?.some((row) => row.code.toLowerCase() === value && row.status === 'RETIRED'))
    if (retired) { setFound(null); setForeignPrompt(false); setMessage(`Thẻ ${normalized} đã được thay thế. Hãy quét mã đang hoạt động ${retired.qr || 'mới'}.`); return }
    const next = cows.find((cow) => [cow.code, cow.tag, cow.qr].some((item) => item?.toLowerCase() === value))
    if (!next) { setFound(null); setForeignPrompt(false); setMessage('Không tìm thấy mã trong trang trại hiện tại. Kiểm tra mã hoặc quét lại.'); return }
    setForeignPrompt(false)
    setFound(next)
    setMessage('Đã nhận diện thẻ QR. Kiểm tra thông tin trước khi mở hồ sơ.')
  }

  const startCamera = async () => {
    setCameraError('')
    setMessage('')
    setCamera('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) throw new Error('Thiết bị hoặc trình duyệt không hỗ trợ camera.')
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (!result) return
          const text = result.getText()
          controls.stop()
          scannerRef.current = null
          setCamera('idle')
          resolve(text)
        },
      )
      scannerRef.current = controls
      setCamera('ready')
    } catch (cause) {
      scannerRef.current?.stop()
      scannerRef.current = null
      setCamera('blocked')
      setCameraError(cause instanceof Error && cause.name === 'NotAllowedError'
        ? 'Quyền camera bị từ chối. Cho phép camera trong cài đặt trình duyệt hoặc nhập mã thủ công.'
        : cause instanceof Error ? cause.message : 'Không thể mở camera. Hãy nhập mã thủ công.')
    }
  }

  const reset = () => {
    stopCamera()
    setQuery('')
    setFound(null)
    setMessage('')
    setCameraError('')
    setForeignPrompt(false)
    setFarmSwitched(false)
  }

  return <Shell screen={screen} role={role}><div className="grid gap-8 lg:grid-cols-[minmax(300px,.9fr)_minmax(0,1.1fr)]"><div className="space-y-4"><div className="relative min-h-64 overflow-hidden border border-edge bg-[#173a2d]"><video ref={videoRef} className={`h-full min-h-64 w-full object-cover ${camera === 'ready' ? 'block' : 'invisible'}`} muted playsInline aria-label="Hình ảnh camera quét QR" /><div aria-hidden="true" className="pointer-events-none absolute inset-[15%] border-2 border-white/90" />{camera !== 'ready' && <div className="absolute inset-0 grid place-items-center px-6 text-center text-white"><div><p className="m-0 text-base font-semibold">{camera === 'starting' ? 'Đang mở camera…' : 'Quét thẻ QR'}</p><p className="mb-0 mt-2 text-xs text-white/80">Ưu tiên camera sau; luôn có thể nhập mã ở bên cạnh.</p></div></div>}</div><div className="flex flex-wrap gap-2">{camera === 'ready' ? <Button onClick={stopCamera}>Tắt camera</Button> : <Button variant="primary" disabled={camera === 'starting'} onClick={startCamera}>{camera === 'starting' ? 'Đang mở…' : 'Bật camera quét QR'}</Button>}<Button onClick={reset}>Làm mới</Button></div>{cameraError && <InlineMessage tone="warn" title="Không mở được camera">{cameraError}</InlineMessage>}</div><div className="space-y-4"><Field label="Nhập mã thủ công" id="scan-code" hint="Mã hiển thị, số tai hoặc mã QR."><input id="scan-code" className={inputCls} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); resolve() } }} placeholder="BC-000125 hoặc QR-7F3K-0125" /></Field><div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => resolve()}>Nhận diện</Button><Button onClick={reset}>Quét lại</Button></div>{message && <InlineMessage tone={found ? 'ok' : 'warn'}>{message}</InlineMessage>}{foreignPrompt && <div className="flex flex-wrap items-center gap-3 border-y border-rule py-3"><span className="min-w-0 flex-1 text-xs text-subtle">Xác nhận chuyển sang trang trại được cấp quyền rồi quét lại mã.</span><Button onClick={() => { setForeignPrompt(false); writeDemo('selected-farm', { code: 'FARM-ACCESSIBLE', name: 'Trại được cấp quyền' }); setFound(cows[0] || null); setFarmSwitched(true); setMessage(`Đã chuyển sang trang trại được cấp quyền. Có thể mở hồ sơ ${cows[0]?.code || 'bò đã được chia sẻ'}.`) }}>Chuyển trang trại</Button></div>}{farmSwitched && found && <InlineMessage tone="ok">Đã chọn trang trại được cấp quyền.</InlineMessage>}{found && <div className="border-y border-rule py-4"><h2 className="m-0 text-base font-bold text-ink">{found.code} · {found.name || 'Chưa đặt tên'}</h2><p className="mb-0 mt-2 text-sm text-subtle">{found.tag || 'Chưa có số tai'} · {found.breed} · {found.sex} · {found.ageLong || found.ageShort} · Chuồng {found.barn || '—'}</p><p className="mb-0 mt-2 text-xs text-subtle">{cattleStatusText(found.status)} · {found.health?.label || 'Không có trạng thái sức khỏe'} · {found.sex === 'Đực' ? 'Không áp dụng sinh sản' : found.repro?.label || '—'}</p><Button className="mt-4" variant="primary" onClick={() => { writeDemo('selected-cattle', { code: found.code }); navigate(profileRoute('SCR-27', found.code)) }}>Mở hồ sơ bò</Button></div>}</div></div></Shell>
}

export function CattlePreviewScreen({ screen, role, state = 'success' }: { screen: ScreenDefinition; role?: ScreenRole; state?: ReviewState }) {
  const navigate = useNavigate()
  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} />
  if (state === 'error') return <Shell screen={screen} role={role}><InlineMessage tone="err">Không thể tải dữ liệu hồ sơ bò. Thử tải lại hoặc quay về danh sách đàn.</InlineMessage></Shell>
  if (state === 'empty') return <Shell screen={screen} role={role}><EmptyState title="Chưa có dữ liệu hồ sơ bò" description="Chưa có cá thể phù hợp trong trạng thái xem này." actionLabel="Về danh sách đàn" onAction={() => navigate('/ui/scr-26')} /></Shell>
  if (screen.id === 'SCR-26') return <CattleList screen={screen} role={state === 'read-only' ? undefined : role} state={state} />
  if (screen.id === 'SCR-27') return <Profile screen={screen} role={role} state={state} />
  if (screen.id === 'SCR-28') return <PenHistory screen={screen} role={role} state={state} />
  if (screen.id === 'SCR-29') return <QrTab screen={screen} role={role} state={state} />
  if (screen.id === 'SCR-30') return <UpdateProfile screen={screen} role={role} state={state} />
  if (screen.id === 'SCR-31') return <QrIssue screen={screen} role={role} state={state} />
  return <ScanQr screen={screen} role={role} />
}
