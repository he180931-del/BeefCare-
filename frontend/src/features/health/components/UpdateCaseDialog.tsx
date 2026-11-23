import { useState } from 'react'
import { Checkbox, Field, inputCls, Modal, ModalButton, ModalFooter, Note, NoticeDialog, Select, Textarea } from '../../../shared/ui'
import { statusToast } from '../domain/healthMessages'
import { fmtDate, OUTCOME_LABEL, PROGRESS_LABEL, PROGRESSES } from '../domain/healthFormat'
import { hasFollowUp, parseTemperature } from '../validation/healthValidation'
import type { CaseOutcome, HealthCaseCard, HealthCaseResult, HealthFormOptions, Progress, StatusAction } from '../types'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import { caseLine, DateTimeInput, hint, RadioGroup, ReadonlyBox, useDialogSave } from './healthUi'

const OUTCOMES: CaseOutcome[] = ['RECOVERED', 'DIED', 'MISSING']

interface Props {
  card: HealthCaseCard
  cattleCode: string
  options: HealthFormOptions
  onClose: () => void
  onSaved: (message: string, result: HealthCaseResult) => void
}

/**
 * Popup "Cập nhật ca bệnh" (D54): gộp ghi theo dõi và đổi trạng thái ca thành một lần cập nhật, cùng một thời điểm.
 * Giữ trạng thái thì phần theo dõi bắt buộc; đổi trạng thái thì phần theo dõi tùy chọn (có nhập ô nào thì cần đủ diễn
 * biến và mô tả). Lỗi nhập liệu hiện dưới ô, lỗi điều kiện hiện popup (D49).
 */
export default function UpdateCaseDialog({ card, cattleCode, options, onClose, onSaved }: Props) {
  const { now, updateStatus } = useHealthCaseCommands()
  const chronic = card.status === 'CHRONIC'
  const [observedAt, setObservedAt] = useState(() => now())
  const [temp, setTemp] = useState('')
  const [progress, setProgress] = useState<Progress | ''>('')
  const [description, setDescription] = useState('')
  const [diagnosis, setDiagnosis] = useState(card.diagnosis)
  const [contagious, setContagious] = useState(card.suspectedContagious)
  const [action, setAction] = useState<StatusAction>('KEEP')
  const [outcome, setOutcome] = useState<CaseOutcome | ''>('')
  const [confirmedBy, setConfirmedBy] = useState(options.members[0] ?? '')
  const form = useDialogSave()
  const { errors } = form
  const temperatureC = parseTemperature(temp)
  const closing = action === 'CLOSE'
  const lost = closing && (outcome === 'DIED' || outcome === 'MISSING')
  const followUpRequired = hasFollowUp({ action, description, progress, temperatureC })

  const save = () => form.run(async () => {
    const result = await updateStatus(card.id, {
      expectedVersion: card.version, action, observedAt, temperatureC, progress, description, diagnosis, suspectedContagious: contagious, outcome, confirmedBy,
    })
    onSaved(statusToast(result), result)
  })

  const mark = (label: string) => (followUpRequired ? `${label} *` : label)
  return (
    <Modal title="Cập nhật ca bệnh" sub={`Ca ${card.caseCode} · mở ${fmtDate(card.openedDate)} · ${chronic ? `mạn tính từ ${fmtDate(card.chronicSince)}` : `ngày ${card.day}`}`} width={640} onClose={onClose}>
      <Field label="Ca sức khỏe" id="uc-case"><ReadonlyBox id="uc-case" value={caseLine(card.caseCode, card.signs, cattleCode)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời điểm *" id="uc-time" hint={hint(errors.observedAt)}><DateTimeInput id="uc-time" value={observedAt} onChange={setObservedAt} /></Field>
        <Field label="Thân nhiệt" id="uc-temp" hint={hint(errors.temperatureC, '35,0 – 43,0')}>
          <div className="relative"><input id="uc-temp" inputMode="decimal" maxLength={4} value={temp} onChange={(e) => setTemp(e.target.value)} className={`${inputCls} pr-10`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">°C</span></div>
        </Field>
      </div>
      <Field label={mark('Diễn biến')} hint={hint(errors.progress)}>
        <RadioGroup name="uc-progress" ariaLabel="Diễn biến" value={progress} onChange={setProgress} options={PROGRESSES.map((p) => ({ value: p, label: PROGRESS_LABEL[p] }))} />
      </Field>
      <Field label={mark('Mô tả')} id="uc-desc" hint={hint(errors.description, 'Tối đa 1.000 ký tự')}>
        <Textarea id="uc-desc" rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Chẩn đoán nghi ngờ" id="uc-diagnosis" hint={hint(errors.diagnosis)}>
        <input id="uc-diagnosis" list="uc-diagnosis-list" maxLength={100} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputCls} />
        <datalist id="uc-diagnosis-list">{options.diagnoses.map((d) => <option key={d} value={d} />)}</datalist>
        <Checkbox checked={contagious} onChange={(e) => setContagious(e.target.checked)} className="mt-1 text-[13px]">Nghi truyền nhiễm – cách ly</Checkbox>
      </Field>
      <Field label="Trạng thái ca *">
        <RadioGroup name="uc-action" ariaLabel="Trạng thái ca" value={action} onChange={setAction} options={[
          { value: 'KEEP', label: chronic ? 'Giữ mạn tính' : 'Giữ đang mở' },
          chronic ? { value: 'TO_OPEN', label: 'Mở lại' } : { value: 'TO_CHRONIC', label: 'Chuyển mạn tính' },
          { value: 'CLOSE', label: 'Đóng ca' },
        ]} />
      </Field>
      {closing && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kết quả *" hint={hint(errors.outcome)}>
            <RadioGroup name="uc-outcome" ariaLabel="Kết quả" value={outcome} onChange={setOutcome} options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} />
          </Field>
          <Field label="Người xác nhận" id="uc-confirm">
            <Select id="uc-confirm" value={confirmedBy} onChange={(e) => setConfirmedBy(e.target.value)}>{options.members.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
        </div>
      )}
      {lost && <Note tone="err">Hệ thống tạo phiếu xuất "Chết / mất" chờ Chủ trại xác nhận; {cattleCode} vẫn trong đàn đến lúc đó.</Note>}
      {form.formError && <NoticeDialog message={form.formError} onClose={form.clearFormError} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={lost ? 'danger' : 'primary'} onClick={save} disabled={form.saving}>{lost ? 'Xác nhận đóng ca' : 'Lưu cập nhật'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
