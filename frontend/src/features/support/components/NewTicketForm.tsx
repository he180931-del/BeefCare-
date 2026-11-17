import { useState, type FormEvent } from 'react'
import { Button, Card, Field, inputCls, Note, Segmented, Select, Textarea } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { DESCRIPTION_MAX, requiredScopeForCategory, SUBJECT_MAX, TICKET_CATEGORIES, validateCreate } from '../domain/ticketRules'
import type { CreateTicketCommand, OwnedFarm, TicketCategory } from '../types'
import { FieldError } from './FieldError'

interface Props {
  farms: OwnedFarm[]
  initial: { category: TicketCategory | ''; farmId: number | null }
  /** Trả lỗi theo trường (khóa `_form` cho lỗi chung) hoặc null khi đã gửi được. */
  onSubmit: (cmd: CreateTicketCommand) => Promise<Record<string, string> | null>
  onCancel: () => void
}

/** SCR-65: nội dung yêu cầu. Ưu tiên NORMAL được hệ thống gán mặc định; CS chỉnh sau khi nhận. */
export function NewTicketForm({ farms, initial, onSubmit, onCancel }: Props) {
  const initialScope = requiredScopeForCategory(initial.category) ?? 'FARM'
  const [form, setForm] = useState<CreateTicketCommand>({
    category: initial.category,
    scope: initialScope,
    farmId: initialScope === 'ACCOUNT' ? null : initial.farmId,
    subject: '',
    description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const set = (patch: Partial<CreateTicketCommand>) => setForm((f) => ({ ...f, ...patch }))
  const isFarm = form.scope === 'FARM'
  const requiredScope = requiredScopeForCategory(form.category)

  const selectCategory = (category: TicketCategory | '') => {
    const categoryScope = requiredScopeForCategory(category)
    set({
      category,
      ...(categoryScope ? { scope: categoryScope } : {}),
      ...(categoryScope === 'ACCOUNT' ? { farmId: null } : {}),
    })
  }

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
          <div className="grid grid-cols-1 gap-3.5 sm:col-span-2 sm:grid-cols-[minmax(0,260px)_max-content_minmax(0,260px)] sm:justify-between">
            <Field label="Danh mục *" id="tk-category">
              <Select className="max-w-[260px]" id="tk-category" value={form.category} onChange={(e) => selectCategory(e.target.value as TicketCategory | '')}>
                <option value="">Danh mục</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <FieldError>{errors.category}</FieldError>
            </Field>
            <Field label="Phạm vi *">
              <Segmented
                options={[
                  { value: 'FARM', label: 'Trang trại', disabled: requiredScope === 'ACCOUNT' },
                  { value: 'ACCOUNT', label: 'Không gắn trại', disabled: requiredScope === 'FARM' },
                ]}
                className="!flex-nowrap !w-fit"
                value={form.scope}
                onChange={(scope) => set({
                  scope: scope as CreateTicketCommand['scope'],
                  farmId: scope === 'ACCOUNT' ? null : form.farmId,
                })}
              />
              {requiredScope === 'FARM' && <p className="m-0 text-xs text-muted">Danh mục này bắt buộc gắn với trang trại.</p>}
              <FieldError>{errors.scope}</FieldError>
            </Field>
            <Field label={isFarm ? 'Trang trại liên quan *' : 'Trang trại liên quan'} id="tk-farm">
              <Select className="max-w-[260px]" id="tk-farm" value={isFarm ? (form.farmId ?? '') : ''} disabled={!isFarm} onChange={(e) => set({ farmId: e.target.value ? Number(e.target.value) : null })}>
                {!isFarm && <option value="">Không có</option>}
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
