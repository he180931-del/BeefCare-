import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { DateInput, ErrorBlock, Field, LoadingBlock, Note, Textarea, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import { fmtDate } from '../domain/vaccinationFormat'
import { VaccinationValidationError, type FieldErrors } from '../domain/vaccinationRules'
import type { DoseRow } from '../types'
import { FieldError } from './vaccinationParts'

interface Props { doseId: number; onClose: () => void; onSaved: (message: string) => void }

export default function DeferModal(props: Props) {
  const query = useQuery(() => vaccinationApi.getDose(props.doseId), [props.doseId])
  if (!query.data) {
    return (
      <Modal title="Hoãn mũi tiêm" width={560} onClose={props.onClose}>
        {query.error ? <ErrorBlock message={userFacingError(query.error, 'Không tải được mũi tiêm.')} onRetry={query.refetch} /> : <LoadingBlock />}
      </Modal>
    )
  }
  return <DeferForm {...props} dose={query.data} />
}

function DeferForm({ dose, onClose, onSaved }: Props & { dose: DoseRow }) {
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    setErrors({})
    try {
      const result = await vaccinationApi.deferDose(dose.id, { expectedVersion: dose.version, reason, newExpectedDate: date || undefined, note })
      onSaved(result.message)
    } catch (error) {
      if (error instanceof VaccinationValidationError) setErrors(error.fields)
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  const name = dose.cattleName ? `${dose.cattleCode} “${dose.cattleName}”` : dose.cattleCode
  return (
    <Modal title="Hoãn mũi tiêm" sub={`${name} · ${dose.breed} · ${dose.penName.split(' – ')[0] ? `Chuồng ${dose.penName.split(' – ')[0]}` : ''}`} width={560} onClose={onClose}>
      <Field label="Mũi tiêm" id="df-dose"><input id="df-dose" readOnly value={`${dose.scheduleName} · ${dose.doseText} · hạn ${fmtDate(dose.dueDate)}`} className={`${inputCls} bg-page text-muted`} /></Field>
      <Field label="Lý do chưa tiêm *" id="df-reason" hint="Tối đa 500 ký tự">
        <Textarea id="df-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      <Field label="Ngày dự kiến mới" id="df-date" hint="Từ hôm nay trở đi · không bắt buộc">
        <DateInput id="df-date" value={date} onChange={setDate} />
        <FieldError>{errors.newExpectedDate}</FieldError>
      </Field>
      <Field label="Ghi chú" id="df-note">
        <input id="df-note" className={inputCls} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{errors.note}</FieldError>
      </Field>
      {errors.form && <Note tone="err">{errors.form}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>Lưu hoãn</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
