import { useState } from 'react'
import { Button, Field, Icon, Note, Radio, Textarea } from '../../../shared/ui'
import { OUTCOME_LABEL } from '../domain/supportRules'
import type { Actor, CompleteCommand, InternalOutcome, RecipientInternalView } from '../types'
import { FieldError, useSubmit } from './common'
import { SupportError } from '../domain/supportRules'
import { useSupportCommands } from '../hooks/usePlatformSupportUseCase'

const OUTCOMES: InternalOutcome[] = ['CONFIRMED', 'NOT_CONFIRMED', 'NEED_MORE_INFO', 'OUT_OF_SCOPE']

/** Biểu mẫu gửi kết quả của PM/SA (UC-FE20-13); dùng inline và trong hộp thoại. */
export function ResultForm({ ir, me, simulateFailure, initialOutcome, onlyReasons, onDone, onSaveFailed }: {
  ir: RecipientInternalView
  me: Actor
  simulateFailure: boolean
  initialOutcome?: InternalOutcome
  /** Hộp thoại "Không xác nhận / Ngoài phạm vi": ẩn lựa chọn Đã xác nhận. */
  onlyReasons?: boolean
  onDone: (updated: RecipientInternalView) => void
  onSaveFailed: (cmd: CompleteCommand) => void
}) {
  const { completeInternal } = useSupportCommands()
  const [outcome, setOutcome] = useState<InternalOutcome | ''>(initialOutcome ?? '')
  const [resultNote, setResultNote] = useState('')
  const [errors, setErrors] = useState<{ outcome?: string; resultNote?: string }>({})
  const { busy, error, run } = useSubmit()
  const needsMoreInfo = outcome === 'NEED_MORE_INFO'
  const submit = () => {
    const next = {
      outcome: outcome ? undefined : 'Kết quả là bắt buộc.',
      resultNote: resultNote.trim() ? undefined : `${needsMoreInfo ? 'Nội dung cần bổ sung' : 'Ghi chú kết quả'} là bắt buộc.`,
    }
    setErrors(next)
    if (next.outcome || next.resultNote || !outcome) return
    const cmd: CompleteCommand = { outcome, resultNote: resultNote.trim(), expectedVersion: ir.version }
    void run(async () => {
      try {
        onDone(await completeInternal(me, ir.code, { ...cmd, simulateSaveFailure: simulateFailure }))
      } catch (e) {
        if (e instanceof SupportError && e.code === 'SAVE_FAILED_AFTER_DOMAIN') return onSaveFailed(cmd)
        throw e
      }
    })
  }
  return (
    <div className="flex flex-col gap-4">
      <Field label="Kết quả *">
        <div role="radiogroup" aria-label="Kết quả" className="flex flex-wrap gap-x-6 gap-y-2">
          {OUTCOMES.filter((o) => !(onlyReasons && o === 'CONFIRMED')).map((o) => (
            <Radio key={o} name={`outcome-${ir.code}`} checked={outcome === o} onChange={() => setOutcome(o)}>{OUTCOME_LABEL[o]}</Radio>
          ))}
        </div>
        <FieldError>{errors.outcome}</FieldError>
      </Field>
      <Field label={needsMoreInfo ? 'Nội dung cần bổ sung *' : 'Nội dung kết quả *'} id={`res-${ir.code}`}>
        <Textarea id={`res-${ir.code}`} rows={3} maxLength={2000} value={resultNote} onChange={(e) => setResultNote(e.target.value)} placeholder={needsMoreInfo ? 'Nêu rõ thông tin hoặc chứng từ còn thiếu' : 'Nêu ghi chú kết quả đã làm sạch'} />
        <FieldError>{errors.resultNote}</FieldError>
      </Field>
      {error && <Note tone="err">{error}</Note>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={busy}><Icon name="send" size={16} /> {needsMoreInfo ? 'Yêu cầu bổ sung thông tin' : 'Gửi kết quả & hoàn thành'}</Button>
      </div>
    </div>
  )
}
