import { useState } from 'react'
import { ErrorBlock, Field, inputCls, LoadingBlock, Modal, ModalButton, ModalFooter, Note, NoticeDialog, Radio, Segmented, Select, Textarea } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useSession } from '../../../app/session/sessionContext'
import { fmtDec } from '../domain/growthFormat'
import { METHOD_LABEL } from '../domain/growthLabels'
import { BCS_SCALE, GrowthLargeChangeError, GrowthValidationError, tapeWeightKg, type GrowthFieldErrors } from '../domain/growthRules'
import { useGrowthCommands, useGrowthFormOptions } from '../hooks/useGrowthUseCase'
import type { GrowthFormOptions, GrowthMethod, RecordGrowthCommand } from '../types'
import { FieldError, UnitInput, parseNum } from './growthParts'

/** Methods offered when recording; ESTIMATE stays readable on old records but is no longer offered. */
const RECORD_METHODS: GrowthMethod[] = ['SCALE', 'TAPE']

interface Props { cattleCode: string; onClose: () => void; onSaved: (message: string) => void }

export default function GrowthRecordModal(props: Props) {
  const options = useGrowthFormOptions(props.cattleCode)
  if (!options.data) {
    return (
      <Modal title="Ghi nhận cân" width={640} onClose={props.onClose}>
        {options.error ? <ErrorBlock message={userFacingError(options.error, 'Không tải được thông tin bò.')} onRetry={options.refetch} /> : <LoadingBlock />}
      </Modal>
    )
  }
  return <RecordForm {...props} options={options.data} />
}

function RecordForm({ cattleCode, options, onClose, onSaved }: Props & { options: GrowthFormOptions }) {
  const session = useSession()
  const { record } = useGrowthCommands()
  const { cattle, now } = options
  const members = session?.fullName && !options.members.some((m) => m.name === session.fullName) ? [{ id: 0, name: session.fullName }, ...options.members] : options.members
  const [measuredAt, setMeasuredAt] = useState(now)
  const [measuredBy, setMeasuredBy] = useState(String((members.find((m) => m.name === session?.fullName) ?? members[0]).id))
  const [method, setMethod] = useState<GrowthMethod>('SCALE')
  const [girth, setGirth] = useState('')
  const [length, setLength] = useState('')
  const [weight, setWeight] = useState('')
  const [weightTouched, setWeightTouched] = useState(false)
  const [bcs, setBcs] = useState<number | undefined>()
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<GrowthFieldErrors>({})
  const [largeChange, setLargeChange] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const g = parseNum(girth)
  const l = parseNum(length)
  // Chỉ tự tính cân khi hai số đo thước dây đọc được; gõ sai thì để người dùng thấy lỗi dưới ô.
  const autoWeight = method === 'TAPE' && Number.isFinite(g) && Number.isFinite(l) ? tapeWeightKg(g as number, l as number) : undefined
  const weightText = weightTouched || autoWeight === undefined ? weight : String(autoWeight)

  const submit = async (acknowledgedLargeChange = false) => {
    const weightKg = parseNum(weightText)
    const member = members.find((m) => String(m.id) === measuredBy)
    const command: RecordGrowthCommand = {
      measuredAt,
      measuredBy: member?.id,
      measuredByName: member?.name,
      method: weightKg !== undefined ? method : undefined,
      weightKg,
      heartGirthCm: method === 'TAPE' ? g : undefined,
      bodyLengthCm: method === 'TAPE' ? l : undefined,
      bcs,
      note,
      acknowledgedLargeChange,
    }
    setSaving(true)
    setErrors({})
    try {
      await record(cattleCode, command)
      onSaved(`Đã lưu đánh giá cho ${cattleCode}.`)
    } catch (error) {
      if (error instanceof GrowthValidationError) setErrors(error.fields)
      else if (error instanceof GrowthLargeChangeError) setLargeChange(error.message)
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  const cow = `${cattle.code}${cattle.name ? ` “${cattle.name}”` : ''} · ${cattle.breed} · ${cattle.sex} · Chuồng ${cattle.penName}`
  return (
    <Modal title="Ghi nhận cân" width={640} onClose={onClose}>
      <Field label="Bò" id="gr-cattle"><input id="gr-cattle" readOnly value={cow} className={`${inputCls} bg-page text-muted`} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời điểm đo *" id="gr-measured-at">
          <input id="gr-measured-at" type="datetime-local" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} className={inputCls} />
          <FieldError>{errors.measuredAt}</FieldError>
        </Field>
        <Field label="Người đo" id="gr-measured-by">
          <Select id="gr-measured-by" value={measuredBy} onChange={(e) => setMeasuredBy(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Phương pháp *">
        <div role="radiogroup" aria-label="Phương pháp" className="flex flex-wrap gap-x-5 gap-y-2">
          {RECORD_METHODS.map((m) => (
            <Radio key={m} name="gr-method" checked={method === m} onChange={() => { setMethod(m); setWeightTouched(false) }}>{METHOD_LABEL[m]}</Radio>
          ))}
        </div>
        <FieldError>{errors.method}</FieldError>
      </Field>
      {method === 'TAPE' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vòng ngực (cm)" id="gr-girth" hint="50 – 300 cm">
            <UnitInput id="gr-girth" unit="cm" min={50} max={300} step={0.1} value={girth} onChange={(e) => setGirth(e.target.value)} />
            <FieldError>{errors.heartGirthCm}</FieldError>
          </Field>
          <Field label="Dài thân chéo (cm)" id="gr-length" hint="30 – 250 cm">
            <UnitInput id="gr-length" unit="cm" min={30} max={250} step={0.1} value={length} onChange={(e) => setLength(e.target.value)} />
            <FieldError>{errors.bodyLengthCm}</FieldError>
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cân nặng" id="gr-weight">
          <UnitInput id="gr-weight" unit="kg" min={1} max={1500} step={0.1} value={weightText} onChange={(e) => { setWeight(e.target.value); setWeightTouched(true) }} />
          <FieldError>{errors.weightKg}</FieldError>
        </Field>
      </div>
      <Field label="Điểm thể trạng BCS">
        <Segmented
          options={BCS_SCALE.map((v) => ({ value: String(v), label: fmtDec(v) }))}
          value={bcs === undefined ? '' : String(bcs)}
          onChange={(v) => setBcs(bcs === Number(v) ? undefined : Number(v))}
        />
        <FieldError>{errors.bcs}</FieldError>
      </Field>
      <Field label="Ghi chú" id="gr-note" hint="Tối đa 500 ký tự">
        <Textarea id="gr-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{errors.note}</FieldError>
      </Field>
      {errors.form && <NoticeDialog message={errors.form} onClose={() => setErrors(({ form: _form, ...rest }) => rest)} />}
      {largeChange ? (
        <>
          <Note tone="warn">{largeChange}</Note>
          <ModalFooter>
            <ModalButton onClick={() => setLargeChange(null)}>Quay lại</ModalButton>
            <ModalButton variant="primary" disabled={saving} onClick={() => { setLargeChange(null); void submit(true) }}>Vẫn lưu</ModalButton>
          </ModalFooter>
        </>
      ) : (
        <ModalFooter>
          <ModalButton onClick={onClose}>Hủy</ModalButton>
          <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>Lưu đánh giá</ModalButton>
        </ModalFooter>
      )}
    </Modal>
  )
}
