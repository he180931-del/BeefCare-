import { useMemo, useState } from 'react'
import { DateInput, Field, KV, Modal, ModalButton, ModalFooter, Note, Select } from '../../../shared/ui'
import { PURPOSE_OPTIONS, STAGES } from '../constants/entryOptions'
import { money } from '../../../shared/lib/format'
import { RadioRow } from './parts'
import EntryHistoryDeclarationForm from './EntryHistoryDeclarationForm'
import { validateEntryHistory } from '../domain/entryHistory'
import type { EntryCow } from '../types'
import type { Pen } from '../../pen-management'
import type { EntryBreedOption, EntryVaccineOption } from '../api/herdEntryBackendApi'

const compactInputCls = 'box-border min-w-0 w-full rounded-lg border border-field bg-white px-1.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand read-only:bg-page read-only:text-muted sm:px-2 sm:py-2 sm:text-[13px]'
const compactSelectCls = '[&_select]:min-w-0 [&_select]:rounded-lg [&_select]:px-1.5 [&_select]:py-1.5 [&_select]:text-[12px] sm:[&_select]:px-2 sm:[&_select]:py-2 sm:[&_select]:text-[13px]'
const ACCURACY = { 'Chính xác': 'Chính xác', 'Ước tính': 'Ước tính', 'Không rõ': 'Không rõ' }
type EditCow = EntryCow & { colourMarkings?: string; quarantineUntil?: string }

/**
 * Sex is selected first because the catalogue has biological constraints. The
 * dropdowns are filtered from sex; sex itself is never changed by selecting a
 * purpose or stage.
 */
export const stagesForSex = (sex: string) => {
  if (sex === 'Đực') return STAGES.filter((stage) => ['Bê theo mẹ', 'Bò tơ', 'Vỗ béo', 'Đực giống', 'Chưa xác định'].includes(stage.value))
  if (sex === 'Cái') return STAGES.filter((stage) => ['Bê theo mẹ', 'Bò tơ', 'Bò cái', 'Chưa xác định'].includes(stage.value))
  return []
}

export const purposesForSex = (sex: string) => {
  if (sex === 'Đực') return PURPOSE_OPTIONS.filter((purpose) => !/sinh sản/i.test(purpose))
  if (sex === 'Cái') return PURPOSE_OPTIONS.filter((purpose) => !/vỗ béo|đực giống/i.test(purpose))
  return []
}

export const isFatteningPurpose = (purpose: string) => /vỗ béo|fattening/i.test(purpose)

/**
 * Sửa một con trong phiếu nhập. `others` là các con khác trong phiếu (để kiểm tra sức chứa chuồng).
 * onSave(cow) ghi lại con; onRemove() xóa con khỏi phiếu.
 */
export default function RowEditModal({ cow, index, recordId, dateIso, pricing = 'kg', others, pens = [], vaccines = [], breeds = [], onSave, onRemove, onClose }: { cow: EditCow; index: number; recordId: string; dateIso: string; pricing?: 'kg' | 'con'; others: EditCow[]; pens?: Pen[]; vaccines?: EntryVaccineOption[]; breeds?: EntryBreedOption[]; onSave: (cow: EditCow) => void; onRemove: () => void; onClose: () => void }) {
  const initialWeightBasis: 'MEASURED' | 'ESTIMATED' | null = cow.weightBasis === 'MEASURED' || cow.weightBasis === 'ESTIMATED'
    ? cow.weightBasis
    : cow.weightBasis === null ? null : cow.weight > 0 ? (cow.estimated ? 'ESTIMATED' : 'MEASURED') : null
  const [c, setC] = useState(() => ({ ...cow, pricing, unitPrice: pricing === 'con' ? cow.unitPrice : initialWeightBasis ? cow.unitPrice : 0 }))
  const [validationError, setValidationError] = useState<string | null>(null)
  const warningReason = String(cow.warningReason ?? '')
  const [weightInput, setWeightInput] = useState(String(cow.weight))
  const set = (p: Partial<EditCow>) => setC((x) => ({ ...x, ...p }))
  const availableStages = useMemo(() => stagesForSex(c.sex), [c.sex])
  const availablePurposes = useMemo(() => purposesForSex(c.sex), [c.sex])
  const setHist = (patch: Partial<EditCow['hist']>) => set({ hist: { ...c.hist, ...patch } })
  // Older drafts may only contain YYYY-MM. Native date inputs need a day, so
  // use the first day of that month as the editable calendar value. The
  // backend already normalizes estimated dates to the first of the month.
  const dobInputValue = c.dob
    ? /^\d{4}-\d{2}$/.test(c.dob) ? `${c.dob}-01` : c.dob
    : ''
  const barn = pens.find((b) => b.code === c.barn)
  const sameBarn = others.filter((o) => o.barn === c.barn).length
  const canRemove = Boolean(cow.code)
  const full = barn && barn.count + sameBarn + 1 > barn.capacity
  const receptionCriteria = barn?.receptionCriteria
  const purposeCode = /sinh sản/i.test(c.purpose) ? 'BREEDING' : /vỗ béo|thương phẩm/i.test(c.purpose) ? 'FATTENING' : /đực giống|giữ giống/i.test(c.purpose) ? 'SIRE' : ''
  const stageCode = /bê theo mẹ|chưa cai/i.test(c.stage) ? 'UNWEANED_CALF' : /bê cai sữa/i.test(c.stage) ? 'WEANED_CALF' : /bò tơ|hậu bị/i.test(c.stage) ? 'YOUNG_STOCK' : /bò|vỗ béo|đực giống/i.test(c.stage) ? 'ADULT' : ''
  const sexCode = c.sex === 'Đực' ? 'MALE' : c.sex === 'Cái' ? 'FEMALE' : ''
  const ageMonths = c.dob && dateIso ? (() => {
    const [year, month] = dateIso.split('-').map(Number)
    const [birthYear, birthMonth] = c.dob.split('-').map(Number)
    return year * 12 + month - (birthYear * 12 + birthMonth)
  })() : 0
  const criterionIssues = receptionCriteria ? [
    receptionCriteria.purposeTypes?.length && purposeCode && !receptionCriteria.purposeTypes.includes(purposeCode) ? 'Mục đích nuôi phải phù hợp tiêu chí của chuồng.' : '',
    receptionCriteria.lifeStages?.length && stageCode && !receptionCriteria.lifeStages.includes(stageCode) ? 'Giai đoạn sinh trưởng phải phù hợp tiêu chí của chuồng.' : '',
    receptionCriteria.sex && sexCode && receptionCriteria.sex !== sexCode ? `Giới tính phải là ${receptionCriteria.sex === 'MALE' ? 'Đực' : receptionCriteria.sex === 'FEMALE' ? 'Cái' : receptionCriteria.sex}.` : '',
    receptionCriteria.minAgeMonths != null && ageMonths < receptionCriteria.minAgeMonths ? `Tuổi tối thiểu: ${receptionCriteria.minAgeMonths} tháng.` : '',
    receptionCriteria.minWeightKg != null && c.weight < receptionCriteria.minWeightKg ? `Cân nặng tối thiểu: ${receptionCriteria.minWeightKg} kg.` : '',
  ].filter(Boolean) : []
  const receptionError = !barn ? 'Chuồng nhận không tồn tại trong dữ liệu backend.' : barn.status !== 'ACTIVE' ? `Chuồng ${barn.code} đang ngừng sử dụng.` : full ? `Chuồng ${barn.code} đã vượt sức chứa (${barn.count + sameBarn + 1}/${barn.capacity}).` : null
  // Keep the action enabled for a missing pen so the popup can show the
  // precise required-field message; hard business failures (inactive/full)
  // remain disabled.
  const ok = !c.barn || !receptionError
  const [weightBasis, setWeightBasis] = useState<'MEASURED' | 'ESTIMATED' | null>(() => {
    return initialWeightBasis
  })
  const hasWeightBasis = weightBasis !== null
  const amount = pricing === 'con' ? c.unitPrice : hasWeightBasis ? c.weight * c.unitPrice : 0
  const save = () => {
    if (!c.tag.trim()) return setValidationError('Vui lòng nhập số thẻ tai.')
    if (!c.breed.trim()) return setValidationError('Vui lòng chọn giống.')
    if (!c.sex.trim()) return setValidationError('Vui lòng chọn giới tính.')
    if (!c.stage.trim() || c.stage === 'Chưa xác định') return setValidationError('Vui lòng chọn giai đoạn sinh trưởng.')
    if (!c.purpose.trim() || c.purpose === 'Chưa xác định') return setValidationError('Vui lòng chọn mục đích nuôi.')
    if (!c.barn.trim()) return setValidationError('Vui lòng chọn chuồng nhận.')
    if ((pricing === 'kg' || c.weight !== 0) && (!Number.isFinite(c.weight) || c.weight < 1 || c.weight > 1500)) return setValidationError('Cân nhập phải từ 1 đến 1.500 kg.')
    if (c.weight > 0 && !hasWeightBasis) return setValidationError('Vui lòng chọn cơ sở cân.')
    if (!Number.isFinite(c.unitPrice) || c.unitPrice <= 0) return setValidationError(pricing === 'con' ? 'Vui lòng nhập số tiền cuối lớn hơn 0.' : 'Đơn giá phải lớn hơn 0.')
    if (receptionError) return setValidationError(receptionError)
    const historyError = validateEntryHistory(c.hist, true, dateIso)
    if (historyError) return setValidationError(historyError)
    setValidationError(null)
    onSave({ ...c, pricing, weightBasis: c.weight > 0 ? weightBasis : null, estimated: c.weight > 0 && weightBasis === 'ESTIMATED', warningReason: criterionIssues.length ? (warningReason.trim() || 'Không phù hợp tiêu chí chuồng') : (warningReason.trim() || undefined) })
  }

  return (
    <>
    <Modal
      width={720}
      maxHeight="calc(100vh - 1rem)"
      title={`Sửa con #${index + 1} trong phiếu ${recordId}`}
      sub={'Thông tin dùng để tạo hồ sơ bò khi lưu phiếu – chưa tạo hồ sơ cho đến khi bấm "Lưu & tạo hồ sơ".'}
      topTitle="Thêm / sửa con trong phiếu nhập"
      onClose={onClose}
    >
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field label="Số thẻ tai *" hint="Để trống nếu gắn thẻ sau">
            <input id="entry-cow-tag" className={compactInputCls} value={c.tag} placeholder="Nhập số thẻ tai" onChange={(e) => set({ tag: e.target.value })} />
          </Field>
          <Field label="Tên gọi">
            <input id="entry-cow-name" className={compactInputCls} value={c.name} placeholder="Không bắt buộc" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="sm:col-span-2"><Field label="Màu lông & đặc điểm" hint="Nên nhập khi chưa có thẻ tai để phân biệt trong lô">
            <input id="entry-cow-colour" maxLength={255} className={compactInputCls} value={String(c.colourMarkings ?? '')} placeholder="Vàng, khoang trắng bụng, sừng ngắn" onChange={(e) => set({ colourMarkings: e.target.value })} />
          </Field></div>
          <Field label="Giống *">
            <Select className={compactSelectCls} id="entry-cow-breed" value={c.breed} onChange={(e) => {
              const breed = e.target.value
              const selected = breeds.find((option) => option.name === breed)
              set({ breed, breedId: selected?.id ?? null })
            }}>
              <option value="">Chọn giống</option>
              {breeds.map((option) => option.name).map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink">Giới tính *</span>
              <RadioRow name="sex" value={c.sex} options={['Đực', 'Cái']} onChange={(sex) => {
                const nextStages = stagesForSex(sex)
                const nextPurposes = purposesForSex(sex)
                const invalidStage = Boolean(c.stage && !nextStages.some((stage) => stage.value === c.stage))
                const invalidPurpose = Boolean(c.purpose && !nextPurposes.includes(c.purpose))
                set({
                  sex,
                  stage: nextStages.some((stage) => stage.value === c.stage) ? c.stage : '',
                  purpose: nextPurposes.includes(c.purpose) ? c.purpose : '',
                  purposeId: nextPurposes.includes(c.purpose) ? (c as EditCow).purposeId : null,
                })
                setValidationError(invalidStage
                  ? 'Giai đoạn sinh trưởng hiện tại không phù hợp với giới tính đã chọn. Vui lòng chọn lại.'
                  : invalidPurpose
                    ? 'Mục đích nuôi hiện tại không phù hợp với giới tính đã chọn. Vui lòng chọn lại.'
                    : null)
              }} />
          </div>
          <Field label="Ngày sinh" hint="Chọn ngày sinh hoặc ngày ước tính; độ chính xác chọn bên cạnh">
            <input
              id="entry-cow-dob"
              type="date"
              aria-label="Ngày sinh"
              value={dobInputValue}
              max={dateIso || undefined}
              onChange={(e) => set({ dob: e.target.value })}
              className={`${compactInputCls} cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
          </Field>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink">Độ chính xác ngày sinh</span>
            <RadioRow name="accuracy" value={c.dobAccuracy} options={Object.keys(ACCURACY)} onChange={(dobAccuracy) => set({ dobAccuracy })} />
          </div>
          <Field label="Giai đoạn sống *" hint="Đề xuất theo tuổi, sửa được">
            <Select className={compactSelectCls} id="entry-cow-stage" value={c.stage} disabled={!c.sex.trim()} aria-describedby={!c.sex.trim() ? 'entry-cow-sex-hint' : undefined} onChange={(e) => set({ stage: e.target.value })}>
              <option value="">{c.sex.trim() ? 'Chọn giai đoạn sinh trưởng' : 'Chọn giới tính trước'}</option>
              {availableStages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Mục đích nuôi *">
            <Select className={compactSelectCls} id="entry-cow-purpose" value={c.purpose} disabled={!c.sex.trim()} aria-describedby={!c.sex.trim() ? 'entry-cow-sex-hint' : undefined} onChange={(e) => {
              const purpose = e.target.value
              set({ purpose, purposeId: null })
            }}>
              <option value="">{c.sex.trim() ? 'Chọn mục đích nuôi' : 'Chọn giới tính trước'}</option>
              {availablePurposes.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          {!c.sex.trim() && <span id="entry-cow-sex-hint" className="text-[11px] text-muted sm:col-span-2">Chọn giới tính trước để mở danh sách giai đoạn sinh trưởng và mục đích nuôi.</span>}
          <Field label={`Cân nhập (kg)${pricing === 'kg' ? ' *' : ''}`} hint={pricing === 'con' ? 'Không bắt buộc khi tính theo con; nếu nhập: 1–1.500 kg' : undefined}>
            <input
              id="entry-cow-weight"
              type="number"
              min="0"
              max="1500"
              className={compactInputCls}
              value={weightInput}
              onChange={(e) => {
                const value = e.target.value
                setWeightInput(value)
                set({ weight: value === '' ? 0 : Number(value) })
              }}
              onBlur={() => {
                if (weightInput === '') setWeightInput('0')
              }}
            />
          </Field>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink">{`Cơ sở cân${pricing === 'kg' || c.weight > 0 ? ' *' : ' (khi có cân)'}`}</span>
              <RadioRow name="weigh" value={weightBasis === 'ESTIMATED' ? 'Ước tính' : weightBasis === 'MEASURED' ? 'Cân thực tế' : ''} options={['Cân thực tế', 'Ước tính']} onChange={(v) => {
                const next = v === 'Ước tính' ? 'ESTIMATED' : 'MEASURED'
                setWeightBasis(next)
                set({ estimated: next === 'ESTIMATED', weightBasis: next })
              }} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-3">
          <Field label="Chuồng nhận *">
            <Select className={compactSelectCls} id="entry-cow-barn" value={c.barn} onChange={(e) => set({ barn: e.target.value })}>
              {pens.map((b) => <option key={b.code} value={b.code}>{`${b.name} · ${b.count}/${b.capacity}`}</option>)}
            </Select>
          </Field>
          <Field label={`Đơn giá (đ/${pricing === 'con' ? 'con' : 'kg'}) *`}>
            <input id="entry-cow-unit-price" type="number" min="0" disabled={pricing === 'con' || (pricing === 'kg' && !hasWeightBasis)} className={`${compactInputCls} disabled:cursor-not-allowed disabled:bg-page disabled:text-muted`} value={c.unitPrice} onChange={(e) => set({ unitPrice: Number(e.target.value) || 0 })} />
          </Field>
          <Field label={pricing === 'con' ? 'Thành tiền *' : 'Thành tiền'}>
            {pricing === 'con' ? (
              <div className="relative">
                <input id="entry-cow-total-amount" type="number" min="0" className={compactInputCls} value={c.unitPrice || ''} onChange={(e) => set({ unitPrice: Number(e.target.value) || 0 })} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">đ</span>
              </div>
            ) : (
              <span className={`${compactInputCls} block bg-page text-muted`}>{money(amount)} đ</span>
            )}
          </Field>
        </div>
        <p className="m-0 text-xs font-medium text-ink">{`Cách tính giá: ${pricing === 'con' ? 'Theo con' : 'Theo kg'} (áp cho cả phiếu)`}</p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field label="Cách ly đến" hint="Không bắt buộc · hiện trên hồ sơ đến hết ngày">
            <DateInput id="entry-cow-quarantine" value={String(c.quarantineUntil ?? '')} onChange={(quarantineUntil) => set({ quarantineUntil })} />
          </Field>
        </div>
        <EntryHistoryDeclarationForm value={c.hist} sex={c.sex} vaccines={vaccines} onChange={setHist} onError={setValidationError} />
        {barn && !receptionError && criterionIssues.length === 0 && <Note tone="ok">{`Tiêu chí chuồng ${barn.code}: Đạt. Tiêm phòng "Có" được lưu là bản ghi tiêm LỊCH SỬ, không tạo mũi trong lịch tiêm.`}</Note>}
      </div>

      <ModalFooter>
        {(validationError || receptionError || criterionIssues.length > 0) && (
          <div className="min-w-0 basis-full min-[768px]:basis-auto min-[768px]:flex-1 [&>div]:text-sm [&>div]:font-medium">
            {validationError && <Note tone="err">{validationError}</Note>}
            {!validationError && receptionError && <Note tone="err">{receptionError}</Note>}
            {!validationError && !receptionError && criterionIssues.length > 0 && <Note tone="warn">Không phù hợp tiêu chí chuồng: {criterionIssues.join(' ')}</Note>}
          </div>
        )}
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2.5">
          {canRemove && <ModalButton variant="link" onClick={onRemove}>Xóa con khỏi phiếu</ModalButton>}
          <ModalButton onClick={onClose}>Hủy</ModalButton>
          <ModalButton variant="primary" disabled={!ok} onClick={save}>{`Lưu con #${index + 1}`}</ModalButton>
        </div>
      </ModalFooter>
    </Modal>

    </>
  )
}
