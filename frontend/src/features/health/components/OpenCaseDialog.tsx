import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, inputCls, Note, Select, Textarea } from '../../../components/ui'
import { healthApi } from '../api/healthApi'
import { openedToast } from '../domain/healthMessages'
import { SEVERITIES, SEVERITY_LABEL, statusText } from '../domain/healthFormat'
import { MSG, parseTemperature } from '../domain/healthRules'
import type { HealthCaseCard, HealthCattle, HealthFormOptions, Severity } from '../types'
import { cattleLine, DateTimeInput, hint, RadioGroup, ReadonlyBox, useDialogSave } from './healthUi'

export default function OpenCaseDialog({ cattle, activeCases, options, onClose, onSaved }: { cattle: HealthCattle; activeCases: HealthCaseCard[]; options: HealthFormOptions; onClose: () => void; onSaved: (message: string) => void }) {
  const [observedAt, setObservedAt] = useState(() => healthApi.now())
  const [temp, setTemp] = useState('')
  const [signs, setSigns] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [contagious, setContagious] = useState('no')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [existingId, setExistingId] = useState('')
  const [observer, setObserver] = useState(options.members[0] ?? '')
  const form = useDialogSave()
  const { errors } = form

  const save = () => form.run(async () => {
    if (mode === 'existing' && !existingId) { form.setErrors({ existingCaseId: MSG.required('Ca sức khỏe') }); return }
    const existing = mode === 'existing' ? activeCases.find((c) => String(c.id) === existingId) : undefined
    const result = await healthApi.openCase(cattle.code, {
      existingCaseId: existing?.id, expectedVersion: existing?.version, observedAt, observer, temperatureC: parseTemperature(temp), signs, diagnosis, suspectedContagious: contagious === 'yes', severity,
    })
    onSaved(openedToast(result))
  })

  return (
    <Modal title="Mở ca sức khỏe" sub="Ghi quan sát bất thường và mở ca theo dõi" width={640} onClose={onClose}>
      <Field label="Bò" id="hc-cattle"><ReadonlyBox id="hc-cattle" value={cattleLine(cattle)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời điểm quan sát *" id="hc-observed" hint={hint(errors.observedAt)}><DateTimeInput id="hc-observed" value={observedAt} onChange={setObservedAt} /></Field>
        <Field label="Thân nhiệt" id="hc-temp" hint={hint(errors.temperatureC, '35,0 – 43,0 · không bắt buộc')}>
          <div className="relative"><input id="hc-temp" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} className={`${inputCls} pr-10`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">°C</span></div>
        </Field>
      </div>
      <Field label="Dấu hiệu / mô tả *" id="hc-signs" hint={hint(errors.signs, 'Tối đa 1.000 ký tự')}><Textarea id="hc-signs" rows={2} value={signs} onChange={(e) => setSigns(e.target.value)} /></Field>
      <Field label="Chẩn đoán nghi ngờ" id="hc-diagnosis" hint={hint(errors.diagnosis)}>
        <input id="hc-diagnosis" list="hc-diagnosis-list" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputCls} />
        <datalist id="hc-diagnosis-list">{options.diagnoses.map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
      <Field label="Nghi truyền nhiễm – cách ly">
        <RadioGroup name="hc-contagious" value={contagious} onChange={setContagious} options={[{ value: 'no', label: 'Không' }, { value: 'yes', label: 'Có – cách ly, báo thú y' }]} />
      </Field>
      <Field label="Mức độ *" hint={hint(errors.severity)}>
        <RadioGroup name="hc-severity" value={severity} onChange={setSeverity} options={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))} />
      </Field>
      <Field label="Ca sức khỏe *" hint={hint(errors.existingCaseId)}>
        <RadioGroup name="hc-mode" value={mode} onChange={setMode} options={activeCases.length ? [{ value: 'new', label: 'Mở ca mới' }, { value: 'existing', label: 'Nối vào ca đang có' }] : [{ value: 'new', label: 'Mở ca mới' }]} />
        {mode === 'existing' && (
          <Select aria-label="Chọn ca đang mở hoặc mạn tính" value={existingId} onChange={(e) => setExistingId(e.target.value)}>
            <option value="">Chọn ca đang mở hoặc mạn tính</option>
            {activeCases.map((c) => <option key={c.id} value={c.id}>{c.caseCode} · {c.signs} ({statusText(c.status, c.day, c.chronicSince)})</option>)}
          </Select>
        )}
      </Field>
      <Field label="Người quan sát" id="hc-observer">
        <Select id="hc-observer" value={observer} onChange={(e) => setObserver(e.target.value)}>{options.members.map((m) => <option key={m}>{m}</option>)}</Select>
      </Field>
      {form.formError && <Note tone="err">{form.formError}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={form.saving}>Lưu ghi nhận</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
