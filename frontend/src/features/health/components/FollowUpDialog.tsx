import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, inputCls, Note, Textarea } from '../../../components/ui'
import { healthApi } from '../api/healthApi'
import { followUpToast } from '../domain/healthMessages'
import { fmtDate, PROGRESS_LABEL, PROGRESSES } from '../domain/healthFormat'
import { parseTemperature } from '../domain/healthRules'
import type { HealthCaseCard, HealthFormOptions, Progress } from '../types'
import { caseLine, DateTimeInput, hint, RadioGroup, ReadonlyBox, useDialogSave } from './healthUi'

export default function FollowUpDialog({ card, cattleCode, options, onClose, onSaved }: { card: HealthCaseCard; cattleCode: string; options: HealthFormOptions; onClose: () => void; onSaved: (message: string) => void }) {
  const [observedAt, setObservedAt] = useState(() => healthApi.now())
  const [temp, setTemp] = useState('')
  const [progress, setProgress] = useState<Progress | ''>('')
  const [description, setDescription] = useState('')
  const form = useDialogSave()
  const { errors } = form

  const save = () => form.run(async () => {
    await healthApi.recordFollowUp(card.id, { expectedVersion: card.version, observedAt, temperatureC: parseTemperature(temp), progress, description, observer: options.members[0] })
    onSaved(followUpToast(card.caseCode))
  })

  return (
    <Modal title="Ghi theo dõi" sub={`Ca ${card.caseCode} · mở ${fmtDate(card.openedDate)} · ${card.status === 'OPEN' ? `OPEN ngày ${card.day}` : `CHRONIC từ ${fmtDate(card.chronicSince)}`}`} width={600} onClose={onClose}>
      <Field label="Ca sức khỏe" id="fu-case"><ReadonlyBox id="fu-case" value={caseLine(card.caseCode, card.signs, cattleCode)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời điểm *" id="fu-time" hint={hint(errors.observedAt, 'Không trước lúc mở ca')}><DateTimeInput id="fu-time" value={observedAt} onChange={setObservedAt} /></Field>
        <Field label="Thân nhiệt" id="fu-temp" hint={hint(errors.temperatureC, '35,0 – 43,0 · không bắt buộc')}>
          <div className="relative"><input id="fu-temp" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} className={`${inputCls} pr-10`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">°C</span></div>
        </Field>
      </div>
      <Field label="Diễn biến *" hint={hint(errors.progress)}>
        <RadioGroup name="fu-progress" value={progress} onChange={setProgress} options={PROGRESSES.map((p) => ({ value: p, label: PROGRESS_LABEL[p] }))} />
      </Field>
      <Field label="Mô tả *" id="fu-desc" hint={hint(errors.description, 'Tối đa 1.000 ký tự')}><Textarea id="fu-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {form.formError && <Note tone="err">{form.formError}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={form.saving}>Lưu theo dõi</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
