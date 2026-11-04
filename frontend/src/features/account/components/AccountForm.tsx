import { useState } from 'react'
import { Button, Field, inputCls } from '../../../components/ui'
import type { AccountFieldSpec } from '../data/accountFixtures'

function fieldId(label: string) {
  return `account-${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`
}

function autoCompleteFor(field: AccountFieldSpec): string | undefined {
  if (field.kind === 'email') return 'email'
  if (field.kind === 'tel') return 'tel'
  if (field.kind === 'password') return field.label.toLowerCase().includes('mới') ? 'new-password' : 'current-password'
  if (field.label.toLowerCase().includes('họ và tên')) return 'name'
  return undefined
}

function maxLengthFor(field: AccountFieldSpec): number | undefined {
  if (field.maxLength) return field.maxLength
  if (field.kind === 'password') return 128
  if (field.kind === 'email') return 254
  if (field.kind === 'tel') return 30
  return undefined
}

function FieldControl({ field, disabled, value, error, onChange }: { field: AccountFieldSpec; disabled: boolean; value: string | boolean; error?: string; onChange: (value: string | boolean) => void }) {
  const id = fieldId(field.label)
  const [passwordVisible, setPasswordVisible] = useState(false)
  if (field.kind === 'checkbox') {
    return <div><label className="flex items-start gap-2 text-sm leading-5 text-ink"><input id={id} name={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} required={field.required} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="mt-1 size-4 accent-brand" /><span>{field.label}</span></label>{error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-err-fg">{error}</p>}</div>
  }
  if (field.kind === 'radio') {
    return <fieldset aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="flex flex-wrap gap-3"><legend className="mb-2 w-full text-xs font-semibold text-ink">{field.label}{field.required ? ' *' : ''}</legend>{field.options?.map((option) => <label key={option} className="flex items-center gap-2 text-sm text-ink"><input type="radio" name={id} value={option} checked={value === option} onChange={() => onChange(option)} disabled={disabled} required={field.required} className="size-4 accent-brand" />{option}</label>)}{error && <p id={`${id}-error`} role="alert" className="basis-full text-xs text-err-fg">{error}</p>}</fieldset>
  }
  const label = `${field.label}${field.required ? ' *' : ''}`
  if (field.kind === 'select') {
    return <Field id={id} label={label} hint={field.hint}><select id={id} name={id} className={inputCls} required={field.required} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} value={String(value)} onChange={(event) => onChange(event.target.value)}><option value="" disabled>Chọn {field.label.toLowerCase()}</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>{error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-err-fg">{error}</p>}</Field>
  }
  if (field.kind === 'textarea') {
    return <Field id={id} label={label} hint={field.hint}><textarea id={id} name={id} className={`${inputCls} min-h-24 resize-y`} required={field.required} disabled={disabled} maxLength={maxLengthFor(field)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} value={String(value)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />{error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-err-fg">{error}</p>}</Field>
  }
  return <Field id={id} label={label} hint={field.hint}><div className="relative"><input id={id} name={id} className={`${inputCls}${field.kind === 'password' ? ' pr-20' : ''}`} type={field.kind === 'password' && passwordVisible ? 'text' : field.kind ?? 'text'} required={field.required} readOnly={field.readOnly} disabled={disabled && !field.readOnly} maxLength={maxLengthFor(field)} autoComplete={autoCompleteFor(field)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} value={String(value)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? (field.readOnly ? undefined : `Nhập ${field.label.toLowerCase()}`)} />{field.kind === 'password' && <button type="button" className="absolute inset-y-0 right-3 text-xs font-semibold text-brand" onClick={() => setPasswordVisible((current) => !current)} disabled={disabled}>{passwordVisible ? 'Ẩn' : 'Hiện'}</button>}</div>{error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-err-fg">{error}</p>}</Field>
}

export function AccountForm({ fields, actionLabel, secondaryAction, readOnly = false, wide = false, primaryBlock = false, onSubmit, onSecondary, onFieldChange, validate }: {
  fields: AccountFieldSpec[]
  actionLabel: string
  secondaryAction?: string
  readOnly?: boolean
  wide?: boolean
  primaryBlock?: boolean
  onSubmit?: (values: Record<string, string | boolean>) => void
  onSecondary?: () => void
  onFieldChange?: (label: string, value: string | boolean) => void
  validate?: (values: Record<string, string | boolean>) => Record<string, string>
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => Object.fromEntries(fields.map((field) => [field.label, field.kind === 'checkbox' ? false : field.value ?? ''])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const validateForm = () => {
    const next: Record<string, string> = Object.fromEntries(fields.filter((field) => field.required && !values[field.label]).map((field) => [field.label, `${field.label} là bắt buộc.`]))
    for (const field of fields) {
      const value = String(values[field.label] ?? '').trim()
      if (!value) continue
      if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) next[field.label] = 'Email chưa đúng định dạng.'
      if (field.label === 'Họ và tên' && value.length < 2) next[field.label] = 'Họ và tên cần ít nhất 2 ký tự.'
      if (field.kind === 'tel' && !/^(?:\+84|0)\d{9}$/.test(value.replace(/[\s.-]/g, ''))) next[field.label] = 'Số điện thoại Việt Nam chưa đúng định dạng.'
    }
    Object.assign(next, validate?.(values) ?? {})
    setErrors(next)
    return Object.keys(next).length === 0
  }
  return <form className="w-full" noValidate onSubmit={(event) => { event.preventDefault(); if (validateForm()) onSubmit?.(values) }}><div className={wide ? 'grid gap-4 md:grid-cols-2' : 'flex max-w-xl flex-col gap-4'}>{fields.map((field) => <FieldControl key={field.label} field={field} error={errors[field.label]} value={values[field.label] ?? ''} onChange={(value) => { setValues((current) => ({ ...current, [field.label]: value })); setErrors((current) => ({ ...current, [field.label]: '' })); onFieldChange?.(field.label, value) }} disabled={readOnly} />)}</div>{!readOnly && <div className={`${wide ? '' : 'max-w-xl'} mt-5 flex flex-wrap justify-end gap-2`}>{secondaryAction && <Button type="button" onClick={onSecondary}>{secondaryAction}</Button>}<Button block={primaryBlock} variant="primary" type="submit">{actionLabel}</Button></div>}</form>
}
