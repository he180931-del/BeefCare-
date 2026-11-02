import { useMemo, useState, type ReactNode } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, inputCls, Note, Select, Table, Td, Textarea, Th } from '../../../components/ui'
import { healthApi } from '../api/healthApi'
import { recordToast } from '../domain/healthMessages'
import { fmtDate, fmtDateTime, fmtTemp, PROGRESS_LABEL, PROGRESSES, ROUTE_LABEL, ROUTES } from '../domain/healthFormat'
import { latestWithdrawalEnd, MSG, parseTemperature } from '../domain/healthRules'
import type { HealthFormOptions, HealthProfile, HealthTimelineRow, Progress, TreatmentRoute } from '../types'
import { DateTimeInput, hint, RadioGroup, ReadonlyBox, toIntOrNull, useDialogSave } from './healthUi'

function Row({ label, current, error, children }: { label: string; current: ReactNode; error?: string; children: ReactNode }) {
  return (
    <tr>
      <Td className="font-medium">{label}</Td>
      <Td>{current}</Td>
      <Td className="min-w-0">{children}{error && <p role="alert" className="m-0 mt-1 text-[11px] text-err-fg">{error}</p>}</Td>
    </tr>
  )
}

export default function CorrectRecordDialog({ row, profile, options, onClose, onSaved }: { row: HealthTimelineRow; profile: HealthProfile; options: HealthFormOptions; onClose: () => void; onSaved: (message: string) => void }) {
  const treatment = row.type === 'TREATMENT'
  const opening = row.type === 'OPENING'
  const [action, setAction] = useState<'correct' | 'void'>('correct')
  const [time, setTime] = useState(row.occurredAt)
  const [medicineId, setMedicineId] = useState(String(row.medicineId ?? ''))
  const [dose, setDose] = useState(row.dose ?? '')
  const [route, setRoute] = useState<TreatmentRoute | ''>(row.route ?? '')
  const [course, setCourse] = useState(String(row.courseDays ?? 1))
  const [wd, setWd] = useState(String(row.withdrawalDays ?? 0))
  const [who, setWho] = useState(row.recordedBy)
  const [temp, setTemp] = useState(row.temperatureC !== null ? fmtTemp(row.temperatureC) : '')
  const [progress, setProgress] = useState<Progress | ''>(row.progress ?? '')
  const [description, setDescription] = useState(row.description ?? '')
  const [reason, setReason] = useState('')
  const form = useDialogSave()
  const { errors } = form
  const voiding = action === 'void'
  const blocked = voiding && opening
  const medicines = options.medicines.filter((m) => m.active || m.id === row.medicineId)

  const before = profile.withdrawalEndDate
  const after = useMemo(() => {
    const course1 = toIntOrNull(course)
    const wd1 = toIntOrNull(wd)
    return latestWithdrawalEnd(profile.timeline.map((t) => {
      if (t.id !== row.id) return t
      if (voiding) return { ...t, status: 'VOIDED' as const }
      return treatment && course1 && Number.isInteger(course1) && wd1 !== null && Number.isInteger(wd1) && time ? { ...t, occurredAt: time, courseDays: course1, withdrawalDays: wd1 } : t
    }))
  }, [profile.timeline, row.id, voiding, treatment, course, wd, time])

  const save = () => form.run(async () => {
    const result = voiding
      ? await healthApi.voidEntry(row.id, { expectedVersion: row.version, reason })
      : await healthApi.correctEntry(row.id, treatment
        ? { expectedVersion: row.version, reason, medicineId: Number(medicineId) || null, treatmentTime: time, dose, route, courseDays: toIntOrNull(course), withdrawalDays: toIntOrNull(wd), performer: who }
        : { expectedVersion: row.version, reason, observedAt: time, temperatureC: parseTemperature(temp), progress: row.type === 'FOLLOW_UP' ? progress : undefined, description, observer: who })
    onSaved(recordToast(result))
  })

  const kind = treatment ? 'điều trị' : 'theo dõi'
  return (
    <Modal title={`Sửa / hủy bản ghi ${kind}`} sub={`${profile.cattle.code} · Ca ${row.caseCode} · ${treatment ? 'Điều trị' : opening ? 'Mở ca' : 'Theo dõi'} ${fmtDateTime(row.occurredAt)}`} width={700} onClose={onClose}>
      <Field label="Bản ghi" id="cr-record"><ReadonlyBox id="cr-record" value={row.details} /></Field>
      <Field label="Hành động *">
        <RadioGroup name="cr-action" value={action} onChange={setAction} options={[{ value: 'correct', label: 'Sửa bản ghi' }, { value: 'void', label: 'Hủy bản ghi' }]} />
      </Field>
      {blocked && <Note tone="err">{MSG.voidOpening}</Note>}
      {!voiding && (
        <Table>
          <thead><tr><Th className="w-[140px]">Trường thông tin</Th><Th className="w-[160px]">Giá trị hiện tại</Th><Th>Giá trị mới</Th></tr></thead>
          <tbody>
            {treatment ? (
              <>
                <Row label="Thuốc" current={row.medicineName} error={errors.medicineId}>
                  <Select aria-label="Thuốc" value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
                </Row>
                <Row label="Liệu trình (ngày)" current={row.courseDays} error={errors.courseDays}><input aria-label="Liệu trình (ngày)" inputMode="numeric" value={course} onChange={(e) => setCourse(e.target.value)} className={inputCls} /></Row>
                <Row label="Thời điểm bắt đầu" current={fmtDateTime(row.occurredAt)} error={errors.treatmentTime}><DateTimeInput value={time} onChange={setTime} /></Row>
                <Row label="Liều" current={row.dose} error={errors.dose}><input aria-label="Liều" value={dose} onChange={(e) => setDose(e.target.value)} className={inputCls} /></Row>
                <Row label="Đường dùng" current={row.route ? ROUTE_LABEL[row.route] : ''} error={errors.route}>
                  <Select aria-label="Đường dùng" value={route} onChange={(e) => setRoute(e.target.value as TreatmentRoute)}>{ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}</Select>
                </Row>
                <Row label="Ngưng sử dụng (ngày)" current={`${row.withdrawalDays} ngày`} error={errors.withdrawalDays}><input aria-label="Ngưng sử dụng (ngày)" inputMode="numeric" value={wd} onChange={(e) => setWd(e.target.value)} className={inputCls} /></Row>
                <Row label="Người thực hiện" current={row.recordedBy} error={errors.performer}><input aria-label="Người thực hiện" list="cr-who" value={who} onChange={(e) => setWho(e.target.value)} className={inputCls} /></Row>
              </>
            ) : (
              <>
                <Row label="Thời điểm quan sát" current={fmtDateTime(row.occurredAt)} error={errors.observedAt}><DateTimeInput value={time} onChange={setTime} /></Row>
                <Row label="Thân nhiệt (°C)" current={row.temperatureC !== null ? fmtTemp(row.temperatureC) : '—'} error={errors.temperatureC}><input aria-label="Thân nhiệt (°C)" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} className={inputCls} /></Row>
                {row.type === 'FOLLOW_UP' && (
                  <Row label="Diễn biến" current={row.progress ? PROGRESS_LABEL[row.progress] : ''} error={errors.progress}>
                    <Select aria-label="Diễn biến" value={progress} onChange={(e) => setProgress(e.target.value as Progress)}>{PROGRESSES.map((p) => <option key={p} value={p}>{PROGRESS_LABEL[p]}</option>)}</Select>
                  </Row>
                )}
                <Row label={opening ? 'Dấu hiệu / mô tả' : 'Mô tả'} current={row.description} error={errors.description}><Textarea aria-label={opening ? 'Dấu hiệu / mô tả' : 'Mô tả'} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Row>
                <Row label="Người quan sát" current={row.recordedBy}><input aria-label="Người quan sát" list="cr-who" value={who} onChange={(e) => setWho(e.target.value)} className={inputCls} /></Row>
              </>
            )}
          </tbody>
        </Table>
      )}
      <datalist id="cr-who">{options.members.map((m) => <option key={m} value={m} />)}</datalist>
      {voiding && !blocked && <Note tone="warn">Bản ghi sẽ chuyển sang trạng thái Đã hủy: mờ đi trong lịch sử và không còn được tính vào ngưng sử dụng thịt hay trạng thái sức khỏe.</Note>}
      {(treatment || voiding) && !blocked && <Note tone={before !== after ? 'info' : 'grey'}>Ngưng thịt đến: {fmtDate(before)} → {fmtDate(after)} (tính lại khi lưu)</Note>}
      <Field label="Lý do *" id="cr-reason" hint={hint(errors.reason, 'Tối đa 500 ký tự')}><Textarea id="cr-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {form.formError && <Note tone="err">{form.formError}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={voiding ? 'danger' : 'primary'} onClick={save} disabled={form.saving || blocked}>{voiding ? 'Hủy bản ghi' : 'Lưu'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
