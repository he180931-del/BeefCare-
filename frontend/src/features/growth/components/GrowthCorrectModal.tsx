import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, Note, Radio, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { growthApi } from '../api/growthApi'
import { fmtDateTime, fmtDec, fmtKg } from '../domain/growthFormat'
import { METHOD_LABEL } from '../domain/growthLabels'
import { BCS_SCALE, GrowthValidationError, type GrowthFieldErrors } from '../domain/growthRules'
import type { GrowthMethod, GrowthRecord } from '../types'
import { FieldError, UnitInput, parseNum } from './growthParts'

export default function GrowthCorrectModal({ record, onClose, onSaved }: { record: GrowthRecord; onClose: () => void; onSaved: (message: string) => void }) {
  const [action, setAction] = useState<'CORRECT' | 'EXCLUDE'>('CORRECT')
  const [weight, setWeight] = useState(record.weightKg === undefined ? '' : String(record.weightKg))
  const [girth, setGirth] = useState(record.heartGirthCm === undefined ? '' : String(record.heartGirthCm))
  const [length, setLength] = useState(record.bodyLengthCm === undefined ? '' : String(record.bodyLengthCm))
  const [bcs, setBcs] = useState(record.bcs === undefined ? '' : String(record.bcs))
  const [method, setMethod] = useState<GrowthMethod | ''>(record.method ?? '')
  const [measuredAt, setMeasuredAt] = useState(record.measuredAt)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<GrowthFieldErrors>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    setErrors({})
    try {
      await growthApi.correct(record.cattleCode, record.id, {
        action,
        reason,
        expectedVersion: record.version,
        values:
          action === 'CORRECT'
            ? { measuredAt, method: method || undefined, weightKg: parseNum(weight), heartGirthCm: parseNum(girth), bodyLengthCm: parseNum(length), bcs: parseNum(bcs) }
            : undefined,
      })
      onSaved(`Bản ghi đã được ${action === 'CORRECT' ? 'sửa' : 'loại trừ'}. Giá trị gốc vẫn được lưu trong lịch sử.`)
    } catch (error) {
      if (error instanceof GrowthValidationError) setErrors(error.fields)
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  const summary = [record.weightKg !== undefined && `${fmtKg(record.weightKg)} kg`, record.bcs !== undefined && `BCS ${fmtDec(record.bcs)}`, record.method && METHOD_LABEL[record.method], record.measuredByName].filter(Boolean).join(' · ')
  const tape = method === 'TAPE'
  return (
    <Modal title="Sửa / loại trừ bản ghi cân" sub={`${record.cattleCode} · bản ghi ${fmtDateTime(record.measuredAt)}`} width={700} onClose={onClose}>
      <Field label="Bản ghi" id="gc-record"><input id="gc-record" readOnly value={summary} className={`${inputCls} bg-page text-muted`} /></Field>
      <Field label="Hành động *">
        <div role="radiogroup" aria-label="Hành động" className="flex flex-wrap gap-x-5 gap-y-2">
          <Radio name="gc-action" checked={action === 'CORRECT'} onChange={() => setAction('CORRECT')}>Sửa giá trị</Radio>
          <Radio name="gc-action" checked={action === 'EXCLUDE'} onChange={() => setAction('EXCLUDE')}>Loại trừ bản ghi</Radio>
        </div>
      </Field>
      {action === 'CORRECT' && (
        <Table stack={false}>
          <thead><tr><Th>Trường thông tin</Th><Th>Giá trị hiện tại</Th><Th>Giá trị mới</Th></tr></thead>
          <tbody>
            <tr>
              <Td className="font-medium">Cân nặng</Td><Td>{record.weightKg === undefined ? '—' : `${fmtKg(record.weightKg)} kg`}</Td>
              <Td><UnitInput aria-label="Cân nặng mới" unit="kg" value={weight} onChange={(e) => setWeight(e.target.value)} /><FieldError>{errors.weightKg}</FieldError></Td>
            </tr>
            {tape && (
              <>
                <tr>
                  <Td className="font-medium">Vòng ngực</Td><Td>{record.heartGirthCm === undefined ? '—' : `${record.heartGirthCm} cm`}</Td>
                  <Td><UnitInput aria-label="Vòng ngực mới" unit="cm" value={girth} onChange={(e) => setGirth(e.target.value)} /><FieldError>{errors.heartGirthCm}</FieldError></Td>
                </tr>
                <tr>
                  <Td className="font-medium">Dài thân chéo</Td><Td>{record.bodyLengthCm === undefined ? '—' : `${record.bodyLengthCm} cm`}</Td>
                  <Td><UnitInput aria-label="Dài thân chéo mới" unit="cm" value={length} onChange={(e) => setLength(e.target.value)} /><FieldError>{errors.bodyLengthCm}</FieldError></Td>
                </tr>
              </>
            )}
            <tr>
              <Td className="font-medium">BCS</Td><Td>{record.bcs === undefined ? '—' : fmtDec(record.bcs)}</Td>
              <Td>
                <Select aria-label="BCS mới" value={bcs} onChange={(e) => setBcs(e.target.value)}>
                  <option value="">—</option>
                  {BCS_SCALE.map((v) => <option key={v} value={v}>{fmtDec(v)}</option>)}
                </Select>
                <FieldError>{errors.bcs}</FieldError>
              </Td>
            </tr>
            <tr>
              <Td className="font-medium">Phương pháp</Td><Td>{record.method ? METHOD_LABEL[record.method] : '—'}</Td>
              <Td>
                <Select aria-label="Phương pháp mới" value={method} onChange={(e) => setMethod(e.target.value as GrowthMethod | '')}>
                  <option value="">—</option>
                  {(Object.keys(METHOD_LABEL) as GrowthMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </Select>
                <FieldError>{errors.method}</FieldError>
              </Td>
            </tr>
            <tr>
              <Td className="font-medium">Thời điểm đo</Td><Td>{fmtDateTime(record.measuredAt)}</Td>
              <Td><input aria-label="Thời điểm đo mới" type="datetime-local" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} className={inputCls} /><FieldError>{errors.measuredAt}</FieldError></Td>
            </tr>
          </tbody>
        </Table>
      )}
      <Field label="Lý do *" id="gc-reason" hint="Tối đa 500 ký tự">
        <Textarea id="gc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      {errors.form && <Note tone="err">{errors.form}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{action === 'CORRECT' ? 'Lưu chỉnh sửa' : 'Loại trừ bản ghi'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
