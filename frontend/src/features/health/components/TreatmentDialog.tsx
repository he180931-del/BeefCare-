import { useMemo, useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, inputCls, Note, Select, Textarea } from '../../../components/ui'
import { healthApi } from '../api/healthApi'
import { treatmentToast } from '../domain/healthMessages'
import { fmtDate, ROUTE_LABEL, ROUTES } from '../domain/healthFormat'
import { lastDoseDate, MSG, withdrawalEnd } from '../domain/healthRules'
import type { HealthCaseCard, HealthFormOptions, TreatmentRoute } from '../types'
import { caseLine, DateTimeInput, hint, ReadonlyBox, toIntOrNull, useDialogSave } from './healthUi'

export default function TreatmentDialog({ card, cattleCode, options, onClose, onSaved }: { card: HealthCaseCard; cattleCode: string; options: HealthFormOptions; onClose: () => void; onSaved: (message: string) => void }) {
  const medicines = useMemo(() => options.medicines.filter((m) => m.active), [options])
  const [medicineId, setMedicineId] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState<TreatmentRoute | ''>('')
  const [startAt, setStartAt] = useState(() => healthApi.now())
  const [course, setCourse] = useState('1')
  const [wd, setWd] = useState('')
  const [performer, setPerformer] = useState(options.members[0] ?? '')
  const [advice, setAdvice] = useState('')
  const form = useDialogSave()
  const { errors } = form
  const medicine = medicines.find((m) => String(m.id) === medicineId)

  // Chọn thuốc thì đề xuất liều, đường dùng và số ngày ngưng từ danh mục; người dùng vẫn sửa được.
  const pickMedicine = (id: string) => {
    setMedicineId(id)
    const m = medicines.find((x) => String(x.id) === id)
    if (m) { setDose(m.defaultDose); setRoute(m.route); setWd(String(m.withdrawalDays)) }
  }
  const courseN = toIntOrNull(course)
  const wdN = toIntOrNull(wd)
  const valid = startAt && courseN !== null && Number.isInteger(courseN) && courseN >= 1 && wdN !== null && Number.isInteger(wdN) && wdN >= 0
  const save = () => form.run(async () => {
    const r = await healthApi.recordTreatment(card.id, { expectedVersion: card.version, medicineId: medicine?.id ?? null, treatmentTime: startAt, dose, route, courseDays: courseN, withdrawalDays: wdN, performer, veterinaryAdvice: advice })
    onSaved(treatmentToast(r.withdrawalEndDate))
  })

  return (
    <Modal title="Ghi điều trị" sub={`Ca ${card.caseCode} · mở ${fmtDate(card.openedDate)} · ${card.status === 'OPEN' ? `OPEN ngày ${card.day}` : `CHRONIC từ ${fmtDate(card.chronicSince)}`}`} width={640} onClose={onClose}>
      <Field label="Ca sức khỏe" id="tr-case"><ReadonlyBox id="tr-case" value={caseLine(card.caseCode, card.signs, cattleCode)} /></Field>
      {card.status === 'CHRONIC' && <Note tone="info">{MSG.chronicNotice}</Note>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thuốc (danh mục trại) *" id="tr-medicine" hint={hint(errors.medicineId)}>
          <Select id="tr-medicine" value={medicineId} onChange={(e) => pickMedicine(e.target.value)}>
            <option value="">Chọn thuốc</option>
            {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Liều *" id="tr-dose" hint={hint(errors.dose, medicine?.doseNote ? `Tham chiếu: ${medicine.doseNote}` : undefined)}>
          <input id="tr-dose" value={dose} onChange={(e) => setDose(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Đường dùng *" id="tr-route" hint={hint(errors.route)}>
          <Select id="tr-route" value={route} onChange={(e) => setRoute(e.target.value as TreatmentRoute)}>
            <option value="">Chọn đường dùng</option>
            {ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Thời điểm bắt đầu *" id="tr-start" hint={hint(errors.treatmentTime)}><DateTimeInput id="tr-start" value={startAt} onChange={setStartAt} /></Field>
        <Field label="Liệu trình (ngày)" id="tr-course" hint={hint(errors.courseDays, '1 – 30 · cùng thuốc, liều, đường dùng mỗi ngày')}>
          <input id="tr-course" inputMode="numeric" value={course} onChange={(e) => setCourse(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Mũi cuối (tự tính)" id="tr-last"><ReadonlyBox id="tr-last" value={valid ? fmtDate(lastDoseDate(startAt, courseN!)) : '—'} /></Field>
        <Field label="Ngưng sử dụng (ngày)" id="tr-wd" hint={hint(errors.withdrawalDays, 'Lấy từ danh mục, có thể sửa')}>
          <input id="tr-wd" inputMode="numeric" value={wd} onChange={(e) => setWd(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Hết ngưng" id="tr-end"><ReadonlyBox id="tr-end" value={valid ? fmtDate(withdrawalEnd(startAt, courseN!, wdN!)) : '—'} /></Field>
      </div>
      <Field label="Người thực hiện" id="tr-performer" hint={hint(errors.performer, 'Hoặc nhập tên bác sĩ thú y bên ngoài')}>
        <input id="tr-performer" list="tr-performer-list" value={performer} onChange={(e) => setPerformer(e.target.value)} className={inputCls} />
        <datalist id="tr-performer-list">{options.members.map((m) => <option key={m} value={m} />)}</datalist>
      </Field>
      <Field label="Lời khuyên thú y" id="tr-advice" hint={hint(errors.veterinaryAdvice, 'Tối đa 500 ký tự')}><Textarea id="tr-advice" rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} /></Field>
      {form.formError && <Note tone="err">{form.formError}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={form.saving}>Lưu điều trị</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
