import { useState } from 'react'
import { ErrorBlock, Field, inputCls, LoadingBlock, Modal, ModalButton, ModalFooter, NoticeDialog, Select, Table, Td, Textarea, Th } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { fmtDateTime } from '../domain/vaccinationFormat'
import { VaccinationValidationError, type FieldErrors } from '../domain/vaccinationRules'
import { useVaccinationCommands, useVaccinationOptions } from '../hooks/useVaccinationUseCase'
import type { VaccinationOptions, VaccinationRecord, VaccineRoute } from '../types'
import { ROUTE_OTHER_MAX } from '../domain/vaccinationRules'
import { DOSE_INVALID, FieldError, ROUTE_LABEL, UnitInput, parseDoseAmount, parseNum, routeLabelOf, splitDose } from './vaccinationParts'

interface Props { record: VaccinationRecord; onClose: () => void; onSaved: (message: string) => void }

export default function CorrectVaccinationModal(props: Props) {
  const options = useVaccinationOptions()
  if (!options.data) {
    return (
      <Modal title="Sửa bản ghi tiêm" width={700} onClose={props.onClose}>
        {options.error ? <ErrorBlock message={userFacingError(options.error, 'Không tải được danh mục vắc-xin.')} onRetry={options.refetch} /> : <LoadingBlock />}
      </Modal>
    )
  }
  return <Form {...props} options={options.data} />
}

/** Ghi chú của lần sửa gần nhất: điền sẵn khi mở lại popup (D53, như FE-08 D43). */
export function latestCorrectionNote(record: VaccinationRecord): string {
  const last = [...record.revisions].reverse().find((r) => r.action === 'CORRECT' && r.reason)
  return last?.reason ?? ''
}

function Form({ record, options, onClose, onSaved }: Props & { options: VaccinationOptions }) {
  const onFarm = record.source === 'ON_FARM'
  const initialDose = splitDose(record.dose)
  // D82: mũi "Nhập lịch sử" tên tự do không có vắc-xin danh mục – mặc định giữ tên cũ (''), chỉ đổi khi người dùng chọn.
  const freeText = record.vaccineId == null
  const [vaccineId, setVaccineId] = useState(freeText ? '' : String(record.vaccineId))
  const [administeredAt, setAdministeredAt] = useState(record.administeredAt)
  const [amount, setAmount] = useState(initialDose.amount)
  const [route, setRoute] = useState<VaccineRoute | ''>(record.route ?? '')
  const [routeOther, setRouteOther] = useState(record.routeText ?? '')
  const [withdrawal, setWithdrawal] = useState(String(record.withdrawalDays))
  const [vaccinator, setVaccinator] = useState(record.vaccinator ?? '')
  const [note, setNote] = useState(() => latestCorrectionNote(record))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const { correctRecord } = useVaccinationCommands()

  const names = options.members.map((m) => m.name)
  const vaccinatorChoices = record.vaccinator && !names.includes(record.vaccinator) ? [record.vaccinator, ...names] : names

  const submit = async () => {
    const dose = parseDoseAmount(amount, initialDose.unit)
    if (dose.invalid) { setErrors({ dose: DOSE_INVALID }); return }
    setSaving(true)
    setErrors({})
    try {
      await correctRecord(record.id, {
        expectedVersion: record.version, vaccineId: vaccineId ? Number(vaccineId) : undefined, administeredAt, dose: dose.amount ? `${dose.amount} ${initialDose.unit}` : undefined,
        route: route || undefined, routeOther: route === 'OTHER' ? routeOther : undefined,
        withdrawalDays: withdrawal.trim() === '' ? 0 : parseNum(withdrawal) ?? Number.NaN, vaccinator: vaccinator || undefined, note,
      })
      onSaved('Đã sửa bản ghi tiêm.')
    } catch (error) {
      if (error instanceof VaccinationValidationError) setErrors(error.fields)
      else setErrors({ form: userFacingError(error, 'Không lưu được dữ liệu. Vui lòng thử lại.') })
    } finally {
      setSaving(false)
    }
  }

  const when = record.precision === 'MONTH' ? record.administeredAt.slice(5, 7) + '/' + record.administeredAt.slice(0, 4) : fmtDateTime(record.administeredAt)
  const summary = [record.vaccineLabel, record.dose, record.route && routeLabelOf(record.route, record.routeText).toLowerCase(), record.vaccinator ?? 'Không rõ'].filter(Boolean).join(' · ')
  return (
    <Modal title="Sửa bản ghi tiêm" sub={`${record.cattleCode} · ${record.vaccineLabel}${record.doseText ? ` ${record.doseText}` : ''} · ${when}`} width={700} onClose={onClose}>
      <Field label="Bản ghi" id="cv-record"><input id="cv-record" readOnly value={summary} className={`${inputCls} bg-page text-muted`} /></Field>
      <Table variant="panel" stack={false}>
        <thead><tr><Th>Trường thông tin</Th><Th>Giá trị hiện tại</Th><Th>Giá trị mới</Th></tr></thead>
        <tbody>
          <tr>
            <Td className="font-medium">Vắc-xin</Td><Td>{record.vaccineLabel}</Td>
            <Td><Select aria-label="Vắc-xin mới" value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>{freeText && <option value="">{`Giữ: ${record.vaccineLabel}`}</option>}{options.vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select><FieldError>{errors.vaccineId}</FieldError></Td>
          </tr>
          <tr>
            <Td className="font-medium">Thời điểm tiêm</Td><Td>{when}</Td>
            <Td><input aria-label="Thời điểm tiêm mới" type="datetime-local" className={inputCls} value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)} /><FieldError>{errors.administeredAt}</FieldError></Td>
          </tr>
          <tr>
            <Td className="font-medium">Liều</Td><Td>{record.dose ?? '—'}</Td>
            <Td><UnitInput aria-label="Liều mới" type="text" inputMode="decimal" unit={initialDose.unit} aria-invalid={!!errors.dose} value={amount} onChange={(e) => setAmount(e.target.value)} /><FieldError>{errors.dose}</FieldError></Td>
          </tr>
          <tr>
            <Td className="font-medium">Đường tiêm</Td><Td>{routeLabelOf(record.route, record.routeText)}</Td>
            <Td>
              <Select aria-label="Đường tiêm mới" value={route} onChange={(e) => setRoute(e.target.value as VaccineRoute | '')}><option value="">—</option>{(Object.keys(ROUTE_LABEL) as VaccineRoute[]).map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}</Select>
              {route === 'OTHER' && <input aria-label="Đường tiêm khác mới" placeholder="Nhập đường tiêm *" className={inputCls} maxLength={ROUTE_OTHER_MAX} value={routeOther} onChange={(e) => setRouteOther(e.target.value)} />}
              <FieldError>{errors.routeOther}</FieldError>
            </Td>
          </tr>
          {onFarm && (
            <tr>
              <Td className="font-medium">Ngưng sử dụng</Td><Td>{record.withdrawalDays} ngày</Td>
              <Td><UnitInput aria-label="Số ngày ngưng mới" type="text" inputMode="numeric" unit="ngày" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} /><FieldError>{errors.withdrawalDays}</FieldError></Td>
            </tr>
          )}
          <tr>
            <Td className="font-medium">Người tiêm</Td><Td>{record.vaccinator ?? 'Không rõ'}</Td>
            <Td><Select aria-label="Người tiêm mới" value={vaccinator} onChange={(e) => setVaccinator(e.target.value)}><option value="">—</option>{vaccinatorChoices.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Td>
          </tr>
        </tbody>
      </Table>
      <Field label="Ghi chú" id="cv-note">
        <Textarea id="cv-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{errors.note ?? errors.reason}</FieldError>
      </Field>
      {errors.form && <NoticeDialog message={errors.form} onClose={() => setErrors(({ form: _form, ...rest }) => rest)} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>Lưu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
