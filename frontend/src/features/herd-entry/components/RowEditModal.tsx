import { useMemo, useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { DateInput, Field, KV, Note, Select, Table, Td, Th } from '../../../components/ui'
import { BREEDS, PURPOSE_OPTIONS, STAGES } from '../data/importsData'
import { money } from '../../../data/format'
import { RadioRow } from './parts'
import type { EntryCow, Pen } from '../../../types'
import type { EntryBreedOption, EntryVaccineOption } from '../api/herdEntryBackendApi'

const TH = 'px-1! first:pl-3! last:pr-3!'
const compactInputCls = 'box-border min-w-0 w-full rounded-lg border border-field bg-white px-1.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand read-only:bg-page read-only:text-muted sm:px-2 sm:py-2 sm:text-[13px]'
const compactSelectCls = '[&_select]:min-w-0 [&_select]:rounded-lg [&_select]:px-1.5 [&_select]:py-1.5 [&_select]:text-[12px] sm:[&_select]:px-2 sm:[&_select]:py-2 sm:[&_select]:text-[13px]'
const HIST_OPTIONS = ['Có', 'Không', 'Không rõ']
const ACCURACY = { 'Chính xác': 'Chính xác', 'Ước tính': 'Ước tính', 'Không rõ': 'Không rõ' }
type EditCow = EntryCow & { colourMarkings?: string; quarantineUntil?: string }
type HistoryDetail = 'vaccine' | 'disease' | 'repro'

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
export default function RowEditModal({ cow, index, recordId, dateIso, others, pens = [], vaccines = [], breeds = [], onSave, onRemove, onClose }: { cow: EditCow; index: number; recordId: string; dateIso: string; pricing?: 'kg' | 'con'; others: EditCow[]; pens?: Pen[]; vaccines?: EntryVaccineOption[]; breeds?: EntryBreedOption[]; onSave: (cow: EditCow) => void; onRemove: () => void; onClose: () => void }) {
  const initialPricing = cow.pricing ?? 'kg'
  const initialWeightBasis: 'MEASURED' | 'ESTIMATED' | null = cow.weightBasis === 'MEASURED' || cow.weightBasis === 'ESTIMATED'
    ? cow.weightBasis
    : cow.weightBasis === null ? null : cow.weight > 0 ? (cow.estimated ? 'ESTIMATED' : 'MEASURED') : null
  const [c, setC] = useState(() => ({ ...cow, pricing: initialPricing, unitPrice: initialPricing === 'con' ? cow.unitPrice : initialWeightBasis ? cow.unitPrice : 0 }))
  const [validationError, setValidationError] = useState<string | null>(null)
  const warningReason = String(cow.warningReason ?? '')
  const [detailModal, setDetailModal] = useState<HistoryDetail | null>(null)
  const [detailDraft, setDetailDraft] = useState('')
  const [detailDate, setDetailDate] = useState('')
  const [detailSource, setDetailSource] = useState('')
  const [vaccineRows, setVaccineRows] = useState<Array<{ vaccineId?: number; vaccineName: string; date: string; source: string }>>([])
  const [weightInput, setWeightInput] = useState(String(cow.weight))
  const set = (p: Partial<EditCow>) => setC((x) => ({ ...x, ...p }))
  const availableStages = useMemo(() => stagesForSex(c.sex), [c.sex])
  const availablePurposes = useMemo(() => purposesForSex(c.sex), [c.sex])
  const setHist = (patch: Partial<EditCow['hist']>) => set({ hist: { ...c.hist, ...patch } })
  const detailMeta: Record<HistoryDetail, { title: string; label: string; placeholder: string; value: string; type?: 'number' }> = {
    vaccine: { title: 'Chi tiết tiêm phòng', label: 'Loại vaccine', placeholder: 'Nhập tên vaccine nếu chưa có trong danh mục', value: c.hist.vaccineName ?? c.hist.vaccineNote ?? '' },
    disease: { title: 'Chi tiết bệnh đã biết', label: 'Mô tả bệnh', placeholder: 'Nhập mô tả bệnh đã biết', value: c.hist.diseaseNote ?? '' },
    repro: { title: 'Chi tiết sinh sản', label: 'Số tháng mang thai', placeholder: 'Nhập số tháng nếu đang mang thai', value: c.hist.pregnancyMonths == null ? '' : String(c.hist.pregnancyMonths), type: 'number' },
  }
  const openDetail = (kind: HistoryDetail) => {
    setDetailDraft(detailMeta[kind].value)
    setDetailDate(kind === 'vaccine' ? c.hist.vaccineDate ?? '' : '')
    setDetailSource(kind === 'vaccine' ? c.hist.vaccineSource ?? '' : kind === 'repro' ? c.hist.reproductionNote ?? '' : '')
    if (kind === 'vaccine') setVaccineRows((c.hist.vaccineItems?.length ? c.hist.vaccineItems : [{ vaccineId: c.hist.vaccineId, vaccineName: c.hist.vaccineName ?? c.hist.vaccineNote ?? '', vaccineDate: c.hist.vaccineDate ?? '', vaccineSource: c.hist.vaccineSource ?? '' }]).map((item) => ({ vaccineId: item.vaccineId, vaccineName: item.vaccineName ?? '', date: item.vaccineDate ?? '', source: item.vaccineSource ?? '' })))
    // The backend contract stores one disease declaration description string
    // (max 1,000 characters), so keep this editor as one textarea rather than
    // presenting a UI-only list that would be re-joined before submission.
    setDetailModal(kind)
  }
  const saveDetail = () => {
    if (!detailModal) return
    if (detailModal === 'repro') {
      const pregnantAtEntry = c.hist.pregnantAtEntry ?? 'UNKNOWN'
      const months = pregnantAtEntry === 'YES' && c.hist.pregnancyMonths != null ? Number(c.hist.pregnancyMonths) : undefined
      if (months != null && (!Number.isInteger(months) || months < 1 || months > 9)) return setValidationError('Số tháng mang thai phải từ 1 đến 9.')
      setHist({ pregnancyMonths: months, earlierCalvings: c.hist.earlierCalvings, pregnantAtEntry, reproductionNote: detailSource.slice(0, 1000) })
    } else if (detailModal === 'vaccine') {
      if (detailDate && detailDate > new Date().toISOString().slice(0, 10)) return setValidationError('Ngày tiêm không được ở tương lai.')
      const items = vaccineRows.filter((item) => item.vaccineName.trim() || item.vaccineId != null || item.date || item.source).map((item) => ({ vaccineId: item.vaccineId, vaccineName: item.vaccineName, vaccineDate: item.date, vaccineSource: item.source }))
      setHist({ vaccineItems: items, vaccineId: items[0]?.vaccineId, vaccineName: items[0]?.vaccineName, vaccineDate: items[0]?.vaccineDate, vaccineSource: items[0]?.vaccineSource, vaccineNote: items[0]?.vaccineSource || items[0]?.vaccineName })
    } else setHist({ diseaseNote: detailDraft.trim().slice(0, 1000) })
    setValidationError(null)
    setDetailModal(null)
  }
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
  const pricing = c.pricing ?? 'kg'
  const amount = pricing === 'con' ? c.unitPrice : hasWeightBasis ? c.weight * c.unitPrice : 0
  const save = () => {
    if (!c.tag.trim()) return setValidationError('Vui lòng nhập số thẻ tai.')
    if (!c.breed.trim()) return setValidationError('Vui lòng chọn giống.')
    if (!c.sex.trim()) return setValidationError('Vui lòng chọn giới tính.')
    if (!c.stage.trim() || c.stage === 'Chưa xác định') return setValidationError('Vui lòng chọn giai đoạn sinh trưởng.')
    if (!c.purpose.trim() || c.purpose === 'Chưa xác định') return setValidationError('Vui lòng chọn mục đích nuôi.')
    if (!c.barn.trim()) return setValidationError('Vui lòng chọn chuồng nhận.')
    if (pricing === 'kg' && (!Number.isFinite(c.weight) || c.weight <= 0)) return setValidationError('Cân nhập phải từ 1 đến 1.500 kg.')
    if (pricing === 'kg' && !hasWeightBasis) return setValidationError('Vui lòng chọn cơ sở cân.')
    if (!Number.isFinite(c.unitPrice) || c.unitPrice <= 0) return setValidationError(pricing === 'con' ? 'Vui lòng nhập số tiền cuối lớn hơn 0.' : 'Đơn giá phải lớn hơn 0.')
    if (receptionError) return setValidationError(receptionError)
    if (c.hist.vaccine === 'Có' && !c.hist.vaccineNote?.trim()) return setValidationError('Vui lòng nhập thông tin tiêm phòng.')
    if (c.hist.disease === 'Có' && !String((c.hist as Record<string, unknown>).diseaseNote ?? '').trim()) return setValidationError('Vui lòng mô tả bệnh đã biết.')
    if (c.hist.repro === 'Có' && c.hist.pregnantAtEntry === 'YES' && (!Number.isInteger(c.hist.pregnancyMonths) || Number(c.hist.pregnancyMonths) < 1 || Number(c.hist.pregnancyMonths) > 9)) return setValidationError('Vui lòng nhập số tháng mang thai từ 1 đến 9.')
    if (c.hist.repro === 'Có' && (!Number.isInteger(c.hist.earlierCalvings) || Number(c.hist.earlierCalvings) < 0 || Number(c.hist.earlierCalvings) > 15)) return setValidationError('Vui lòng nhập số lứa đã đẻ từ 0 đến 15.')
    setValidationError(null)
    onSave({ ...c, pricing, weightBasis, estimated: weightBasis === 'ESTIMATED', warningReason: criterionIssues.length ? (warningReason.trim() || 'Không phù hợp tiêu chí chuồng') : (warningReason.trim() || undefined) })
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
              {(breeds.length ? breeds.map((option) => option.name) : BREEDS).map((b) => <option key={b}>{b}</option>)}
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
          <Field label="Cân nhập (kg) *">
            <input
              id="entry-cow-weight"
              type="number"
              min="0"
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
            <span className="text-xs font-medium text-ink">Cơ sở cân *</span>
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
          <Field label="Đơn giá (đ/kg) *">
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
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink">Cách tính giá *</span>
              <div className="flex items-center gap-4" role="radiogroup" aria-label="Cách tính giá">
                {(['kg', 'con'] as const).map((basis) => <label key={basis} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink">
                  <input
                    type="radio"
                    name="pricing-basis"
                    value={basis}
                    checked={pricing === basis}
                    onChange={() => set({ pricing: basis, unitPrice: 0 })}
                    className="h-4 w-4 accent-brand"
                  />
                  {basis === 'kg' ? 'Theo cân' : 'Theo con'}
                </label>)}
              </div>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
          <Field label="Cách ly đến" hint="Không bắt buộc · hiện trên hồ sơ đến hết ngày">
            <DateInput id="entry-cow-quarantine" value={String(c.quarantineUntil ?? '')} onChange={(quarantineUntil) => set({ quarantineUntil })} />
          </Field>
        </div>
        <h3 className="m-0 text-sm font-semibold text-ink">Lịch sử trước nhập đàn</h3>
        <div className="overflow-hidden rounded border border-edge">
          <Table bordered={false} stack={false}>
            <thead>
              <tr>
                <Th className={`${TH} w-[110px]`}>Mục</Th>
                <Th className={`${TH} w-[260px]`}>Khai báo</Th>
                <Th className={TH}>Chi tiết</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className={TH}>Tiêm phòng</Td>
                <Td className={TH}><RadioRow name="vaccine" value={c.hist.vaccine} options={HIST_OPTIONS} onChange={(v) => setHist({ vaccine: v })} /></Td>
                <Td className={`${TH} max-w-[150px]`}><button type="button" aria-label="Chi tiết tiêm phòng" disabled={c.hist.vaccine !== 'Có'} onClick={() => openDetail('vaccine')} className="w-full max-w-[150px] cursor-pointer truncate rounded-lg border border-field bg-white px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-brand hover:bg-page disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-field disabled:hover:bg-white">{c.hist.vaccine === 'Có' && (c.hist.vaccineName?.trim() || c.hist.vaccineNote?.trim()) ? 'Chi tiết (đã nhập)' : 'Chi tiết'}</button></Td>
              </tr>
              <tr>
                <Td className={TH}>Bệnh đã biết</Td>
                <Td className={TH}><RadioRow name="disease" value={c.hist.disease} options={HIST_OPTIONS} onChange={(v) => setHist({ disease: v })} /></Td>
                <Td className={`${TH} max-w-[150px]`}><button type="button" aria-label="Chi tiết bệnh đã biết" disabled={c.hist.disease !== 'Có'} onClick={() => openDetail('disease')} className="w-full max-w-[150px] cursor-pointer truncate rounded-lg border border-field bg-white px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-brand hover:bg-page disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-field disabled:hover:bg-white">{c.hist.disease === 'Có' && c.hist.diseaseNote?.trim() ? 'Chi tiết (đã nhập)' : 'Chi tiết'}</button></Td>
              </tr>
              <tr>
                <Td className={TH}>{c.sex === 'Cái' ? 'Sinh sản (bò cái)' : 'Sinh sản'}</Td>
                <Td className={TH}><RadioRow name="repro" value={c.hist.repro} options={HIST_OPTIONS} onChange={(v) => {
                  if (v === 'Có') {
                    setHist({ repro: v, pregnantAtEntry: c.hist.pregnantAtEntry ?? 'UNKNOWN' })
                  } else {
                    // Conditional reproduction details must not survive after
                    // the declaration is changed away from "Có".
                    setHist({ repro: v, pregnantAtEntry: v === 'Không' ? 'NO' : 'UNKNOWN', earlierCalvings: undefined, pregnancyMonths: undefined, reproductionNote: undefined })
                  }
                }} /></Td>
                <Td className={`${TH} max-w-[150px]`}><button type="button" aria-label="Chi tiết sinh sản" disabled={c.hist.repro !== 'Có'} onClick={() => openDetail('repro')} className="w-full max-w-[150px] cursor-pointer truncate rounded-lg border border-field bg-white px-3 py-2 text-left text-[12px] text-ink transition-colors hover:border-brand hover:bg-page disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-field disabled:hover:bg-white">{c.hist.repro === 'Có' && c.hist.pregnancyMonths != null ? 'Chi tiết (đã nhập)' : 'Chi tiết'}</button></Td>
              </tr>
            </tbody>
          </Table>
        </div>
        {barn && !receptionError && criterionIssues.length === 0 && <Note tone="ok">{`Tiêu chí chuồng ${barn.code}: Đạt. Tiêm phòng "Có" được lưu là bản ghi tiêm LỊCH SỬ, không tạo mũi trong lịch tiêm.`}</Note>}
      </div>

      <ModalFooter compact className="min-[768px]:!px-3">
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
    {detailModal && (
      <Modal width={520} maxHeight="min(600px, calc(100vh - 2rem))" title={detailMeta[detailModal].title} sub="Nhập thông tin chi tiết cho khai báo này." onClose={() => setDetailModal(null)}>
        {detailModal === 'vaccine' ? <div className="flex min-h-0 flex-col gap-2">
          <div aria-label="Danh sách vaccine" role="region" className="max-h-[220px] min-h-0 overflow-y-auto overscroll-contain pr-1">
          <div className="flex flex-col gap-2">
          {vaccineRows.map((item, index) => <div key={index} className="grid items-end gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <Field label={index === 0 ? 'Loại vaccine' : undefined} id={`entry-history-vaccine-name-${index}`}>
              <input id={`entry-history-vaccine-name-${index}`} aria-label={index === 0 ? 'Tên vaccine tự do' : `Tên vaccine tự do ${index + 1}`} className={compactInputCls} value={item.vaccineName} placeholder="Ví dụ: LMLM" onChange={(e) => { const next = [...vaccineRows]; next[index] = { ...item, vaccineId: undefined, vaccineName: e.target.value }; setVaccineRows(next) }} />
            </Field>
            {vaccines.length > 0 ? <Field label={index === 0 ? 'Chọn trong danh mục' : undefined} id={`entry-history-vaccine-catalogue-${index}`}><select id={`entry-history-vaccine-catalogue-${index}`} aria-label={`Chọn vaccine trong danh mục ${index + 1}`} className={compactInputCls} value={item.vaccineId == null ? '' : `id:${item.vaccineId}`} onChange={(e) => { const value = e.target.value; const next = [...vaccineRows]; const option = vaccines.find((entry) => String(entry.id) === value.slice(3)); next[index] = value ? { ...item, vaccineId: option?.id, vaccineName: option?.name ?? item.vaccineName } : { ...item, vaccineId: undefined }; setVaccineRows(next) }}><option value="">Không chọn</option>{vaccines.map((entry) => <option key={entry.id} value={`id:${entry.id}`}>{entry.code} · {entry.name}</option>)}</select></Field> : <span aria-hidden="true" />}
            <Field label={index === 0 ? 'Ngày tiêm' : undefined}><input aria-label={`Ngày tiêm ${index + 1}`} type="date" className={compactInputCls} value={item.date} onChange={(e) => { const next = [...vaccineRows]; next[index] = { ...item, date: e.target.value }; setVaccineRows(next) }} /></Field>
            <Field label={index === 0 ? 'Nguồn thông tin' : undefined}><input aria-label={`Nguồn thông tin ${index + 1}`} className={compactInputCls} value={item.source} placeholder="Ví dụ: sổ tiêm cũ" onChange={(e) => { const next = [...vaccineRows]; next[index] = { ...item, source: e.target.value }; setVaccineRows(next) }} /></Field>
            <button type="button" aria-label={`Xóa vaccine ${index + 1}`} className="h-8 cursor-pointer rounded border border-field px-2 text-xs text-danger hover:border-danger" onClick={() => setVaccineRows((rows) => rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [{ vaccineName: '', date: '', source: '' }])}>Xóa</button>
          </div>)}
          </div>
          </div>
          <button type="button" className="w-fit cursor-pointer rounded border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-page" onClick={() => setVaccineRows((rows) => [...rows, { vaccineName: '', date: '', source: '' }])}>+ Thêm vaccine</button>
        </div> : detailModal === 'disease' ? <div className="flex flex-col gap-2">
          <Field label="Mô tả bệnh" id="entry-history-disease">
            <textarea id="entry-history-disease" aria-label="Mô tả bệnh" rows={5} maxLength={1000} autoFocus className={`${compactInputCls} min-h-[120px] resize-y`} value={detailDraft} placeholder="Nhập mô tả bệnh đã biết" onChange={(e) => setDetailDraft(e.target.value)} />
          </Field>
          <p className="text-xs text-muted">Tối đa 1.000 ký tự.</p>
        </div> : detailModal === 'repro' ? <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số lứa đã đẻ trước nhập đàn" id="entry-history-earlier-calvings"><input id="entry-history-earlier-calvings" aria-label="Số lứa đã đẻ trước nhập đàn" type="number" min={0} max={15} className={compactInputCls} value={c.hist.earlierCalvings ?? ''} onChange={(e) => setHist({ earlierCalvings: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Đang mang thai" id="entry-history-pregnant"><select id="entry-history-pregnant" aria-label="Đang mang thai" className={compactInputCls} value={c.hist.pregnantAtEntry ?? 'UNKNOWN'} onChange={(e) => { const pregnantAtEntry = e.target.value; setHist({ pregnantAtEntry, ...(pregnantAtEntry !== 'YES' ? { pregnancyMonths: undefined } : {}) }) }}><option value="YES">Có</option><option value="NO">Không</option><option value="UNKNOWN">Không rõ</option></select></Field>
          <Field label="Số tháng mang thai" id="entry-history-pregnancy-months">
            <input
              id="entry-history-pregnancy-months"
              aria-label="Số tháng mang thai"
              type="number"
              min={1}
              max={9}
              disabled={c.hist.pregnantAtEntry !== 'YES'}
              className={`${compactInputCls} disabled:cursor-not-allowed disabled:bg-page disabled:text-muted`}
              value={c.hist.pregnancyMonths ?? ''}
              placeholder={c.hist.pregnantAtEntry === 'YES' ? 'Nhập 1–9 tháng' : 'Chỉ nhập khi đang mang thai'}
              onChange={(e) => setHist({ pregnancyMonths: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="Mô tả bổ sung" id="entry-history-repro-note"><textarea id="entry-history-repro-note" aria-label="Mô tả bổ sung" rows={3} maxLength={1000} className={`${compactInputCls} resize-y`} value={detailSource} placeholder="Thông tin sinh sản bổ sung" onChange={(e) => setDetailSource(e.target.value)} /></Field>
        </div> : null}
        <ModalFooter compact className="-mt-2 !px-0 [&_button]:h-10 [&_button]:rounded-lg [&_button]:px-3 [&_button]:text-xs"><ModalButton onClick={() => setDetailModal(null)}>Hủy</ModalButton><ModalButton variant="primary" onClick={saveDetail}>Lưu chi tiết</ModalButton></ModalFooter>
      </Modal>
    )}
    </>
  )
}
