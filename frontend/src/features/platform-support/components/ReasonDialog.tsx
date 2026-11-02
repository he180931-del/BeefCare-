import { useState, type ReactNode } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon, type IconName } from '../../../components/Icon'
import { Field, Note, Textarea, inputCls } from '../../../components/ui'
import { FieldError, useSubmit } from './common'

/** Hộp thoại một ô văn bản bắt buộc (lý do, câu hỏi công khai, ghi chú...). */
export function ReasonDialog({
  title, label, placeholder, max = 1000, submitLabel, submitIcon, note, noteTone = 'info', warn, readOnly, secondary, blocked, onSubmit, onClose,
}: {
  title: string
  label: string
  placeholder?: string
  max?: number
  submitLabel: string
  submitIcon?: IconName
  note?: ReactNode
  noteTone?: 'info' | 'warn' | 'grey'
  warn?: ReactNode
  readOnly?: { label: string; value: string }
  secondary?: { label: string; onClick: () => void }
  /** Khóa nút gửi (ví dụ còn yêu cầu nội bộ đang mở). */
  blocked?: boolean
  onSubmit: (text: string) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { busy, error, run } = useSubmit()
  const fieldLabel = label.replace(/ \*$/, '')
  const submit = () => {
    const v = text.trim()
    if (!v) return setFieldError(`${fieldLabel} là bắt buộc.`)
    if (v.length > max) return setFieldError(`${fieldLabel} tối đa ${max} ký tự.`)
    setFieldError(null)
    void run(() => onSubmit(v))
  }
  return (
    <Modal title={title} width={640} onClose={onClose}>
      {readOnly && <Field label={readOnly.label} id="rd-ro"><input id="rd-ro" className={inputCls} readOnly value={readOnly.value} /></Field>}
      <Field label={label} id="rd-text">
        <Textarea id="rd-text" rows={3} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} aria-invalid={!!fieldError} />
        <FieldError>{fieldError}</FieldError>
      </Field>
      {warn && <Note tone="warn">{warn}</Note>}
      {note && <Note tone={noteTone}>{note}</Note>}
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
        {secondary && <ModalButton onClick={secondary.onClick}>{secondary.label}</ModalButton>}
        <ModalButton variant="primary" onClick={submit} disabled={busy || blocked}>{submitIcon && <Icon name={submitIcon} size={16} />} {submitLabel}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
