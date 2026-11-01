import { useState, type ReactNode } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Checkbox, Field, Note, Select, Textarea, inputCls } from '../../../components/ui'
import type { ReproductionAction } from '../domain/reproductionRules'
import type {
  CalfOutcome,
  CalvingRecord,
  DataSource,
  ReproductionCommand,
  ReproductionEvent,
  ReproductionFemale,
} from '../types'

type DialogTarget =
  | { mode: 'record'; action: Exclude<ReproductionAction, 'RECORD_CALVING'> }
  | { mode: 'correct-event'; event: ReproductionEvent }
  | { mode: 'void-event'; event: ReproductionEvent }
  | { mode: 'correct-calving'; calving: CalvingRecord }
  | { mode: 'void-calving'; calving: CalvingRecord }

export type ReproductionDialogTarget = DialogTarget

const sourceOptions: Array<[DataSource, string]> = [
  ['DIRECT_OBSERVATION', 'Quan sát trực tiếp'], ['FARM_NOTEBOOK', 'Sổ trại'], ['EXTERNAL_REPORT', 'Báo cáo bên ngoài'],
]
const localDateTime = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const initialFor = (target: DialogTarget): Record<string, string> => {
  if (target.mode === 'record') return {
    occurredAt: localDateTime(), dataSource: 'DIRECT_OBSERVATION',
    method: target.action === 'RECORD_BREEDING' ? 'NATURAL_SERVICE' : 'ULTRASOUND',
    result: 'PREGNANT', sireSource: 'FARM', sireId: '', externalSireBreed: '', updateType: 'OBSERVATION',
    details: '', observer: '', signs: '', linkedEstrusId: '', linkedBreedingId: '', estimatedMonths: '',
    examiner: '', performer: '', semenCode: '', note: '', linkedHealthCaseId: '',
  }
  if (target.mode === 'correct-event') return {
    occurredAt: target.event.occurredAt, dataSource: target.event.dataSource ?? 'DIRECT_OBSERVATION',
    method: target.event.method ?? '', result: target.event.result ?? 'PREGNANT',
    updateType: target.event.updateType ?? 'OBSERVATION', details: target.event.details ?? '',
    observer: target.event.observer ?? '', signs: target.event.details ?? '',
    linkedBreedingId: target.event.linkedBreedingId ?? '', estimatedMonths: target.event.estimatedMonths == null ? '' : String(target.event.estimatedMonths),
    examiner: target.event.examiner ?? '', performer: target.event.performer ?? '', semenCode: '',
    note: '', sireSource: 'FARM', sireId: '', externalSireBreed: '', linkedHealthCaseId: target.event.linkedHealthCaseId ?? '',
  }
  if (target.mode === 'correct-calving') return {
    occurredAt: target.calving.birthAt, dataSource: target.calving.dataSource, method: target.calving.course,
    result: target.calving.damCondition, retainedPlacenta: String(target.calving.retainedPlacenta), updateType: 'OBSERVATION', details: '', observer: '', signs: '',
    linkedEstrusId: '', linkedBreedingId: '', estimatedMonths: '', examiner: '', performer: target.calving.attendant ?? '',
    semenCode: '', note: '', sireSource: 'FARM', sireId: '', externalSireBreed: '', linkedHealthCaseId: '',
  }
  if (target.mode === 'void-event') return {
    occurredAt: target.event.occurredAt, dataSource: target.event.dataSource ?? 'DIRECT_OBSERVATION',
    method: '', result: '', updateType: 'OBSERVATION', details: '', observer: '', signs: '',
    linkedEstrusId: '', linkedBreedingId: '', estimatedMonths: '', examiner: '', performer: '',
    semenCode: '', note: '', sireSource: 'FARM', sireId: '', externalSireBreed: '', linkedHealthCaseId: '',
  }
  return {
    occurredAt: target.calving.birthAt, dataSource: target.calving.dataSource, method: 'NORMAL',
    result: target.calving.damCondition, retainedPlacenta: String(target.calving.retainedPlacenta), updateType: 'OBSERVATION', details: '', observer: '', signs: '',
    linkedEstrusId: '', linkedBreedingId: '', estimatedMonths: '', examiner: '', performer: target.calving.attendant ?? '',
    semenCode: '', note: '', sireSource: 'FARM', sireId: '', externalSireBreed: '', linkedHealthCaseId: '',
  }
}

export default function ReproductionActionDialog({
  target,
  profile,
  onClose,
  onRecord,
  onCorrectEvent,
  onVoidEvent,
  onCorrectCalving,
  onVoidCalving,
}: {
  target: DialogTarget
  profile: ReproductionFemale
  onClose: () => void
  onRecord: (command: ReproductionCommand) => Promise<void>
  onCorrectEvent: (eventId: string, patch: Partial<ReproductionEvent>, reason: string) => Promise<void>
  onVoidEvent: (eventId: string, reason: string) => Promise<void>
  onCorrectCalving: (calvingId: string, patch: Partial<CalvingRecord>, reason: string) => Promise<void>
  onVoidCalving: (calvingId: string, reason: string) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initialFor(target))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [calves, setCalves] = useState<CalfOutcome[]>(target.mode === 'correct-calving' ? structuredClone(target.calving.calves) : [])
  const change = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))
  const isRecording = target.mode === 'record'
  const isCorrection = target.mode === 'correct-event' || target.mode === 'correct-calving'
  const isVoid = target.mode === 'void-event' || target.mode === 'void-calving'
  const action = target.mode === 'record' ? target.action : null
  const title = isRecording ? ({
    RECORD_ESTRUS: 'Ghi động dục', RECORD_BREEDING: 'Ghi phối giống',
    RECORD_PREGNANCY_CHECK: 'Ghi khám thai', RECORD_PREGNANCY_UPDATE: 'Ghi diễn biến thai',
  }[action!]) : isCorrection ? 'Sửa bản ghi sinh sản' : 'Hủy bản ghi sinh sản'

  const submit = async () => {
    setBusy(true); setError('')
    try {
      if (target.mode === 'record' && action === 'RECORD_ESTRUS') {
        await onRecord({ type: 'ESTRUS', occurredAt: values.occurredAt, observer: values.observer, signs: values.signs.split('|').filter(Boolean), description: values.details, dataSource: values.dataSource as DataSource })
      } else if (target.mode === 'record' && action === 'RECORD_BREEDING') {
        await onRecord({
          type: 'BREEDING', occurredAt: values.occurredAt, linkedEstrusId: values.linkedEstrusId || null,
          dataSource: values.dataSource as DataSource, method: values.method as 'NATURAL_SERVICE' | 'ARTIFICIAL_INSEMINATION',
          sireSource: values.sireSource as 'FARM' | 'EXTERNAL', farmSireId: values.sireId,
          externalSireBreed: values.externalSireBreed, semenCode: values.semenCode, performer: values.performer, note: values.note,
        })
      } else if (target.mode === 'record' && action === 'RECORD_PREGNANCY_CHECK') {
        await onRecord({
          type: 'PREGNANCY_CHECK', occurredAt: values.occurredAt, linkedBreedingId: values.linkedBreedingId || null,
          dataSource: values.dataSource as DataSource, result: values.result as 'PREGNANT' | 'NOT_PREGNANT' | 'INCONCLUSIVE',
          method: values.method as 'ULTRASOUND' | 'RECTAL' | 'OTHER', estimatedMonths: values.estimatedMonths === '' ? null : Number(values.estimatedMonths),
          examiner: values.examiner, note: values.note,
        })
      } else if (target.mode === 'record' && action === 'RECORD_PREGNANCY_UPDATE') {
        await onRecord({
          type: 'PREGNANCY_UPDATE', occurredAt: values.occurredAt, dataSource: values.dataSource as DataSource,
          updateType: values.updateType as 'OBSERVATION' | 'COMPLICATION' | 'LOSS', details: values.details,
          linkedHealthCaseId: values.linkedHealthCaseId || null,
        })
      } else if (target.mode === 'correct-event') {
        const patch: Partial<ReproductionEvent> = { occurredAt: values.occurredAt, dataSource: values.dataSource as DataSource, details: values.details }
        if (target.event.type === 'PREGNANCY_CHECK') patch.result = values.result as ReproductionEvent['result']
        if (target.event.type === 'PREGNANCY_UPDATE') patch.updateType = values.updateType as ReproductionEvent['updateType']
        if (target.event.type === 'BREEDING') { patch.method = values.method; patch.performer = values.performer; patch.sireLabel = values.sireId || values.externalSireBreed }
        if (target.event.type === 'ESTRUS') patch.observer = values.observer
        await onCorrectEvent(target.event.id, patch, reason)
      } else if (target.mode === 'void-event') {
        await onVoidEvent(target.event.id, reason)
      } else if (target.mode === 'correct-calving') {
        const patch: Partial<CalvingRecord> = {
          birthAt: values.occurredAt, dataSource: values.dataSource as DataSource,
          course: values.method as CalvingRecord['course'], damCondition: values.result as CalvingRecord['damCondition'],
          retainedPlacenta: values.retainedPlacenta === 'true', attendant: values.performer,
        }
        if (!target.calving.calves.some((calf) => calf.registrationStatus === 'REGISTERED')) patch.calves = calves
        await onCorrectCalving(target.calving.id, patch, reason)
      } else if (target.mode === 'void-calving') {
        await onVoidCalving(target.calving.id, reason)
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được sự kiện sinh sản.')
    } finally { setBusy(false) }
  }

  const validEstrus = profile.events.filter((event) => event.type === 'ESTRUS' && event.status === 'VALID')
  const validBreedings = profile.events.filter((event) => event.type === 'BREEDING' && event.status === 'VALID')
  const estrusOptions: Array<[string, string]> = [['', 'Không liên kết'], ...validEstrus.map((event): [string, string] => [event.id, `${new Date(event.occurredAt).toLocaleString('vi-VN')} · ${event.summary}`])]
  const breedingOptions: Array<[string, string]> = [['', 'Không liên kết'], ...validBreedings.map((event): [string, string] => [event.id, `${new Date(event.occurredAt).toLocaleString('vi-VN')} · ${event.summary}`])]
  const renderDataSource = () => <Field label="Nguồn dữ liệu" id="repro-source"><Select id="repro-source" value={values.dataSource} onChange={(event) => change('dataSource', event.target.value)}>{sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
  const renderTime = (label: string) => <Field label={label} id="repro-occurred-at"><input id="repro-occurred-at" aria-label={label} type="datetime-local" className={inputCls} value={values.occurredAt} max={localDateTime()} onChange={(event) => change('occurredAt', event.target.value)} /></Field>
  const textField = (key: string, label: string, maxLength = 100) => <Field label={label} id={`repro-${key}`}><input id={`repro-${key}`} className={inputCls} maxLength={maxLength} value={values[key]} onChange={(event) => change(key, event.target.value)} /></Field>
  const textarea = (key: string, label: string, maxLength = 1000) => <Field label={label} id={`repro-${key}`}><Textarea id={`repro-${key}`} maxLength={maxLength} rows={3} value={values[key]} onChange={(event) => change(key, event.target.value)} /></Field>
  const selectField = (key: string, label: string, choices: Array<[string, string]>) => <Field label={label} id={`repro-${key}`}><Select id={`repro-${key}`} value={values[key]} onChange={(event) => change(key, event.target.value)}>{choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select></Field>
  const reasonField = () => <Field label="Lý do *" id="repro-reason"><Textarea id="repro-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
  const sourceAndTime = (timeLabel: string) => <div className="grid gap-3 sm:grid-cols-2">{renderTime(timeLabel)}{renderDataSource()}</div>
  const futureSireFields = values.sireSource === 'FARM'
    ? <Field label="Bò đực trong trại *" id="repro-sire"><Select id="repro-sire" value={values.sireId} onChange={(event) => change('sireId', event.target.value)}><option value="">Chọn bò đực</option><option value="sire-1">Sắm · VN-BV-0101</option></Select></Field>
    : textField('externalSireBreed', 'Giống bò đực / giống tinh *', 100)

  let body: ReactNode
  if (isVoid) {
    const label = target.mode === 'void-event' ? target.event.summary : `Sự kiện đẻ ${new Date(target.calving.birthAt).toLocaleDateString('vi-VN')}`
    body = <><Note tone="warn">Hủy sẽ giữ nguyên bản ghi trong dòng thời gian và loại sự kiện khỏi trạng thái sinh sản. Các liên kết phát sinh có thể chặn thao tác này.</Note><p className="m-0 text-sm">Bản ghi: <b>{label}</b></p>{reasonField()}</>
  } else if (target.mode === 'record' && action === 'RECORD_ESTRUS') {
    body = <>{sourceAndTime('Thời điểm động dục *')}<div className="grid gap-3 sm:grid-cols-2">{textField('observer', 'Người quan sát', 100)}{textarea('details', 'Mô tả dấu hiệu', 1000)}</div><div className="flex flex-wrap gap-3 rounded-md bg-page p-3 text-xs">{['Đứng cho con khác nhảy', 'Nhảy con khác', 'Kêu nhiều / bồn chồn', 'Dịch nhầy trong', 'Âm hộ sưng đỏ'].map((sign) => <Checkbox key={sign} checked={values.signs.split('|').includes(sign)} onChange={(event) => change('signs', event.target.checked ? [...values.signs.split('|').filter(Boolean), sign].join('|') : values.signs.split('|').filter((item) => item !== sign).join('|'))}>{sign}</Checkbox>)}</div></>
  } else if (target.mode === 'record' && action === 'RECORD_BREEDING') {
    body = <>{sourceAndTime('Thời điểm phối *')}<div className="grid gap-3 sm:grid-cols-2">{selectField('linkedEstrusId', 'Động dục liên quan', estrusOptions)}{selectField('method', 'Phương pháp *', [['NATURAL_SERVICE', 'Phối tự nhiên'], ['ARTIFICIAL_INSEMINATION', 'Thụ tinh nhân tạo']])}</div><div className="grid gap-3 sm:grid-cols-2">{selectField('sireSource', 'Nguồn bò đực / tinh *', [['FARM', 'Trong trại'], ['EXTERNAL', 'Ngoài trại']])}{futureSireFields}</div>{values.method === 'ARTIFICIAL_INSEMINATION' && <div className="grid gap-3 sm:grid-cols-2">{textField('semenCode', 'Mã lô tinh', 50)}{textField('performer', 'Người thực hiện', 100)}</div>}{values.method === 'NATURAL_SERVICE' && textField('performer', 'Người thực hiện', 100)}{renderDataSource()}{textarea('note', 'Ghi chú', 500)}</>
  } else if (target.mode === 'record' && action === 'RECORD_PREGNANCY_CHECK') {
    body = <>{sourceAndTime('Thời điểm khám *')}{selectField('linkedBreedingId', 'Lần phối liên quan', breedingOptions)}<div className="grid gap-3 sm:grid-cols-2">{selectField('result', 'Kết quả *', [['PREGNANT', 'Có thai'], ['NOT_PREGNANT', 'Không có thai'], ['INCONCLUSIVE', 'Chưa kết luận']])}{selectField('method', 'Phương pháp', [['ULTRASOUND', 'Siêu âm'], ['RECTAL', 'Khám trực tràng'], ['OTHER', 'Khác']])}</div>{values.result === 'PREGNANT' && <div className="grid gap-3 sm:grid-cols-2">{textField('estimatedMonths', 'Số tháng mang thai (nếu chưa có lần phối)', 2)}{textField('examiner', 'Người khám', 100)}</div>}{values.result !== 'PREGNANT' && textField('examiner', 'Người khám', 100)}{textarea('note', 'Ghi chú', 500)}</>
  } else if (target.mode === 'record' && action === 'RECORD_PREGNANCY_UPDATE') {
    body = <>{sourceAndTime('Thời điểm diễn biến *')}{selectField('updateType', 'Loại diễn biến *', [['OBSERVATION', 'Theo dõi'], ['COMPLICATION', 'Biến chứng'], ['LOSS', 'Mất thai']])}{textarea('details', 'Chi tiết *', 1000)}{values.updateType === 'COMPLICATION' && profile.openHealthCase && selectField('linkedHealthCaseId', 'Ca sức khỏe liên quan', [['', 'Không liên kết'], ['health-ongoing', 'Ca sức khỏe đang mở']])}</>
  } else if (target.mode === 'correct-event') {
    body = <>{sourceAndTime('Thời điểm sự kiện *')}{target.event.type === 'PREGNANCY_CHECK' && selectField('result', 'Kết quả', [['PREGNANT', 'Có thai'], ['NOT_PREGNANT', 'Không có thai'], ['INCONCLUSIVE', 'Chưa kết luận']])}{target.event.type === 'PREGNANCY_UPDATE' && selectField('updateType', 'Loại diễn biến', [['OBSERVATION', 'Theo dõi'], ['COMPLICATION', 'Biến chứng'], ['LOSS', 'Mất thai']])}{target.event.type === 'BREEDING' && <div className="grid gap-3 sm:grid-cols-2">{selectField('method', 'Phương pháp', [['NATURAL_SERVICE', 'Phối tự nhiên'], ['ARTIFICIAL_INSEMINATION', 'Thụ tinh nhân tạo']])}{textField('performer', 'Người thực hiện', 100)}</div>}{target.event.type === 'ESTRUS' && textField('observer', 'Người quan sát', 100)}{textarea('details', 'Chi tiết', 1000)}{reasonField()}</>
  } else if (target.mode === 'correct-calving') {
    body = <>{sourceAndTime('Thời điểm đẻ *')}<div className="grid gap-3 sm:grid-cols-2">{selectField('method', 'Diễn biến đẻ', [['NORMAL', 'Bình thường'], ['ASSISTED', 'Có trợ giúp'], ['CAESAREAN', 'Mổ lấy thai']])}{selectField('result', 'Tình trạng bò mẹ', [['GOOD', 'Ổn định'], ['MONITORING', 'Cần theo dõi'], ['CRITICAL', 'Nguy kịch']])}</div>{textField('performer', 'Người đỡ đẻ', 100)}<Field label="Nhau chưa ra sau 12 giờ" id="repro-retained-placenta"><Checkbox checked={values.retainedPlacenta === 'true'} onChange={(event) => change('retainedPlacenta', String(event.target.checked))}>Ghi nhận giữ lại nhau</Checkbox></Field><Field label="Kết quả bê" id="repro-calf-outcomes"><div className="flex flex-col gap-3">{calves.map((calf, index) => <div key={calf.id} className="grid gap-2 rounded-md border border-edge p-3 sm:grid-cols-2"><strong className="sm:col-span-2">Bê {index + 1}{calf.registrationStatus === 'REGISTERED' ? ' · Đã đăng ký' : ''}</strong><Select aria-label={`Kết quả bê ${index + 1}`} disabled={calf.registrationStatus === 'REGISTERED'} value={calf.outcome} onChange={(event) => setCalves((current) => current.map((row, i) => i === index ? event.target.value === 'STILLBORN' ? { ...row, outcome: 'STILLBORN', sex: 'UNKNOWN', earTag: null, penId: null, penCode: null, breed: null, registrationChoice: null, registrationStatus: null, productionPurpose: null } : { ...row, outcome: 'LIVE', sex: row.sex === 'UNKNOWN' ? 'FEMALE' : row.sex, penId: row.penId ?? profile.penId, penCode: row.penCode ?? profile.penCode, breed: row.breed ?? profile.breed, registrationChoice: row.registrationChoice ?? 'DRAFT', registrationStatus: row.registrationStatus ?? 'PENDING_CONFIRMATION' } : row))}><option value="LIVE">Sống</option><option value="STILLBORN">Thai chết lưu</option></Select><Select aria-label={`Giới tính bê ${index + 1}`} disabled={calf.registrationStatus === 'REGISTERED' || calf.outcome === 'STILLBORN'} value={calf.sex} onChange={(event) => setCalves((current) => current.map((row, i) => i === index ? { ...row, sex: event.target.value as CalfOutcome['sex'] } : row))}><option value="MALE">Đực</option><option value="FEMALE">Cái</option><option value="UNKNOWN">Không rõ</option></Select><input aria-label={`Số tai bê ${index + 1}`} disabled={calf.registrationStatus === 'REGISTERED'} maxLength={50} className={inputCls} value={calf.earTag ?? ''} onChange={(event) => setCalves((current) => current.map((row, i) => i === index ? { ...row, earTag: event.target.value || null } : row))} placeholder="Số tai (nếu đã có)" /><input aria-label={`Cân nặng bê ${index + 1}`} disabled={calf.registrationStatus === 'REGISTERED'} type="number" min="1" max="80" step="0.1" className={inputCls} value={calf.weightKg ?? ''} onChange={(event) => setCalves((current) => current.map((row, i) => i === index ? { ...row, weightKg: event.target.value === '' ? null : Number(event.target.value) } : row))} placeholder="Cân nặng kg" /><Select aria-label={`Cơ sở cân bê ${index + 1}`} disabled={calf.registrationStatus === 'REGISTERED' || calf.weightKg == null} value={calf.weightBasis ?? ''} onChange={(event) => setCalves((current) => current.map((row, i) => i === index ? { ...row, weightBasis: event.target.value ? event.target.value as CalfOutcome['weightBasis'] : null } : row))}><option value="">Chọn cơ sở cân</option><option value="MEASURED">Đã cân</option><option value="ESTIMATED">Ước tính</option></Select></div>)}</div></Field>{reasonField()}</>
  } else {
    body = <><p className="m-0 text-sm">{profile.cattleCode} · {profile.name}</p>{reasonField()}</>
  }

  const disableSubmit = busy || ((isVoid || isCorrection) && !reason.trim())
  const submitLabel = busy ? 'Đang lưu…' : isVoid ? 'Hủy sự kiện' : isCorrection ? 'Lưu chỉnh sửa' : 'Lưu sự kiện'

  return (
    <Modal width={760} maxHeight="calc(100vh - 2rem)" title={title} sub={`${profile.cattleCode} · ${profile.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {target.mode !== 'record' && <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><span>{'event' in target ? target.event.summary : 'Sự kiện đẻ'}</span><Badge>{'event' in target ? target.event.status : target.calving.status}</Badge></div>}
        {error && <Note tone="err">{error}</Note>}
        {body}
      </div>
      <ModalFooter compact className="-mx-6 mt-2 border-t border-rule px-0">
        <ModalButton disabled={busy} onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant={isVoid ? 'danger' : 'primary'} disabled={disableSubmit} onClick={() => void submit()}>{submitLabel}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

