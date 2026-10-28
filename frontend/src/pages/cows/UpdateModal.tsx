import { useState } from 'react'
import { Field, Select, Textarea, DateInput, Note } from '../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { STAGES, TODAY } from '../../data/cowsData'
import { updateIdentity, updateStage } from '../../api/cattleApi'
import { useMutation } from '../../hooks/useApi'
import { Panel, Seg, fieldCls } from './parts'
import type { CowSeed } from '../../data/cowsData'

const TABS = [
  ['identity', 'Định danh & mô tả'],
  ['purpose', 'Mục đích nuôi'],
  ['stage', 'Giai đoạn'],
] as const

type IdentityPayload = { name: string; tag: string; description: string }
type StagePayload = { stage: string; date: string; reason: string }
type FormErrors = { stage?: string; reason?: string }

export default function UpdateModal({ cow, onClose, onSaved }: { cow: CowSeed; onClose: () => void; onSaved: () => void }) {
  const saveIdentity = useMutation((payload: IdentityPayload) => updateIdentity(cow.code, payload))
  const saveStage = useMutation((payload: StagePayload) => updateStage(cow.code, payload))
  const isDemo = cow.code === 'BC-000142'
  const [tab, setTab] = useState('stage')
  const [identity, setIdentity] = useState<IdentityPayload>({ name: cow.name ?? '', tag: cow.tag ?? '', description: cow.description ?? '' })
  const [stage, setStage] = useState(isDemo ? 'Bò cái sinh sản' : cow.stage)
  const [date, setDate] = useState(TODAY)
  const [reason, setReason] = useState(isDemo ? 'Đủ 13 tháng & 236 kg, đưa vào theo dõi sinh sản' : '')
  const [errors, setErrors] = useState<FormErrors>({})

  const save = async () => {
    if (tab === 'identity') {
      await saveIdentity.mutate(identity)
      return onSaved()
    }
    if (tab === 'stage') {
      const e: FormErrors = {}
      if (stage === cow.stage) e.stage = 'Chọn giai đoạn khác giai đoạn hiện tại.'
      if (!reason.trim()) e.reason = 'Nhập lý do.'
      setErrors(e)
      if (Object.keys(e).length) return
      await saveStage.mutate({ stage, date, reason: reason.trim() })
    }
    onSaved()
  }

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tên gọi">
              <input className={fieldCls} value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
            </Field>
            <Field label="Số tai phụ">
              <input className={fieldCls} value={identity.tag} onChange={(e) => setIdentity({ ...identity, tag: e.target.value })} />
            </Field>
          </div>
          <Field label="Mô tả">
            <Textarea className="!h-16 !leading-[normal]" value={identity.description} onChange={(e) => setIdentity({ ...identity, description: e.target.value })} />
          </Field>
        </Panel>
      )}

      {tab === 'purpose' && (
        <>
          <Field label="Mục đích hiện tại">
            <input className={fieldCls} value={cow.purpose} readOnly />
          </Field>
          <Field label="Mục đích mới">
            <Select className="[&_select]:!leading-[normal]" disabled value={cow.purpose} onChange={() => {}}>
              <option>{cow.purpose}</option>
            </Select>
          </Field>
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
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
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

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save}>Lưu thay đổi</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
