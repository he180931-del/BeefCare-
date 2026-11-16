import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Badge, inputCls, Radio } from '../../../components/ui'
import { useSession } from '../../authorization'
import { ENTRY_LABEL, HEALTH_STATE_LABEL, OUTCOME_LABEL, PROGRESS_LABEL, ROUTE_LABEL, SEVERITY_LABEL, fmtDate, fmtDateTime, fmtTemp } from '../domain/healthFormat'
import { HealthValidationError } from '../domain/healthRules'
import type { CaseOutcome, CaseStatus, HealthCattle, HealthState, HealthTimelineRow, Severity } from '../types'

/** Chỉ Quản lý ghi nhận (GBR-08); Chủ trại và Kỹ thuật viên chỉ xem. Không có phiên được coi là Quản lý. */
export function useCanRecord() {
  const session = useSession()
  return (session?.role ?? 'MANAGER') === 'MANAGER'
}

/** Hộp thoại mở bằng `?m=<tên>`; `case` / `entry` chọn ca hoặc bản ghi cần thao tác. */
export function useHealthDialog() {
  const [params, setParams] = useSearchParams()
  const [m] = useModalParam()
  const open = (name: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(params)
    next.set('m', name)
    for (const [k, v] of Object.entries(extra)) next.set(k, v)
    setParams(next)
  }
  const close = () => {
    const next = new URLSearchParams(params)
    for (const k of ['m', 'case', 'entry']) next.delete(k)
    setParams(next)
  }
  return { m, open, close, caseCode: params.get('case'), entryId: params.get('entry') }
}

export function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef<number>()
  const show = useCallback((text: string) => {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), 7000)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const node = message ? <div role="status" className="fixed bottom-6 right-6 z-[60] max-w-[min(420px,calc(100vw-3rem))] rounded-lg bg-[#1b684d] px-4 py-3 text-sm text-white shadow-lg">{message}</div> : null
  return [node, show] as const
}

/** Gọi API trong hộp thoại: lỗi theo trường hiện dưới ô, lỗi khác hiện một dòng trên chân hộp thoại. */
export function useDialogSave() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const run = async (action: () => Promise<void>) => {
    setSaving(true); setErrors({}); setFormError('')
    try { await action() } catch (e) {
      if (e instanceof HealthValidationError) setErrors(e.errors)
      else setFormError(userFacingError(e, 'Không lưu được. Vui lòng thử lại.'))
    } finally { setSaving(false) }
  }
  return { errors, setErrors, formError, saving, run }
}

export const hint = (error?: string, text?: ReactNode) => (error ? <span role="alert" className="text-err-fg">{error}</span> : text)

/** Ô ngày giờ dd/mm/yyyy hh:mm như Figma, không phụ thuộc ngôn ngữ trình duyệt; giá trị ra là 'yyyy-mm-ddThh:mm' hoặc '' khi chưa hợp lệ. */
export function DateTimeInput({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(() => (value ? fmtDateTime(value) : ''))
  const edit = (next: string) => {
    setText(next)
    const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(next.trim())
    const iso = m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
    onChange(iso && !Number.isNaN(Date.parse(iso)) ? iso : '')
  }
  return (
    <div className="relative">
      <input id={id} value={text} onChange={(e) => edit(e.target.value)} placeholder="dd/mm/yyyy hh:mm" inputMode="numeric" autoComplete="off" className={`${inputCls} pr-9`} />
      <Icon name="calendar-event" size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  )
}

export const ReadonlyBox = ({ id, value }: { id?: string; value: string }) => <input id={id} readOnly value={value} className={inputCls} />

export function RadioGroup<T extends string>({ name, value, options, onChange, ariaLabel }: { name: string; value: T | ''; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {options.map((o) => <Radio key={o.value} name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="text-[13px]">{o.label}</Radio>)}
    </div>
  )
}

export const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-[11px] text-faint">{label}</span>
    <span className="text-[13px] font-medium text-ink">{children}</span>
  </div>
)

export const toIntOrNull = (text: string) => (text.trim() === '' ? null : Number(text))

export function cattleLine(c: HealthCattle): string {
  return [c.code, c.breed, c.sex, c.ageText, c.penCode && `${c.penCode}${c.penName ? ` – ${c.penName}` : ''}`].filter(Boolean).join(' · ')
}

export const caseLine = (caseCode: string, signs: string, cattleCode: string) => `${caseCode} · ${signs} · ${cattleCode}`

const SEVERITY_TONE = { MILD: undefined, MODERATE: 'warn', SEVERE: 'err' } as const
export const SeverityBadge = ({ severity }: { severity: Severity }) => <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>

const STATE_VIEW: Record<HealthState, { tone: 'ok' | 'info' | 'err'; icon: 'heart' | 'eye' | 'pill' }> = {
  HEALTHY: { tone: 'ok', icon: 'heart' }, MONITORING: { tone: 'info', icon: 'eye' }, UNDER_TREATMENT: { tone: 'err', icon: 'pill' },
}
export const HealthStateBadge = ({ state }: { state: HealthState }) => <Badge tone={STATE_VIEW[state].tone} icon={STATE_VIEW[state].icon}>{HEALTH_STATE_LABEL[state]}</Badge>

export function CaseStatusBadge({ status, day, chronicSince, outcome }: { status: CaseStatus; day: number; chronicSince?: string; outcome?: CaseOutcome }) {
  if (status === 'OPEN') return <Badge tone="warn" icon="clock">OPEN · ngày {day}</Badge>
  if (status === 'CHRONIC') return <Badge tone="info" icon="clock">CHRONIC · từ {fmtDate(chronicSince)}</Badge>
  const label = outcome ? OUTCOME_LABEL[outcome] : '—'
  return <Badge tone={outcome === 'RECOVERED' ? 'ok' : outcome === 'DIED' || outcome === 'MISSING' ? 'err' : 'outline'}>CLOSED · {label}</Badge>
}

const PROGRESS_TONE = { IMPROVED: 'ok', UNCHANGED: 'outline', WORSENED: 'err' } as const
export function EntryBadge({ row }: { row: HealthTimelineRow }) {
  if (row.type === 'TREATMENT') return <Badge tone="info" icon="pill">{ENTRY_LABEL.TREATMENT}</Badge>
  if (row.type === 'FOLLOW_UP' && row.progress) return <Badge tone={PROGRESS_TONE[row.progress]} icon="eye">{ENTRY_LABEL.FOLLOW_UP} · {PROGRESS_LABEL[row.progress]}</Badge>
  return <Badge tone={row.type === 'OBSERVATION' ? 'outline' : undefined}>{ENTRY_LABEL[row.type]}</Badge>
}

/** Dòng gọn cho bản điện thoại: bỏ số ngày ngưng, đưa diễn biến lên đầu. */
export function shortDetails(row: HealthTimelineRow): string {
  if (row.type === 'TREATMENT') return [row.medicineName, `${row.dose}${(row.courseDays ?? 1) > 1 ? ` × ${row.courseDays} ngày` : ''}`, ROUTE_LABEL[row.route!].toLowerCase()].join(' · ')
  const temp = row.temperatureC !== null ? ` · ${fmtTemp(row.temperatureC)}°C` : ''
  const text = row.type === 'FOLLOW_UP' && row.progress ? `${PROGRESS_LABEL[row.progress]} · ${(row.description ?? '').replace(/^./, (c) => c.toLowerCase())}` : row.description ?? ''
  return `${text}${temp}`
}
