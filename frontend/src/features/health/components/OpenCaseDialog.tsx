import { useState } from 'react'
import { Button, DateTimeInput, Field, inputCls, Modal, ModalButton, ModalFooter, Note, NoticeDialog, Select, Textarea } from '../../../shared/ui'
import { openedToast } from '../domain/healthMessages'
import { SEVERITIES, SEVERITY_LABEL, statusText } from '../domain/healthFormat'
import { parseTemperature } from '../validation/healthValidation'
import type { HealthCaseCard, HealthCattle, HealthFormOptions, Severity } from '../types'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import { cattleLine, hint, RadioGroup, ReadonlyBox, useDialogSave } from './healthUi'

interface Props {
  cattle: HealthCattle
  activeCases: HealthCaseCard[]
  options: HealthFormOptions
  onClose: () => void
  onSaved: (message: string) => void
  /** Chuyển sang "Cập nhật ca bệnh" của một ca đang có (D54). */
  onUpdateCase: (caseCode: string) => void
}

/**
 * Popup Mở ca: luôn mở ca mới cho một vấn đề mới (một con bò có thể có nhiều ca – GBR-45). Diễn biến của ca đang có
 * ghi qua "Cập nhật ca bệnh"; popup chỉ nhắc và dẫn sang đó (D54).
 */
export default function OpenCaseDialog({ cattle, activeCases, options, onClose, onSaved, onUpdateCase }: Props) {
  const { now, openCase } = useHealthCaseCommands()
  const [observedAt, setObservedAt] = useState(() => now())
  const [temp, setTemp] = useState('')
  const [signs, setSigns] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [contagious, setContagious] = useState('no')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [observer, setObserver] = useState(options.members[0] ?? '')
  const form = useDialogSave()
  const { errors } = form

  const save = () => form.run(async () => {
    const result = await openCase(cattle.code, {
      observedAt, observer, temperatureC: parseTemperature(temp), signs, diagnosis, suspectedContagious: contagious === 'yes', severity,
    })
    onSaved(openedToast(result))
  })

  return (
    <Modal title="Mở ca sức khỏe" width={640} onClose={onClose}>
      <Field label="Bò" id="hc-cattle"><ReadonlyBox id="hc-cattle" value={cattleLine(cattle)} /></Field>
      {activeCases.length > 0 && (
        <Note tone="info">
          <span>Bò đang có ca {activeCases.map((c) => `${c.caseCode} (${statusText(c.status, c.day, c.chronicSince)})`).join(', ')}. Diễn biến của ca đó ghi ở</span>{' '}
          {activeCases.map((c) => <Button key={c.id} type="button" variant="link" className="text-[13px]" onClick={() => onUpdateCase(c.caseCode)}>Cập nhật ca {c.caseCode}</Button>)}
        </Note>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời điểm quan sát *" id="hc-observed" hint={hint(errors.observedAt)}><DateTimeInput id="hc-observed" value={observedAt} onChange={setObservedAt} /></Field>
        <Field label="Thân nhiệt" id="hc-temp" hint={hint(errors.temperatureC, '35,0 – 43,0 · không bắt buộc')}>
          <div className="relative"><input id="hc-temp" inputMode="decimal" maxLength={4} value={temp} onChange={(e) => setTemp(e.target.value)} className={`${inputCls} pr-10`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">°C</span></div>
        </Field>
      </div>
      <Field label="Dấu hiệu / mô tả *" id="hc-signs" hint={hint(errors.signs, 'Tối đa 1.000 ký tự')}><Textarea id="hc-signs" rows={2} maxLength={1000} value={signs} onChange={(e) => setSigns(e.target.value)} /></Field>
      <Field label="Chẩn đoán nghi ngờ" id="hc-diagnosis" hint={hint(errors.diagnosis)}>
        <input id="hc-diagnosis" list="hc-diagnosis-list" maxLength={100} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputCls} />
        <datalist id="hc-diagnosis-list">{options.diagnoses.map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
      <Field label="Nghi truyền nhiễm – cách ly">
        <RadioGroup name="hc-contagious" value={contagious} onChange={setContagious} options={[{ value: 'no', label: 'Không' }, { value: 'yes', label: 'Có – cách ly, báo thú y' }]} />
      </Field>
      <Field label="Mức độ *" hint={hint(errors.severity)}>
        <RadioGroup name="hc-severity" value={severity} onChange={setSeverity} options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))} />
      </Field>
      <Field label="Người quan sát" id="hc-observer">
        <Select id="hc-observer" value={observer} onChange={(e) => setObserver(e.target.value)}>{options.members.map((m) => <option key={m}>{m}</option>)}</Select>
      </Field>
      {form.formError && <NoticeDialog message={form.formError} onClose={form.clearFormError} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={form.saving}>Mở ca</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
