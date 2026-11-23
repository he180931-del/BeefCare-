import { useState } from 'react'
import { inputCls, Field, Modal, ModalButton, ModalFooter, Note, Select, Table, Td, Textarea, Th } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { fmtDateTime, fmtDec, fmtKg } from '../domain/growthFormat'
import { METHOD_LABEL } from '../domain/growthLabels'
import { BCS_SCALE, GrowthValidationError, type GrowthFieldErrors } from '../domain/growthRules'
import type { GrowthMethod, GrowthRecord } from '../types'
import { useGrowthCommands } from '../hooks/useGrowthUseCase'
import { FieldError, UnitInput, parseNum } from './growthParts'

/** Ghi chú của lần sửa gần nhất (D43): điền sẵn khi mở lại popup để người dùng không phải gõ lại. */
export function latestCorrectionNote(record: GrowthRecord): string {
  const last = [...record.revisions].reverse().find((r) => r.action === 'CORRECT' && r.reason)
  return last?.reason ?? ''
}

/** Popup Sửa bản ghi cân: chỉ để sửa giá trị; ghi chú không bắt buộc (D43). Xóa dùng GrowthDeleteModal. */
export default function GrowthCorrectModal({ record, onClose, onSaved }: { record: GrowthRecord; onClose: () => void; onSaved: (message: string) => void }) {
  const { correct } = useGrowthCommands()
  const [weight, setWeight] = useState(record.weightKg === undefined ? '' : String(record.weightKg))
  const [girth, setGirth] = useState(record.heartGirthCm === undefined ? '' : String(record.heartGirthCm))
  const [length, setLength] = useState(record.bodyLengthCm === undefined ? '' : String(record.bodyLengthCm))
  const [bcs, setBcs] = useState(record.bcs === undefined ? '' : String(record.bcs))
  const [method, setMethod] = useState<GrowthMethod | ''>(record.method ?? '')
  const [measuredAt, setMeasuredAt] = useState(record.measuredAt)
  const [note, setNote] = useState(() => latestCorrectionNote(record))
  const [errors, setErrors] = useState<GrowthFieldErrors>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    setErrors({})
    try {
      await correct(record.cattleCode, record.id, {
        action: 'CORRECT',
        reason: note,
        expectedVersion: record.version,
        values: { measuredAt, method: method || undefined, weightKg: parseNum(weight), heartGirthCm: parseNum(girth), bodyLengthCm: parseNum(length), bcs: parseNum(bcs) },
      })
      onSaved('Đã sửa bản ghi cân. Giá trị trước khi sửa vẫn được lưu trong lịch sử.')
    } catch (error) {
      if (error instanceof GrowthValidationError) setErrors(error.fields)
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  const tape = method === 'TAPE'
  return (
    <Modal title="Sửa bản ghi cân" sub={`${record.cattleCode} · bản ghi ${fmtDateTime(record.measuredAt)}`} width={700} onClose={onClose}>
      <Table variant="panel" stack={false}>
        <thead><tr><Th>Trường thông tin</Th><Th>Giá trị hiện tại</Th><Th>Giá trị mới</Th></tr></thead>
        <tbody>
          <tr>
            <Td className="font-medium">Cân nặng</Td><Td>{record.weightKg === undefined ? '—' : `${fmtKg(record.weightKg)} kg`}</Td>
            <Td><UnitInput aria-label="Cân nặng mới" unit="kg" min={1} max={1500} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} /><FieldError>{errors.weightKg}</FieldError></Td>
          </tr>
          {tape && (
            <>
              <tr>
                <Td className="font-medium">Vòng ngực</Td><Td>{record.heartGirthCm === undefined ? '—' : `${record.heartGirthCm} cm`}</Td>
                <Td><UnitInput aria-label="Vòng ngực mới" unit="cm" min={50} max={300} step={0.1} value={girth} onChange={(e) => setGirth(e.target.value)} /><FieldError>{errors.heartGirthCm}</FieldError></Td>
              </tr>
              <tr>
                <Td className="font-medium">Dài thân chéo</Td><Td>{record.bodyLengthCm === undefined ? '—' : `${record.bodyLengthCm} cm`}</Td>
                <Td><UnitInput aria-label="Dài thân chéo mới" unit="cm" min={30} max={250} step={0.1} value={length} onChange={(e) => setLength(e.target.value)} /><FieldError>{errors.bodyLengthCm}</FieldError></Td>
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
      <Field label="Ghi chú" id="gc-note">
        <Textarea id="gc-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      {errors.form && <Note tone="err">{errors.form}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>Lưu chỉnh sửa</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
