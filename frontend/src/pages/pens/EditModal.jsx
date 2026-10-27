import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { Field, Radio, Table, Td, Th, inputCls } from '../../components/ui'
import { PURPOSES, STAGES } from '../../data/penData'
import { cx, TH } from './parts'

const OPERATORS = ['≥', '≤']
const TODAY_LABEL = '20/10/2026'

// Options must include the saved value (vd "—" của chuồng ngừng sử dụng)
const withCurrent = (list, value) => (list.includes(value) ? list : [value, ...list])
const toNumber = (text) => (text === '' ? null : Number(text))

// Ô "Điều kiện" trông như chữ + ▾ nhưng là <select> thật phủ trong suốt
function ConditionSelect({ value, options, onChange }) {
  return (
    <label className="relative inline-block cursor-pointer">
      {value} <span className="text-[10px] text-muted">▾</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

const ErrorText = ({ children }) => <span className="text-[11px] text-err-fg">{children}</span>

export default function EditModal({ barn, barns, onSave, onClose }) {
  const isNew = !barn
  const [code, setCode] = useState(barn?.code ?? '')
  const [name, setName] = useState(barn?.name ?? '')
  const [capacity, setCapacity] = useState(barn ? String(barn.capacity) : '')
  const [desc, setDesc] = useState(barn?.desc ?? '')
  const [purpose, setPurpose] = useState(barn?.purpose ?? PURPOSES[0])
  const [stage, setStage] = useState(barn?.stage ?? STAGES[0])
  const [minAge, setMinAge] = useState(barn?.minAge != null ? String(barn.minAge) : '')
  const [minAgeOp, setMinAgeOp] = useState(barn?.minAgeOp ?? '≥')
  const [hasWeight, setHasWeight] = useState(barn?.minWeight != null)
  const [minWeight, setMinWeight] = useState(barn?.minWeight != null ? String(barn.minWeight) : '')
  const [minWeightOp, setMinWeightOp] = useState(barn?.minWeightOp ?? '≥')
  const [status, setStatus] = useState(barn?.status ?? 'ACTIVE')
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
    const versionNumber = Number(barn?.version?.match(/^v(\d+)/)?.[1] ?? 0)
    onSave({
      ...(barn ?? { code: trimmedCode, count: 0, cows: [], sex: 'Cả hai', accept: stage }),
      name: name.trim(),
      capacity: capacityNumber,
      desc: desc.trim(),
      status,
      purpose,
      stage,
      minAge: toNumber(minAge),
      minAgeOp,
      minWeight: hasWeight ? toNumber(minWeight) : null,
      minWeightOp,
      version: `v${versionNumber + 1} từ ${TODAY_LABEL}`,
    })
  }

  const condition = (value, options, onChange) => (
    <ConditionSelect value={value} options={options} onChange={onChange} />
  )

  return (
    <Modal
      width={640}
      title={barn ? `Sửa chuồng – ${barn.code}` : 'Tạo chuồng mới'}
      sub={barn ? `${barn.name} · ${barn.count} con đang ở` : 'Nhập thông tin chuồng và tiêu chí tiếp nhận'}
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
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
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
        <input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} />
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
            <Td className={TH}>—</Td>
          </tr>
          <tr>
            <Td className={TH}>Giai đoạn</Td>
            <Td className={TH}>{condition(stage, withCurrent(STAGES, stage), setStage)}</Td>
            <Td className={TH}>—</Td>
          </tr>
          <tr>
            <Td className={TH}>Tuổi tối thiểu (tháng)</Td>
            <Td className={TH}>{condition(minAgeOp, OPERATORS, setMinAgeOp)}</Td>
            <Td className={TH}>
              <input type="number" value={minAge} onChange={(e) => setMinAge(e.target.value)} className="w-16 bg-transparent text-xs text-ink outline-none" />
            </Td>
          </tr>
          {hasWeight && (
            <tr>
              <Td className={TH}>Cân tối thiểu (kg)</Td>
              <Td className={TH}>{condition(minWeightOp, OPERATORS, setMinWeightOp)}</Td>
              <Td className={TH}>
                <input type="number" value={minWeight} onChange={(e) => setMinWeight(e.target.value)} className="w-16 bg-transparent text-xs text-ink outline-none" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {!hasWeight && (
        <button type="button" onClick={() => setHasWeight(true)} className="-mt-2 cursor-pointer self-start p-1 text-xs font-semibold text-brand">
          + Thêm tiêu chí
        </button>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink">Tình trạng sử dụng</span>
        <div className="flex gap-[18px]">
          <Radio name="status" checked={status === 'ACTIVE'} onChange={() => setStatus('ACTIVE')}>ACTIVE</Radio>
          <Radio name="status" checked={status === 'INACTIVE'} onChange={() => setStatus('INACTIVE')}>INACTIVE</Radio>
        </div>
      </div>

      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save}>Lưu chuồng</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
