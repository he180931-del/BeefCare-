import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFixtureSession, type ReviewState } from '../../../app/fixtureSession'
import type { ScreenRole } from '../../../app/screenManifest'
import { Button, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, StickyActions, WorkSection } from '../../../components/workspace'

export type CareAdminRole = Exclude<ScreenRole, 'guest'>
export type CareAdminKind = 'list' | 'form' | 'detail' | 'report'
export interface FieldCondition { field: string; equals?: string; oneOf?: string[] }
export type FieldSpec = string | { label: string; type?: 'text' | 'select' | 'radio' | 'date' | 'time' | 'number' | 'unit' | 'file' | 'readonly'; options?: string[]; unit?: string; placeholder?: string; hint?: string; required?: boolean; min?: number; max?: number; step?: number; readonly?: boolean; editable?: boolean; condition?: FieldCondition }
export interface RepeatableLines { columns: string[]; fields: FieldSpec[]; defaultRows: Array<Record<string, string>>; minRows?: number; addLabel?: string }
export interface CareAdminAction { label: string; roles: CareAdminRole[]; type?: 'navigateTo' | 'effect' | 'save' | 'cancel' | 'status' | 'download'; target?: string; effect?: 'quick-fill' | 'print' | 'toggle-panel' | 'mark-read' | 'confirm' | 'void' }
export interface CareAdminBlueprint { id: `SCR-${string}`; feature: string; title: string; description: string; kind: CareAdminKind; fields: FieldSpec[]; columns: string[]; rows: string[][]; actions: CareAdminAction[]; rowTarget?: string; lines?: RepeatableLines; dataMode: 'fixture' }
export const FARM_VIEW: CareAdminRole[] = ['owner', 'manager', 'technician']
export const FARM_WRITE: CareAdminRole[] = ['owner', 'manager']
export const MANAGER: CareAdminRole[] = ['manager']
export const OWNER: CareAdminRole[] = ['owner']
export const PM: CareAdminRole[] = ['pm']
export const CS: CareAdminRole[] = ['cs']
export const PM_SA: CareAdminRole[] = ['pm', 'sa']
export function defineScreen(input: Omit<CareAdminBlueprint, 'dataMode'>): CareAdminBlueprint { return { ...input, dataMode: 'fixture' } }

// Explicit operational journeys for the current workspace routes.

function normalizeField(field: FieldSpec): Exclude<FieldSpec, string> { return typeof field === 'string' ? { label: field } : field }
function FieldControl({ field, value, onChange, disabled }: { field: FieldSpec; value: string; onChange?: (value: string) => void; disabled?: boolean }) {
  const spec = normalizeField(field)
  const label = spec.label
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const isLong = /nội dung|mô tả|lý do|ghi chú|kết quả|hướng xử lý/i.test(label)
  const common = { id, 'aria-label': label, value, disabled: disabled || spec.readonly || spec.type === 'readonly', required: spec.required, min: spec.min, max: spec.max, step: spec.step, placeholder: spec.placeholder, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange?.(event.target.value), className: inputCls }
  const control = isLong ? <textarea {...common} rows={3} /> : spec.type === 'select' ? <select {...common}><option value="">Chọn {label.toLowerCase()}</option>{(spec.options ?? ['Đang hoạt động', 'Tạm dừng', 'Không áp dụng']).map((option) => <option key={option}>{option}</option>)}</select> : spec.type === 'radio' ? <span className="flex flex-wrap gap-3 py-2">{(spec.options ?? ['Có', 'Không']).map((option) => <label key={option} className="flex items-center gap-1"><input type="radio" name={id} value={option} checked={value === option} onChange={() => onChange?.(option)} disabled={disabled} />{option}</label>)}</span> : <input {...(spec.type === 'file' ? { id, 'aria-label': label, disabled, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.files?.[0]?.name ?? ''), className: inputCls } : common)} type={spec.type === 'date' || spec.type === 'time' || spec.type === 'number' ? spec.type : spec.type === 'file' ? 'file' : 'text'} placeholder={spec.unit ? `Đơn vị: ${spec.unit}` : undefined} />
  return <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-ink"><span>{label}{spec.required && <span className="ml-1 text-err-fg">*</span>}{spec.unit && <span className="ml-1 font-normal text-subtle">({spec.unit})</span>}</span>{control}{spec.hint && <span className="text-[11px] font-normal text-subtle">{spec.hint}</span>}</label>
}

export function DedicatedScreen({ blueprint, role, state }: { blueprint: CareAdminBlueprint; role: CareAdminRole; state: ReviewState }) {
  const [notice, setNotice] = useState('')
  const session = useFixtureSession()
  const navigate = useNavigate()
  const stored = session.records.find((record) => record.id === `demo-${blueprint.id}`)
  const [values, setValues] = useState<Record<string, string>>(stored?.values ?? {})
  const [lineRows, setLineRows] = useState<Array<Record<string, string>>>(stored?.lines ?? blueprint.lines?.defaultRows ?? [])
  const [showPanel, setShowPanel] = useState(false)
  useEffect(() => { setValues(stored?.values ?? {}) }, [blueprint.id, stored?.updatedAt])
  useEffect(() => { setLineRows(stored?.lines ?? blueprint.lines?.defaultRows ?? []) }, [blueprint.id, stored?.updatedAt])
  const allowedActions = state === 'read-only' ? [] : blueprint.actions.filter((action) => action.roles.includes(role))
  const isForm = blueprint.kind === 'form' || blueprint.kind === 'detail'
  const visibleRows = useMemo(() => {
    const terms = Object.values(values).filter(Boolean).map((value) => value.toLowerCase())
    if (blueprint.kind !== 'list' && blueprint.kind !== 'report') return blueprint.rows
    return terms.length ? blueprint.rows.filter((row) => terms.every((term) => row.join(' ').toLowerCase().includes(term))) : blueprint.rows
  }, [blueprint, values])
  if (state === 'loading') return <LoadingState label={`Đang tải ${blueprint.title.toLowerCase()}…`} rows={5} />
  if (state === 'error') return <InlineMessage tone="err" title="Không thể tải dữ liệu.">Kiểm tra kết nối rồi thử lại. Không thay bằng dữ liệu mẫu.</InlineMessage>
  const runDemoAction = (action: CareAdminAction) => {
    const label = action.label
    const actionType = action.type
    if (!actionType) { setNotice(`${label} chưa có thao tác được khai báo.`); return }
    if (actionType === 'navigateTo' && action.target) { navigate(action.target); return }
    if (actionType === 'cancel') { setNotice(`${label} — chưa có thay đổi nào được lưu.`); return }
    if (actionType === 'effect') {
      if (action.effect === 'quick-fill') setValues((current) => ({ ...current, ...Object.fromEntries(blueprint.fields.map((field) => { const spec = normalizeField(field); return [spec.label, current[spec.label] || (spec.options?.[0] ?? 'Đã ghi nhận')] })) }))
      if (action.effect === 'print') window.print()
      if (action.effect === 'toggle-panel') setShowPanel((current) => !current)
      if (action.effect === 'mark-read') setNotice(`${label} đã cập nhật trạng thái.`)
      if (action.effect === 'confirm' || action.effect === 'void') persist(label)
      return
    }
    if (actionType === 'download') {
      const csv = [blueprint.columns, ...visibleRows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `${blueprint.id.toLowerCase()}.csv`; link.click(); URL.revokeObjectURL(link.href)
      setNotice(`${label} đã được xuất trên thiết bị.`); return
    }
    const id = `demo-${blueprint.id}`
    const updatedAt = new Date().toLocaleString('vi-VN')
    const existing = session.records.find((record) => record.id === id)
    const patch = { status: label, values, lines: lineRows, description: 'Đã thực hiện và ghi nhận trong phiên làm việc hiện tại.', updatedAt, history: [...(existing?.history ?? []), { label, at: updatedAt }] }
    if (existing) session.dispatch({ type: 'edit-record', id, patch })
    else session.dispatch({ type: 'add-record', record: { id, label: blueprint.title, ...patch } })
    setNotice(`${label} đã được ghi trên thiết bị.`)
    if (action.target) navigate(action.target)
  }
  const persist = (label: string) => {
    const id = `demo-${blueprint.id}`; const updatedAt = new Date().toLocaleString('vi-VN'); const existing = session.records.find((record) => record.id === id)
    const patch = { status: label, values, lines: lineRows, description: 'Đã thực hiện và ghi nhận trong phiên làm việc hiện tại.', updatedAt, history: [...(existing?.history ?? []), { label, at: updatedAt }] }
    if (existing) session.dispatch({ type: 'edit-record', id, patch }); else session.dispatch({ type: 'add-record', record: { id, label: blueprint.title, ...patch } })
    setNotice(`${label} đã được ghi trên thiết bị.`)
  }
  const isDetail = blueprint.kind === 'detail'
  const canEditField = (field: FieldSpec) => { const spec = normalizeField(field); return !isDetail || spec.editable === true }
  const conditionVisible = (field: FieldSpec) => { const condition = normalizeField(field).condition; return !condition || (condition.equals ? values[condition.field] === condition.equals : condition.oneOf?.includes(values[condition.field] ?? '')) }
  const renderField = (field: FieldSpec, index: number) => {
    const spec = normalizeField(field); if (!conditionVisible(field)) return null
    const value = values[spec.label] ?? (isDetail ? blueprint.rows[index]?.[1] ?? '—' : '')
    return isDetail && !spec.editable ? <div key={spec.label} className="min-w-0 border-b border-rule pb-3"><dt className="text-xs text-subtle">{spec.label}</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{value}{spec.unit ? ` ${spec.unit}` : ''}</dd>{spec.hint && <span className="text-[11px] text-subtle">{spec.hint}</span>}</div> : <FieldControl key={spec.label} field={field} value={value} disabled={state === 'read-only' || !canEditField(field)} onChange={(next) => setValues((current) => ({ ...current, [spec.label]: next }))} />
  }
  const renderLines = blueprint.lines && <div className="mt-6"><h3 className="mb-3 text-sm font-semibold text-ink">Dòng chi tiết</h3><Table bordered={false} scroll><thead><tr>{blueprint.lines.columns.map((column) => <Th key={column}>{column}</Th>)}<Th>Thao tác</Th></tr></thead><tbody>{lineRows.map((line, index) => <tr key={`${blueprint.id}-line-${index}`}>{blueprint.lines!.columns.map((column) => <Td key={column}><input className={inputCls} value={line[column] ?? ''} onChange={(event) => setLineRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [column]: event.target.value } : row))} /></Td>)}<Td><Button small onClick={() => setLineRows((rows) => rows.length > (blueprint.lines?.minRows ?? 0) ? rows.filter((_, rowIndex) => rowIndex !== index) : rows)}>Xóa</Button></Td></tr>)}</tbody></Table><Button small onClick={() => setLineRows((rows) => [...rows, Object.fromEntries(blueprint.lines!.columns.map((column) => [column, '']))])}>{blueprint.lines.addLabel ?? 'Thêm dòng'}</Button></div>
  if (isDetail) return <div className="min-w-0"><PageHeader title={blueprint.title} sub={blueprint.description} badge={<FixtureNotice />} /><WorkSection title="Thông tin nghiệp vụ"><dl className="m-0 grid min-w-0 gap-4 md:grid-cols-2">{blueprint.fields.map((field, index) => { const spec = normalizeField(field); if (!conditionVisible(field)) return null; const value = values[spec.label] ?? blueprint.rows[index]?.[1] ?? '—'; return spec.editable ? <FieldControl key={spec.label} field={field} value={value} disabled={state === 'read-only'} onChange={(next) => setValues((current) => ({ ...current, [spec.label]: next }))} /> : <div key={spec.label} className="border-b border-rule pb-3"><dt className="text-xs text-subtle">{spec.label}</dt><dd className="m-0 mt-1 text-sm font-semibold text-ink">{value}</dd></div> })}</dl>{renderLines}</WorkSection>{showPanel && <WorkSection title="Lịch sử thao tác"><ol className="m-0 space-y-2 border-l border-rule pl-4">{(stored?.history ?? []).map((event, index) => <li key={`${event.at}-${index}`} className="text-xs"><strong>{event.label}</strong><span className="ml-2 text-subtle">{event.at}</span></li>)}</ol></WorkSection>}{allowedActions.length > 0 && <StickyActions message="Thao tác được lưu trong phiên làm việc hiện tại." actions={allowedActions.map((action) => <Button key={action.label} variant={action === allowedActions.at(-1) ? 'primary' : 'default'} onClick={() => runDemoAction(action)}>{action.label}</Button>)} />}</div>
  return <div className="min-w-0">
    <PageHeader title={blueprint.title} sub={blueprint.description} badge={<FixtureNotice />} />
    {blueprint.lines && !isDetail && renderLines}
    {notice && <InlineMessage className="mt-4" tone="ok" title="Đã cập nhật:">{notice}</InlineMessage>}
    {isForm ? <><WorkSection title="Thông tin nghiệp vụ" description="Các trường được tách theo nghiệp vụ của màn hình."><div className="grid min-w-0 gap-x-5 gap-y-4 md:grid-cols-2">{blueprint.fields.map((field) => { const spec = normalizeField(field); return conditionVisible(field) && <FieldControl key={spec.label} field={field} value={values[spec.label] ?? ''} disabled={state === 'read-only'} onChange={(value) => setValues((current) => ({ ...current, [spec.label]: value }))} /> })}</div>{blueprint.rows.length > 0 && <div className="mt-6"><h3 className="mb-3 text-sm font-semibold text-ink">Chi tiết dòng</h3><Table bordered={false} scroll={blueprint.columns.length > 5}><thead><tr>{blueprint.columns.map((column) => <Th key={column}>{column}</Th>)}</tr></thead><tbody>{blueprint.rows.map((row, rowIndex) => <tr key={`${blueprint.id}-${rowIndex}`}>{blueprint.columns.map((column, index) => <Td key={column}>{row[index] ?? '—'}</Td>)}</tr>)}</tbody></Table></div>}{state === 'empty' && <EmptyState compact title="Chưa có dữ liệu nền" description="Điền thông tin để xem lại thao tác trước khi xác nhận." />}</WorkSection>{stored?.history && stored.history.length > 0 && <WorkSection title="Lịch sử thao tác"><ol className="m-0 space-y-2 border-l border-rule pl-4">{stored.history.map((event, index) => <li key={`${event.at}-${index}`} className="text-xs"><strong>{event.label}</strong><span className="ml-2 text-subtle">{event.at}</span></li>)}</ol></WorkSection>}</> : <WorkSection title={blueprint.kind === 'report' ? 'Báo cáo' : 'Danh sách'} description="Lọc và đọc dữ liệu trực tiếp trên một mặt phẳng nội dung."><FilterBar>{blueprint.fields.map((field) => <div className="min-w-40 flex-1" key={normalizeField(field).label}><FieldControl field={field} value={values[normalizeField(field).label] ?? ''} onChange={(value) => setValues((current) => ({ ...current, [normalizeField(field).label]: value }))} /></div>)}</FilterBar>{state === 'empty' || visibleRows.length === 0 ? <EmptyState compact title="Không có bản ghi phù hợp" description="Thay đổi bộ lọc để xem dữ liệu khác." /> : <Table bordered={false} scroll={blueprint.columns.length > 5}><thead><tr>{blueprint.columns.map((column) => <Th key={column}>{column}</Th>)}{blueprint.rowTarget && <Th>Thao tác</Th>}</tr></thead><tbody>{visibleRows.map((row, rowIndex) => <tr key={`${blueprint.id}-${rowIndex}`}>{blueprint.columns.map((column, index) => <Td key={column}>{row[index] ?? '—'}</Td>)}{blueprint.rowTarget && <Td><Button small onClick={() => navigate(blueprint.rowTarget as string)}>Mở</Button></Td>}</tr>)}</tbody></Table>}</WorkSection>}
    {allowedActions.length > 0 && <StickyActions message="Thao tác được lưu trong phiên làm việc hiện tại." actions={allowedActions.map((action) => <Button key={action.label} variant={action === allowedActions.at(-1) ? 'primary' : 'default'} onClick={() => runDemoAction(action)}>{action.label}</Button>)} />}
  </div>
}
