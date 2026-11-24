import { useState, type FormEvent } from 'react'
import { Button, Field, Icon, inputCls, Note, Panel, Select, Textarea } from '../../../shared/ui'
import { TICKET_CATEGORIES } from '../domain/ticketRules'
import { DESCRIPTION_MAX, SUBJECT_MAX, validateCreate } from '../validation/ticketValidation'
import type { CreateTicketCommand, TicketCategory } from '../types'
import { FieldError } from './FieldError'

interface Props {
  activeFarmId: number | null
  initialCategory?: TicketCategory | ''
  /** Trả lỗi theo trường (khóa `_form` cho lỗi chung) hoặc null khi đã gửi được. */
  onSubmit: (cmd: CreateTicketCommand) => Promise<Record<string, string> | null>
  onCancel: () => void
}

/** SCR-65: nội dung yêu cầu. Ưu tiên NORMAL được hệ thống gán mặc định; CS chỉnh sau khi nhận. */
export function NewTicketForm({ activeFarmId, initialCategory = '', onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<CreateTicketCommand>({
    category: initialCategory,
    scope: 'FARM',
    farmId: activeFarmId,
    subject: '',
    description: '',
  })
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const set = (patch: Partial<CreateTicketCommand>) => setForm((f) => ({ ...f, ...patch }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const local = validateCreate(form, activeFarmId == null ? [] : [activeFarmId])
    setErrors(local)
    if (Object.keys(local).length > 0) return
    setSending(true)
    const remote = await onSubmit(form)
    setSending(false)
    if (remote) setErrors(remote)
  }

  return (
    <form onSubmit={submit} noValidate>
      <Panel title="Nội dung yêu cầu">
        <div className="flex flex-col gap-4">
          <div className="grid min-w-0 gap-4 @min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Field label="Danh mục *" id="tk-category">
              <Select id="tk-category" value={form.category} onChange={(e) => set({ category: e.target.value as TicketCategory | '' })}>
                <option value="">Danh mục</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.category}</FieldError>
            </Field>
            <Field label="Trang trại áp dụng">
              <div className="rounded-md border border-edge bg-page px-3 py-2.5 text-sm text-muted">Tự động gắn với trại bạn đang mở.</div>
            </Field>
          </div>
          <div>
            <Field label="Tiêu đề *" id="tk-subject" hint={`Tối đa ${SUBJECT_MAX} ký tự`}>
              <input id="tk-subject" className={inputCls} value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
              <FieldError>{errors.subject}</FieldError>
            </Field>
          </div>
          <div>
            <Field label="Mô tả chi tiết *" id="tk-description" hint={`Tối đa ${DESCRIPTION_MAX.toLocaleString('vi-VN')} ký tự`}>
              <Textarea id="tk-description" rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} />
              <FieldError>{errors.description}</FieldError>
            </Field>
          </div>
          <div>
            <label htmlFor="tk-evidence" className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-field bg-white px-3 py-2 text-xs font-semibold text-ink"><Icon name="upload" size={14} /> Đính kèm tệp
              <input id="tk-evidence" aria-label="Đính kèm tệp" type="file" accept="application/pdf,image/jpeg,image/png" multiple className="sr-only" onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []))} />
            </label>
            {evidenceFiles.length > 0 && (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0" aria-label="Tệp bằng chứng đã chọn">
                {evidenceFiles.map((file) => <li key={`${file.name}${file.lastModified}`} className="flex items-center gap-2 rounded-md bg-page px-3 py-2 text-xs text-ink"><Icon name="upload" size={14} /><span>{file.name}</span><span className="text-muted">· {Math.ceil(file.size / 1024)} KB</span></li>)}
              </ul>
            )}
          </div>
        </div>
        {errors._form && (
          <div className="mt-3">
            <Note tone="err">{errors._form}</Note>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 [&>button]:w-full @min-[440px]:[&>button]:w-auto">
          <Button type="button" size="bento" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" size="bento" disabled={sending}>
            <Icon name="send" size={16} /> Gửi yêu cầu
          </Button>
        </div>
      </Panel>
    </form>
  )
}
