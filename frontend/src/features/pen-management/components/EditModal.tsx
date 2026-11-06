import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, Radio, Table, Td, Th, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { PURPOSES, STAGES } from '../../../data/penData'
import { cx, TH } from './parts'
import type { ReactNode } from 'react'
import type { Pen, PenStatus } from '../../../types'
import { penName } from './BarnTable'

const OPERATORS = ['≥', '≤'] as const
const TODAY_LABEL = '20/10/2026'

// Options must include the saved value (vd "—" của chuồng ngừng sử dụng)
const withCurrent = (list: readonly string[], value: string): string[] => (list.includes(value) ? [...list] : [value, ...list])
const toNumber = (text: string): number | null => (text === '' ? null : Number(text))

// Ô "Điều kiện" trông như chữ + ▾ nhưng là <select> thật phủ trong suốt
function ConditionSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="relative inline-block cursor-pointer">
      {value} <span className="text-[10px] text-muted">▾</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

const ErrorText = ({ children }: { children: ReactNode }) => <span className="text-[11px] text-err-fg">{children}</span>

export default function EditModal({ barn, barns, onSave, onClose, saving = false, saveError }: { barn: Pen | null; barns: Pen[]; onSave: (pen: Pen) => void | Promise<void>; onClose: () => void; saving?: boolean; saveError?: unknown }) {
  const isNew = !barn
  const [code, setCode] = useState(barn?.code ?? '')
  const [name, setName] = useState(barn ? penName(barn) : '')
  const [capacity, setCapacity] = useState(barn ? String(barn.capacity) : '')
  const [desc, setDesc] = useState(barn?.desc ?? '')
  const [purpose, setPurpose] = useState(barn?.purpose ?? PURPOSES[0])
  const [stage, setStage] = useState(barn?.stage ?? STAGES[0])
  const [minAge, setMinAge] = useState(barn?.minAge != null ? String(barn.minAge) : '')
  const [minAgeOp, setMinAgeOp] = useState(barn?.minAgeOp ?? '≥')
  const [minWeight, setMinWeight] = useState(barn?.minWeight != null ? String(barn.minWeight) : '')
  const [minWeightOp, setMinWeightOp] = useState(barn?.minWeightOp ?? '≥')
  const [status, setStatus] = useState<PenStatus>(barn?.status ?? 'ACTIVE')
  const [tried, setTried] = useState(false)

  const trimmedCode = code.trim()
  const capacityNumber = Number(capacity)
  const errors = {
    code: !isNew ? '' : !trimmedCode ? 'Nhập mã chuồng' : barns.some((b) => b.code === trimmedCode) ? 'Mã chuồng đã tồn tại' : '',
    name: name.trim() ? '' : 'Nhập tên chuồng',
    capacity: !Number.isInteger(capacityNumber) || capacityNumber < 1
      ? 'Sức chứa phải là số nguyên ≥ 1'
      : barn && capacityNumber < barn.count ? `Không nhỏ hơn số bò đang ở (${barn.count})` : '',
  }
  const invalid = Object.values(errors).some(Boolean)

  const save = () => {
    setTried(true)
    if (invalid) return
    const next: Pen = {
      ...(barn ?? { code: trimmedCode, count: 0, cows: [], sex: 'Cả hai', accept: stage }),
      code: barn?.code ?? trimmedCode,
      // Giữ nguyên tiền tố mã nếu tên đang lưu có tiền tố; ô nhập chỉ hiện phần tên như frame.
      name: barn && barn.name !== penName(barn) ? `${barn.code} – ${name.trim()}` : name.trim(),
      capacity: capacityNumber,
      desc: desc.trim(),
      status,
      purpose,
      stage,
      minAge: toNumber(minAge),
      minAgeOp,
      minWeight: toNumber(minWeight),
      minWeightOp,
      // `version` is the backend optimistic-lock version.  It must remain the
      // version read when the modal opened; the backend increments it after a
      // successful update.  Incrementing it here made every edit send a stale
      // (next) version and the PUT was rejected with a conflict.
      version: barn?.version,
    }
    onSave(next)
  }

  const condition = (value: string, options: readonly string[], onChange: (value: string) => void) => (
    <ConditionSelect value={value} options={options} onChange={onChange} />
  )

  return (
    <Modal
      width={640}
      title={barn ? `Sửa chuồng – ${barn.code}` : 'Tạo chuồng mới'}
      sub={barn ? `${penName(barn)} · ${barn.count} con đang ở` : 'Nhập thông tin chuồng và tiêu chí tiếp nhận'}
      topTitle="Tạo / sửa chuồng"
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_minmax(0,1fr)_120px]">
        <Field label="Mã chuồng *">
          <input
            value={isNew ? code : barn.code}
            readOnly={!isNew}
            onChange={(e) => setCode(e.target.value)}
            className={cx(inputCls, 'read-only:!bg-white read-only:!text-ink')}
          />
          {tried && errors.code && <ErrorText>{errors.code}</ErrorText>}
        </Field>
        <Field label="Tên chuồng *">
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Tên chuồng (tối đa 100 ký tự)" />
          {tried && errors.name && <ErrorText>{errors.name}</ErrorText>}
        </Field>
        <Field label="Sức chứa *">
          <div className="relative">
            <input
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={cx(inputCls, 'pr-10')}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle">con</span>
          </div>
          {tried && errors.capacity && <ErrorText>{errors.capacity}</ErrorText>}
        </Field>
      </div>

      <Field label="Mô tả">
        <textarea value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} className={`${inputCls} min-h-16 resize-y`} placeholder="Ghi chú về chuồng (tối đa 500 ký tự)" />
        <span className="text-[11px] text-subtle">{desc.length}/500 ký tự</span>
      </Field>

      <div className="text-[13px] font-semibold text-[#212121]">Tiêu chí tiếp nhận · phiên bản mới từ {TODAY_LABEL}</div>
      <Table stack={false}>
        <thead>
          <tr>
            <Th className={cx(TH, 'w-[200px]')}>Loại tiêu chí</Th>
            <Th className={cx(TH, 'w-[150px]')}>Điều kiện</Th>
            <Th className={TH}>Giá trị</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td className={TH}>Mục đích</Td>
            <Td className={TH}>{condition(purpose, withCurrent(PURPOSES, purpose), setPurpose)}</Td>
            <Td className={TH}>
              <span className="font-medium text-ink">{purpose || 'Chưa chọn mục đích'}</span>
            </Td>
          </tr>
          <tr>
            <Td className={TH}>Giai đoạn</Td>
            <Td className={TH}>{condition(stage, withCurrent(STAGES, stage), setStage)}</Td>
            <Td className={TH}>
              <span className="font-medium text-ink">{stage || 'Chưa chọn giai đoạn'}</span>
            </Td>
          </tr>
          <tr>
            <Td className={TH}>Tuổi tối thiểu (tháng)</Td>
            <Td className={TH}>{condition(minAgeOp, OPERATORS, setMinAgeOp)}</Td>
            <Td className={TH}>
              <div className="relative w-[132px]">
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  placeholder="Ví dụ: 12"
                  aria-label="Tuổi tối thiểu theo tháng"
                  className="w-full rounded border border-[#d8e4dd] bg-white px-2 py-1.5 pr-12 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-subtle">tháng</span>
              </div>
            </Td>
          </tr>
          <tr>
            <Td className={TH}>Cân tối thiểu (kg)</Td>
            <Td className={TH}>{condition(minWeightOp, OPERATORS, setMinWeightOp)}</Td>
            <Td className={TH}>
              <div className="relative w-[132px]">
                <input
                  type="number"
                  min="1"
                  max="1500"
                  value={minWeight}
                  onChange={(e) => setMinWeight(e.target.value)}
                  placeholder="Ví dụ: 230"
                  aria-label="Cân tối thiểu theo kg"
                  className="w-full rounded border border-[#d8e4dd] bg-white px-2 py-1.5 pr-8 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-subtle">kg</span>
              </div>
            </Td>
          </tr>
        </tbody>
      </Table>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink">Tình trạng sử dụng</span>
        <div className="flex gap-[18px]">
          <Radio name="status" checked={status === 'ACTIVE'} onChange={() => setStatus('ACTIVE')}>ACTIVE</Radio>
          <Radio name="status" checked={status === 'INACTIVE'} onChange={() => setStatus('INACTIVE')}>INACTIVE</Radio>
        </div>
      </div>

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
