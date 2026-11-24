import { useMemo, useState, type ReactNode } from 'react'
import { DateTimeInput, DoseInput, Field, inputCls, Modal, ModalButton, ModalFooter, Note, NoticeDialog, Select, Table, Td, Textarea, Th } from '../../../shared/ui'
import { recordToast } from '../domain/healthMessages'
import { fmtDate, fmtDateTime, fmtTemp, PROGRESS_LABEL, PROGRESSES, ROUTE_LABEL, ROUTES } from '../domain/healthFormat'
import { latestWithdrawalEnd } from '../domain/healthRules'
import { parseTemperature } from '../validation/healthValidation'
import type { HealthFormOptions, HealthProfile, HealthTimelineRow, Progress, TreatmentRoute } from '../types'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import { joinDose, splitDose, type DoseUnit } from '../../../shared/lib/dose'
import type { EntryAction } from './CaseCard'
import { hint, MemberSelect, ReadonlyBox, toIntOrNull, useDialogSave, useTemperatureCheck } from './healthUi'

function Row({ label, current, error, children }: { label: string; current: ReactNode; error?: string; children: ReactNode }) {
  return (
    <tr>
      <Td className="font-medium">{label}</Td>
      <Td>{current}</Td>
      <Td className="min-w-0">{children}{error && <p role="alert" className="m-0 mt-1 text-[11px] text-err-fg">{error}</p>}</Td>
    </tr>
  )
}

/**
 * Sửa hoặc xóa một bản ghi theo dõi / điều trị (D73, như Cân nặng D43, Tiêm phòng D53, Sinh sản D69): hành động do nút
 * ở dòng thời gian quyết định; sửa có Ghi chú không bắt buộc, xóa chỉ xác nhận. Lần ghi mở ca không có nút Xóa.
 */
export default function CorrectRecordDialog({ action, row, profile, options, onClose, onSaved }: { action: EntryAction; row: HealthTimelineRow; profile: HealthProfile; options: HealthFormOptions; onClose: () => void; onSaved: (message: string) => void }) {
  const treatment = row.type === 'TREATMENT'
  const opening = row.type === 'OPENING'
  const [time, setTime] = useState(row.occurredAt)
  const [medicineId, setMedicineId] = useState(String(row.medicineId ?? ''))
  // D65: liều số + đơn vị; liều cũ không theo chuẩn thì để trống ô số, hiện nguyên văn ở cột "Hiện tại".
  const initialDose = splitDose(row.dose)
  const [amount, setAmount] = useState(initialDose.amount)
  const [unit, setUnit] = useState<DoseUnit>(initialDose.unit)
  const dose = joinDose(amount, unit)
  const [route, setRoute] = useState<TreatmentRoute | ''>(row.route ?? '')
  const [course, setCourse] = useState(String(row.courseDays ?? 1))
  const [wd, setWd] = useState(String(row.withdrawalDays ?? 0))
  const [who, setWho] = useState(row.recordedBy)
  // Người quan sát chọn theo id; người cũ không còn trong trại thì để "Giữ nguyên" (không gửi observerId).
  const [observerId, setObserverId] = useState<number | null>(options.members.some((m) => m.id === row.observerId) ? row.observerId ?? null : null)
  const [temp, setTemp] = useState(row.temperatureC !== null ? fmtTemp(row.temperatureC) : '')
  const [progress, setProgress] = useState<Progress | ''>(row.progress ?? '')
  const [description, setDescription] = useState(row.description ?? '')
  const [reason, setReason] = useState('')
  const { correctEntry, voidEntry } = useHealthCaseCommands()
  const form = useDialogSave()
  const { errors } = form
  const tempCheck = useTemperatureCheck()
  const voiding = action === 'void'
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

  const submit = () => form.run(async () => {
    const result = voiding
      ? await voidEntry(row.id, { expectedVersion: row.version, reason })
      : await correctEntry(row.id, treatment
        ? { expectedVersion: row.version, reason, medicineId: Number(medicineId) || null, treatmentTime: time, dose: dose === (row.dose ?? '') || (!amount && initialDose.legacy) ? undefined : dose, route, courseDays: toIntOrNull(course), withdrawalDays: toIntOrNull(wd), performer: who }
        : { expectedVersion: row.version, reason, observedAt: time, temperatureC: parseTemperature(temp), progress: row.type === 'FOLLOW_UP' ? progress : undefined, description, observerId })
    onSaved(recordToast(result))
  })
  const save = () => tempCheck.guard(voiding || treatment ? null : parseTemperature(temp), submit)

  const kind = treatment ? 'điều trị' : 'theo dõi'
  return (
    <Modal title={voiding ? `Xóa bản ghi ${kind}?` : `Sửa bản ghi ${kind}`} sub={`${profile.cattle.code} · Ca ${row.caseCode} · ${treatment ? 'Điều trị' : opening ? 'Mở ca' : 'Theo dõi'} ${fmtDateTime(row.occurredAt)}`} width={voiding ? 560 : 700} onClose={onClose}>
      <Field label="Bản ghi" id="cr-record"><ReadonlyBox id="cr-record" value={row.details} /></Field>
      {!voiding && (
        <Table variant="panel">
          <thead><tr><Th className="w-[140px]">Trường thông tin</Th><Th className="w-[160px]">Giá trị hiện tại</Th><Th>Giá trị mới</Th></tr></thead>
          <tbody>
            {treatment ? (
              <>
                <Row label="Thuốc" current={row.medicineName} error={errors.medicineId}>
                  <Select aria-label="Thuốc" value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
                </Row>
                <Row label="Số ngày dùng" current={row.courseDays} error={errors.courseDays}><input aria-label="Số ngày dùng" inputMode="numeric" maxLength={2} value={course} onChange={(e) => setCourse(e.target.value)} className={inputCls} /></Row>
                <Row label="Thời điểm bắt đầu" current={fmtDateTime(row.occurredAt)} error={errors.treatmentTime}><DateTimeInput value={time} onChange={setTime} /></Row>
                <Row label="Liều mỗi lần" current={row.dose} error={errors.dose}><DoseInput label="Liều mỗi lần" amount={amount} unit={unit} invalid={!!errors.dose} onAmount={setAmount} onUnit={setUnit} /></Row>
                <Row label="Đường dùng" current={row.route ? ROUTE_LABEL[row.route] : ''} error={errors.route}>
                  <Select aria-label="Đường dùng" value={route} onChange={(e) => setRoute(e.target.value as TreatmentRoute)}>{ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}</Select>
                </Row>
                <Row label="Ngưng sử dụng (ngày)" current={`${row.withdrawalDays} ngày`} error={errors.withdrawalDays}><input aria-label="Ngưng sử dụng (ngày)" inputMode="numeric" maxLength={3} value={wd} onChange={(e) => setWd(e.target.value)} className={inputCls} /></Row>
                <Row label="Người thực hiện" current={row.recordedBy} error={errors.performer}><input aria-label="Người thực hiện" list="cr-who" maxLength={100} value={who} onChange={(e) => setWho(e.target.value)} className={inputCls} /></Row>
              </>
            ) : (
              <>
                <Row label="Thời điểm quan sát" current={fmtDateTime(row.occurredAt)} error={errors.observedAt}><DateTimeInput value={time} onChange={setTime} /></Row>
                <Row label="Thân nhiệt (°C)" current={row.temperatureC !== null ? fmtTemp(row.temperatureC) : '—'} error={errors.temperatureC}><input aria-label="Thân nhiệt (°C)" inputMode="decimal" maxLength={4} value={temp} onChange={(e) => { setTemp(e.target.value); form.clearError('temperatureC') }} className={inputCls} /></Row>
                {row.type === 'FOLLOW_UP' && (
                  <Row label="Diễn biến" current={row.progress ? PROGRESS_LABEL[row.progress] : ''} error={errors.progress}>
                    <Select aria-label="Diễn biến" value={progress} onChange={(e) => setProgress(e.target.value as Progress)}>{PROGRESSES.map((p) => <option key={p} value={p}>{PROGRESS_LABEL[p]}</option>)}</Select>
                  </Row>
                )}
                <Row label={opening ? 'Dấu hiệu / mô tả' : 'Mô tả'} current={row.description} error={errors.description}><Textarea aria-label={opening ? 'Dấu hiệu / mô tả' : 'Mô tả'} rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></Row>
                <Row label="Người quan sát" current={row.recordedBy}><MemberSelect id="cr-observer" value={observerId} members={options.members} onChange={setObserverId} label="Người quan sát" keepLabel={`Giữ nguyên (${row.recordedBy || '—'})`} /></Row>
              </>
            )}
          </tbody>
        </Table>
      )}
      <datalist id="cr-who">{options.members.map((m) => <option key={m.id} value={m.name} />)}</datalist>
      {voiding
        ? <p className="m-0 text-sm text-ink">Bản ghi sẽ không còn trong diễn biến ca; ngưng thịt và trạng thái sức khỏe được tính lại. Lịch sử thay đổi vẫn được lưu.</p>
        : <Field label="Ghi chú" id="cr-reason" hint={hint(errors.reason, 'Không bắt buộc · tối đa 500 ký tự')}><Textarea id="cr-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
      {(treatment || voiding) && <Note tone={before !== after ? 'info' : 'grey'}>Ngưng thịt đến: {fmtDate(before)} → {fmtDate(after)} (tính lại khi lưu)</Note>}
      {tempCheck.dialog}
      {form.formError && <NoticeDialog message={form.formError} onClose={form.clearFormError} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={voiding ? 'danger' : 'primary'} onClick={save} disabled={form.saving}>{voiding ? 'Xóa' : 'Lưu'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
