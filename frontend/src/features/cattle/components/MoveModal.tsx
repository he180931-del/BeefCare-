import { useEffect, useState } from 'react'
import { Field, DateInput, Note, Select, Table } from '../../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { MANAGER, OWNER, TODAY } from '../../../data/cowsData'
import { checkPenMove, moveBarn } from '../api/cattleApi'
import { useMutation } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { Chip, Td, Th, fieldCls } from './parts'
import type { CowSeed } from '../../../data/cowsData'
import type { Pen } from '../../../types'

type MovePayload = { to: string; date: string; reason: string; by: string }
type CheckResult = Awaited<ReturnType<typeof checkPenMove>>

export default function MoveModal({ cow, barns, onClose, onSaved }: { cow: CowSeed; barns: Record<string, Pen>; onClose: () => void; onSaved: () => void }) {
  const backend = cow.backendId != null
  const from = barns[cow.barn]
  const isDemo = !backend && cow.code === 'BC-000142'
  const options = Object.values(barns).filter((b) => b.code !== cow.barn && b.status === 'ACTIVE')
  const [to, setTo] = useState(backend ? options[0]?.code ?? '' : options.find((b) => b.code === 'A1')?.code ?? options[0]?.code ?? '')
  const [date, setDate] = useState(backend ? new Date().toISOString().slice(0, 10) : TODAY)
  const [by, setBy] = useState(MANAGER)
  const [reason, setReason] = useState(isDemo ? 'Đủ 13 tháng & 236 kg – chuẩn bị theo dõi sinh sản' : '')
  const [check, setCheck] = useState<CheckResult>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const dest = barns[to]
  const destId = typeof dest?.backendId === 'number' ? dest.backendId : undefined
  const warningRequired = check?.cattle?.some((c) => c.warningReasonRequired) === true
  const move = useMutation((payload: MovePayload) => moveBarn(cow.code, payload, backend ? { backendId: cow.backendId, backendVersion: cow.backendVersion, toPenId: destId, warningReason: warningRequired ? payload.reason : undefined } : {}))

  // Backend kiểm tra tiếp nhận (chuồng đích ACTIVE, còn chỗ, tiêu chí) trước khi cho chuyển.
  useEffect(() => {
    if (!backend || destId == null) { setCheck(null); return }
    let active = true
    setChecking(true)
    setError('')
    checkPenMove(cow.code, { date, toPenId: destId }, { backendId: cow.backendId })
      .then((result) => { if (active) setCheck(result) })
      .catch((e: unknown) => { if (active) { setCheck(null); setError(userFacingError(e, 'Không kiểm tra được điều kiện tiếp nhận.')) } })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [backend, destId, date, cow.code, cow.backendId])

  const blockText = check?.blocked ? check.block?.text ?? check.block?.message ?? 'Chuồng đích không nhận được bò này.' : ''
  const checks: Array<[string, boolean]> = backend
    ? [['Chuồng đích ACTIVE và còn chỗ', !!check && !check.blocked], ...(warningRequired ? [['Tiêu chí tiếp nhận của chuồng', false] as [string, boolean]] : [])]
    : [
        ['Chuồng đích ACTIVE và còn chỗ', dest?.status === 'ACTIVE' && dest.count < dest.capacity],
        ['Mục đích nuôi khớp tiêu chí chuồng', cow.purpose === dest?.purpose],
        [`Ngưỡng ≥ ${dest?.minMonths ?? 0} tháng và ≥ ${dest?.minKg ?? 0} kg`, cow.months >= (dest?.minMonths ?? 0) && cow.weight != null && cow.weight >= (dest?.minKg ?? 0)],
        ['Giai đoạn khớp tiêu chí chuồng', cow.stage === dest?.stage],
      ]
  const canSave = reason.trim() !== '' && (backend ? !!check && !check.blocked && !checking && !move.loading : checks[0][1])

  const confirm = async () => {
    setError('')
    try {
      await move.mutate({ to, date, reason: reason.trim(), by })
      onSaved()
    } catch (e) {
      setError(userFacingError(e, 'Không chuyển được chuồng. Vui lòng thử lại.'))
    }
  }

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
          <div className="flex min-h-11 items-center rounded-xl border border-field bg-page px-2.5 text-sm leading-[normal] text-muted">{from ? `${from.name} · ${from.count}/${from.capacity}` : '—'}</div>
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
      {blockText && <Note tone="err">{blockText}</Note>}
      {error && <Note tone="err">{error}</Note>}
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
              <Td>{ok ? <Chip tone="ok" icon="circle-check">Đạt</Chip> : <Chip tone="warn">Chưa khớp</Chip>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!canSave} onClick={confirm}>Xác nhận chuyển chuồng</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
