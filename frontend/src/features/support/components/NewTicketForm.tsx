import { useState, type FormEvent } from 'react'
import { Button, Field, Icon, inputCls, Note, Panel, Segmented, Select, Textarea } from '../../../shared/ui'
import { requiredScopeForCategory, TICKET_CATEGORIES } from '../domain/ticketRules'
import { DESCRIPTION_MAX, SUBJECT_MAX, validateCreate } from '../validation/ticketValidation'
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
      <Panel title="Nội dung yêu cầu">
        <div className="flex flex-col gap-4">
          <div className="grid min-w-0 gap-4 @min-[480px]:grid-cols-2 @min-[680px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
            <Field label="Danh mục *" id="tk-category">
              <Select id="tk-category" value={form.category} onChange={(e) => selectCategory(e.target.value as TicketCategory | '')}>
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
                className="grid! w-full grid-cols-2 [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:whitespace-normal [&>button]:px-2"
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
              <Select id="tk-farm" value={isFarm ? (form.farmId ?? '') : ''} disabled={!isFarm} onChange={(e) => set({ farmId: e.target.value ? Number(e.target.value) : null })}>
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
