import { useEffect, useMemo, useRef, useState } from 'react'
import { DateInput, Field, Modal, ModalButton, ModalFooter, MoneyInput, Note, NumberInput, Select } from '../../../shared/ui'
import { PURPOSE_OPTIONS, STAGES } from '../constants/entryOptions'
import { money } from '../../../shared/lib/format'
import { RadioRow } from './parts'
import EntryHistoryDeclarationForm from './EntryHistoryDeclarationForm'
import { validateEntryHistory } from '../domain/entryHistory'
import { ageOf } from '../domain/entryCow'
import type { EntryCow } from '../types'
import type { Pen } from '../../pen-management'
import type { EntryBreedOption, EntryPurposeOption, EntryVaccineOption } from '../api/herdEntryBackendApi'

const compactInputCls = 'box-border h-[34px] min-w-0 w-full rounded-lg border border-field bg-white px-2 text-[12px] text-ink outline-none focus:border-brand aria-invalid:border-err-fg read-only:bg-page read-only:text-muted'
const compactSelectCls = '[&_select]:h-[34px] [&_select]:min-w-0 [&_select]:rounded-lg [&_select]:px-2 [&_select]:py-1 [&_select]:text-[12px]'
type EditCow = EntryCow & { colourMarkings?: string; quarantineUntil?: string }

/**
 * Sex is selected first because the catalogue has biological constraints. The
 * dropdowns are filtered from sex; sex itself is never changed by selecting a
 * purpose or stage.
 */
export const stagesForSex = (sex: string) => {
  if (sex === 'Đực') return STAGES.filter((stage) => ['Bê theo mẹ', 'Bê cai sữa', 'Bò tơ', 'Vỗ béo', 'Đực giống'].includes(stage.value))
  if (sex === 'Cái') return STAGES.filter((stage) => ['Bê theo mẹ', 'Bê cai sữa', 'Bò tơ', 'Bò cái'].includes(stage.value))
  return []
}

export const purposesForSex = (sex: string) => {
  if (sex === 'Đực') return PURPOSE_OPTIONS.filter((purpose) => purpose !== 'Chưa xác định' && !/sinh sản/i.test(purpose))
  if (sex === 'Cái') return PURPOSE_OPTIONS.filter((purpose) => purpose !== 'Chưa xác định' && !/đực giống|giữ giống/i.test(purpose))
  return []
}

export const isFatteningPurpose = (purpose: string) => /vỗ béo|fattening/i.test(purpose)

function proposeStage(age: number, sex: string) {
  if (!sex || age < 0) return ''
  if (age < 6) return 'Bê theo mẹ'
  if (age < 12) return 'Bê cai sữa'
  if (age < 24) return 'Bò tơ'
  return sex === 'Cái' ? 'Bò cái' : 'Vỗ béo'
}

/**
 * Sửa một con trong phiếu nhập. `others` là các con khác trong phiếu (để kiểm tra sức chứa chuồng).
 * onSave(cow) ghi lại con; onRemove() xóa con khỏi phiếu.
 */
export default function RowEditModal({ cow, index, dateIso, pricing = 'kg', isNew = false, others, pens = [], vaccines = [], breeds = [], purposes, onSave, onRemove, onClose }: { cow: EditCow; index: number; recordId: string; dateIso: string; pricing?: 'kg' | 'con'; isNew?: boolean; others: EditCow[]; pens?: Pen[]; vaccines?: EntryVaccineOption[]; breeds?: EntryBreedOption[]; purposes?: EntryPurposeOption[]; onSave: (cow: EditCow) => void; onRemove: () => void; onClose: () => void }) {
  const initialWeightBasis: 'MEASURED' | 'ESTIMATED' | null = cow.weightBasis === 'MEASURED' || cow.weightBasis === 'ESTIMATED'
    ? cow.weightBasis
    : cow.weightBasis === null ? null : cow.weight > 0 ? (cow.estimated ? 'ESTIMATED' : 'MEASURED') : null
  const [c, setC] = useState<EditCow & {pricing:'kg' | 'con'}>(() => ({ ...cow, pricing, purpose: cow.purpose === 'Chưa xác định' ? '' : cow.purpose, stage: ({UNWEANED_CALF:'Bê theo mẹ', WEANED_CALF:'Bê cai sữa', YOUNG_STOCK:'Bò tơ', ADULT:cow.sex === 'Cái' ? 'Bò cái' : 'Vỗ béo', 'Chưa xác định':''} as Record<string,string>)[cow.stage] ?? cow.stage }))
  const [invalidField, setInvalidField] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [stageEdited, setStageEdited] = useState(false)
  const form = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!invalidField) return
    const element = form.current?.querySelector<HTMLElement>(`#${invalidField}`)
    element?.focus({preventScroll:true}); element?.scrollIntoView?.({block:'center',behavior:'smooth'})
  }, [invalidField])
  const fail = (id: string, message: string) => { setInvalidField(id); setValidationError(message) }
  const [validationError, setValidationError] = useState<string | null>(null)
  const warningReason = String(cow.warningReason ?? '')
  const set = (p: Partial<EditCow>) => { setC((x) => ({ ...x, ...p })); setInvalidField(''); setValidationError(null) }
  const availableStages = useMemo(() => stagesForSex(c.sex), [c.sex])
  const cataloguePurposes = useMemo(() => purposes?.filter(p => p.available && p.purposeType !== 'UNDECIDED' && (p.purposeType !== 'SIRE' || c.sex === 'Đực') && (p.purposeType !== 'BREEDING' || c.sex === 'Cái')) ?? [], [purposes,c.sex])
  const availablePurposes = useMemo(() => purposes ? cataloguePurposes.map(p => p.name) : purposesForSex(c.sex), [purposes,cataloguePurposes,c.sex])
  const selectedPurpose = cataloguePurposes.find(p => p.id === Number(c.purposeId))
  const setHist = (patch: Partial<EditCow['hist']>) => set({ hist: { ...c.hist, ...patch } })
  const barn = pens.find((b) => b.code === c.barn)
  const sameBarn = others.filter((o) => o.barn === c.barn).length
  const canRemove = !isNew
  const full = barn && barn.count + sameBarn + 1 > barn.capacity
  const receptionCriteria = barn?.receptionCriteria
  const purposeCode = selectedPurpose?.purposeType ?? (/sinh sản/i.test(c.purpose) ? 'BREEDING' : /vỗ béo|thương phẩm/i.test(c.purpose) ? 'FATTENING' : /đực giống|giữ giống/i.test(c.purpose) ? 'SIRE' : '')
  const stageCode = /bê theo mẹ|chưa cai/i.test(c.stage) ? 'UNWEANED_CALF' : /bê cai sữa/i.test(c.stage) ? 'WEANED_CALF' : /bò tơ|hậu bị/i.test(c.stage) ? 'YOUNG_STOCK' : /bò|vỗ béo|đực giống/i.test(c.stage) ? 'ADULT' : ''
  const sexCode = c.sex === 'Đực' ? 'MALE' : c.sex === 'Cái' ? 'FEMALE' : ''
  const ageMonths = ageOf(c.dob, dateIso)
  const proposedStage = c.dob ? proposeStage(ageMonths, c.sex) : ''
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
  const weightBasis = c.weight > 0 ? c.weight === cow.weight && initialWeightBasis === 'ESTIMATED' ? 'ESTIMATED' : 'MEASURED' : null
  const amount = pricing === 'con' ? c.unitPrice : c.weight * c.unitPrice
  const quarantineShortcut = (days: number) => {
    if (!dateIso) return
    const next = new Date(`${dateIso}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + days)
    set({quarantineUntil:next.toISOString().slice(0,10)})
  }
  const save = () => {
    if (c.tag.length > 30) return fail('entry-cow-tag', 'Số thẻ tai tối đa 30 ký tự.')
    if (!c.breed.trim()) return fail('entry-cow-breed', 'Vui lòng chọn giống.')
    if (!c.sex.trim()) return fail('entry-cow-sex', 'Vui lòng chọn giới tính.')
    if (!c.stage.trim() || c.stage === 'Chưa xác định') return fail('entry-cow-stage', 'Vui lòng chọn giai đoạn sinh trưởng.')
    if (!c.purpose.trim() || c.purpose === 'Chưa xác định') return fail('entry-cow-purpose', 'Vui lòng chọn mục đích nuôi.')
    if (!c.barn.trim()) return fail('entry-cow-barn', 'Vui lòng chọn chuồng nhận.')
    if ((pricing === 'kg' || c.weight !== 0) && (!Number.isFinite(c.weight) || c.weight < 1 || c.weight > 1500)) return fail('entry-cow-weight', 'Cân nhập phải từ 1 đến 1.500 kg.')
    if (!Number.isFinite(c.unitPrice) || c.unitPrice <= 0) return fail('entry-cow-unit-price', pricing === 'con' ? 'Giá con phải lớn hơn 0.' : 'Đơn giá phải lớn hơn 0.')
    if (c.dob && (c.dob.slice(0,7) > dateIso.slice(0,7) || c.dob < '1900-01')) return fail('entry-cow-dob', 'Tháng sinh không hợp lệ hoặc sau tháng nhập.')
    if (c.quarantineUntil && c.quarantineUntil < dateIso) return fail('entry-cow-quarantine', 'Cách ly nhập đàn đến không được trước ngày nhập.')
    if (receptionError) return fail('entry-cow-barn', receptionError)
    const historyError = validateEntryHistory(c.hist, true, dateIso)
    if (historyError) return fail('entry-cow-history', historyError)
    setValidationError(null)
    onSave({ ...c, pricing, weightBasis: c.weight > 0 ? weightBasis : null, estimated: c.weight > 0 && weightBasis === 'ESTIMATED', warningReason: criterionIssues.length ? (warningReason.trim() || 'Không phù hợp tiêu chí chuồng') : (warningReason.trim() || undefined) })
  }

  return (
    <>
    <Modal
      width={720}
      maxHeight="calc(100vh - 1rem)"
      title={`${isNew ? 'Thêm' : 'Sửa'} con #${index + 1}`}
      sub={'Thông tin dùng để tạo hồ sơ bò khi lưu phiếu – chưa tạo hồ sơ cho đến khi bấm "Lưu & tạo hồ sơ".'}
      onClose={onClose}
    >
      <div ref={form} className="flex min-w-0 flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field id="entry-cow-tag" label="Số thẻ tai" hint="Để trống nếu gắn thẻ sau">
            <input id="entry-cow-tag" aria-invalid={invalidField === 'entry-cow-tag'} maxLength={30} className={compactInputCls} value={c.tag} placeholder="Nhập số thẻ tai" onChange={(e) => set({ tag: e.target.value })} />
          </Field>
          <Field id="entry-cow-name" label="Tên gọi">
            <input id="entry-cow-name" maxLength={50} className={compactInputCls} value={c.name} placeholder="Không bắt buộc" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="sm:col-span-2"><Field id="entry-cow-colour" label="Màu lông & đặc điểm" hint={!c.tag.trim() && !String(c.colourMarkings ?? '').trim() ? 'Nên nhập màu lông & đặc điểm để phân biệt con chưa gắn thẻ.' : undefined}>
            <input id="entry-cow-colour" maxLength={255} className={compactInputCls} value={String(c.colourMarkings ?? '')} placeholder="Vàng, khoang trắng bụng, sừng ngắn" onChange={(e) => set({ colourMarkings: e.target.value })} />
          </Field></div>
          <Field id="entry-cow-breed" label="Giống *">
            <Select className={compactSelectCls} id="entry-cow-breed" aria-invalid={invalidField === 'entry-cow-breed'} value={c.breed} onChange={(e) => {
              const breed = e.target.value
              const selected = breeds.find((option) => option.name === breed)
              set({ breed, breedId: selected?.id ?? null })
            }}>
              <option value="">Chọn giống</option>
              {c.breed && !breeds.some(b => b.name === c.breed) && <option>{c.breed}</option>}
              {breeds.map((option) => option.name).map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <div id="entry-cow-sex" tabIndex={-1} aria-invalid={invalidField === 'entry-cow-sex'} className="flex min-w-0 flex-col gap-1.5 rounded aria-invalid:ring-1 aria-invalid:ring-err-fg">
            <span className="text-xs font-medium text-ink">Giới tính *</span>
              <RadioRow name="sex" value={c.sex} options={['Đực', 'Cái']} onChange={(sex) => {
                const nextStages = stagesForSex(sex)
                const nextPurposes = purposes ? purposes.filter(p => (p.purposeType !== 'SIRE' || sex === 'Đực') && (p.purposeType !== 'BREEDING' || sex === 'Cái')).map(p => p.name) : purposesForSex(sex)
                const invalidStage = Boolean(c.stage && !nextStages.some((stage) => stage.value === c.stage))
                const keepPurpose = purposes ? purposes.some(p => p.id === Number(c.purposeId) && p.available && (p.purposeType !== 'SIRE' || sex === 'Đực') && (p.purposeType !== 'BREEDING' || sex === 'Cái')) : nextPurposes.includes(c.purpose)
                const invalidPurpose = Boolean(c.purpose && !keepPurpose)
                set({
                  sex,
                  stage: nextStages.some((stage) => stage.value === c.stage) ? c.stage : '',
                  purpose: keepPurpose ? c.purpose : '',
                  purposeId: keepPurpose ? (c as EditCow).purposeId : null,
                })
                setValidationError(invalidStage
                  ? 'Giai đoạn sinh trưởng hiện tại không phù hợp với giới tính đã chọn. Vui lòng chọn lại.'
                  : invalidPurpose
                    ? 'Mục đích nuôi hiện tại không phù hợp với giới tính đã chọn. Vui lòng chọn lại.'
                    : null)
              }} />
          </div>
          <Field id="entry-cow-dob" label="Tháng sinh (ước tính)" hint={c.dob ? `≈ ${ageMonths} tháng tuổi khi nhập` : 'Chưa rõ tháng sinh'}>
            <input id="entry-cow-dob" aria-invalid={invalidField === 'entry-cow-dob'} type="month" aria-label="Tháng sinh (ước tính)" min="1900-01" max={dateIso.slice(0,7)} value={c.dob.slice(0,7)} className={compactInputCls} onChange={e => {
              const month = e.target.value
              // Same 6/12/24 month boundaries as EntryLineValidator.proposeLifeStage (GBR-25).
              const monthChanged = month !== c.dob.slice(0, 7)
              const stage = stageEdited || !monthChanged ? c.stage : month ? proposeStage(ageOf(month, dateIso), c.sex) : ''
              if (month === cow.dob.slice(0, 7)) {
                set({ stage, dob: cow.dob, dobAccuracy: cow.dobAccuracy })
              } else {
                set({ stage, dob: month ? `${month}-01` : '', dobAccuracy: month ? 'ESTIMATED' : 'UNKNOWN', ageMonths: undefined })
              }
            }} />
          </Field>
          <Field id="entry-cow-stage" label="Giai đoạn sống *" hint={proposedStage ? `Gợi ý theo tuổi: ${proposedStage}` : 'Đề xuất theo tuổi, sửa được'}>
            <Select className={compactSelectCls} id="entry-cow-stage" aria-invalid={invalidField === 'entry-cow-stage'} value={c.stage} disabled={!c.sex.trim()} aria-describedby={!c.sex.trim() ? 'entry-cow-sex-hint' : undefined} onChange={(e) => { setStageEdited(Boolean(e.target.value)); set({ stage: e.target.value }) }}>
              <option value="">{c.sex.trim() ? 'Chọn giai đoạn sinh trưởng' : 'Chọn giới tính trước'}</option>
              {availableStages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field id="entry-cow-purpose" label="Mục đích nuôi *">
            <Select className={compactSelectCls} id="entry-cow-purpose" aria-invalid={invalidField === 'entry-cow-purpose'} value={selectedPurpose ? String(selectedPurpose.id) : c.purpose} disabled={!c.sex.trim()} aria-describedby={!c.sex.trim() ? 'entry-cow-sex-hint' : undefined} onChange={(e) => {
              const option = cataloguePurposes.find(p => String(p.id) === e.target.value)
              set({ purpose: option?.name ?? e.target.value, purposeId: option?.id ?? null })
            }}>
              <option value="">{c.sex.trim() ? 'Chọn mục đích nuôi' : 'Chọn giới tính trước'}</option>
              {c.purpose && !selectedPurpose && !availablePurposes.includes(c.purpose) && <option>{c.purpose}</option>}
              {purposes ? cataloguePurposes.map(p => <option key={p.id} value={p.id}>{p.name} · {({SIRE:'Đực giống',BREEDING:'Sinh sản',FATTENING:'Vỗ béo'} as Record<string,string>)[p.purposeType] ?? p.purposeType}</option>) : availablePurposes.map(p => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          {!c.sex.trim() && <span id="entry-cow-sex-hint" className="text-[11px] text-muted sm:col-span-2">Chọn giới tính trước để mở danh sách giai đoạn sinh trưởng và mục đích nuôi.</span>}
          <Field id="entry-cow-weight" label={`Cân nhập (kg)${pricing === 'kg' ? ' *' : ''}`} hint={pricing === 'con' ? 'Không bắt buộc khi tính theo con; nếu nhập: 1–1.500 kg' : undefined}>
            <NumberInput id="entry-cow-weight" aria-invalid={invalidField === 'entry-cow-weight'} min={1} max={1500} decimals={2} className={compactInputCls} value={c.weight} onChange={weight => set({weight:weight ?? 0})} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-3">
          <Field id="entry-cow-barn" label="Chuồng nhận *">
            <Select className={compactSelectCls} id="entry-cow-barn" aria-invalid={invalidField === 'entry-cow-barn'} value={c.barn} onChange={(e) => set({ barn: e.target.value })}>
              {pens.map((b) => <option key={b.code} value={b.code}>{`${b.name} · ${b.count}/${b.capacity}`}</option>)}
            </Select>
          </Field>
          <Field id="entry-cow-unit-price" label={pricing === 'con' ? 'Giá con (đ) *' : 'Đơn giá (đ/kg) *'} hint={`${pricing === 'con' ? 'Theo con' : 'Theo kg'} – áp cho cả phiếu`}>
            <MoneyInput id="entry-cow-unit-price" aria-invalid={invalidField === 'entry-cow-unit-price'} aria-label={pricing === 'con' ? 'Giá con' : 'Đơn giá (đ/kg)'} value={c.unitPrice} onChange={unitPrice => set({unitPrice})} inputClassName={compactInputCls} />
          </Field>
          {pricing === 'kg' && <Field label="Thành tiền"><output className={`${compactInputCls} flex items-center bg-page text-muted`}>{c.weight > 0 ? `${money(amount)} đ` : '—'}</output></Field>}
        </div>
        <Field label="Cách ly nhập đàn đến" hint="Không bắt buộc · ngày hết theo dõi riêng sau khi mua về; khác cách ly thịt">
          <div aria-invalid={invalidField === 'entry-cow-quarantine'} className="rounded-lg aria-invalid:ring-1 aria-invalid:ring-err-fg"><DateInput id="entry-cow-quarantine" label="Cách ly nhập đàn đến" value={String(c.quarantineUntil ?? '')} onChange={quarantineUntil => set({quarantineUntil})} className="[&>div]:h-[34px] [&>div]:rounded-lg [&>div]:py-1 [&>div]:text-[12px]" /></div>
          <div className="flex gap-2"><ModalButton onClick={() => quarantineShortcut(14)}>+14 ngày</ModalButton><ModalButton onClick={() => quarantineShortcut(21)}>+21 ngày</ModalButton></div>
        </Field>
        <div id="entry-cow-history" tabIndex={-1} aria-invalid={invalidField === 'entry-cow-history'} className="min-w-0 rounded-lg aria-invalid:ring-1 aria-invalid:ring-err-fg"><EntryHistoryDeclarationForm value={c.hist} sex={c.sex} entryDate={dateIso} vaccines={vaccines} onChange={setHist} onError={setValidationError} /></div>
        {barn && c.sex && c.stage && c.purpose && !receptionError && criterionIssues.length === 0 && <Note tone="ok">{`Tiêu chí chuồng ${barn.code}: Đạt. Tiêm phòng "Có" được lưu là bản ghi tiêm LỊCH SỬ, không tạo mũi trong lịch tiêm.`}</Note>}
      </div>

      <ModalFooter>
        {(validationError || receptionError || criterionIssues.length > 0) && (
          <div className="min-w-0 basis-full min-[768px]:basis-auto min-[768px]:flex-1 [&>div]:text-sm [&>div]:font-medium">
            {validationError && <Note tone="err">{validationError}</Note>}
            {!validationError && receptionError && <Note tone="err">{receptionError}</Note>}
            {!validationError && !receptionError && criterionIssues.length > 0 && <Note tone="err">Không phù hợp tiêu chí chuồng: {criterionIssues.join(' ')}</Note>}
          </div>
        )}
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2.5">
          {canRemove && <ModalButton variant="link" onClick={() => setConfirmRemove(true)}>Xóa con khỏi phiếu</ModalButton>}
          <ModalButton onClick={onClose}>Hủy</ModalButton>
          <ModalButton variant="primary" disabled={!ok} onClick={save}>{isNew ? 'Thêm con' : `Lưu con #${index + 1}`}</ModalButton>
        </div>
      </ModalFooter>
    </Modal>
    {confirmRemove && <Modal width={420} title={`Xóa con #${index + 1} khỏi phiếu?`} onClose={() => setConfirmRemove(false)}><p>Con này sẽ được bỏ khỏi phiếu nháp.</p><ModalFooter><ModalButton onClick={() => setConfirmRemove(false)}>Hủy</ModalButton><ModalButton variant="primary" onClick={onRemove}>Xóa con</ModalButton></ModalFooter></Modal>}

    </>
  )
}
