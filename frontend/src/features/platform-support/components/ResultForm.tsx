import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { useQuery } from '../../../hooks/useApi'
import { Button, Field, Note, Radio, Select, Textarea } from '../../../components/ui'
import { supportApi } from '../api/supportApi'
import { OUTCOME_LABEL } from '../domain/supportRules'
import type { Actor, CompleteCommand, InternalOutcome, InternalView } from '../types'
import { FieldError, useSubmit } from './common'
import { SupportError } from '../domain/supportRules'

const OUTCOMES: InternalOutcome[] = ['PERFORMED', 'UNABLE', 'OUTSIDE_DOMAIN']

/** Biểu mẫu gửi kết quả của PM/SA (UC-FE20-13); dùng inline và trong hộp thoại. */
export function ResultForm({ ir, me, simulateFailure, initialOutcome, onlyReasons, onDone, onSaveFailed }: {
  ir: InternalView
  me: Actor
  simulateFailure: boolean
  initialOutcome?: InternalOutcome
  /** Hộp thoại "Không thể thực hiện / Ngoài phạm vi": ẩn lựa chọn Đã thực hiện. */
  onlyReasons?: boolean
  onDone: (updated: InternalView) => void
  onSaveFailed: (cmd: CompleteCommand) => void
}) {
  const navigate = useNavigate()
  const { data: refs } = useQuery(() => supportApi.listDomainResults(me, ir.code), [ir.code, me])
  const [outcome, setOutcome] = useState<InternalOutcome | ''>(initialOutcome ?? '')
  const [result, setResult] = useState('')
  const [ref, setRef] = useState('')
  const [errors, setErrors] = useState<{ outcome?: string; result?: string; ref?: string }>({})
  const { busy, error, run } = useSubmit()
  const performed = outcome === 'PERFORMED'
  const submit = () => {
    const next = {
      outcome: outcome ? undefined : 'Kết quả là bắt buộc.',
      result: result.trim() ? undefined : 'Nội dung kết quả là bắt buộc.',
      ref: performed && !ref ? 'Đã thực hiện cần chọn kết quả đã lưu trong miền xử lý.' : undefined,
    }
    setErrors(next)
    if (next.outcome || next.result || next.ref || !outcome) return
    const cmd: CompleteCommand = { outcome, result: result.trim(), domainResultAuditId: performed ? Number(ref) : undefined, expectedVersion: ir.version }
    void run(async () => {
      try {
        onDone(await supportApi.completeInternal(me, ir.code, { ...cmd, simulateSaveFailure: simulateFailure }))
      } catch (e) {
        if (e instanceof SupportError && e.code === 'SAVE_FAILED_AFTER_DOMAIN') return onSaveFailed(cmd)
        throw e
      }
    })
  }
  const related = me.role === 'PM' ? { label: 'Mở bàn đối soát', to: '/nen-tang/thanh-toan' } : { label: 'Mở tài khoản', to: '/nen-tang/tai-khoan' }
  return (
    <div className="flex flex-col gap-4">
      <Field label="Kết quả *">
        <div role="radiogroup" aria-label="Kết quả" className="flex flex-wrap gap-x-6 gap-y-2">
          {OUTCOMES.filter((o) => !(onlyReasons && o === 'PERFORMED')).map((o) => (
            <Radio key={o} name={`outcome-${ir.code}`} checked={outcome === o} onChange={() => setOutcome(o)}>{OUTCOME_LABEL[o]}</Radio>
          ))}
        </div>
        <FieldError>{errors.outcome}</FieldError>
      </Field>
      <Field label="Nội dung kết quả *" id={`res-${ir.code}`}>
        <Textarea id={`res-${ir.code}`} rows={3} maxLength={2000} value={result} onChange={(e) => setResult(e.target.value)} placeholder={outcome === 'PERFORMED' ? 'Mô tả kết quả đã làm sạch' : 'Lý do (nhân viên hỗ trợ dùng để hướng dẫn khách)'} />
        <FieldError>{errors.result}</FieldError>
      </Field>
      {!onlyReasons && (
        <Field label="Tham chiếu kết quả đã thực hiện" id={`ref-${ir.code}`} hint='Chỉ dùng khi chọn "Đã thực hiện"'>
          <Select id={`ref-${ir.code}`} value={ref} disabled={!performed} onChange={(e) => setRef(e.target.value)}>
            <option value="">Chọn kết quả đã lưu trong miền xử lý</option>
            {(refs ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
          <FieldError>{errors.ref}</FieldError>
        </Field>
      )}
      <Note tone="grey">Kết quả gửi cho nhân viên hỗ trợ phụ trách {ir.from}. Chủ trại không thấy nội dung này.</Note>
      {error && <Note tone="err">{error}</Note>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => navigate(related.to)}>{related.label}</Button>
        <Button variant="primary" onClick={submit} disabled={busy}><Icon name="send" size={16} /> Gửi kết quả &amp; hoàn thành</Button>
      </div>
    </div>
  )
}
