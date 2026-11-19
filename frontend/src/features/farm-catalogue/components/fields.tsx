import type { ReactNode } from 'react'
import { Badge, Radio, inputCls } from '../../../components/ui'

/** Lỗi thay chỗ gợi ý ngay dưới ô (MSG-COM-06, MSG-FE18-02, MSG-FE18-06). */
export const fieldError = (error: string | undefined, hint?: ReactNode): ReactNode =>
  error ? <span role="alert" className="text-err-fg">{error}</span> : hint

interface InputProps {
  id: string
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  invalid?: boolean
  placeholder?: string
  maxLength?: number
  upper?: boolean
}

export function TextInput({ id, value, onChange, readOnly, invalid, upper, ...rest }: InputProps) {
  return (
    <input
      id={id}
      className={inputCls}
      value={value}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
      {...rest}
    />
  )
}

/** Ô số có đơn vị ở cuối (ngày, tháng, kg…). Giữ dạng chữ để báo lỗi khi nhập không phải số. */
export function UnitInput({ unit, ...props }: InputProps & { unit: string }) {
  return (
    <div className="relative">
      <input
        id={props.id}
        className={`${inputCls} pr-14`}
        inputMode="decimal"
        value={props.value}
        readOnly={props.readOnly}
        aria-invalid={props.invalid || undefined}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
    </div>
  )
}

export function AvailabilityBadge({ available }: { available: boolean }) {
  return available ? <Badge tone="ok" icon="circle-check">Đang dùng</Badge> : <Badge tone="outline">Ngừng dùng</Badge>
}

/** Trạng thái sử dụng: Đang dùng / Ngừng dùng. Chỉ xem thì hiện huy hiệu. */
export function StatusField({ value, onChange, readOnly, label = 'Trạng thái sử dụng' }: { value: boolean; onChange: (value: boolean) => void; readOnly?: boolean; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink">{label}</span>
      {readOnly ? (
        <div><AvailabilityBadge available={value} /></div>
      ) : (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-5 gap-y-2">
          <Radio name="availability" checked={value} onChange={() => onChange(true)}>Đang dùng</Radio>
          <Radio name="availability" checked={!value} onChange={() => onChange(false)}>Ngừng dùng</Radio>
        </div>
      )}
    </div>
  )
}
