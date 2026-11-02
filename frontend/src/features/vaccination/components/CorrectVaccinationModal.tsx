import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { ErrorBlock, Field, LoadingBlock, Note, Radio, Select, Table, Td, Textarea, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import { fmtDate, fmtDateTime } from '../domain/vaccinationFormat'
import { VaccinationValidationError, type FieldErrors } from '../domain/vaccinationRules'
import type { VaccinationOptions, VaccinationRecord, VaccineRoute } from '../types'
import { FieldError, ROUTE_LABEL, UnitInput, parseNum, splitDose } from './vaccinationParts'

interface Props { record: VaccinationRecord; onClose: () => void; onSaved: (message: string) => void }

export default function CorrectVaccinationModal(props: Props) {
  const options = useQuery(() => vaccinationApi.options(), [])
  if (!options.data) {
    return (
      <Modal title="Sửa / hủy bản ghi tiêm" width={700} onClose={props.onClose}>
        {options.error ? <ErrorBlock message={userFacingError(options.error, 'Không tải được danh mục vắc-xin.')} onRetry={options.refetch} /> : <LoadingBlock />}
      </Modal>
    )
  }
  return <Form {...props} options={options.data} />
}

function Form({ record, options, onClose, onSaved }: Props & { options: VaccinationOptions }) {
  const onFarm = record.source === 'ON_FARM'
  const initialDose = splitDose(record.dose)
  const [action, setAction] = useState<'CORRECT' | 'VOID'>('CORRECT')
  const [vaccineId, setVaccineId] = useState(String(record.vaccineId ?? options.vaccines[0].id))
  const [batchNo, setBatchNo] = useState(record.batchNo ?? '')
  const [administeredAt, setAdministeredAt] = useState(record.administeredAt)
  const [amount, setAmount] = useState(initialDose.amount)
  const [route, setRoute] = useState<VaccineRoute | ''>(record.route ?? '')
  const [withdrawal, setWithdrawal] = useState(String(record.withdrawalDays))
  const [vaccinator, setVaccinator] = useState(record.vaccinator ?? '')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const names = options.members.map((m) => m.name)
  const vaccinatorChoices = record.vaccinator && !names.includes(record.vaccinator) ? [record.vaccinator, ...names] : names

  const submit = async () => {
    setSaving(true)
    setErrors({})
    try {
      if (action === 'VOID') await vaccinationApi.voidRecord(record.id, { expectedVersion: record.version, reason })
      else {
        await vaccinationApi.correctRecord(record.id, {
          expectedVersion: record.version, vaccineId: Number(vaccineId), administeredAt, batchNo, dose: amount.trim() ? `${amount.trim()} ${initialDose.unit}` : undefined,
          route: route || undefined, withdrawalDays: parseNum(withdrawal), vaccinator: vaccinator || undefined, reason,
        })
      }
      onSaved(`Bản ghi tiêm đã được ${action === 'VOID' ? 'hủy' : 'sửa'}. Giá trị gốc vẫn được lưu trong lịch sử.`)
    } catch (error) {
      if (error instanceof VaccinationValidationError) setErrors(error.fields)
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  const when = record.precision === 'MONTH' ? record.administeredAt.slice(5, 7) + '/' + record.administeredAt.slice(0, 4) : fmtDateTime(record.administeredAt)
  const summary = [record.vaccineLabel, record.batchNo ? `lô ${record.batchNo}` : 'lô không rõ', record.dose, record.route && ROUTE_LABEL[record.route].toLowerCase(), record.vaccinator ?? 'Không rõ'].filter(Boolean).join(' · ')
  return (
    <Modal title="Sửa / hủy bản ghi tiêm" sub={`${record.cattleCode} · ${record.vaccineLabel}${record.doseText ? ` ${record.doseText}` : ''} · ${when}`} width={700} onClose={onClose}>
      <Field label="Bản ghi" id="cv-record"><input id="cv-record" readOnly value={summary} className={`${inputCls} bg-page text-muted`} /></Field>
      <Field label="Hành động *">
        <div role="radiogroup" aria-label="Hành động" className="flex flex-wrap gap-x-5 gap-y-2">
          <Radio name="cv-action" checked={action === 'CORRECT'} onChange={() => setAction('CORRECT')}>Sửa bản ghi</Radio>
          <Radio name="cv-action" checked={action === 'VOID'} onChange={() => setAction('VOID')}>Hủy bản ghi</Radio>
        </div>
      </Field>
      {action === 'CORRECT' && (
        <Table stack={false}>
          <thead><tr><Th>Trường thông tin</Th><Th>Giá trị hiện tại</Th><Th>Giá trị mới</Th></tr></thead>
          <tbody>
            <tr>
              <Td className="font-medium">Vắc-xin</Td><Td>{record.vaccineLabel}</Td>
              <Td><Select aria-label="Vắc-xin mới" value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>{options.vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select><FieldError>{errors.vaccineId}</FieldError></Td>
            </tr>
            <tr>
              <Td className="font-medium">Số lô</Td><Td>{record.batchNo ?? 'Không rõ'}</Td>
              <Td><input aria-label="Số lô mới" className={inputCls} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} /><FieldError>{errors.batchNo}</FieldError></Td>
            </tr>
            <tr>
              <Td className="font-medium">Thời điểm tiêm</Td><Td>{when}</Td>
              <Td><input aria-label="Thời điểm tiêm mới" type="datetime-local" className={inputCls} value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)} /><FieldError>{errors.administeredAt}</FieldError></Td>
            </tr>
            <tr>
              <Td className="font-medium">Liều</Td><Td>{record.dose ?? '—'}</Td>
              <Td><UnitInput aria-label="Liều mới" unit={initialDose.unit} value={amount} onChange={(e) => setAmount(e.target.value)} /></Td>
            </tr>
            <tr>
              <Td className="font-medium">Đường tiêm</Td><Td>{record.route ? ROUTE_LABEL[record.route] : '—'}</Td>
              <Td><Select aria-label="Đường tiêm mới" value={route} onChange={(e) => setRoute(e.target.value as VaccineRoute | '')}><option value="">—</option>{(Object.keys(ROUTE_LABEL) as VaccineRoute[]).map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}</Select></Td>
            </tr>
            {onFarm && (
              <tr>
                <Td className="font-medium">Ngưng sử dụng</Td><Td>{record.withdrawalDays} ngày</Td>
                <Td><UnitInput aria-label="Số ngày ngưng mới" unit="ngày" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} /><FieldError>{errors.withdrawalDays}</FieldError></Td>
              </tr>
            )}
            <tr>
              <Td className="font-medium">Người tiêm</Td><Td>{record.vaccinator ?? 'Không rõ'}</Td>
              <Td><Select aria-label="Người tiêm mới" value={vaccinator} onChange={(e) => setVaccinator(e.target.value)}><option value="">—</option>{vaccinatorChoices.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Td>
            </tr>
          </tbody>
        </Table>
      )}
      <Field label="Lý do *" id="cv-reason" hint="Tối đa 500 ký tự">
        <Textarea id="cv-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      {errors.form && <Note tone="err">{errors.form}</Note>}
      <Note tone="info">{action === 'VOID' ? `Mũi tương ứng quay lại trạng thái chưa tiêm trong lịch (hạn ${record.scheduledDoseId ? 'theo lịch' : fmtDate(record.administeredAt)}).` : 'Ngày hết ngưng sử dụng thịt của bò được tính lại khi lưu.'}</Note>
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={action === 'VOID' ? 'danger' : 'primary'} disabled={saving} onClick={() => void submit()}>{action === 'VOID' ? 'Hủy bản ghi' : 'Lưu'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
