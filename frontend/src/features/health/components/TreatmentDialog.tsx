import { useMemo, useState } from 'react'
import { Checkbox, DateTimeInput, DoseInput, Field, inputCls, Modal, ModalButton, ModalFooter, NoticeDialog, Select, Textarea } from '../../../shared/ui'
import { treatmentToast } from '../domain/healthMessages'
import { caseLabel, fmtDate, ROUTE_LABEL, ROUTES, statusText } from '../domain/healthFormat'
import { lastDoseDate, withdrawalEnd } from '../domain/healthRules'
import type { HealthCaseCard, HealthFormOptions, TreatmentRoute } from '../types'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import { joinDose, parseDoseAmount, splitDose, type DoseUnit } from '../../../shared/lib/dose'
import { caseLine, hint, ReadonlyBox, toIntOrNull, useCurrentMember, useDialogSave } from './healthUi'

const DOSE_INVALID = 'Liều phải là số lớn hơn 0.'
/** Tổng lượng của cả đợt, viết theo kiểu Việt Nam (dấu phẩy thập phân). */
const totalDose = (amount: number, days: number, unit: DoseUnit) => `${(Math.round(amount * days * 100) / 100).toLocaleString('vi-VN')} ${unit}`

export default function TreatmentDialog({ card, cattleCode, options, onClose, onSaved }: { card: HealthCaseCard; cattleCode: string; options: HealthFormOptions; onClose: () => void; onSaved: (message: string) => void }) {
  const { now, recordTreatment } = useHealthCaseCommands()
  const medicines = useMemo(() => options.medicines.filter((m) => m.active), [options])
  const [medicineId, setMedicineId] = useState('')
  // D65: liều = số + đơn vị cho mỗi lần dùng; lưu chuỗi "30 ml".
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<DoseUnit>('ml')
  const [route, setRoute] = useState<TreatmentRoute | ''>('')
  const [startAt, setStartAt] = useState(() => now())
  const [course, setCourse] = useState('1')
  const [wd, setWd] = useState('')
  const me = useCurrentMember(options.members)
  const [performer, setPerformer] = useState(me?.name ?? '')
  const [advice, setAdvice] = useState('')
  // D59: ca theo dõi dài hạn mặc định về Đang mở như GBR-45; bỏ chọn khi chỉ là điều trị duy trì.
  const longTerm = card.status === 'CHRONIC'
  const [returnToOpen, setReturnToOpen] = useState(true)
  const form = useDialogSave()
  const { errors } = form
  const medicine = medicines.find((m) => String(m.id) === medicineId)

  const reference = splitDose(medicine?.defaultDose)
  // Chọn thuốc thì đề xuất liều, đường dùng và số ngày ngưng từ danh mục; người dùng vẫn sửa được. Danh mục chưa có
  // đường dùng thì để trống cho người dùng chọn (không tự điền "Khác").
  const pickMedicine = (id: string) => {
    setMedicineId(id)
    const m = medicines.find((x) => String(x.id) === id)
    if (!m) return
    const ref = splitDose(m.defaultDose)
    setAmount(ref.amount); setUnit(ref.unit); setRoute(m.route); setWd(String(m.withdrawalDays))
  }
  // Liều tham chiếu chỉ đúng với đường dùng của thuốc trong danh mục: đổi sang đường khác thì bỏ liều đã điền sẵn.
  const otherRoute = !!medicine?.route && !!route && route !== medicine.route
  const pickRoute = (next: TreatmentRoute | '') => {
    setRoute(next)
    if (medicine?.route && next !== medicine.route && amount === reference.amount && unit === reference.unit) setAmount('')
  }
  const dose = joinDose(amount, unit)
  const amountN = parseDoseAmount(amount)
  const doseHint = otherRoute
    ? `Liều tham chiếu chỉ áp cho ${ROUTE_LABEL[medicine!.route as TreatmentRoute]}; nhập liều theo hướng dẫn.`
    : reference.legacy ? `Liều tham chiếu: ${medicine!.defaultDose}` : 'Lượng cho mỗi lần dùng'
  const courseN = toIntOrNull(course)
  const wdN = toIntOrNull(wd)
  const valid = startAt && courseN !== null && Number.isInteger(courseN) && courseN >= 1 && wdN !== null && Number.isInteger(wdN) && wdN >= 0
  const save = () => {
    if (Number.isNaN(amountN)) { form.setErrors({ dose: DOSE_INVALID }); return }
    void submit()
  }
  const submit = () => form.run(async () => {
    const r = await recordTreatment(card.id, { expectedVersion: card.version, medicineId: medicine?.id ?? null, treatmentTime: startAt, dose, route, courseDays: courseN, withdrawalDays: wdN, performer, veterinaryAdvice: advice, returnToOpen: longTerm ? returnToOpen : undefined })
    onSaved(treatmentToast(r.withdrawalEndDate))
  })

  return (
    <Modal title="Ghi điều trị" sub={`Ca ${card.caseCode} · mở ${fmtDate(card.openedDate)} · ${statusText(card.status, card.day, card.chronicSince)}`} width={640} onClose={onClose}>
      <Field label="Ca sức khỏe" id="tr-case"><ReadonlyBox id="tr-case" value={caseLine(card.caseCode, caseLabel(card), cattleCode)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thuốc (danh mục trại) *" id="tr-medicine" hint={hint(errors.medicineId, medicine?.doseNote ? `Ghi chú thuốc: ${medicine.doseNote}` : undefined)}>
          <Select id="tr-medicine" value={medicineId} onChange={(e) => pickMedicine(e.target.value)}>
            <option value="">Chọn thuốc</option>
            {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Liều mỗi lần *" id="tr-dose" hint={hint(errors.dose, doseHint)}>
          <DoseInput id="tr-dose" amount={amount} unit={unit} invalid={!!errors.dose} onAmount={(v) => { setAmount(v); form.clearError('dose') }} onUnit={setUnit} />
        </Field>
        <Field label="Đường dùng *" id="tr-route" hint={hint(errors.route)}>
          <Select id="tr-route" value={route} onChange={(e) => pickRoute(e.target.value as TreatmentRoute | '')}>
            <option value="">Chọn đường dùng</option>
            {ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Thời điểm bắt đầu *" id="tr-start" hint={hint(errors.treatmentTime)}><DateTimeInput id="tr-start" value={startAt} onChange={setStartAt} /></Field>
        <Field label="Số ngày dùng (mỗi ngày 1 lần)" id="tr-course" hint={hint(errors.courseDays, valid && amountN && courseN! > 1 ? `Tổng: ${dose} × ${courseN} ngày = ${totalDose(amountN, courseN!, unit)}` : '1 – 30 ngày')}>
          <input id="tr-course" inputMode="numeric" maxLength={2} value={course} onChange={(e) => setCourse(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Ngày dùng cuối" id="tr-last"><ReadonlyBox id="tr-last" value={valid ? fmtDate(lastDoseDate(startAt, courseN!)) : '—'} /></Field>
        <Field label="Ngưng sử dụng (ngày)" id="tr-wd" hint={hint(errors.withdrawalDays)}>
          <input id="tr-wd" inputMode="numeric" maxLength={3} value={wd} onChange={(e) => setWd(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Hết ngưng" id="tr-end"><ReadonlyBox id="tr-end" value={valid ? fmtDate(withdrawalEnd(startAt, courseN!, wdN!)) : '—'} /></Field>
      </div>
      <Field label="Người thực hiện" id="tr-performer" hint={hint(errors.performer, 'Hoặc nhập tên người ngoài')}>
        <input id="tr-performer" list="tr-performer-list" maxLength={100} value={performer} onChange={(e) => setPerformer(e.target.value)} className={inputCls} />
        <datalist id="tr-performer-list">{options.members.map((m) => <option key={m.id} value={m.name} />)}</datalist>
      </Field>
      {longTerm && (
        <Checkbox checked={returnToOpen} onChange={(e) => setReturnToOpen(e.target.checked)} className="text-[13px]">
          Chuyển ca về Đang mở (bỏ chọn nếu chỉ điều trị duy trì)
        </Checkbox>
      )}
      <Field label="Ghi chú" id="tr-advice" hint={hint(errors.veterinaryAdvice, 'Tối đa 500 ký tự')}><Textarea id="tr-advice" rows={2} maxLength={500} placeholder="Ví dụ: lời dặn của thú y, phản ứng sau dùng thuốc" value={advice} onChange={(e) => setAdvice(e.target.value)} /></Field>
      {form.formError && <NoticeDialog message={form.formError} onClose={form.clearFormError} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={form.saving}>Lưu điều trị</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
