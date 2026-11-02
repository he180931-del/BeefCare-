import { useState } from 'react'
import { Field, Select, Textarea, DateInput, Note } from '../../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { STAGES, TODAY } from '../../../data/cowsData'
import { LIFE_STAGE_OPTIONS } from '../../../api/cattleBackendApi'
import { listPurposes, updateIdentity, updatePurpose, updateStage } from '../api/cattleApi'
import { useMutation, useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { Panel, Seg, fieldCls } from './parts'
import type { CowSeed } from '../../../data/cowsData'

const TABS = [
  ['identity', 'Định danh & mô tả'],
  ['purpose', 'Mục đích nuôi'],
  ['stage', 'Giai đoạn'],
] as const

type IdentityPayload = { name: string; tag: string; description: string }
type StagePayload = { stage: string; date: string; reason: string }
type FormErrors = { stage?: string; reason?: string }

export default function UpdateModal({ cow, owner = false, onClose, onSaved }: { cow: CowSeed; owner?: boolean; onClose: () => void; onSaved: () => void }) {
  const backend = cow.backendId != null && cow.backendVersion != null
  const context = backend
    ? {
        backendId: cow.backendId,
        backendVersion: cow.backendVersion,
        currentProfile: { earTagNumber: cow.tag, name: cow.name, colourMarkings: cow.colourMarkings, notes: cow.notes, productionPurposeId: cow.purposeId, lifeStage: cow.lifeStage },
      }
    : {}
  const purposes = useQuery(() => listPurposes(), [])
  const saveIdentity = useMutation((payload: IdentityPayload) => updateIdentity(cow.code, payload, context))
  const saveStage = useMutation((payload: StagePayload) => updateStage(cow.code, payload, context))
  const savePurpose = useMutation((id: number) => updatePurpose(cow.code, id, { ...context, effectiveDate: date, reason: reason.trim() || undefined }))
  const isDemo = !backend && cow.code === 'BC-000142'
  const [tab, setTab] = useState('stage')
  const [identity, setIdentity] = useState<IdentityPayload>({ name: cow.name ?? '', tag: cow.tag ?? '', description: backend ? cow.colourMarkings ?? '' : cow.description ?? '' })
  const [stage, setStage] = useState(backend ? cow.lifeStage ?? 'ADULT' : isDemo ? 'Bò cái sinh sản' : cow.stage)
  const [date, setDate] = useState(backend ? new Date().toISOString().slice(0, 10) : TODAY)
  const [reason, setReason] = useState(isDemo ? 'Đủ 13 tháng & 236 kg, đưa vào theo dõi sinh sản' : '')
  const [purposeId, setPurposeId] = useState(cow.purposeId ? String(cow.purposeId) : '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [failure, setFailure] = useState('')
  const canChangePurpose = owner && (!backend || cow.canChangePurpose === true)

  const run = async (job: () => Promise<unknown>) => {
    setFailure('')
    try {
      await job()
      onSaved()
    } catch (e) {
      setFailure(userFacingError(e, 'Không lưu được thay đổi. Vui lòng thử lại.'))
    }
  }

  const save = async () => {
    if (tab === 'identity') return run(() => saveIdentity.mutate(identity))
    if (tab === 'purpose') {
      if (!canChangePurpose || !purposeId || Number(purposeId) === cow.purposeId) return onClose()
      const e: FormErrors = reason.trim() ? {} : { reason: 'Nhập lý do.' }
      setErrors(e)
      if (Object.keys(e).length) return
      return run(() => savePurpose.mutate(Number(purposeId)))
    }
    const e: FormErrors = {}
    if (stage === (backend ? cow.lifeStage : cow.stage)) e.stage = 'Chọn giai đoạn khác giai đoạn hiện tại.'
    if (!reason.trim()) e.reason = 'Nhập lý do.'
    setErrors(e)
    if (Object.keys(e).length) return
    return run(() => saveStage.mutate({ stage, date, reason: reason.trim() }))
  }

  const stageOptions = backend ? LIFE_STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) : STAGES.map((s) => ({ value: s, label: s }))

  return (
    <Modal
      title={`Cập nhật hồ sơ – ${cow.code}`}
      topTitle="Cập nhật hồ sơ bò"
      sub={`${cow.breed} · ${cow.sex} · ${cow.ageLong} · ${cow.barn}`}
      width={600}
      onClose={onClose}
    >
      <div>
        <Seg options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'identity' && (
        <Panel pad="p-0" gap="gap-4" className="border-0">
          <Field label="Số thẻ tai">
            <input className={fieldCls} value={identity.tag} onChange={(e) => setIdentity({ ...identity, tag: e.target.value })} />
          </Field>
          <Field label="Tên gọi">
            <input className={fieldCls} value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
          </Field>
          <Field label="Màu lông & đặc điểm">
            <Textarea className="!h-16 !leading-[normal]" value={identity.description} onChange={(e) => setIdentity({ ...identity, description: e.target.value })} />
          </Field>
          <Note tone="grey">Ảnh và mô tả giúp nhận diện khi thẻ tai mất hoặc chưa gắn. Số thẻ tai không trùng với bò đang nuôi.</Note>
        </Panel>
      )}

      {tab === 'purpose' && (
        <>
          <Field label="Mục đích hiện tại">
            <input className={fieldCls} value={cow.purpose} readOnly />
          </Field>
          <Field label="Mục đích mới *">
            <Select className="[&_select]:!leading-[normal]" disabled={!canChangePurpose} value={purposeId} onChange={(e) => setPurposeId(e.target.value)}>
              {!backend && <option>{cow.purpose}</option>}
              {(purposes.data ?? []).filter((p) => p.available).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          {canChangePurpose && backend && (
            <>
              <Field label="Ngày hiệu lực *"><DateInput value={date} onChange={setDate} /></Field>
              <Field label="Lý do *">
                <Textarea className="!h-16 !leading-[normal]" value={reason} onChange={(e) => setReason(e.target.value)} />
                {errors.reason && <span className="text-[11px] text-err-fg">{errors.reason}</span>}
              </Field>
            </>
          )}
          <Note tone="grey">Mục đích nuôi chỉ Chủ trại được đổi. Bò đã xuất hoặc đã hủy chỉ xem.</Note>
        </>
      )}

      {tab === 'stage' && (
        <>
          <Field label="Giai đoạn hiện tại">
            <input className={fieldCls} value={cow.stage} readOnly />
          </Field>
          <Field label="Giai đoạn mới *">
            <Select className="[&_select]:!leading-[normal]" value={stage} onChange={(e) => setStage(e.target.value)}>
              {stageOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            {errors.stage && <span className="text-[11px] text-err-fg">{errors.stage}</span>}
          </Field>
          <Field label="Ngày hiệu lực *">
            <DateInput value={date} onChange={setDate} />
          </Field>
          <Field label="Lý do *">
            <Textarea className="!h-16 !leading-[normal]" value={reason} onChange={(e) => setReason(e.target.value)} />
            {errors.reason && <span className="text-[11px] text-err-fg">{errors.reason}</span>}
          </Field>
          <Note tone="grey">Mục đích nuôi chỉ Chủ trại được đổi. Bò đã xuất hoặc đã hủy chỉ xem.</Note>
        </>
      )}

      {failure && <Note tone="err">{failure}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save}>Lưu thay đổi</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
