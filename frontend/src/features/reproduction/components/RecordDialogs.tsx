import { useState, type ReactNode } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Checkbox, Field, Note, Select, Textarea, inputCls } from '../../../components/ui'
import { useSession } from '../../authorization'
import {
  REPRODUCTION_BREEDS, REPRODUCTION_HEALTH_CASES, REPRODUCTION_MEMBERS, REPRODUCTION_SIRES,
} from '../data/reproductionMock'
import {
  METHOD_TEXT, addDaysText, eligibilityScore, expectedCalvingDate, findNearbyEvent, formatDate, formatDateTime,
} from '../domain/reproductionRules'
import type { DataSource, ReproductionCommand, ReproductionFemale } from '../types'
import {
  CHECK_METHOD_OPTIONS, DateTimeField, PersonInput, RESULT_OPTIONS, RadioField, ReadOnlyField, SIGNS,
  SOURCE_HINT, SOURCE_OPTIONS, UPDATE_TYPE_OPTIONS, nowLocal,
} from './reproductionFields'

export type RecordAction = 'RECORD_ESTRUS' | 'RECORD_BREEDING' | 'RECORD_PREGNANCY_CHECK' | 'RECORD_PREGNANCY_UPDATE'
interface Props { profile: ReproductionFemale; onClose: () => void; onRecord: (command: ReproductionCommand) => Promise<void> }
interface Confirm { text: string; yes: string; no: string }

const pill = (profile: ReproductionFemale) => `${profile.cattleCode} · Số tai ${profile.earTag || '—'} · ${profile.breed} · ${profile.penCode}`
const subOf = (profile: ReproductionFemale) => `${profile.cattleCode} · ${profile.breed} · Chuồng ${profile.penCode}`

function useRecordSubmit(onRecord: Props['onRecord'], onClose: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const send = async (command: ReproductionCommand) => {
    setError(''); setConfirm(null); setBusy(true)
    try { await onRecord(command); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được sự kiện sinh sản.') }
    finally { setBusy(false) }
  }
  return { busy, error, confirm, setConfirm, send }
}

function Shell({ title, sub, width, saveLabel, onClose, onSave, state, children }: {
  title: string; sub: string; width: number; saveLabel: string; onClose: () => void; onSave: () => void
  state: ReturnType<typeof useRecordSubmit>; children: ReactNode
}) {
  const { busy, error, confirm, setConfirm } = state
  return (
    <Modal width={width} title={title} sub={sub} onClose={onClose}>
      {error && <Note tone="err">{error}</Note>}
      {confirm && (
        <Note tone="warn">
          <div className="flex flex-wrap items-center gap-2"><span className="flex-1">{confirm.text}</span>
            <ModalButton variant="primary" onClick={() => onSave()}>{confirm.yes}</ModalButton>
            <ModalButton onClick={() => setConfirm(null)}>{confirm.no}</ModalButton>
          </div>
        </Note>
      )}
      {children}
      <ModalFooter className="-mx-6 !px-6 !pb-0 !pt-2">
        <ModalButton disabled={busy} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={busy || !!confirm} onClick={() => onSave()}>{busy ? 'Đang lưu…' : saveLabel}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

const SourceField = ({ value, onChange }: { value: DataSource; onChange: (value: DataSource) => void }) => (
  <Field label="Nguồn dữ liệu" id="repro-source" hint={SOURCE_HINT}>
    <Select id="repro-source" aria-label="Nguồn dữ liệu" value={value} onChange={(event) => onChange(event.target.value as DataSource)}>
      {SOURCE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </Select>
  </Field>
)

export function EstrusDialog({ profile, onClose, onRecord }: Props) {
  const session = useSession()
  const [occurredAt, setOccurredAt] = useState(nowLocal)
  const [observer, setObserver] = useState(() => REPRODUCTION_MEMBERS.find((member) => member.name === session?.fullName)?.name ?? REPRODUCTION_MEMBERS[0]?.name ?? '')
  const [signs, setSigns] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const state = useRecordSubmit(onRecord, onClose)
  const save = () => {
    const near = state.confirm ? null : findNearbyEvent(profile, 'ESTRUS', occurredAt)
    if (near) {
      state.setConfirm({ text: `Đã có bản ghi động dục của ${profile.cattleCode} lúc ${formatDateTime(near.occurredAt)}. Vẫn lưu?`, yes: 'Vẫn lưu', no: 'Không' })
      return
    }
    void state.send({ type: 'ESTRUS', occurredAt, observer, signs: SIGNS.filter((sign) => signs.includes(sign)), description, dataSource: 'DIRECT_OBSERVATION' })
  }
  return (
    <Shell title="Ghi động dục" sub={subOf(profile)} width={560} saveLabel="Lưu động dục" onClose={onClose} onSave={save} state={state}>
      <div className="flex flex-col gap-3">
        <ReadOnlyField label="Bò cái" value={pill(profile)} />
        <DateTimeField label="Thời điểm quan sát *" value={occurredAt} onChange={setOccurredAt} />
        <Field label="Người quan sát" id="repro-observer"><MemberSelectField value={observer} onChange={setObserver} /></Field>
        <Field label="Dấu hiệu">
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-field px-3.5 py-3 text-[13px]">
            {SIGNS.map((sign) => (
              <Checkbox key={sign} aria-label={sign} checked={signs.includes(sign)} onChange={(event) => setSigns((current) => event.target.checked ? [...current, sign] : current.filter((item) => item !== sign))}>{sign}</Checkbox>
            ))}
          </div>
        </Field>
        <Field label="Mô tả (không bắt buộc)" id="repro-description" hint="Những gì quan sát được · tối đa 1.000 ký tự">
          <Textarea id="repro-description" aria-label="Mô tả" rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </div>
    </Shell>
  )
}

const MemberSelectField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <Select id="repro-observer" aria-label="Người quan sát" value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Chọn người</option>
    {REPRODUCTION_MEMBERS.map((member) => <option key={member.name} value={member.name}>{`${member.name} · ${member.role}`}</option>)}
  </Select>
)

export function BreedingDialog({ profile, onClose, onRecord }: Props) {
  const [occurredAt, setOccurredAt] = useState(nowLocal)
  const [linked, setLinked] = useState<string | null>(null)
  const [source, setSource] = useState<DataSource>('DIRECT_OBSERVATION')
  const [method, setMethod] = useState<'NATURAL_SERVICE' | 'ARTIFICIAL_INSEMINATION'>('NATURAL_SERVICE')
  const [sireSource, setSireSource] = useState<'FARM' | 'EXTERNAL'>('FARM')
  const [farmSireId, setFarmSireId] = useState('')
  const [breed, setBreed] = useState('')
  const [semenCode, setSemenCode] = useState('')
  const [supplier, setSupplier] = useState('')
  const [performer, setPerformer] = useState('')
  const [note, setNote] = useState('')
  const state = useRecordSubmit(onRecord, onClose)
  const hours72 = 72 * 3_600_000
  const estrusOptions = profile.events
    .filter((event) => event.type === 'ESTRUS' && event.status === 'VALID' && event.occurredAt <= occurredAt && Date.parse(occurredAt) - Date.parse(event.occurredAt) <= hours72)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const linkedEstrusId = linked ?? estrusOptions[0]?.id ?? ''
  const score = profile.eligibility ? eligibilityScore(profile.eligibility) : null
  const external = sireSource === 'EXTERNAL'
  const insemination = method === 'ARTIFICIAL_INSEMINATION'
  const save = () => {
    const near = state.confirm ? null : findNearbyEvent(profile, 'BREEDING', occurredAt)
    if (near) {
      state.setConfirm({ text: `Đã có bản ghi phối giống của ${profile.cattleCode} lúc ${formatDateTime(near.occurredAt)}. Vẫn lưu?`, yes: 'Vẫn lưu', no: 'Không' })
      return
    }
    void state.send({
      type: 'BREEDING', occurredAt, linkedEstrusId: linkedEstrusId || null, dataSource: source, method, sireSource,
      farmSireId: external ? '' : farmSireId, externalSireBreed: breed, semenCode: insemination ? semenCode : '',
      semenSupplier: insemination ? supplier : '', performer, note,
    })
  }
  return (
    <Shell title={`Ghi phối giống – lần phối ${profile.servicesInCurrentCycle + 1}`} sub={subOf(profile)} width={760} saveLabel="Lưu phối giống" onClose={onClose} onSave={save} state={state}>
      {score && score.met < 3 && <Note tone="warn">Chưa đạt điều kiện phối: {profile.eligibility?.failedConditions.join(' ') || score.failed.join(', ')} Bạn vẫn có thể ghi lần phối đã xảy ra.</Note>}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <ReadOnlyField label="Bò cái" value={pill(profile)} />
        {score ? <Field label="Điều kiện xét phối"><div className="flex min-h-[44px] items-center"><Badge tone={score.met === 3 ? 'ok' : 'warn'}>{score.badge}</Badge></div></Field> : <div />}
        <Field label="Liên kết động dục" id="repro-linked-estrus" hint="Động dục trong 72 giờ gần nhất">
          <Select id="repro-linked-estrus" aria-label="Liên kết động dục" value={linkedEstrusId} onChange={(event) => setLinked(event.target.value)}>
            <option value="">Không liên kết</option>
            {estrusOptions.map((event) => <option key={event.id} value={event.id}>{formatDateTime(event.occurredAt)} · Động dục</option>)}
          </Select>
        </Field>
        <DateTimeField label="Thời điểm phối *" value={occurredAt} onChange={setOccurredAt} hint="Không trước lúc động dục" />
        <RadioField label="Phương pháp *" name="Phương pháp" value={method} onChange={(value) => setMethod(value as typeof method)} options={Object.entries(METHOD_TEXT)} />
        <RadioField label="Nguồn đực giống *" name="Nguồn đực giống" value={sireSource} onChange={(value) => setSireSource(value as typeof sireSource)} options={[['FARM', 'Trong trại'], ['EXTERNAL', 'Ngoài trại']]} />
        <Field label="Đực giống trong trại" id="repro-sire" hint="Chỉ khi nguồn Trong trại">
          <Select id="repro-sire" aria-label="Đực giống trong trại" disabled={external} value={farmSireId} onChange={(event) => setFarmSireId(event.target.value)}>
            <option value="">Chọn mã bò đực</option>
            {REPRODUCTION_SIRES.map((sire) => <option key={sire.id} value={sire.id}>{sire.label}</option>)}
          </Select>
        </Field>
        <Field label={external ? 'Giống tinh / đực giống *' : 'Giống tinh / đực giống'} id="repro-sire-breed">
          <Select id="repro-sire-breed" aria-label="Giống tinh / đực giống" value={breed} onChange={(event) => setBreed(event.target.value)}>
            <option value="">Chọn giống</option>
            {REPRODUCTION_BREEDS.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </Field>
        <Field label="Mã ống tinh / lô tinh" id="repro-semen" hint={insemination ? undefined : 'Chỉ thụ tinh nhân tạo'}>
          <input id="repro-semen" aria-label="Mã ống tinh / lô tinh" disabled={!insemination} maxLength={50} className={inputCls} value={semenCode} onChange={(event) => setSemenCode(event.target.value)} />
        </Field>
        <Field label="Nhà cung cấp tinh" id="repro-supplier">
          <input id="repro-supplier" aria-label="Nhà cung cấp tinh" disabled={!insemination} maxLength={100} className={inputCls} value={supplier} onChange={(event) => setSupplier(event.target.value)} />
        </Field>
        <SourceField value={source} onChange={setSource} />
        <Field label="Người thực hiện" id="repro-performer" hint="Thành viên hoặc nhập tên người ngoài">
          <PersonInput id="repro-performer" label="Người thực hiện" value={performer} onChange={setPerformer} />
        </Field>
        <ReadOnlyField label="Ngày dự kiến đẻ (tạm tính)" value={formatDate(expectedCalvingDate(occurredAt))} hint="Thời điểm phối + 283 ngày" />
        <Field label="Ghi chú" id="repro-note">
          <input id="repro-note" aria-label="Ghi chú" maxLength={500} className={inputCls} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Shell>
  )
}

export function PregnancyCheckDialog({ profile, onClose, onRecord }: Props) {
  const [occurredAt, setOccurredAt] = useState(nowLocal)
  const [source, setSource] = useState<DataSource>('DIRECT_OBSERVATION')
  const [result, setResult] = useState<'PREGNANT' | 'NOT_PREGNANT' | 'INCONCLUSIVE'>('PREGNANT')
  const [method, setMethod] = useState<'ULTRASOUND' | 'RECTAL' | 'OTHER'>('ULTRASOUND')
  const [examiner, setExaminer] = useState('')
  const [months, setMonths] = useState('')
  const [linked, setLinked] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const state = useRecordSubmit(onRecord, onClose)
  const breedings = profile.events
    .filter((event) => event.type === 'BREEDING' && event.status === 'VALID' && (!profile.lastCalvingAt || event.occurredAt > profile.lastCalvingAt))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const linkedBreeding = breedings.find((event) => event.id === (linked ?? breedings[0]?.id))
  const monthCount = months === '' ? null : Number(months)
  const expected = result !== 'PREGNANT' ? null
    : linkedBreeding ? { date: expectedCalvingDate(linkedBreeding.occurredAt), basis: 'Theo lần phối liên kết (CONFIRMED)', hint: 'Theo lần phối liên kết + 283 ngày' }
      : monthCount != null && monthCount >= 1 && monthCount <= 9 ? { date: addDaysText(occurredAt, 283 - monthCount * 30), basis: 'Ước tính theo số tháng (ESTIMATED)', hint: 'Ngày khám + 283 ngày − số tháng × 30' }
        : null
  const save = () => void state.send({
    type: 'PREGNANCY_CHECK', occurredAt, linkedBreedingId: linkedBreeding?.id ?? null, dataSource: source, result, method,
    estimatedMonths: result === 'PREGNANT' ? monthCount : null, examiner, note,
  })
  return (
    <Shell title="Ghi khám thai" sub={`${profile.cattleCode} · ${profile.breed} · Chuồng ${profile.penCode}`} width={640} saveLabel="Lưu kết quả khám" onClose={onClose} onSave={save} state={state}>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><ReadOnlyField label="Bò cái" value={`${profile.cattleCode} · Số tai ${profile.earTag || '—'} · ${profile.breed} · ${profile.penCode}`} /></div>
        <div className="sm:col-span-2">
          <Field label="Lần phối liên kết" id="repro-linked-breeding">
            <Select id="repro-linked-breeding" aria-label="Lần phối liên kết" value={linkedBreeding?.id ?? ''} onChange={(event) => setLinked(event.target.value)}>
              <option value="">Không liên kết</option>
              {breedings.map((event) => <option key={event.id} value={event.id}>{`${formatDateTime(event.occurredAt)} · ${event.method ? METHOD_TEXT[event.method as keyof typeof METHOD_TEXT] : 'Phối giống'}${event.semenCode ? ` · ${event.semenCode}` : ''}`}</option>)}
            </Select>
          </Field>
        </div>
        <DateTimeField label="Thời điểm khám *" value={occurredAt} onChange={setOccurredAt} />
        <SourceField value={source} onChange={setSource} />
        <div className="sm:col-span-2"><RadioField label="Kết quả *" name="Kết quả" value={result} onChange={(value) => setResult(value as typeof result)} options={RESULT_OPTIONS} /></div>
        <Field label="Phương pháp" id="repro-check-method">
          <Select id="repro-check-method" aria-label="Phương pháp" value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
            {CHECK_METHOD_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Người khám" id="repro-examiner" hint="Thành viên hoặc người ngoài">
          <PersonInput id="repro-examiner" label="Người khám" value={examiner} onChange={setExaminer} />
        </Field>
        <Field label="Số tháng chửa (ước tính)" id="repro-months" hint="1 – 9 · dùng khi không có lần phối liên kết">
          <input id="repro-months" aria-label="Số tháng chửa" type="number" min="1" max="9" step="1" disabled={result !== 'PREGNANT'} className={inputCls} value={months} onChange={(event) => setMonths(event.target.value)} />
        </Field>
        <ReadOnlyField label="Cơ sở ngày dự kiến đẻ" value={expected?.basis ?? 'Chưa đủ dữ liệu'} hint="Không có lần phối → ƯỚC TÍNH theo số tháng" />
        {result === 'PREGNANT' && <div className="sm:col-span-2"><ReadOnlyField label="Ngày dự kiến đẻ" value={expected ? formatDate(expected.date) : '—'} hint={expected?.hint ?? 'Chưa tính được ngày dự kiến đẻ: cần lần phối liên kết hoặc số tháng chửa'} /></div>}
        <div className="sm:col-span-2">
          <Field label="Ghi chú" id="repro-check-note"><input id="repro-check-note" aria-label="Ghi chú" maxLength={500} className={inputCls} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        </div>
      </div>
    </Shell>
  )
}

export function PregnancyUpdateDialog({ profile, onClose, onRecord }: Props) {
  const preg = profile.openPregnancy
  const [updateType, setUpdateType] = useState<'OBSERVATION' | 'COMPLICATION' | 'LOSS'>('OBSERVATION')
  const [occurredAt, setOccurredAt] = useState(nowLocal)
  const [source, setSource] = useState<DataSource>('DIRECT_OBSERVATION')
  const [details, setDetails] = useState('')
  const [caseId, setCaseId] = useState('')
  const state = useRecordSubmit(onRecord, onClose)
  const cases = REPRODUCTION_HEALTH_CASES[profile.cattleCode] ?? []
  const expectedText = preg ? formatDate(preg.expectedCalvingAt) : '—'
  const save = () => {
    if (updateType === 'LOSS' && !state.confirm) {
      state.setConfirm({ text: 'Sẩy thai sẽ kết thúc thai kỳ và đưa bò về trạng thái Chờ phối. Xác nhận lưu?', yes: 'Xác nhận', no: 'Quay lại' })
      return
    }
    void state.send({ type: 'PREGNANCY_UPDATE', occurredAt, dataSource: source, updateType, details, linkedHealthCaseId: updateType === 'COMPLICATION' && caseId ? caseId : null })
  }
  return (
    <Shell title="Ghi diễn biến thai" sub={`${profile.cattleCode} · Thai kỳ ${preg?.pregnancyNumber ?? '—'} · dự kiến đẻ ${expectedText}`} width={620} saveLabel="Lưu diễn biến" onClose={onClose} onSave={save} state={state}>
      <div className="flex flex-col gap-3">
        <ReadOnlyField label="Thai kỳ" value={`${profile.cattleCode} · Thai kỳ ${preg?.pregnancyNumber ?? '—'} · Đang mang thai · DK đẻ ${expectedText}`} />
        <RadioField label="Loại cập nhật *" name="Loại cập nhật" value={updateType} onChange={(value) => setUpdateType(value as typeof updateType)} options={UPDATE_TYPE_OPTIONS} />
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <DateTimeField label="Thời điểm *" value={occurredAt} onChange={setOccurredAt} hint="Không trước ngày khám xác nhận" />
          <SourceField value={source} onChange={setSource} />
        </div>
        <Field label="Chi tiết *" id="repro-update-details" hint="Tối đa 1.000 ký tự">
          <Textarea id="repro-update-details" aria-label="Chi tiết" rows={2} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} />
        </Field>
        {updateType === 'COMPLICATION' && (
          <Field label="Liên kết ca bệnh" id="repro-case" hint="Chỉ với Biến chứng">
            <Select id="repro-case" aria-label="Liên kết ca bệnh" value={caseId} onChange={(event) => setCaseId(event.target.value)}>
              <option value="">Không liên kết</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
        )}
      </div>
    </Shell>
  )
}

export default function RecordDialog({ action, ...props }: Props & { action: RecordAction }) {
  if (action === 'RECORD_ESTRUS') return <EstrusDialog {...props} />
  if (action === 'RECORD_BREEDING') return <BreedingDialog {...props} />
  if (action === 'RECORD_PREGNANCY_CHECK') return <PregnancyCheckDialog {...props} />
  return <PregnancyUpdateDialog {...props} />
}
