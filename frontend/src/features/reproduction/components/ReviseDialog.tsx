import { ReproductionValidationError } from '../domain/reproductionRules'
import { useState, type ReactNode } from 'react'
import { Field, inputCls, Modal, ModalButton, ModalFooter, Note, NoticeDialog, Select, Table, Td, Textarea, Th } from '../../../shared/ui'
import { METHOD_TEXT, formatDate, formatDateTime } from '../domain/reproductionRules'
import type { CalfOutcome, CalvingRecord, ReproductionEvent, ReproductionFemale } from '../types'
import { CHECK_METHOD_OPTIONS, COURSE_OPTIONS, DAM_CONDITION_OPTIONS, DateTimeInput, MemberSelect, PersonInput, RESULT_OPTIONS, RadioRow, UPDATE_TYPE_OPTIONS, FieldMessage, parseDecimalText } from './reproductionFields'
import { useReproductionOptions } from './reproductionOptions'

export type RevisedRecord = { kind: 'event'; event: ReproductionEvent } | { kind: 'calving'; calving: CalvingRecord }
export interface ReviseTarget { mode: 'revise'; record: RevisedRecord; action: 'correct' | 'void' }
export interface ReviseHandlers {
  onClose: () => void
  onCorrectEvent: (eventId: string, patch: Partial<ReproductionEvent>, reason: string) => Promise<void>
  onVoidEvent: (eventId: string, reason: string) => Promise<void>
  onCorrectCalving: (calvingId: string, patch: Partial<CalvingRecord>, reason: string) => Promise<void>
  onVoidCalving: (calvingId: string, reason: string) => Promise<void>
  onVoidCalf: (calvingId: string, calfId: string, reason: string) => Promise<void>
}

type Current =
  | { kind: 'event'; event: ReproductionEvent }
  | { kind: 'calving'; calving: CalvingRecord }
  | { kind: 'calf'; calving: CalvingRecord; calf: CalfOutcome }
type RecType = 'update' | 'calving' | 'calf'
type Control = 'datetime' | 'text' | 'textarea' | 'number' | 'select' | 'member' | 'person'
interface Row { key: string; label: string; current: string; init: string; control: Control; options?: Array<[string, string]>; disabled?: boolean }

const labelOf = (options: Array<[string, string]>, value: string | undefined) => options.find(([key]) => key === value)?.[1] ?? (value || '—')
const METHOD_OPTIONS = Object.entries(METHOD_TEXT)
const BASIS_OPTIONS: Array<[string, string]> = [['', 'Chưa chọn'], ['MEASURED', 'Cân thực tế'], ['ESTIMATED', 'Ước tính']]
const PLACENTA_OPTIONS: Array<[string, string]> = [['false', 'Không'], ['true', 'Có']]

function rowsFor(cur: Current, profile: ReproductionFemale, cases: Array<{ id: string; label: string }>): Row[] {
  if (cur.kind === 'calf') {
    const { calf } = cur
    const registered = calf.registrationStatus === 'REGISTERED'
    return [
      { key: 'sex', label: 'Giới tính', current: labelOf([['MALE', 'Đực'], ['FEMALE', 'Cái'], ['UNKNOWN', 'Không rõ']], calf.sex), init: calf.sex, control: 'select', disabled: registered,
        options: calf.outcome === 'STILLBORN' ? [['MALE', 'Đực'], ['FEMALE', 'Cái'], ['UNKNOWN', 'Không rõ']] : [['MALE', 'Đực'], ['FEMALE', 'Cái']] },
      { key: 'weightKg', label: 'Cân sơ sinh', current: calf.weightKg == null ? '—' : `${calf.weightKg} kg`, init: calf.weightKg == null ? '' : String(calf.weightKg), control: 'number', disabled: registered },
      { key: 'weightBasis', label: 'Cơ sở cân', current: labelOf(BASIS_OPTIONS, calf.weightBasis ?? ''), init: calf.weightBasis ?? '', control: 'select', options: BASIS_OPTIONS, disabled: registered },
      { key: 'earTag', label: 'Mã thẻ tai / QR', current: calf.earTag || '—', init: calf.earTag ?? '', control: 'text', disabled: registered },
    ]
  }
  if (cur.kind === 'calving') {
    const c = cur.calving
    return [
      { key: 'birthAt', label: 'Thời điểm đẻ', current: formatDateTime(c.birthAt), init: c.birthAt, control: 'datetime' },
      { key: 'attendant', label: 'Người đỡ đẻ', current: c.attendant || '—', init: c.attendant ?? '', control: 'person' },
      { key: 'course', label: 'Kiểu đẻ', current: labelOf(COURSE_OPTIONS, c.course), init: c.course, control: 'select', options: COURSE_OPTIONS },
      { key: 'damCondition', label: 'Tình trạng bò mẹ sau đẻ', current: labelOf(DAM_CONDITION_OPTIONS, c.damCondition), init: c.damCondition, control: 'select', options: DAM_CONDITION_OPTIONS },
      { key: 'retainedPlacenta', label: 'Sót nhau (quá 12 giờ)', current: c.retainedPlacenta ? 'Có' : 'Không', init: String(c.retainedPlacenta), control: 'select', options: PLACENTA_OPTIONS },
    ]
  }
  const e = cur.event
  if (e.type === 'ESTRUS') {
    return [
      { key: 'occurredAt', label: 'Thời điểm quan sát', current: formatDateTime(e.occurredAt), init: e.occurredAt, control: 'datetime' },
      { key: 'details', label: 'Mô tả', current: e.description ?? e.details ?? '—', init: e.description ?? e.details ?? '', control: 'textarea' },
      { key: 'observer', label: 'Người quan sát', current: e.observer || '—', init: e.observer ?? '', control: 'member' },
    ]
  }
  if (e.type === 'BREEDING') {
    const estrus = profile.events.filter((item) => item.type === 'ESTRUS' && item.status === 'VALID')
    const estrusOptions: Array<[string, string]> = [['', 'Không liên kết'], ...estrus.map((item): [string, string] => [item.id, `${formatDateTime(item.occurredAt)} · Động dục`])]
    return [
      { key: 'occurredAt', label: 'Thời điểm phối', current: formatDateTime(e.occurredAt), init: e.occurredAt, control: 'datetime' },
      { key: 'method', label: 'Phương pháp', current: labelOf(METHOD_OPTIONS, e.method), init: e.method ?? 'NATURAL_SERVICE', control: 'select', options: METHOD_OPTIONS },
      { key: 'sireLabel', label: 'Đực giống', current: e.sireLabel || '—', init: e.sireLabel ?? '', control: 'text' },
      { key: 'semenCode', label: 'Mã tinh', current: e.semenCode || '—', init: e.semenCode ?? '', control: 'text' },
      { key: 'performer', label: 'Người thực hiện', current: e.performer || '—', init: e.performer ?? '', control: 'person' },
      { key: 'linkedEstrusId', label: 'Động dục liên kết', current: labelOf(estrusOptions, e.linkedEstrusId ?? ''), init: e.linkedEstrusId ?? '', control: 'select', options: estrusOptions },
    ]
  }
  if (e.type === 'PREGNANCY_CHECK') {
    const breedings = profile.events.filter((item) => item.type === 'BREEDING' && item.status === 'VALID')
    const breedingOptions: Array<[string, string]> = [['', 'Không liên kết'], ...breedings.map((item): [string, string] => [item.id, `${formatDate(item.occurredAt)} · ${item.method === 'ARTIFICIAL_INSEMINATION' ? 'TTNT' : 'Tự nhiên'}${item.semenCode ? ` · ${item.semenCode}` : ''}`])]
    return [
      { key: 'result', label: 'Kết quả', current: labelOf(RESULT_OPTIONS, e.result), init: e.result ?? 'PREGNANT', control: 'select', options: RESULT_OPTIONS },
      { key: 'occurredAt', label: 'Thời điểm khám', current: formatDateTime(e.occurredAt), init: e.occurredAt, control: 'datetime' },
      { key: 'method', label: 'Phương pháp', current: labelOf(CHECK_METHOD_OPTIONS, e.method), init: e.method ?? 'ULTRASOUND', control: 'select', options: CHECK_METHOD_OPTIONS },
      { key: 'examiner', label: 'Người khám', current: e.examiner || '—', init: e.examiner ?? '', control: 'person' },
      { key: 'linkedBreedingId', label: 'Lần phối liên kết', current: labelOf(breedingOptions, e.linkedBreedingId ?? '').replace(/ · [A-Z]+-\d+$/, ''), init: e.linkedBreedingId ?? '', control: 'select', options: breedingOptions },
    ]
  }
  const caseOptions: Array<[string, string]> = [['', 'Không liên kết'], ...cases.map((item): [string, string] => [item.id, item.label.split(' · ')[0] || item.id])]
  return [
    { key: 'updateType', label: 'Loại cập nhật', current: labelOf(UPDATE_TYPE_OPTIONS, e.updateType), init: e.updateType ?? 'OBSERVATION', control: 'select', options: UPDATE_TYPE_OPTIONS },
    { key: 'occurredAt', label: 'Thời điểm', current: formatDateTime(e.occurredAt), init: e.occurredAt, control: 'datetime' },
    { key: 'description', label: 'Chi tiết', current: e.description ?? e.details ?? '—', init: e.description ?? e.details ?? '', control: 'textarea' },
    { key: 'linkedHealthCaseId', label: 'Liên kết ca bệnh', current: e.linkedHealthCaseId || '—', init: e.linkedHealthCaseId ?? '', control: 'select', options: caseOptions },
  ]
}

function patchFor(cur: Current, get: (key: string) => string): Partial<ReproductionEvent> | Partial<CalvingRecord> {
  if (cur.kind === 'calving') {
    return { birthAt: get('birthAt'), attendant: get('attendant'), course: get('course') as CalvingRecord['course'], damCondition: get('damCondition') as CalvingRecord['damCondition'], retainedPlacenta: get('retainedPlacenta') === 'true' }
  }
  if (cur.kind === 'calf') return {}
  const type = cur.event.type
  if (type === 'ESTRUS') return { occurredAt: get('occurredAt'), details: get('details'), description: get('details'), observer: get('observer') }
  if (type === 'BREEDING') return { occurredAt: get('occurredAt'), method: get('method'), sireLabel: get('sireLabel'), semenCode: get('semenCode') || undefined, performer: get('performer'), linkedEstrusId: get('linkedEstrusId') || null }
  if (type === 'PREGNANCY_CHECK') return { result: get('result') as ReproductionEvent['result'], occurredAt: get('occurredAt'), method: get('method'), examiner: get('examiner'), linkedBreedingId: get('linkedBreedingId') || null }
  return { updateType: get('updateType') as ReproductionEvent['updateType'], occurredAt: get('occurredAt'), description: get('description'), linkedHealthCaseId: get('linkedHealthCaseId') || null }
}

const groupOf = (record: RevisedRecord): 'eb' | 'check' | 'pc' => {
  if (record.kind === 'calving') return 'pc'
  if (record.event.type === 'ESTRUS' || record.event.type === 'BREEDING') return 'eb'
  return record.event.type === 'PREGNANCY_CHECK' ? 'check' : 'pc'
}

export default function ReviseDialog({ target, profile, onClose, onCorrectEvent, onVoidEvent, onCorrectCalving, onVoidCalving, onVoidCalf }: ReviseHandlers & { target: ReviseTarget; profile: ReproductionFemale }) {
  const group = groupOf(target.record)
  const initialType: RecType = target.record.kind === 'calving' || target.record.event.type === 'CALVING' ? 'calving' : 'update'
  const initialId = target.record.kind === 'calving' ? target.record.calving.id : target.record.event.id
  const action = target.action
  const [recType, setRecType] = useState<RecType>(initialType)
  const [recId, setRecId] = useState(initialId)
  const [reason, setReason] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<{ text: string; yes: string } | null>(null)

  const validCalvings = profile.calvings.filter((calving) => calving.status === 'VALID')
  const updates = profile.events.filter((event) => event.type === 'PREGNANCY_UPDATE' && event.status === 'VALID')
  const calfOptions = validCalvings.flatMap((calving) => calving.calves.filter((calf) => calf.status !== 'VOIDED').map((calf): [string, string] => [`${calving.id}|${calf.id}`, `Bê số ${calf.number} · ${formatDate(calving.birthAt)} · ${calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh'}`]))
  const recordOptions: Array<[string, string]> = recType === 'update'
    ? updates.map((event): [string, string] => [event.id, `${labelOf(UPDATE_TYPE_OPTIONS, event.updateType)} · ${formatDateTime(event.occurredAt)} · ${profile.cattleCode}`])
    : recType === 'calving'
      ? validCalvings.map((calving): [string, string] => [calving.id, `Sự kiện đẻ · ${formatDateTime(calving.birthAt)} · ${profile.cattleCode}`])
      : calfOptions

  let current: Current | null = null
  if (group !== 'pc') current = target.record.kind === 'event' ? { kind: 'event', event: target.record.event } : null
  else if (recType === 'update') { const event = updates.find((item) => item.id === recId); if (event) current = { kind: 'event', event } }
  else if (recType === 'calving') { const calving = validCalvings.find((item) => item.id === recId); if (calving) current = { kind: 'calving', calving } }
  else {
    const [calvingId, calfId] = recId.split('|')
    const calving = validCalvings.find((item) => item.id === calvingId)
    const calf = calving?.calves.find((item) => item.id === calfId)
    if (calving && calf) current = { kind: 'calf', calving, calf }
  }

  const uid = current ? (current.kind === 'event' ? current.event.id : current.kind === 'calving' ? current.calving.id : `${current.calving.id}|${current.calf.id}`) : 'none'
  const { healthCases } = useReproductionOptions()
  const rows = current ? rowsFor(current, profile, healthCases) : []
  const get = (key: string) => edits[`${uid}/${key}`] ?? rows.find((row) => row.key === key)?.init ?? ''
  const set = (key: string, value: string) => setEdits((state) => ({ ...state, [`${uid}/${key}`]: value }))

  const switchType = (next: RecType) => {
    setRecType(next)
    const first = next === 'update' ? updates[0]?.id : next === 'calving' ? validCalvings[0]?.id : calfOptions[0]?.[0]
    setRecId(first ?? '')
    setConfirm(null)
  }

  const warning = (): string | null => {
    if (!current || current.kind !== 'event') return null
    const event = current.event
    if (event.type === 'ESTRUS' && action === 'void') {
      const breeding = profile.events.find((item) => item.type === 'BREEDING' && item.status === 'VALID' && item.linkedEstrusId === event.id)
      if (breeding) return `Bản ghi này đang được lần phối giống ${formatDateTime(breeding.occurredAt)} liên kết. Vẫn xóa?`
    }
    if (event.type === 'PREGNANCY_CHECK' && event.result === 'PREGNANT' && profile.openPregnancy && event.pregnancyId === profile.openPregnancy.id && (action === 'void' || get('result') !== 'PREGNANT')) {
      return 'Kết quả khám này đang xác nhận thai kỳ hiện tại; sửa hoặc xóa có thể đổi trạng thái sinh sản. Vẫn tiếp tục?'
    }
    return null
  }

  const submit = async (confirmed = false) => {
    if (!current) return
    const message = confirmed ? null : warning()
    if (message) { setConfirm({ text: message, yes: action === 'void' ? 'Vẫn xóa' : 'Tiếp tục' }); return }
    setError(''); setConfirm(null); setFieldErrors({})
    // D51: cân bê gõ sai không được gửi đi (NaN qua JSON thành null âm thầm) – báo ngay dưới ô.
    const weight = current.kind === 'calf' && action === 'correct' ? parseDecimalText(get('weightKg')) : null
    if (weight !== null && (!Number.isFinite(weight) || weight < 1 || weight > 80)) {
      setFieldErrors({ weightKg: 'Cân sơ sinh phải là số từ 1 đến 80 kg, ví dụ 21 hoặc 21,5.' })
      return
    }
    setBusy(true)
    try {
      const text = reason.trim()
      if (action === 'void') {
        if (current.kind === 'calf') await onVoidCalf(current.calving.id, current.calf.id, text)
        else if (current.kind === 'calving') await onVoidCalving(current.calving.id, text)
        else if (current.event.type === 'CALVING') await onVoidCalving(current.event.id, text)
        else await onVoidEvent(current.event.id, text)
      } else if (current.kind === 'calf') {
        const calves = current.calving.calves.map((calf) => calf.id !== current.calf.id ? calf : {
          ...calf, sex: get('sex') as CalfOutcome['sex'], weightKg: weight,
          weightBasis: (get('weightBasis') || null) as CalfOutcome['weightBasis'], earTag: get('earTag').trim() || null,
        })
        await onCorrectCalving(current.calving.id, { calves }, text)
      } else if (current.kind === 'calving') {
        await onCorrectCalving(current.calving.id, patchFor(current, get) as Partial<CalvingRecord>, text)
      } else {
        await onCorrectEvent(current.event.id, patchFor(current, get) as Partial<ReproductionEvent>, text)
      }
      onClose()
    } catch (cause) {
      // Lỗi có ô hiện dưới ô của dòng đó; lỗi điều kiện (đang được liên kết, bê đã đăng ký…) hiện popup.
      if (cause instanceof ReproductionValidationError) {
        const byRow: Record<string, string> = {}
        const general: string[] = []
        for (const issue of cause.issues) {
          const key = issue.field === 'weight' ? 'weightKg' : issue.field
          if (key && rows.some((row) => row.key === key)) byRow[key] = issue.message
          else general.push(issue.message)
        }
        setFieldErrors(byRow)
        if (general.length) setError(general.join(' '))
      } else setError(cause instanceof Error ? cause.message : 'Không lưu được chỉnh sửa.')
    } finally { setBusy(false) }
  }

  const eventHead = current?.kind === 'event' ? current.event : null
  const typeText = eventHead ? ({ ESTRUS: 'Động dục', BREEDING: 'Phối giống', PREGNANCY_CHECK: 'Khám thai', PREGNANCY_UPDATE: 'Diễn biến thai', CALVING: 'Sự kiện đẻ' }[eventHead.type]) : ''
  const what = group === 'check' ? 'kết quả khám thai' : group === 'pc' ? 'bản ghi mang thai & sinh bê' : `bản ghi ${eventHead?.type === 'BREEDING' ? 'phối giống' : 'động dục'}`
  const title = action === 'void' ? `Xóa ${what}?` : `Sửa ${what}`
  const sub = group === 'pc' ? `${profile.cattleCode} · thai kỳ ${profile.openPregnancy?.pregnancyNumber ?? profile.parity}`
    : eventHead ? (group === 'check' ? `${profile.cattleCode} · khám ${formatDateTime(eventHead.occurredAt)}` : `${profile.cattleCode} · ${formatDateTime(eventHead.occurredAt)}`) : profile.cattleCode
  const width = action === 'void' ? 560 : group === 'pc' ? 720 : 700

  const control = (row: Row): ReactNode => {
    const value = get(row.key)
    const common = { 'aria-label': row.label, disabled: row.disabled }
    if (row.control === 'datetime') return <DateTimeInput label={row.label} value={value} onChange={(next) => set(row.key, next)} />
    if (row.control === 'textarea') return <Textarea {...common} rows={2} maxLength={1000} value={value} onChange={(event) => set(row.key, event.target.value)} />
    if (row.control === 'number') return <input {...common} type="text" inputMode="decimal" className={inputCls} value={value} onChange={(event) => set(row.key, event.target.value)} />
    if (row.control === 'member') return <MemberSelect label={row.label} value={value} onChange={(next) => set(row.key, next)} />
    if (row.control === 'person') return <PersonInput id={`rev-${row.key}`} label={row.label} value={value} onChange={(next) => set(row.key, next)} />
    if (row.control === 'select') return <Select {...common} value={value} onChange={(event) => set(row.key, event.target.value)}>{(row.options ?? []).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
    return <input {...common} maxLength={100} className={inputCls} value={value} onChange={(event) => set(row.key, event.target.value)} />
  }

  const recordLine = eventHead ? `${typeText} · ${profile.cattleCode} · ${formatDateTime(eventHead.occurredAt)} · ${eventHead.recorder}` : ''
  const correcting = action === 'correct'
  return (
    <Modal width={width} title={title} sub={sub} onClose={onClose}>
      {error && <NoticeDialog title="Chưa lưu được" message={error} onClose={() => setError('')} />}
      {confirm && (
        <Note tone="warn">
          <div className="flex flex-wrap items-center gap-2"><span className="flex-1">{confirm.text}</span>
            <ModalButton variant={action === 'void' ? 'danger' : 'primary'} onClick={() => void submit(true)}>{confirm.yes}</ModalButton>
            <ModalButton onClick={() => setConfirm(null)}>Không</ModalButton>
          </div>
        </Note>
      )}
      <div className="flex flex-col gap-3">
        {group === 'pc' && (
          <Field label="Loại bản ghi *">
            <RadioRow name="Loại bản ghi" value={recType} onChange={(value) => switchType(value as RecType)} options={[['update', 'Diễn biến thai'], ['calving', 'Sự kiện đẻ'], ['calf', 'Kết quả bê']]} />
          </Field>
        )}
        {group === 'pc' ? (
          <Field label="Bản ghi *" id="rev-record">
            <Select id="rev-record" aria-label="Bản ghi" value={recId} onChange={(event) => { setRecId(event.target.value); setConfirm(null) }}>
              {recordOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Bản ghi" id="rev-record"><input id="rev-record" aria-label="Bản ghi" readOnly className={inputCls} value={recordLine} /></Field>
        )}
        {!correcting ? (current
          ? <p className="m-0 text-sm text-ink">Bản ghi sẽ không còn trong dòng thời gian; trạng thái sinh sản và chỉ số được tính lại. Lịch sử thay đổi vẫn được lưu.</p>
          : <Note tone="grey">Chưa có bản ghi loại này để xóa.</Note>
        ) : current ? (
          <Table stack={false}>
            <thead><tr><Th className="w-[34%]">Trường thông tin</Th><Th className={correcting ? 'w-[30%]' : ''}>Giá trị hiện tại</Th>{correcting && <Th>Giá trị mới</Th>}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <Td className="font-medium">{row.label}</Td>
                  <Td>{row.current}</Td>
                  {correcting && <Td className="py-2">{control(row)}<FieldMessage>{fieldErrors[row.key]}</FieldMessage></Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <Note tone="grey">Chưa có bản ghi loại này để sửa.</Note>}
        {current?.kind === 'calf' && current.calf.registrationStatus === 'REGISTERED' && <Note tone="warn">Bê này đã đăng ký thành bò: không sửa hoặc xóa ở đây. Sửa hồ sơ bê ở hồ sơ bò.</Note>}
        {/* D69: như Cân nặng / Tiêm phòng – sửa có Ghi chú không bắt buộc; xóa chỉ xác nhận. */}
        {correcting && (
          <Field label="Ghi chú" id="rev-reason" hint="Không bắt buộc · tối đa 500 ký tự">
            <Textarea id="rev-reason" aria-label="Ghi chú" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        )}
        {!correcting && group === 'pc' && <Note tone="info">Không xóa được sự kiện đẻ khi bê đã đăng ký.</Note>}
      </div>
      <ModalFooter>
        <ModalButton disabled={busy} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={correcting ? 'primary' : 'danger'} disabled={busy || !current || !!confirm} onClick={() => void submit()}>{busy ? 'Đang lưu…' : correcting ? 'Lưu chỉnh sửa' : 'Xóa'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
