import { useState, type FormEvent } from 'react'
import { Button, Card, Field, inputCls, Note, Segmented, Select, Textarea } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { DESCRIPTION_MAX, SUBJECT_MAX, TICKET_CATEGORIES, validateCreate } from '../domain/ticketRules'
import type { CreateTicketCommand, OwnedFarm, TicketCategory } from '../types'
import { FieldError } from './FieldError'

interface Props {
  farms: OwnedFarm[]
  initial: { category: TicketCategory | ''; farmId: number | null }
  /** Trả lỗi theo trường (khóa `_form` cho lỗi chung) hoặc null khi đã gửi được. */
  onSubmit: (cmd: CreateTicketCommand) => Promise<Record<string, string> | null>
  onCancel: () => void
}

/** SCR-65: nội dung yêu cầu. Ưu tiên chỉ đọc vì do bộ phận hỗ trợ gán (GBR-76). */
export function NewTicketForm({ farms, initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<CreateTicketCommand>({ category: initial.category, scope: 'FARM', farmId: initial.farmId, subject: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const set = (patch: Partial<CreateTicketCommand>) => setForm((f) => ({ ...f, ...patch }))
  const isFarm = form.scope === 'FARM'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const local = validateCreate(form, farms.map((f) => f.id))
    setErrors(local)
    if (Object.keys(local).length > 0) return
    setSending(true)
    const remote = await onSubmit(form)
    setSending(false)
    if (remote) setErrors(remote)
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card title="Nội dung yêu cầu">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Danh mục *" id="tk-category">
            <Select id="tk-category" value={form.category} onChange={(e) => set({ category: e.target.value as TicketCategory | '' })}>
              <option value="">Chọn danh mục</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <FieldError>{errors.category}</FieldError>
          </Field>
          <Field label="Ưu tiên" id="tk-priority">
            <Select id="tk-priority" value="NORMAL" disabled>
              <option value="NORMAL">Bình thường</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Phạm vi *">
              <Segmented
                options={[
                  { value: 'FARM', label: 'Trang trại' },
                  { value: 'ACCOUNT', label: 'Vấn đề tài khoản (không gắn trại)' },
                ]}
                value={form.scope}
                onChange={(scope) => set({ scope: scope as CreateTicketCommand['scope'] })}
              />
              <FieldError>{errors.scope}</FieldError>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Trang trại liên quan" id="tk-farm">
              <Select id="tk-farm" value={isFarm ? (form.farmId ?? '') : ''} disabled={!isFarm} onChange={(e) => set({ farmId: e.target.value ? Number(e.target.value) : null })}>
                {!isFarm && <option value="">Không gắn trang trại</option>}
                {isFarm && <option value="">Chọn trang trại</option>}
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.farmId}</FieldError>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Tiêu đề *" id="tk-subject" hint={`Tối đa ${SUBJECT_MAX} ký tự`}>
              <input id="tk-subject" className={inputCls} value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
              <FieldError>{errors.subject}</FieldError>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Mô tả chi tiết *" id="tk-description" hint={`Tối đa ${DESCRIPTION_MAX.toLocaleString('vi-VN')} ký tự`}>
              <Textarea id="tk-description" rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} />
              <FieldError>{errors.description}</FieldError>
            </Field>
          </div>
        </div>
        {errors._form && (
          <div className="mt-3">
            <Note tone="err">{errors._form}</Note>
          </div>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <Button type="button" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" disabled={sending}>
            <Icon name="send" size={16} /> Gửi yêu cầu
          </Button>
        </div>
      </Card>
    </form>
  )
}
