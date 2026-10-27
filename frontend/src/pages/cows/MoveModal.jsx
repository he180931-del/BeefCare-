import { useState } from 'react'
import { Field, DateInput, Select, Table } from '../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { MANAGER, OWNER, TODAY, useCowStore } from '../../data/cowsData'
import { Chip, Td, Th, fieldCls } from './parts'

export default function MoveModal({ cow, onClose }) {
  const { barns, moveBarn } = useCowStore()
  const from = barns[cow.barn]
  const isDemo = cow.code === 'BC-000142'
  const options = Object.values(barns).filter((b) => b.code !== cow.barn)
  const [to, setTo] = useState(options.find((b) => b.code === 'A1')?.code ?? options[0]?.code)
  const [date, setDate] = useState(TODAY)
  const [by, setBy] = useState(MANAGER)
  const [reason, setReason] = useState(isDemo ? 'Đủ 13 tháng & 236 kg – chuẩn bị theo dõi sinh sản' : '')

  const dest = barns[to]
  const checks = [
    ['Chuồng đích ACTIVE và còn chỗ', dest.count < dest.capacity],
    ['Mục đích nuôi khớp tiêu chí chuồng', cow.purpose === dest.purpose],
    [`Ngưỡng ≥ ${dest.minMonths} tháng và ≥ ${dest.minKg} kg`, cow.months >= dest.minMonths && cow.weight != null && cow.weight >= dest.minKg],
    ['Giai đoạn khớp tiêu chí chuồng', cow.stage === dest.stage],
  ]
  const canSave = checks[0][1] && reason.trim() !== ''

  return (
    <Modal
      title={`Chuyển chuồng – ${cow.code}`}
      topTitle="Chuyển chuồng"
      sub={`${cow.breed} · ${cow.sex} · ${cow.ageLong} · ${cow.weight != null ? `${cow.weight} kg` : '—'}`}
      width={640}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Từ chuồng">
          <input className={fieldCls} readOnly value={`${from.name} · ${from.count}/${from.capacity}`} />
        </Field>
        <Field label="Chuồng đích *">
          <Select className="[&_select]:!leading-[normal]" value={to} onChange={(e) => setTo(e.target.value)}>
            {options.map((b) => <option key={b.code} value={b.code}>{`${b.name} · ${b.count}/${b.capacity}`}</option>)}
          </Select>
        </Field>
        <Field label="Ngày chuyển *">
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field label="Người thực hiện">
          <Select className="[&_select]:!leading-[normal]" value={by} onChange={(e) => setBy(e.target.value)}>
            <option value={MANAGER}>{MANAGER}</option>
            <option value={OWNER}>{OWNER}</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Lý do *">
            <input className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </div>

      <p className="m-0 text-[14px] font-semibold leading-[normal] text-[#212121]">Kiểm tra tiếp nhận</p>
      <Table stack={false}>
        <thead>
          <tr>
            <Th className="w-[420px]">Điều kiện</Th>
            <Th className="w-[120px]">Kết quả</Th>
          </tr>
        </thead>
        <tbody>
          {checks.map(([label, ok]) => (
            <tr key={label}>
              <Td className="!h-9">{label}</Td>
              <Td>{ok ? <Chip tone="ok">Đạt</Chip> : <Chip tone="warn">Chưa khớp</Chip>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton
          variant="primary"
          disabled={!canSave}
          onClick={() => {
            moveBarn(cow.code, { to, date, reason: reason.trim(), by })
            onClose()
          }}
        >
          Xác nhận chuyển chuồng
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
