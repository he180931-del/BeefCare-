import { useRef, type ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import { Field, Radio, Select, inputCls } from '../../../components/ui'
import { REPRODUCTION_EXTERNAL_PEOPLE, REPRODUCTION_MEMBERS } from '../data/reproductionMock'
import type { DataSource } from '../types'
import { reproductionNow } from '../domain/reproductionClock'

export const SOURCE_OPTIONS: Array<[DataSource, string]> = [
  ['DIRECT_OBSERVATION', 'Quan sát trực tiếp'], ['FARM_NOTEBOOK', 'Sổ trại'], ['EXTERNAL_REPORT', 'Báo cáo bên ngoài'],
]
export const SOURCE_LABEL: Record<DataSource, string> = Object.fromEntries(SOURCE_OPTIONS) as Record<DataSource, string>
export const SOURCE_HINT = 'Mặc định quan sát trực tiếp · đổi khi ghi từ sổ / báo cáo ngoài'
export const RESULT_OPTIONS: Array<[string, string]> = [['PREGNANT', 'Có thai'], ['NOT_PREGNANT', 'Không có thai'], ['INCONCLUSIVE', 'Chưa xác định']]
export const CHECK_METHOD_OPTIONS: Array<[string, string]> = [['ULTRASOUND', 'Siêu âm'], ['RECTAL', 'Khám trực tràng'], ['OTHER', 'Khác']]
export const UPDATE_TYPE_OPTIONS: Array<[string, string]> = [['OBSERVATION', 'Theo dõi'], ['COMPLICATION', 'Biến chứng'], ['LOSS', 'Sẩy thai']]
export const COURSE_OPTIONS: Array<[string, string]> = [['NORMAL', 'Bình thường'], ['ASSISTED', 'Can thiệp'], ['CAESAREAN', 'Mổ đẻ']]
export const DAM_CONDITION_OPTIONS: Array<[string, string]> = [['GOOD', 'Tốt'], ['MONITORING', 'Cần theo dõi'], ['CRITICAL', 'Nguy kịch']]
export const SIGNS = ['Đứng yên cho nhảy', 'Chảy dịch nhờn trong', 'Nhảy lên con khác', 'Kêu rống', 'Âm hộ sưng đỏ']

export const nowLocal = reproductionNow

/** Label without the required marker, used as the control's accessible name. */
export const plain = (label: string): string => label.replace(/ \*$/, '')

export function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <Field label={label} id={`ro-${plain(label)}`} hint={hint}>
      <input id={`ro-${plain(label)}`} aria-label={plain(label)} readOnly className={inputCls} value={value} />
    </Field>
  )
}

// Not inputCls: its read-only: variant would grey out a div.
const BOX = 'w-full rounded-xl border border-field bg-white px-2.5 py-3 text-sm text-ink'
const formatLocal = (value: string) => (value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} ${value.slice(11, 16)}` : 'dd/mm/yyyy hh:mm')

/** Shows "dd/mm/yyyy hh:mm" with the calendar icon like the frames; the native picker sits invisibly on top. */
export function DateTimeInput({ label, value, onChange, max = nowLocal(), disabled, id }: { label: string; value: string; onChange: (value: string) => void; max?: string; disabled?: boolean; id?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <div className={`${BOX} flex items-center gap-1.5 ${disabled ? 'opacity-60' : ''}`}>
        <span className="min-w-0 flex-1 whitespace-nowrap">{formatLocal(value)}</span>
        <Icon name="calendar-event" className="text-muted" />
      </div>
      <input
        ref={ref} id={id} aria-label={label} type="datetime-local" disabled={disabled} value={value} max={max}
        onChange={(event) => onChange(event.target.value)} onClick={() => ref.current?.showPicker?.()}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  )
}

export function DateTimeField({ label, value, onChange, hint, max }: { label: string; value: string; onChange: (value: string) => void; hint?: ReactNode; max?: string }) {
  return (
    <Field label={label} id={`dt-${plain(label)}`} hint={hint}>
      <DateTimeInput id={`dt-${plain(label)}`} label={plain(label)} value={value} onChange={onChange} max={max} />
    </Field>
  )
}

/** A row of radio options; `name` groups them. */
export function RadioRow({ name, value, options, onChange, disabled }: { name: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex min-h-5 flex-wrap items-center gap-x-5 gap-y-2 py-0.5">
      {options.map(([optionValue, label]) => (
        <Radio key={optionValue} name={`${name}-${disabled ? 'off' : 'on'}`} checked={value === optionValue} onChange={() => !disabled && onChange(optionValue)} className="text-[13px]">{label}</Radio>
      ))}
    </div>
  )
}

export function RadioField({ label, name, value, options, onChange, hint }: { label: string; name: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <RadioRow name={name} value={value} options={options} onChange={onChange} />
    </Field>
  )
}

export const memberLabel = (member: { name: string; role: string }) => `${member.name} · ${member.role}`

/** Dropdown of ACTIVE members (observer). */
export function MemberSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const known = REPRODUCTION_MEMBERS.some((member) => member.name === value)
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn người</option>
      {!known && value && <option value={value}>{value}</option>}
      {REPRODUCTION_MEMBERS.map((member) => <option key={member.name} value={member.name}>{memberLabel(member)}</option>)}
    </Select>
  )
}

/** Member name or a typed outside person (performer, examiner, birth attendant). */
export function PersonInput({ label, value, onChange, id }: { label: string; value: string; onChange: (value: string) => void; id: string }) {
  const listId = `${id}-people`
  return (
    <>
      <input id={id} list={listId} aria-label={label} maxLength={100} className={inputCls} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Chọn thành viên hoặc nhập tên" />
      <datalist id={listId}>
        {[...REPRODUCTION_MEMBERS.map((member) => member.name), ...REPRODUCTION_EXTERNAL_PEOPLE].map((name) => <option key={name} value={name} />)}
      </datalist>
    </>
  )
}
