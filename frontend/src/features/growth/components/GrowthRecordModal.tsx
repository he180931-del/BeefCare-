import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { ErrorBlock, Field, LoadingBlock, Note, Radio, Segmented, Select, Textarea, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { growthApi } from '../api/growthApi'
import { fmtDec } from '../domain/growthFormat'
import { METHOD_LABEL } from '../domain/growthLabels'
import { BCS_SCALE, GrowthLargeChangeError, GrowthValidationError, basisOf, tapeWeightKg, type GrowthFieldErrors } from '../domain/growthRules'
import type { GrowthFormOptions, GrowthMethod, RecordGrowthCommand } from '../types'
import { FieldError, UnitInput, parseNum } from './growthParts'

interface Props { cattleCode: string; onClose: () => void; onSaved: (message: string) => void }

export default function GrowthRecordModal(props: Props) {
  const options = useQuery(() => growthApi.formOptions(props.cattleCode), [props.cattleCode])
  if (!options.data) {
    return (
      <Modal title="Ghi nhận cân & BCS" sub="Đánh giá tăng trưởng cho 1 con · lưu vào lịch sử đo" width={640} onClose={props.onClose}>
        {options.error ? <ErrorBlock message={userFacingError(options.error, 'Không tải được thông tin bò.')} onRetry={options.refetch} /> : <LoadingBlock />}
      </Modal>
    )
  }
  return <RecordForm {...props} options={options.data} />
}

function RecordForm({ cattleCode, options, onClose, onSaved }: Props & { options: GrowthFormOptions }) {
  const session = useSession()
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
  const autoWeight = method === 'TAPE' && g !== undefined && l !== undefined ? tapeWeightKg(g, l) : undefined
  const weightText = weightTouched || autoWeight === undefined ? weight : String(autoWeight)
  const basis = parseNum(weightText) !== undefined ? basisOf(method) : undefined

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
      await growthApi.record(cattleCode, command)
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
    <Modal title="Ghi nhận cân & BCS" sub="Đánh giá tăng trưởng cho 1 con · lưu vào lịch sử đo" width={640} onClose={onClose}>
      <Field label="Bò" id="gr-cattle"><input id="gr-cattle" readOnly value={cow} className={`${inputCls} bg-page text-muted`} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời điểm đo *" id="gr-measured-at" hint="Không ở tương lai, không trước ngày nhập đàn">
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
          {(Object.keys(METHOD_LABEL) as GrowthMethod[]).map((m) => (
            <Radio key={m} name="gr-method" checked={method === m} onChange={() => { setMethod(m); setWeightTouched(false) }}>{METHOD_LABEL[m]}</Radio>
          ))}
        </div>
        <FieldError>{errors.method}</FieldError>
      </Field>
      {method === 'TAPE' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vòng ngực (cm)" id="gr-girth" hint="Khi dùng thước dây · 50 – 300 cm">
            <UnitInput id="gr-girth" unit="cm" value={girth} onChange={(e) => setGirth(e.target.value)} />
            <FieldError>{errors.heartGirthCm}</FieldError>
          </Field>
          <Field label="Dài thân chéo (cm)" id="gr-length" hint="30 – 250 cm · cân = 88,4 × VN² × DTC (m), sửa được">
            <UnitInput id="gr-length" unit="cm" value={length} onChange={(e) => setLength(e.target.value)} />
            <FieldError>{errors.bodyLengthCm}</FieldError>
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cân nặng" id="gr-weight" hint="1 – 1.500 kg · tự tính khi đo thước dây">
          <UnitInput id="gr-weight" unit="kg" value={weightText} onChange={(e) => { setWeight(e.target.value); setWeightTouched(true) }} />
          <FieldError>{errors.weightKg}</FieldError>
        </Field>
        <Field label="Cơ sở số liệu" id="gr-basis" hint="Tự đặt theo phương pháp">
          <input id="gr-basis" readOnly value={basis === 'MEASURED' ? 'Thực tế' : basis === 'ESTIMATED' ? 'Ước tính' : '—'} className={`${inputCls} bg-page text-muted`} />
        </Field>
      </div>
      <Field label="Điểm thể trạng BCS (thang trại v1 · 1–5)">
        <Segmented
          options={BCS_SCALE.map((v) => ({ value: String(v), label: fmtDec(v) }))}
          value={bcs === undefined ? '' : String(bcs)}
          onChange={(v) => setBcs(bcs === Number(v) ? undefined : Number(v))}
        />
        <FieldError>{errors.bcs}</FieldError>
      </Field>
      <Field label="Ghi chú" id="gr-note" hint="Tối đa 500 ký tự">
        <Textarea id="gr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{errors.note}</FieldError>
      </Field>
      {errors.form && <Note tone="err">{errors.form}</Note>}
      {largeChange ? (
        <>
          <Note tone="warn">{largeChange}</Note>
          <ModalFooter>
            <ModalButton onClick={() => setLargeChange(null)}>Quay lại</ModalButton>
            <ModalButton variant="primary" disabled={saving} onClick={() => { setLargeChange(null); void submit(true) }}>Vẫn lưu</ModalButton>
          </ModalFooter>
        </>
      ) : (
        <>
          <Note tone="info">Nhập ít nhất cân nặng hoặc BCS. Có cân nặng thì phải chọn phương pháp.</Note>
          <ModalFooter>
            <ModalButton onClick={onClose}>Hủy</ModalButton>
            <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>Lưu đánh giá</ModalButton>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
