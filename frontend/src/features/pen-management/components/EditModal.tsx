import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Checkbox, Field, Radio, Table, Td, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import {
  CRITERION_LABELS, CRITERION_TYPES, LIFE_STAGES, PURPOSE_LABELS, PURPOSE_TYPES, SEXES, SEX_LABELS, STAGE_LABELS,
  criteriaFromForm, criteriaOf, dmy, formFromCriteria, todayIso, validatePenForm,
  type CriterionType, type PenFormValues,
} from '../domain/penRules'
import { cx, TH } from './parts'
import type { ReactNode } from 'react'
import type { Pen, PenStatus } from '../../../types'
import { penName } from './BarnTable'

const ErrorText = ({ children }: { children: ReactNode }) => <span className="text-[11px] text-err-fg">{children}</span>

const PURPOSE_OPTIONS = PURPOSE_TYPES.map((v) => [v, PURPOSE_LABELS[v]] as const)
const STAGE_OPTIONS = LIFE_STAGES.map((v) => [v, STAGE_LABELS[v]] as const)

/** Multi-select of enum values shown as checkboxes (Loại mục đích, Giai đoạn). */
function MultiValue({ value, options, onChange }: { value: string[]; options: ReadonlyArray<readonly [string, string]>; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {options.map(([code, label]) => (
        <Checkbox
          key={code}
          checked={value.includes(code)}
          onChange={(e) => onChange(e.target.checked ? [...value, code] : value.filter((v) => v !== code))}
        >
          <span className="text-sm text-ink">{label}</span>
        </Checkbox>
      ))}
    </div>
  )
}

/**
 * Create / Edit Pen popup (UC-FE04-02, UC-FE04-03). Saving changed criteria makes a new criteria version from today
 * (R-04-06); the backend decides whether the criteria changed, and remains authoritative for MSG-FE04-02 / -03.
 */
export default function EditModal({ barn, barns, onSave, onClose, saving = false, saveError, today = todayIso() }: { barn: Pen | null; barns: Pen[]; onSave: (pen: Pen) => void | Promise<void>; onClose: () => void; saving?: boolean; saveError?: unknown; today?: string }) {
  const isNew = !barn
  const [code, setCode] = useState(barn?.code ?? '')
  const [name, setName] = useState(barn ? penName(barn) : '')
  const [capacity, setCapacity] = useState(barn ? String(barn.capacity) : '')
  const [desc, setDesc] = useState(barn?.desc ?? '')
  const [criteria, setCriteria] = useState<PenFormValues['criteria']>(() => (barn ? formFromCriteria(criteriaOf(barn)) : {}))
  const [status, setStatus] = useState<PenStatus>('ACTIVE')
  const [tried, setTried] = useState(false)

  const values: PenFormValues = { code, name, capacity, description: desc, criteria }
  const errors = validatePenForm(values, { isNew, existingCodes: barns.map((b) => b.code), headcount: barn?.count ?? 0 })
  const invalid = Object.values(errors).some(Boolean)
  const unusedTypes = CRITERION_TYPES.filter((type) => !(type in criteria))

  const setCriterion = (type: CriterionType, value: string[] | string) => setCriteria((current) => ({ ...current, [type]: value }))
  const removeCriterion = (type: CriterionType) => setCriteria((current) => {
    const next = { ...current }
    delete next[type]
    return next
  })
  const addCriterion = (type: CriterionType) => setCriterion(type, type === 'PURPOSE_TYPE' || type === 'LIFE_STAGE' ? [] : '')

  const save = () => {
    setTried(true)
    if (invalid) return
    const receptionCriteria = criteriaFromForm(criteria)
    const next: Pen = {
      ...(barn ?? { code: code.trim(), count: 0, cows: [], status: 'ACTIVE' as PenStatus }),
      code: barn?.code ?? code.trim(),
      // Giữ nguyên tiền tố mã nếu tên đang lưu có tiền tố; ô nhập chỉ hiện phần tên như frame.
      name: barn && barn.name !== penName(barn) ? `${barn.code} – ${name.trim()}` : name.trim(),
      capacity: Number(capacity.trim()),
      desc: desc.trim(),
      // Trạng thái chỉ chọn khi tạo (field 8); khi sửa, đổi trạng thái qua popup Ngưng / Dùng lại.
      status: isNew ? status : barn.status,
      receptionCriteria,
      purpose: receptionCriteria.purposeTypes?.length ? receptionCriteria.purposeTypes.map((v) => PURPOSE_LABELS[v as keyof typeof PURPOSE_LABELS]).join(', ') : 'Mọi mục đích',
      stage: receptionCriteria.lifeStages?.length ? receptionCriteria.lifeStages.map((v) => STAGE_LABELS[v as keyof typeof STAGE_LABELS]).join(', ') : 'Mọi giai đoạn',
      sex: receptionCriteria.sex ? SEX_LABELS[receptionCriteria.sex as keyof typeof SEX_LABELS] : 'Cả hai',
      minAge: receptionCriteria.minAgeMonths ?? null,
      minAgeOp: '≥',
      minWeight: receptionCriteria.minWeightKg ?? null,
      minWeightOp: '≥',
      // `version` / `lockVersion` are the backend optimistic-lock version read when the modal opened; the backend
      // increments it after a successful update, so the form must send it unchanged.
      version: barn?.version,
      lockVersion: barn?.lockVersion,
    }
    onSave(next)
  }

  const valueCell = (type: CriterionType) => {
    const value = criteria[type]
    if (type === 'PURPOSE_TYPE') return <MultiValue value={Array.isArray(value) ? value : []} options={PURPOSE_OPTIONS} onChange={(v) => setCriterion(type, v)} />
    if (type === 'LIFE_STAGE') return <MultiValue value={Array.isArray(value) ? value : []} options={STAGE_OPTIONS} onChange={(v) => setCriterion(type, v)} />
    if (type === 'SEX') {
      return (
        <div className="flex gap-4">
          {SEXES.map((sex) => (
            <Radio key={sex} name="criterion-sex" checked={value === sex} onChange={() => setCriterion(type, sex)}>{SEX_LABELS[sex]}</Radio>
          ))}
        </div>
      )
    }
    const isAge = type === 'MIN_AGE_MONTHS'
    return (
      <div className="relative w-[150px]">
        <input
          inputMode={isAge ? 'numeric' : 'decimal'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setCriterion(type, e.target.value)}
          placeholder={isAge ? '0–240' : '1–1.500'}
          aria-label={CRITERION_LABELS[type]}
          className="w-full rounded border border-[#d8e4dd] bg-white px-2 py-1.5 pr-12 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-subtle">{isAge ? 'tháng' : 'kg'}</span>
      </div>
    )
  }

  const activeTypes = CRITERION_TYPES.filter((type) => type in criteria)

  return (
    <Modal
      width={680}
      title={barn ? `Sửa chuồng – ${barn.code}` : 'Tạo chuồng mới'}
      sub={barn ? `${penName(barn)} · ${barn.count} con đang ở` : 'Nhập thông tin chuồng và tiêu chí nhận bò'}
      topTitle="Tạo / sửa chuồng"
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_minmax(0,1fr)_120px]">
        <Field label="Mã chuồng *">
          <input
            value={isNew ? code : barn.code}
            readOnly={!isNew}
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
            className={cx(inputCls, 'read-only:!bg-white read-only:!text-ink')}
            placeholder="Ví dụ: C-01"
          />
          {tried && errors.code && <ErrorText>{errors.code}</ErrorText>}
        </Field>
        <Field label="Tên chuồng *">
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Tên chuồng (tối đa 100 ký tự)" />
          {tried && errors.name && <ErrorText>{errors.name}</ErrorText>}
        </Field>
        <Field label="Sức chứa *">
          <div className="relative">
            <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={cx(inputCls, 'pr-10')} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle">con</span>
          </div>
          {tried && errors.capacity && <ErrorText>{errors.capacity}</ErrorText>}
        </Field>
      </div>

      <Field label="Mô tả">
        <textarea value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} className={`${inputCls} min-h-16 resize-y`} placeholder="Ghi chú về chuồng (tối đa 500 ký tự)" />
        <span className="text-[11px] text-subtle">{desc.length}/500 ký tự</span>
      </Field>

      <div className="text-[13px] font-semibold text-[#212121]">Tiêu chí nhận bò · phiên bản mới từ {dmy(today)}</div>
      <Table stack={false}>
        <thead>
          <tr>
            <Th className={cx(TH, 'w-[190px]')}>Loại tiêu chí</Th>
            <Th className={TH}>Điều kiện / Giá trị</Th>
            <Th className={cx(TH, 'w-[60px]')} />
          </tr>
        </thead>
        <tbody>
          {activeTypes.length === 0 && (
            <tr>
              <Td colSpan={3} className={cx(TH, 'text-muted')}>Chưa có tiêu chí: chuồng nhận mọi bò.</Td>
            </tr>
          )}
          {activeTypes.map((type) => (
            <tr key={type}>
              <Td className={TH}>{CRITERION_LABELS[type]}</Td>
              <Td className={TH}>
                <div className="flex flex-col gap-1">
                  {valueCell(type)}
                  {tried && errors[type] && <ErrorText>{errors[type]}</ErrorText>}
                </div>
              </Td>
              <Td className={TH}>
                <button type="button" onClick={() => removeCriterion(type)} className="cursor-pointer text-sm text-err-fg hover:underline">Xóa</button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {unusedTypes.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <span>+ Thêm tiêu chí</span>
          <select
            aria-label="Thêm tiêu chí"
            value=""
            onChange={(e) => e.target.value && addCriterion(e.target.value as CriterionType)}
            className="rounded border border-[#d8e4dd] bg-white px-2 py-1 text-sm"
          >
            <option value="">Chọn loại tiêu chí</option>
            {unusedTypes.map((type) => <option key={type} value={type}>{CRITERION_LABELS[type]}</option>)}
          </select>
        </label>
      )}

      {isNew && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-ink">Trạng thái ban đầu</span>
          <div className="flex gap-[18px]">
            <Radio name="status" checked={status === 'ACTIVE'} onChange={() => setStatus('ACTIVE')}>ACTIVE</Radio>
            <Radio name="status" checked={status === 'INACTIVE'} onChange={() => setStatus('INACTIVE')}>INACTIVE</Radio>
          </div>
        </div>
      )}

      <ModalFooter>
        <div className="mr-auto min-w-0 flex-1" role="status" aria-live="polite">
          {Boolean(saveError) && <span className="text-sm text-err-fg">{userFacingError(saveError, 'Không thể lưu chuồng. Vui lòng kiểm tra lại thông tin.')}</span>}
        </div>
        <ModalButton className="text-ink" onClick={onClose} disabled={saving}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu chuồng'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
