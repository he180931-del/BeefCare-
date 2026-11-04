import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Badge, Button, Field, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import {
  loadCatalogueItems,
  loadParameterHistory,
  loadParameters,
  getCatalogueUsage,
  nextParameterVersion,
  PARAMETER_DEFINITIONS,
  MEDICINE_ROUTES,
  PURPOSE_TYPES,
  saveCatalogueItems,
  saveParameterVersion,
  selectCurrentParameterVersion,
  todayInHoChiMinh,
  validateCatalogueDraft,
  validateParameterDraft,
  VACCINE_ROUTES,
  type BreedItem,
  type CatalogueItem,
  type CatalogueKind,
  type CatalogueStatus,
  type MedicineItem,
  type ParameterValues,
  type ParameterVersion,
  type ProductionPurposeItem,
  type VaccineItem,
} from '../catalogueStore'

type CatalogueScreenId = 'SCR-81' | 'SCR-82' | 'SCR-83' | 'SCR-84'
type Draft = Record<string, string>

const tabs: Array<{ id: CatalogueScreenId | 'SCR-85'; label: string; kind: CatalogueKind | 'parameters' }> = [
  { id: 'SCR-81', label: 'Giống bò', kind: 'breeds' },
  { id: 'SCR-82', label: 'Vaccine', kind: 'vaccines' },
  { id: 'SCR-83', label: 'Thuốc tham chiếu', kind: 'medicines' },
  { id: 'SCR-84', label: 'Mục đích nuôi', kind: 'productionPurposes' },
  { id: 'SCR-85', label: 'Tham số', kind: 'parameters' },
]

const kindForScreen: Record<CatalogueScreenId, CatalogueKind> = {
  'SCR-81': 'breeds', 'SCR-82': 'vaccines', 'SCR-83': 'medicines', 'SCR-84': 'productionPurposes',
}

function canView(screenId: string, role: ScreenRole) {
  if (screenId === 'SCR-81' || screenId === 'SCR-82' || screenId === 'SCR-83') return ['owner', 'manager', 'technician'].includes(role)
  return role === 'owner' || role === 'manager'
}

function canWrite(screenId: string, role: ScreenRole) {
  return (screenId === 'SCR-81' || screenId === 'SCR-82' || screenId === 'SCR-83' || screenId === 'SCR-84' || screenId === 'SCR-85') && (role === 'owner' || role === 'manager')
}

function statusTone(status: CatalogueStatus) {
  return status === 'ACTIVE' ? 'ok' as const : 'outline' as const
}
const statusLabel: Record<CatalogueStatus, string> = { ACTIVE: 'Đang dùng', INACTIVE: 'Ngừng dùng' }

function inputValue(draft: Draft, key: string) { return draft[key] ?? '' }

function draftFor(kind: CatalogueKind, item?: CatalogueItem): Draft {
  if (kind === 'breeds') {
    const value = item as BreedItem | undefined
    return { code: value?.code ?? '', name: value?.name ?? '', group: value?.group ?? '', description: value?.description ?? '', status: value?.status ?? 'ACTIVE' }
  }
  if (kind === 'vaccines') {
    const value = item as VaccineItem | undefined
    return { code: value?.code ?? '', name: value?.name ?? '', disease: value?.disease ?? '', manufacturer: value?.manufacturer ?? '', referenceDose: value?.referenceDose ?? '', route: value?.route ?? '', boosterIntervalDays: String(value?.boosterIntervalDays ?? 0), withdrawalDays: String(value?.withdrawalDays ?? 0), status: value?.status ?? 'ACTIVE' }
  }
  if (kind === 'medicines') {
    const value = item as MedicineItem | undefined
    return { code: value?.code ?? '', name: value?.name ?? '', referenceDose: value?.referenceDose ?? '', route: value?.route ?? '', withdrawalDays: String(value?.withdrawalDays ?? 0), notes: value?.notes ?? '', status: value?.status ?? 'ACTIVE' }
  }
  const value = item as ProductionPurposeItem | undefined
  return { code: value?.code ?? '', name: value?.name ?? '', purposeType: value?.purposeType ?? '', description: value?.description ?? '', status: value?.status ?? 'ACTIVE' }
}

function itemFromDraft(kind: CatalogueKind, draft: Draft, existing?: CatalogueItem): CatalogueItem {
  const id = existing?.id ?? `${kind}-${Date.now()}`
  if (kind === 'breeds') return { id, code: inputValue(draft, 'code').trim(), name: inputValue(draft, 'name').trim(), group: inputValue(draft, 'group').trim(), description: inputValue(draft, 'description').trim(), cattleInHerd: (existing as BreedItem | undefined)?.cattleInHerd ?? 0, status: inputValue(draft, 'status') as CatalogueStatus }
  if (kind === 'vaccines') return { id, code: inputValue(draft, 'code').trim(), name: inputValue(draft, 'name').trim(), disease: inputValue(draft, 'disease').trim(), manufacturer: inputValue(draft, 'manufacturer').trim(), referenceDose: inputValue(draft, 'referenceDose').trim(), route: inputValue(draft, 'route'), boosterIntervalDays: Number(inputValue(draft, 'boosterIntervalDays') || 0), withdrawalDays: Number(inputValue(draft, 'withdrawalDays') || 0), inUse: (existing as VaccineItem | undefined)?.inUse ?? 0, status: inputValue(draft, 'status') as CatalogueStatus }
  if (kind === 'medicines') return { id, code: inputValue(draft, 'code').trim(), name: inputValue(draft, 'name').trim(), referenceDose: inputValue(draft, 'referenceDose').trim(), route: inputValue(draft, 'route'), withdrawalDays: Number(inputValue(draft, 'withdrawalDays') || 0), notes: inputValue(draft, 'notes').trim(), inUse: (existing as MedicineItem | undefined)?.inUse ?? 0, status: inputValue(draft, 'status') as CatalogueStatus }
  return { id, code: inputValue(draft, 'code').trim(), name: inputValue(draft, 'name').trim(), purposeType: inputValue(draft, 'purposeType'), description: inputValue(draft, 'description').trim(), cattleInHerd: (existing as ProductionPurposeItem | undefined)?.cattleInHerd ?? 0, receivingPens: (existing as ProductionPurposeItem | undefined)?.receivingPens ?? '—', status: inputValue(draft, 'status') as CatalogueStatus }
}

function TextField({ label, value, onChange, maxLength, disabled, type = 'text', min, max, step, required = false }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; disabled?: boolean; type?: string; min?: number; max?: number; step?: number; required?: boolean }) {
  return <Field label={`${label}${required ? ' *' : ''}`} hint={maxLength ? `Tối đa ${maxLength} ký tự.` : undefined}><input className={inputCls} type={type} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} disabled={disabled} min={min} max={max} step={step} required={required} /></Field>
}

function SelectField({ label, value, options, onChange, disabled, required = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean; required?: boolean }) {
  return <Field label={`${label}${required ? ' *' : ''}`}><select className={inputCls} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required}><option value="">Chọn {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{label === 'Trạng thái' ? statusLabel[option as CatalogueStatus] : option}</option>)}</select></Field>
}

function CatalogueTabs({ active }: { active: CatalogueScreenId | 'SCR-85' }) {
  const navigate = useNavigate()
  return <nav aria-label="Danh mục và tham số" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-b border-rule">{tabs.map((tab) => <button key={tab.id} type="button" className={`border-b-2 px-1 pb-2 text-sm font-semibold ${tab.id === active ? 'border-brand text-brand' : 'border-transparent text-subtle'}`} onClick={() => navigate(`/ui/${tab.id.toLowerCase()}`)}>{tab.label}</button>)}</nav>
}

function CatalogueEditor({ kind, item, items, readOnly, creating, onSave, onCancel, onDelete }: { kind: CatalogueKind; item?: CatalogueItem; items: CatalogueItem[]; readOnly: boolean; creating: boolean; onSave: (item: CatalogueItem) => boolean; onCancel: () => void; onDelete: () => boolean }) {
  const [draft, setDraft] = useState<Draft>(() => draftFor(kind, item))
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<'deactivate' | 'delete' | null>(null)
  useEffect(() => { setDraft(draftFor(kind, item)); setError(''); setPendingAction(null) }, [kind, item?.id, creating])
  const set = (key: string, value: string) => { setError(''); setPendingAction(null); setDraft((current) => ({ ...current, [key]: value })) }
  const usage = item ? getCatalogueUsage(kind, item) : { count: 0, cattleInHerd: 0, inUse: 0, receivingPens: '' }
  const referenced = usage.count
  const needsDeactivateConfirmation = Boolean(item && referenced > 0 && item.status === 'ACTIVE' && inputValue(draft, 'status') === 'INACTIVE' && (kind === 'breeds' || kind === 'vaccines' || kind === 'medicines' || kind === 'productionPurposes'))
  const commitSave = (next: CatalogueItem) => { if (onSave(next)) { setPendingAction(null); setError('') } else setError('Không thể lưu thay đổi. Kiểm tra quyền truy cập rồi thử lại.') }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = itemFromDraft(kind, draft, item)
    const validation = validateCatalogueDraft(kind, draft, items, item?.id)
    if (validation) { setError(validation); return }
    if (needsDeactivateConfirmation && pendingAction !== 'deactivate') { setPendingAction('deactivate'); return }
    commitSave(next)
  }
  const codeLocked = !creating && referenced > 0
  const title = creating ? 'Thêm mục mới' : item ? `Sửa ${item.name}` : 'Chọn một mục để xem'
  if (!item && !creating) return <WorkSection title="Trình chỉnh sửa" description="Chọn một dòng để xem hoặc chỉnh sửa chi tiết.">{null}</WorkSection>
  return <WorkSection title={title} description={codeLocked ? 'Mục đã được tham chiếu; mã được khóa, chỉ được đổi trạng thái.' : 'Nhập thông tin để thêm hoặc cập nhật mục trong danh mục của trang trại.'}><form onSubmit={submit} className="grid gap-4">
    {error && <InlineMessage tone="err" title="⚠ Chưa thể lưu">{error}</InlineMessage>}
    <div className="grid gap-4 md:grid-cols-2">
      <TextField label="Mã" value={inputValue(draft, 'code')} onChange={(value) => set('code', value.toUpperCase())} maxLength={20} disabled={readOnly || codeLocked} required />
      <TextField label={kind === 'breeds' ? 'Tên giống' : kind === 'vaccines' ? 'Tên vaccine' : kind === 'medicines' ? 'Tên thuốc' : 'Tên mục đích'} value={inputValue(draft, 'name')} onChange={(value) => set('name', value)} maxLength={kind === 'medicines' || kind === 'vaccines' ? 150 : 100} disabled={readOnly} required />
      {kind === 'breeds' && <><TextField label="Nhóm giống" value={inputValue(draft, 'group')} onChange={(value) => set('group', value)} maxLength={50} disabled={readOnly} /><TextField label="Mô tả" value={inputValue(draft, 'description')} onChange={(value) => set('description', value)} maxLength={500} disabled={readOnly} /></>}
      {kind === 'vaccines' && <><TextField label="Bệnh phòng" value={inputValue(draft, 'disease')} onChange={(value) => set('disease', value)} maxLength={150} disabled={readOnly} required /><TextField label="Nhà sản xuất" value={inputValue(draft, 'manufacturer')} onChange={(value) => set('manufacturer', value)} maxLength={100} disabled={readOnly} /><TextField label="Liều tham chiếu" value={inputValue(draft, 'referenceDose')} onChange={(value) => set('referenceDose', value)} maxLength={50} disabled={readOnly} /><SelectField label="Đường dùng" value={inputValue(draft, 'route')} options={[...VACCINE_ROUTES]} onChange={(value) => set('route', value)} disabled={readOnly} /><TextField label="Khoảng nhắc mũi tăng cường (ngày)" value={inputValue(draft, 'boosterIntervalDays')} onChange={(value) => set('boosterIntervalDays', value)} type="number" min={0} max={730} step={1} disabled={readOnly} /><TextField label="Thời gian ngưng (ngày)" value={inputValue(draft, 'withdrawalDays')} onChange={(value) => set('withdrawalDays', value)} type="number" min={0} max={365} step={1} disabled={readOnly} /></>}
      {kind === 'medicines' && <><TextField label="Liều tham chiếu" value={inputValue(draft, 'referenceDose')} onChange={(value) => set('referenceDose', value)} maxLength={100} disabled={readOnly} /><SelectField label="Đường dùng" value={inputValue(draft, 'route')} options={[...MEDICINE_ROUTES]} onChange={(value) => set('route', value)} disabled={readOnly} /><TextField label="Ngưng sử dụng thịt (ngày)" value={inputValue(draft, 'withdrawalDays')} onChange={(value) => set('withdrawalDays', value)} type="number" min={0} max={365} step={1} disabled={readOnly} required /><TextField label="Ghi chú" value={inputValue(draft, 'notes')} onChange={(value) => set('notes', value)} maxLength={500} disabled={readOnly} /></>}
      {kind === 'productionPurposes' && <><SelectField label="Loại mục đích" value={inputValue(draft, 'purposeType')} options={[...PURPOSE_TYPES]} onChange={(value) => set('purposeType', value)} disabled={readOnly || referenced > 0} required /><TextField label="Mô tả" value={inputValue(draft, 'description')} onChange={(value) => set('description', value)} maxLength={500} disabled={readOnly} /></>}
      <SelectField label="Trạng thái" value={inputValue(draft, 'status')} options={['ACTIVE', 'INACTIVE']} onChange={(value) => set('status', value)} disabled={readOnly} required />
    </div>
    {!readOnly && pendingAction && <InlineMessage tone="warn" title={pendingAction === 'delete' ? '⚠ Xác nhận xóa vaccine' : '⚠ Xác nhận ngừng sử dụng'}>{pendingAction === 'delete' ? 'Vaccine chưa được sử dụng, có thể xóa khỏi danh mục.' : `Mục này đang được tham chiếu bởi ${referenced} bản ghi; ngừng sử dụng vẫn giữ nguyên dữ liệu lịch sử.`} <span className="ml-2 inline-flex gap-2"><Button type="button" onClick={() => { setPendingAction(null); setError('') }}>Hủy</Button><Button type="button" variant="danger" onClick={() => { if (pendingAction === 'delete') { if (onDelete()) { setPendingAction(null); setError('') } } else commitSave(itemFromDraft(kind, draft, item)) }}>Xác nhận</Button></span></InlineMessage>}
    {!readOnly && <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-4"><Button type="button" onClick={onCancel}>Hủy</Button>{kind === 'vaccines' && item && referenced === 0 && <Button type="button" variant="danger" onClick={() => setPendingAction('delete')}>Xóa vaccine chưa dùng</Button>}<Button type="submit" variant="primary">Lưu</Button></div>}
  </form></WorkSection>
}

function CatalogueTable({ kind, items, query, status, onQuery, onStatus, selectedId, onSelect, onAdd, readOnly }: { kind: CatalogueKind; items: CatalogueItem[]; query: string; status: string; onQuery: (value: string) => void; onStatus: (value: string) => void; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void; readOnly: boolean }) {
  const visible = items.filter((item) => (!query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) && (status === 'ALL' || item.status === status))
  const action = readOnly ? 'Xem' : 'Sửa'
  return <WorkSection title="Danh sách" description="Mã và các trường tham chiếu được lưu theo từng danh mục; mục đã dùng chỉ có thể ngừng sử dụng."><FilterBar actions={!readOnly && <Button variant="primary" onClick={onAdd}>Thêm mục</Button>}><input className={`${inputCls} min-w-56 flex-1`} value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Tìm theo mã hoặc tên" aria-label="Tìm trong danh mục" /><select className={`${inputCls} w-40`} value={status} onChange={(event) => onStatus(event.target.value)} aria-label="Lọc trạng thái"><option value="ALL">Tất cả</option><option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Ngừng dùng</option></select></FilterBar>{visible.length === 0 ? <EmptyState compact title="Không có mục phù hợp" description="Thử đổi từ khóa hoặc trạng thái lọc." actionLabel={!readOnly ? 'Thêm mục' : undefined} onAction={!readOnly ? onAdd : undefined} /> : <Table wide><thead><tr>{kind === 'breeds' && <><Th>Mã</Th><Th>Giống (mô tả)</Th><Th>Nhóm</Th><Th>Bò trong đàn</Th></>}{kind === 'vaccines' && <><Th>Mã</Th><Th>Vaccine</Th><Th>Bệnh phòng</Th><Th>Liều · đường dùng</Th><Th>Đang dùng</Th></>}{kind === 'medicines' && <><Th>Mã</Th><Th>Thuốc</Th><Th>Liều tham chiếu</Th><Th>Đường dùng</Th><Th>Ngưng thịt</Th></>}{kind === 'productionPurposes' && <><Th>Mã</Th><Th>Mục đích</Th><Th>Loại</Th><Th>Bò trong đàn</Th><Th>Chuồng nhận</Th></>}<Th>Trạng thái</Th><Th /></tr></thead><tbody>{visible.map((item) => { const usage = getCatalogueUsage(kind, item); return <tr key={item.id} className={selectedId === item.id ? 'bg-page' : undefined}>{kind === 'breeds' && <><Td><strong>{item.code}</strong></Td><Td><strong>{item.name}</strong><span className="block text-[11px] text-subtle">{(item as BreedItem).description || '—'}</span></Td><Td>{(item as BreedItem).group || '—'}</Td><Td>{usage.cattleInHerd}</Td></>}{kind === 'vaccines' && <><Td><strong>{item.code}</strong></Td><Td><span className="font-semibold">{item.name}</span>{!(item as VaccineItem).referenceDose || !(item as VaccineItem).route ? <span className="mt-1 block"><Badge tone="outline">Bổ sung thông tin</Badge></span> : null}</Td><Td>{(item as VaccineItem).disease || '—'}</Td><Td>{(item as VaccineItem).referenceDose || '—'} · {(item as VaccineItem).route || '—'}</Td><Td>{usage.inUse ? usage.inUse : 'Chưa dùng'}</Td></>}{kind === 'medicines' && <><Td><strong>{item.code}</strong></Td><Td>{item.name}</Td><Td>{(item as MedicineItem).referenceDose || '—'}</Td><Td>{(item as MedicineItem).route || '—'}</Td><Td>{(item as MedicineItem).withdrawalDays} ngày</Td></>}{kind === 'productionPurposes' && <><Td><strong>{item.code}</strong></Td><Td>{item.name}</Td><Td>{(item as ProductionPurposeItem).purposeType}</Td><Td>{usage.cattleInHerd}</Td><Td>{usage.receivingPens || '—'}</Td></>}<Td><Badge tone={statusTone(item.status)}>{statusLabel[item.status]}</Badge></Td><Td><Button small onClick={() => onSelect(item.id)}>{action}</Button></Td></tr>})}</tbody></Table>}</WorkSection>
}

function ParameterField({ label, value, onChange, min, max, step = 1, disabled, required = true }: { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number; step?: number; disabled?: boolean; required?: boolean }) {
  return <TextField label={label} value={value} onChange={onChange} type="number" min={min} max={max} step={step} disabled={disabled} required={required} />
}

const parameterValueLabels: Record<string, string> = { bcsScale: 'Thang điểm thể trạng', ...Object.fromEntries(PARAMETER_DEFINITIONS.map((field) => [field.key, field.label])) }
const parameterLabels = PARAMETER_DEFINITIONS
const sourceNoteLabel = (value: string) => value.replace(/Owner interview/gi, 'Phỏng vấn Chủ trại')

function parameterDiff(previous: ParameterVersion | undefined, current: ParameterVersion) {
  if (!previous) return 'Phiên bản khởi tạo'
  const changes = Object.keys(current.values).filter((key) => current.values[key as keyof ParameterValues] !== previous.values[key as keyof ParameterValues]).map((key) => `${parameterValueLabels[key] ?? key}: ${previous.values[key as keyof ParameterValues] ?? '—'} → ${current.values[key as keyof ParameterValues] ?? '—'}`)
  return changes.length ? changes.join(' · ') : 'Không thay đổi giá trị'
}

function ParameterScreen({ state, role }: { state: ReviewState; role: ScreenRole }) {
  const readOnly = state === 'read-only' || !canWrite('SCR-85', role)
  const [current, setCurrent] = useState<ParameterVersion>(() => loadParameters())
  const [history, setHistory] = useState<ParameterVersion[]>(() => loadParameterHistory())
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(Object.entries(current.values).map(([key, value]) => [key, value === null ? '' : String(value)])))
  const [sourceNote, setSourceNote] = useState(() => current.sourceNote)
  const [effectiveFrom, setEffectiveFrom] = useState(() => current.effectiveFrom)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if (state === 'empty' || state === 'loading' || state === 'error') {
    return <div className="catalogue-ui min-w-0"><PageHeader title="Tham số trạng thái và nhắc việc" sub="Chủ trại và Quản lý cùng quản lý các ngưỡng tham chiếu; thay đổi tạo phiên bản bất biến." badge={<span className="text-xs font-semibold text-subtle">Quản lý trang trại</span>} /><CatalogueTabs active="SCR-85" /><div className="mt-5">{state === 'empty' ? <EmptyState title="Chưa có phiên bản tham số" description="Khởi tạo phiên bản đầu tiên để dùng các ngưỡng đề xuất và nhắc việc." /> : state === 'loading' ? <LoadingState label="Đang tải tham số trạng thái và nhắc việc…" rows={8} /> : <InlineMessage tone="err" title="⚠ Không thể tải tham số">Dữ liệu phiên bản chưa sẵn sàng; thử lại để không ghi nhầm ngưỡng.</InlineMessage>}</div></div>
  }
  const set = (key: string, value: string) => { setError(''); setNotice(''); setDraft((values) => ({ ...values, [key]: value })) }
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('')
    const values = Object.fromEntries(PARAMETER_DEFINITIONS.map(({ key, optional }) => [key, optional && !draft[key] ? null : Number(draft[key])])) as unknown as ParameterValues
    values.bcsScale = draft.bcsScale as ParameterValues['bcsScale']
    const today = todayInHoChiMinh()
    const validation = validateParameterDraft(values, sourceNote, effectiveFrom, today)
    if (validation) { setError(validation); return }
    const next: ParameterVersion = { version: nextParameterVersion(history), effectiveFrom, sourceNote: sourceNote.trim(), author: role === 'manager' ? 'Quản lý' : 'Chủ trại', savedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), values }
    const nextHistory = [...history, next]
    if (!saveParameterVersion(next, nextHistory)) { setError('Không thể lưu phiên bản. Kiểm tra quyền truy cập rồi thử lại.'); return }
    const selected = selectCurrentParameterVersion(nextHistory, today)
    setCurrent(selected); setHistory(nextHistory); setDraft(Object.fromEntries(Object.entries(selected.values).map(([key, value]) => [key, value === null ? '' : String(value)]))); setSourceNote(selected.sourceNote); setEffectiveFrom(next.effectiveFrom)
    setNotice(next.effectiveFrom > today ? `Đã lên lịch ${next.version}; phiên bản sẽ có hiệu lực từ ${next.effectiveFrom}.` : `Đã lưu ${next.version}; phiên bản cũ vẫn giữ nguyên trong lịch sử.`)
  }
  return <div className="catalogue-ui min-w-0"><PageHeader title="Tham số trạng thái và nhắc việc" sub="Chủ trại và Quản lý cùng quản lý các ngưỡng tham chiếu; thay đổi tạo phiên bản bất biến." badge={<span className="text-xs font-semibold text-subtle">Quản lý trang trại</span>} /><CatalogueTabs active="SCR-85" />{notice && <InlineMessage tone="ok" className="mt-4">{notice}</InlineMessage>}<WorkSection title="Phiên bản hiện tại" actions={<Button onClick={() => setShowHistory((value) => !value)}>{showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử phiên bản'}</Button>}><dl className="m-0 grid gap-4 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-subtle">Phiên bản</dt><dd className="m-0 mt-1 font-semibold">{current.version}</dd></div><div><dt className="text-xs text-subtle">Hiệu lực từ</dt><dd className="m-0 mt-1 font-semibold">{current.effectiveFrom}</dd></div><div><dt className="text-xs text-subtle">Ghi chú nguồn</dt><dd className="m-0 mt-1 font-semibold">{sourceNoteLabel(current.sourceNote)}</dd></div><div><dt className="text-xs text-subtle">Tác giả</dt><dd className="m-0 mt-1 font-semibold">{current.author}</dd></div></dl>{showHistory && <div className="mt-5"><Table wide><thead><tr><Th>Phiên bản</Th><Th>Hiệu lực</Th><Th>Thay đổi giá trị</Th><Th>Ghi chú nguồn</Th><Th>Ngày lưu</Th><Th>Người lưu</Th></tr></thead><tbody>{[...history].reverse().map((version) => <tr key={`${version.version}-${version.savedAt}`}><Td>{version.version}</Td><Td>{version.effectiveFrom}</Td><Td>{parameterDiff(history[history.indexOf(version) - 1], version)}</Td><Td>{sourceNoteLabel(version.sourceNote)}</Td><Td>{version.savedAt}</Td><Td>{version.author}</Td></tr>)}</tbody></Table></div>}</WorkSection><form onSubmit={submit}><WorkSection title="Tuổi và điều kiện sinh sản"><div className="grid gap-4 md:grid-cols-3">{parameterLabels.slice(0, 5).map((field) => <ParameterField key={field.key} label={field.label} value={draft[field.key] ?? ''} onChange={(value) => set(field.key, value)} min={field.min} max={field.max} step={field.step} disabled={readOnly} required={!field.optional} />)}</div></WorkSection><WorkSection title="Thai kỳ và kiểm tra"><div className="grid gap-4 md:grid-cols-3">{parameterLabels.slice(5, 10).map((field) => <ParameterField key={field.key} label={field.label} value={draft[field.key] ?? ''} onChange={(value) => set(field.key, value)} min={field.min} max={field.max} step={field.step} disabled={readOnly} />)}</div></WorkSection><WorkSection title="Thời điểm phối giống"><div className="grid gap-4 md:grid-cols-3">{parameterLabels.slice(10, 13).map((field) => <ParameterField key={field.key} label={field.label} value={draft[field.key] ?? ''} onChange={(value) => set(field.key, value)} min={field.min} max={field.max} step={field.step} disabled={readOnly} />)}</div></WorkSection><WorkSection title="Tăng trưởng và tiêm phòng"><div className="grid gap-4 md:grid-cols-3"><Field label="Thang điểm thể trạng *"><select className={inputCls} value={draft.bcsScale} onChange={(event) => set('bcsScale', event.target.value)} disabled={readOnly}><option>1–5 · bước 0,5</option><option>1–9 · bước 1</option></select></Field>{parameterLabels.slice(13).map((field) => <ParameterField key={field.key} label={field.label} value={draft[field.key] ?? ''} onChange={(value) => set(field.key, value)} min={field.min} max={field.max} step={field.step} disabled={readOnly} required={!field.optional} />)}</div></WorkSection><WorkSection title="Phiên bản mới"><div className="grid gap-4 md:grid-cols-2"><TextField label="Ghi chú nguồn" value={sourceNote} onChange={setSourceNote} maxLength={255} disabled={readOnly} required /><TextField label="Hiệu lực từ" value={effectiveFrom} onChange={setEffectiveFrom} type="date" disabled={readOnly} required /></div>{error && <InlineMessage tone="err" className="mt-4" title="⚠ Chưa thể lưu">{error}</InlineMessage>}{!readOnly && <div className="mt-5 flex justify-end"><Button type="submit" variant="primary">Lưu phiên bản mới</Button></div>}</WorkSection></form><InlineMessage tone="info">Gợi ý hỗ trợ quyết định chỉ đề xuất; không tự tạo sự kiện hoặc đổi trạng thái nghiệp vụ.</InlineMessage></div>
}

function CatalogueListScreen({ screen, role, state }: { screen: ScreenDefinition; role: ScreenRole; state: ReviewState }) {
  const id = screen.id as CatalogueScreenId
  const kind = kindForScreen[id]
  const readOnly = state === 'read-only' || !canWrite(id, role)
  const [items, setItems] = useState<CatalogueItem[]>(() => loadCatalogueItems(kind))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | undefined>(() => items[0]?.id)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = items.find((item) => item.id === selectedId)
  useEffect(() => { if (!selectedId && items[0]) setSelectedId(items[0].id) }, [items, selectedId])
  const save = (next: CatalogueItem): boolean => { const updated = items.some((item) => item.id === next.id) ? items.map((item) => item.id === next.id ? next : item) : [...items, next]; if (!saveCatalogueItems(kind, updated)) return false; setItems(updated); setSelectedId(next.id); setCreating(false); setNotice(`${next.name} đã được lưu vào danh mục.`); return true }
  const remove = (): boolean => { if (!selected) return false; const removedName = selected.name; const updated = items.filter((item) => item.id !== selected.id); if (!saveCatalogueItems(kind, updated)) return false; setItems(updated); setSelectedId(updated[0]?.id); setCreating(false); setNotice(`${removedName} đã được xóa vì chưa từng được sử dụng.`); return true }
  if (state === 'loading' || state === 'error') return <div className="catalogue-ui min-w-0"><PageHeader title={screen.viTitle} sub="Danh mục dùng chung theo trang trại; cập nhật sẽ áp dụng cho các biểu mẫu liên quan." badge={<span className="text-xs font-semibold text-subtle">Quản lý trang trại</span>} /><CatalogueTabs active={id} /><div className="mt-5">{state === 'loading' ? <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} rows={5} /> : <InlineMessage tone="err" title={`⚠ Không thể tải ${screen.viTitle.toLowerCase()}.`}>Thử lại để không thao tác trên dữ liệu chưa đồng bộ.</InlineMessage>}</div></div>
  return <div className="catalogue-ui min-w-0"><PageHeader title={screen.viTitle} sub="Danh mục dùng chung theo trang trại; cập nhật sẽ áp dụng cho các biểu mẫu liên quan." badge={<span className="text-xs font-semibold text-subtle">Quản lý trang trại</span>} /><CatalogueTabs active={id} />{notice && <InlineMessage tone="ok" className="mt-4">{notice}</InlineMessage>}<div className="mt-5">{state === 'empty' ? <EmptyState title="Danh mục chưa có dữ liệu" description="Không có mục tham chiếu để hiển thị trong trạng thái empty." actionLabel={!readOnly ? 'Thêm mục' : undefined} onAction={!readOnly ? () => { setCreating(true); setSelectedId(undefined) } : undefined} /> : <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]"><CatalogueTable kind={kind} items={items} query={query} status={status} onQuery={setQuery} onStatus={setStatus} selectedId={selectedId} onSelect={(selected) => { setSelectedId(selected); setCreating(false) }} onAdd={() => { setCreating(true); setSelectedId(undefined) }} readOnly={readOnly} /><CatalogueEditor kind={kind} item={selected} items={items} readOnly={readOnly} creating={creating} onSave={save} onCancel={() => { setCreating(false); setSelectedId(items[0]?.id) }} onDelete={remove} /></div>}</div></div>
}

export function CatalogueScreen({ screen, role, state }: { screen: ScreenDefinition; role: ScreenRole; state: ReviewState }) {
  if (!canView(screen.id, role)) return <InlineMessage tone="err" title="⚠ Bạn không có quyền truy cập">Màn hình này chỉ dành cho thành viên có vai trò phù hợp trong trang trại.</InlineMessage>
  if (screen.id === 'SCR-85') return <ParameterScreen role={role} state={state} />
  return <CatalogueListScreen screen={screen} role={role} state={state} />
}
