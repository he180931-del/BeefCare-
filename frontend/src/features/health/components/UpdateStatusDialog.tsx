import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Checkbox, Field, inputCls, Note, Select, Textarea } from '../../../components/ui'
import { healthApi } from '../api/healthApi'
import { statusToast } from '../domain/healthMessages'
import { fmtDate, OUTCOME_LABEL, PROGRESS_LABEL, PROGRESSES } from '../domain/healthFormat'
import { MSG } from '../domain/healthRules'
import type { CaseOutcome, HealthCaseCard, HealthCaseResult, HealthFormOptions, Progress, StatusAction } from '../types'
import { DateTimeInput, hint, RadioGroup, useDialogSave } from './healthUi'

const OUTCOMES: CaseOutcome[] = ['RECOVERED', 'DIED', 'MISSING']

export default function UpdateStatusDialog({ card, cattleCode, options, onClose, onSaved }: { card: HealthCaseCard; cattleCode: string; options: HealthFormOptions; onClose: () => void; onSaved: (message: string, result: HealthCaseResult) => void }) {
  const chronic = card.status === 'CHRONIC'
  const [progressText, setProgressText] = useState('')
  const [progress, setProgress] = useState<Progress | ''>('')
  const [diagnosis, setDiagnosis] = useState(card.diagnosis)
  const [contagious, setContagious] = useState(card.suspectedContagious)
  const [action, setAction] = useState<StatusAction>('KEEP')
  const [outcome, setOutcome] = useState<CaseOutcome | ''>('')
  const [closedAt, setClosedAt] = useState(() => healthApi.now())
  const [confirmedBy, setConfirmedBy] = useState(options.members[0] ?? '')
  const form = useDialogSave()
  const { errors } = form
  const closing = action === 'CLOSE'
  const lost = closing && (outcome === 'DIED' || outcome === 'MISSING')
  // D30: lưu thành lần theo dõi khi Giữ trạng thái (ô chữ bắt buộc theo Q1) hoặc khi ô chữ có nội dung.
  const keeping = action === 'KEEP'
  const needsProgress = keeping || progressText.trim() !== ''

  const save = () => {
    const missing: Record<string, string> = {}
    if (keeping && !progressText.trim()) missing.progressText = MSG.required('Diễn biến mới')
    if (needsProgress && !progress) missing.progress = MSG.required('Diễn biến')
    if (Object.keys(missing).length) { form.setErrors(missing); return }
    return form.run(async () => {
      const result = await healthApi.updateStatus(card.id, { expectedVersion: card.version, action, progressText, progress: needsProgress ? progress : '', diagnosis, suspectedContagious: contagious, outcome, closedAt: closing ? closedAt : undefined, confirmedBy })
      onSaved(statusToast(result), result)
    })
  }

  return (
    <Modal title={`Cập nhật ca ${card.caseCode}`} sub={`${cattleCode} · mở ${fmtDate(card.openedDate)} · đang ${chronic ? `CHRONIC từ ${fmtDate(card.chronicSince)}` : `OPEN ngày ${card.day}`}`} width={640} onClose={onClose}>
      <Field label={keeping ? 'Diễn biến mới *' : 'Diễn biến mới'} id="us-progress" hint={hint(errors.progressText, 'Được lưu thành 1 lần theo dõi')}><Textarea id="us-progress" rows={2} value={progressText} onChange={(e) => setProgressText(e.target.value)} /></Field>
      <Field label={needsProgress ? 'Diễn biến *' : 'Diễn biến'} hint={hint(errors.progress, needsProgress ? undefined : 'Chỉ cần khi có diễn biến mới')}>
        <RadioGroup name="us-progress-kind" ariaLabel="Diễn biến" value={progress} onChange={setProgress} options={PROGRESSES.map((p) => ({ value: p, label: PROGRESS_LABEL[p] }))} />
      </Field>
      <Field label="Chẩn đoán nghi ngờ" id="us-diagnosis" hint={hint(errors.diagnosis)}>
        <input id="us-diagnosis" list="us-diagnosis-list" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputCls} />
        <datalist id="us-diagnosis-list">{options.diagnoses.map((d) => <option key={d} value={d} />)}</datalist>
        <Checkbox checked={contagious} onChange={(e) => setContagious(e.target.checked)} className="mt-1 text-[13px]">Nghi truyền nhiễm – cách ly</Checkbox>
      </Field>
      <Field label="Trạng thái ca *">
        <RadioGroup name="us-action" value={action} onChange={setAction} options={[
          { value: 'KEEP', label: chronic ? 'Giữ mạn tính' : 'Giữ OPEN' },
          chronic ? { value: 'TO_OPEN', label: 'Quay lại OPEN' } : { value: 'TO_CHRONIC', label: 'Chuyển theo dõi mạn tính' },
          { value: 'CLOSE', label: 'Đóng ca' },
        ]} />
      </Field>
      {closing && (
        <>
          <Field label="Kết quả *" hint={hint(errors.outcome)}>
            <RadioGroup name="us-outcome" value={outcome} onChange={setOutcome} options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thời điểm đóng *" id="us-closed" hint={hint(errors.closedAt, 'Không trước lần ghi gần nhất')}><DateTimeInput id="us-closed" value={closedAt} onChange={setClosedAt} /></Field>
            <Field label="Người xác nhận" id="us-confirm">
              <Select id="us-confirm" value={confirmedBy} onChange={(e) => setConfirmedBy(e.target.value)}>{options.members.map((m) => <option key={m}>{m}</option>)}</Select>
            </Field>
          </div>
        </>
      )}
      {lost && (
        <Note tone="err">
          Ca sẽ được đóng với kết quả {OUTCOME_LABEL[outcome as CaseOutcome]}. Hệ thống tạo phiếu xuất "Chết / mất" ở trạng thái chờ để Chủ trại hoàn tất; {cattleCode} vẫn ở trong đàn đến khi Chủ trại xác nhận. Thao tác này không hoàn tác được.
        </Note>
      )}
      {form.formError && <Note tone="err">{form.formError}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={lost ? 'danger' : 'primary'} onClick={save} disabled={form.saving}>{lost ? 'Xác nhận đóng ca' : 'Lưu cập nhật'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
