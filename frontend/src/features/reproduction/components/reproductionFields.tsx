import type { ReactNode } from 'react'
import { Field, Radio, Select, inputCls } from '../../../components/ui'
import { REPRODUCTION_EXTERNAL_PEOPLE, REPRODUCTION_MEMBERS } from '../data/reproductionMock'
import type { DataSource } from '../types'

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

export const nowLocal = (): string => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Label without the required marker, used as the control's accessible name. */
export const plain = (label: string): string => label.replace(/ \*$/, '')

export function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <Field label={label} id={`ro-${plain(label)}`} hint={hint}>
      <input id={`ro-${plain(label)}`} aria-label={plain(label)} readOnly className={inputCls} value={value} />
    </Field>
  )
}

export function DateTimeField({ label, value, onChange, hint, max = nowLocal() }: { label: string; value: string; onChange: (value: string) => void; hint?: ReactNode; max?: string }) {
  return (
    <Field label={label} id={`dt-${plain(label)}`} hint={hint}>
      <input id={`dt-${plain(label)}`} aria-label={plain(label)} type="datetime-local" className={inputCls} value={value} max={max} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

/** A row of radio options; `name` groups them. */
export function RadioRow({ name, value, options, onChange, disabled }: { name: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex min-h-[44px] flex-wrap items-center gap-x-5 gap-y-2">
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
