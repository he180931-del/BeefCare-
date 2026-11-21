import { useEffect, useState } from 'react'
import { Button, DateInput, Field, Modal, ModalButton, ModalFooter, Note, Select, Table } from '../../../shared/ui'
import { cattleToday, checkPenMove, demoActors, demoCowPrefill, demoRecorder, moveBarn } from '../api/cattleApi'
import { useMutation } from '../../../shared/hooks/useMutation'
import { cattleError as cattleErrorMessage } from '../api/cattleError'
import { BackendError } from '../../../shared/api/backendClient'
import { Chip, Td, Th, fieldCls } from './parts'
import type { CattleViewModel as CowSeed } from '../types'
import type { Pen } from '../../pen-management'

type MovePayload = { to: string; date: string; reason: string; by: string }
type CheckResult = Awaited<ReturnType<typeof checkPenMove>>

const CRITERION_TEXT: Record<string, string> = {
  PURPOSE_TYPE: 'Loại mục đích phù hợp',
  LIFE_STAGE: 'Giai đoạn phù hợp',
  SEX: 'Giới tính phù hợp',
  MIN_AGE_MONTHS: 'Tuổi tối thiểu',
  MIN_WEIGHT_KG: 'Cân tối thiểu',
}
type CheckRow = [string, boolean | null]

export default function MoveModal({ cow, barns, onClose, onReload = onClose, onSaved }: { cow: CowSeed; barns: Record<string, Pen>; onClose: () => void; onReload?: () => void; onSaved: () => void }) {
  const backend = cow.backendId != null
  const from = barns[cow.barn]
  const prefill = demoCowPrefill(cow)
  const options = Object.values(barns).filter((b) => b.code !== cow.barn && b.status === 'ACTIVE')
  const [to, setTo] = useState(backend ? options[0]?.code ?? '' : options.find((b) => b.code === 'A1')?.code ?? options[0]?.code ?? '')
  const [enteredDate, setDate] = useState<string>()
  const date = enteredDate ?? cattleToday()
  const [by, setBy] = useState(demoRecorder)
  const [reason, setReason] = useState(prefill?.moveReason ?? '')
  // R-04-05: lý do cảnh báo là trường riêng, lưu theo phân chuồng mới, không dùng lại lý do chuyển.
  const [warningReason, setWarningReason] = useState('')
  const [check, setCheck] = useState<CheckResult>(null)
  const [checkRun, setCheckRun] = useState(0)
  const [needsReload, setNeedsReload] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const dest = barns[to]
  const destId = typeof dest?.backendId === 'number' ? dest.backendId : undefined
  const warningRequired = check?.cattle?.some((c) => c.warningReasonRequired) === true
  const move = useMutation((payload: MovePayload) => moveBarn(cow.code, payload, backend ? { backendId: cow.backendId, backendVersion: cow.backendVersion, toPenId: destId, warningReason: warningRequired ? warningReason.trim() : undefined } : {}))

  // Backend kiểm tra tiếp nhận (chuồng đích ACTIVE, còn chỗ, tiêu chí) trước khi cho chuyển.
  useEffect(() => {
    if (!backend || destId == null || !date) { setCheck(null); setChecking(false); return }
    let active = true
    setChecking(true)
    setError('')
    checkPenMove(cow.code, { date, toPenId: destId }, { backendId: cow.backendId })
      .then((result) => { if (active) setCheck(result) })
      .catch((e: unknown) => { if (active) { setCheck(null); setError(cattleErrorMessage(e, 'Không kiểm tra được điều kiện tiếp nhận.')) } })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [backend, destId, date, cow.code, cow.backendId, checkRun])

  const blockText = check?.blocked ? check.block?.text ?? check.block?.message ?? 'Chuồng đích không nhận được bò này.' : ''
  // Backend trả kết quả theo từng tiêu chí (MET / NOT_MET / NOT_APPLICABLE); null = Không áp dụng.
  const results = check?.cattle?.[0]?.results ?? []
  const cattleError = check?.cattle?.[0]?.error
  const checks: CheckRow[] = backend
    ? [
        ['Chuồng đích ACTIVE và còn chỗ', !!check && !check.blocked],
        ...results.map((r): CheckRow => [CRITERION_TEXT[r.criterion ?? ''] ?? String(r.criterion), r.outcome === 'NOT_APPLICABLE' ? null : r.outcome === 'MET']),
      ]
    : [
        ['Chuồng đích ACTIVE và còn chỗ', dest?.status === 'ACTIVE' && dest.count < dest.capacity],
        ['Mục đích nuôi khớp tiêu chí chuồng', cow.purpose === dest?.purpose],
        [`Ngưỡng ≥ ${dest?.minMonths ?? 0} tháng và ≥ ${dest?.minKg ?? 0} kg`, cow.months >= (dest?.minMonths ?? 0) && cow.weight != null && cow.weight >= (dest?.minKg ?? 0)],
        ['Giai đoạn khớp tiêu chí chuồng', cow.stage === dest?.stage],
      ]
  const canSave = !needsReload && date !== '' && reason.trim() !== '' && (backend
    ? !!check && !check.blocked && !cattleError && !checking && !move.loading && (!warningRequired || warningReason.trim() !== '')
    : checks[0][1] === true)

  const confirm = async () => {
    if (!canSave) return
    setError('')
    try {
      await move.mutate({ to, date, reason: reason.trim(), by })
      onSaved()
    } catch (e) {
      setError(cattleErrorMessage(e, 'Không chuyển được chuồng. Vui lòng thử lại.'))
      if (e instanceof BackendError) {
        if (e.code === 'MSG-COM-05') setNeedsReload(true)
        if (e.code === 'MSG-FE04-05') {
          setCheck(null)
          setCheckRun((run) => run + 1)
        }
      }
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
        {demoActors.length > 0 && (
          <Field label="Người thực hiện">
            <Select className="[&_select]:!leading-[normal]" value={by} onChange={(e) => setBy(e.target.value)}>
              {demoActors.map((actor) => <option key={actor.value} value={actor.value}>{actor.label}</option>)}
            </Select>
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="Lý do *">
            <input className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </div>

      <p className="m-0 text-[14px] font-semibold leading-[normal] text-[#212121]">Kiểm tra tiếp nhận</p>
      {blockText && <Note tone="err">{blockText}</Note>}
      {error && <Note tone="err">{error}</Note>}
      {cattleError && <Note tone="err">{cattleError.message ?? cattleError.text ?? 'Bò này không chuyển được chuồng.'}</Note>}
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
              <Td>{ok == null ? <Chip tone="grey">Không áp dụng</Chip> : ok ? <Chip tone="ok" icon="circle-check">Đạt</Chip> : <Chip tone="warn">Chưa khớp</Chip>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {backend && warningRequired && (
        <Field label="Lý do cảnh báo *">
          <Note tone="warn">{check?.cattle?.[0]?.warning?.text ?? `${cow.code} không đạt tiêu chí nhận bò của chuồng đích. Nhập lý do để tiếp tục.`}</Note>
          <input className={fieldCls} maxLength={500} value={warningReason} onChange={(e) => setWarningReason(e.target.value)} aria-label="Lý do cảnh báo" />
        </Field>
      )}

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        {needsReload
          ? <ModalButton variant="primary" onClick={onReload}>Tải lại hồ sơ bò</ModalButton>
          : <ModalButton variant="primary" disabled={!canSave} onClick={confirm}>Xác nhận chuyển chuồng</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}
