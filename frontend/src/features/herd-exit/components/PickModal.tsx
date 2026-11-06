import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Checkbox, Field, Note, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { money } from '../../../data/format'
import { TH } from './parts'
import type { HerdExit } from '../../../types'
type HerdCow = { code: string; tag: string; breed: string; sex: string; age: string; group: string; groupKey?: string; stage: string; stageKey?: string; barn: string; weight: number; weightNote: string; estimated: boolean; unitPrice: number; withdrawalUntil?: string; openCase?: string; penCount?: number; penCapacity?: number }

// Bò đang nằm trong phiếu khác (Nháp / Chờ xác nhận / Đã xuất) thì không hiện để chọn.
const ACTIVE_STATUSES = ['Nháp', 'Chờ xác nhận', 'Đã xuất']

export default function PickModal({ id, herdExits, candidates: availableCattle, picked, setPicked, onClose }: { id: string; herdExits: HerdExit[]; candidates: HerdCow[]; picked: HerdCow[]; setPicked: (rows: HerdCow[]) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [barn, setBarn] = useState('all')
  const [group, setGroup] = useState('all')
  const [minWeight, setMinWeight] = useState(0)
  const [selected, setSelected] = useState(() => new Set(picked.map((c) => c.code)))

  const busy = new Set(
    herdExits
      .filter((r) => r.id !== id && ACTIVE_STATUSES.includes(r.status))
      .flatMap((r) => (r.draft?.cows ?? r.detail?.cows ?? []).map((c) => c.code)),
  )
  const candidates: HerdCow[] = availableCattle.filter((c) => !busy.has(c.code)).map((c) => ({ ...c, unitPrice: typeof c.unitPrice === 'number' ? c.unitPrice : 0 }))
  const barnOptions = [...new Set(candidates.map((c) => c.barn).filter(Boolean))]
  const groupOptions = [...new Map(candidates.map((c) => [c.groupKey ?? c.group, c.group])).entries()]
  const rows = candidates.filter(
    (c) =>
      (!query || `${c.code} ${c.tag}`.toLowerCase().includes(query.toLowerCase())) &&
      (barn === 'all' || c.barn === barn) &&
      (group === 'all' || (c.groupKey ?? c.group) === group) &&
      c.weight >= minWeight,
  )

  const toggle = (code: string) => {
    const next = new Set(selected)
    next.has(code) ? next.delete(code) : next.add(code)
    setSelected(next)
  }
  const confirm = () => {
    const kept = picked.filter((c) => selected.has(c.code))
    const added = candidates
      .filter((c) => selected.has(c.code) && !picked.some((p) => p.code === c.code))
      .map((c) => ({ ...c, unitPrice: c.unitPrice ?? 0 }))
    setPicked([...kept, ...added])
    onClose()
  }
  const selectedWeight = candidates.filter((c) => selected.has(c.code)).reduce((s, c) => s + c.weight, 0)
  const occupancy = [...new Map(candidates
    .filter((c) => typeof c.penCount === 'number' && typeof c.penCapacity === 'number')
    .map((c) => [c.barn, { count: c.penCount as number, capacity: c.penCapacity as number }])).entries()]

  return (
    <Modal width={820} title={`Chọn bò vào phiếu xuất ${id}`} sub="Chỉ hiện bò ACTIVE chưa nằm trong phiếu xuất khác đang Nháp / Chờ xác nhận / Đã xuất" topTitle="Chọn bò vào phiếu xuất" onClose={onClose}>
      <div className="-mt-2 flex flex-wrap items-end gap-3">
        <Field label="Tìm kiếm">
          <input className={`${inputCls} !w-[260px]`} placeholder="Mã bò, thẻ tai…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <Field label="Chuồng">
          <Select className="w-[150px]" value={barn} onChange={(e) => setBarn(e.target.value)}>
            <option value="all">Tất cả chuồng</option>{barnOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </Field>
        <Field label="Nhóm đàn">
          <Select className="w-[150px]" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">Tất cả nhóm</option>{groupOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Cân gần nhất tối thiểu">
          <Select className="w-[176px]" value={minWeight} onChange={(e) => setMinWeight(Number(e.target.value))}>
            <option value={0}>≥ 0 kg</option><option value={300}>≥ 300 kg</option><option value={350}>≥ 350 kg</option>
          </Select>
        </Field>
      </div>

      <Table stack={false}>
        <thead>
          <tr>
            <Th className={TH} />
            <Th className={TH}>Mã bò · thẻ tai</Th><Th className={TH}>Nhóm đàn · giai đoạn</Th><Th className={TH}>Chuồng</Th>
            <Th className={TH}>Tuổi</Th><Th className={TH}>Cân gần nhất</Th><Th className={TH}>Cảnh báo</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.code} className="cursor-pointer" onClick={() => toggle(c.code)}>
              <Td className={TH}><Checkbox checked={selected.has(c.code)} onChange={() => toggle(c.code)} aria-label={c.code} /></Td>
              <Td className={TH}>{c.code} / {c.tag}</Td>
              <Td className={TH}>{c.group}<br />{c.stage}</Td>
              <Td className={TH}>{c.barn}</Td>
              <Td className={TH}>{c.age}</Td>
              <Td className={TH}>{c.weight} kg<br />{c.weightNote}</Td>
              <Td className={TH}>
                {c.withdrawalUntil && <Badge tone="err" icon="ban">Ngưng GM → {c.withdrawalUntil.slice(8)}/{c.withdrawalUntil.slice(5, 7)}</Badge>}
                {c.openCase && <Badge tone="warn">Ca mở {c.openCase}</Badge>}
                {!c.withdrawalUntil && !c.openCase && '—'}
              </Td>
            </tr>
          ))}
          {!rows.length && <tr><Td colSpan={7} className="text-center text-muted">Không có bò phù hợp</Td></tr>}
        </tbody>
      </Table>

      {occupancy.map(([pen, value]) => <Note key={pen}>Chuồng {pen}: {value.count}/{value.capacity} con</Note>)}

      <Note>Cảnh báo không chặn việc chọn – Chủ trại xem lại ở bước "Kiểm tra trước khi xác nhận". Quét QR chưa được tích hợp với API hiện tại.</Note>
      <div className="-mt-2 text-[13px] font-semibold text-[#0b563c]">
        Đã chọn {selected.size} con · ~{money(selectedWeight)} kg theo cân gần nhất
      </div>
      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!selected.size} onClick={confirm}><Icon name="circle-plus" />Thêm {selected.size} con vào phiếu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
