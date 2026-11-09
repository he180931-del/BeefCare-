import { useState } from 'react'
import { Field, Select, Textarea, DateInput, Note } from '../../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { STAGES, TODAY } from '../../../data/cowsData'
import { LIFE_STAGE_OPTIONS } from '../../../api/cattleBackendApi'
import { BackendError } from '../../../api/backendClient'
import { listPurposes, removeCattlePhoto, updateIdentity, updatePurpose, updateStage, uploadCattlePhoto } from '../api/cattleApi'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import {
  PURPOSE_TYPE_LABELS, purposeFitsSex, purposeSexMessage, todayIso, validateDatedChange, validateIdentity, validatePhoto,
  type DatedChangeErrors, type IdentityErrors, type IdentityValues,
} from '../domain/profileRules'
import { Panel, Seg, fieldCls } from './parts'
import type { CowSeed } from '../../../data/cowsData'

const TABS = [
  ['identity', 'Định danh & mô tả'],
  ['purpose', 'Mục đích nuôi'],
  ['stage', 'Giai đoạn'],
] as const
type Tab = typeof TABS[number][0]

const ErrorText = ({ children }: { children?: string }) => (children ? <span className="text-[11px] text-err-fg">{children}</span> : null)
const codeOf = (error: unknown) => (error instanceof BackendError ? error.code : null)

/**
 * Update Cattle Profile popup (UC-FE05-03). One tab is saved at a time. Purpose is Owner-only (R-05-03); purpose and
 * life stage need an effective date and a reason (R-05-05). When the change ends reproduction tracking the backend
 * answers MSG-FE05-11 and the user confirms before it is saved again (R-05-08). `suggestion` pre-fills the stage tab
 * when opened from a REM-08 suggestion (R-05-09).
 */
export default function UpdateModal({ cow, owner = false, onClose, onSaved, initialTab = 'stage', suggestion, today = todayIso() }: {
  cow: CowSeed
  owner?: boolean
  onClose: () => void
  onSaved: (message?: string) => void
  initialTab?: Tab
  suggestion?: { stage: string; date: string; reason: string }
  today?: string
}) {
  const backend = cow.backendId != null && cow.backendVersion != null
  const context = backend
    ? {
        backendId: cow.backendId,
        backendVersion: cow.backendVersion,
        currentProfile: { earTagNumber: cow.tag, name: cow.name, colourMarkings: cow.colourMarkings, notes: cow.notes, productionPurposeId: cow.purposeId, lifeStage: cow.lifeStage },
      }
    : {}
  const purposes = useQuery(() => listPurposes(), [])
  const isDemo = !backend && cow.code === 'BC-000142'
  const initialIdentity: IdentityValues = { name: cow.name ?? '', tag: cow.tag ?? '', colour: backend ? cow.colourMarkings ?? '' : cow.description ?? '', notes: cow.notes ?? '' }
  const currentStage = (backend ? cow.lifeStage : cow.stage) ?? ''
  const [tab, setTab] = useState<string>(suggestion ? 'stage' : initialTab)
  const [identity, setIdentity] = useState<IdentityValues>(initialIdentity)
  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [stage, setStage] = useState(suggestion?.stage ?? (backend ? cow.lifeStage ?? 'ADULT' : isDemo ? 'Bò cái sinh sản' : cow.stage))
  const [date, setDate] = useState(suggestion?.date ?? (backend ? today : TODAY))
  const [reason, setReason] = useState(suggestion?.reason ?? (isDemo ? 'Đủ 13 tháng & 236 kg, đưa vào theo dõi sinh sản' : ''))
  const [purposeId, setPurposeId] = useState(cow.purposeId ? String(cow.purposeId) : '')
  const [identityErrors, setIdentityErrors] = useState<IdentityErrors>({})
  const [errors, setErrors] = useState<DatedChangeErrors>({})
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRepro, setConfirmRepro] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const canChangePurpose = owner && (!backend || cow.canChangePurpose === true)
  const sex = (cow.sexCode as string | undefined) ?? cow.sex
  const entryDate = (cow.entryDate as string | undefined) ?? null
  const purposeOptions = (purposes.data ?? []).filter((p) => p.available)
  const chosenPurpose = purposeOptions.find((p) => String(p.id) === purposeId)

  // AF4: closing with unsaved input asks first (MSG-COM-14); values pre-filled on open do not count.
  const [initial] = useState(() => ({ stage, reason, purposeId }))
  const dirty = JSON.stringify(identity) !== JSON.stringify(initialIdentity) || photo != null || removePhoto
    || stage !== initial.stage || reason !== initial.reason || purposeId !== initial.purposeId

  const close = () => (dirty && !saving ? setConfirmDiscard(true) : onClose())

  const run = async (job: (acknowledged: boolean) => Promise<unknown>, acknowledged = false) => {
    setFailure('')
    setSaving(true)
    try {
      await job(acknowledged)
      onSaved(`Đã cập nhật hồ sơ ${cow.code}.`)
    } catch (e) {
      if (codeOf(e) === 'MSG-FE05-11' && !acknowledged) {
        setConfirmRepro(`Sau thay đổi này ${cow.code} sẽ không còn được theo dõi sinh sản. Lịch sử sinh sản được giữ lại. Tiếp tục?`)
        return
      }
      setFailure(userFacingError(e, 'Không lưu được thay đổi. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const saveIdentity = () => {
    const e = validateIdentity(identity)
    setIdentityErrors(e)
    if (Object.keys(e).length || photoError) return
    return run(async () => {
      const changed = JSON.stringify(identity) !== JSON.stringify(initialIdentity)
      let version = cow.backendVersion
      if (changed || !backend) {
        const result = await updateIdentity(cow.code, { name: identity.name.trim(), tag: identity.tag.trim(), description: identity.colour.trim(), notes: identity.notes.trim() }, context)
        const next = (result as { version?: unknown } | null)?.version
        if (typeof next === 'number') version = next
      }
      if (backend && photo) await uploadCattlePhoto({ ...context, backendVersion: version }, photo)
      else if (backend && removePhoto) await removeCattlePhoto({ ...context, backendVersion: version })
    })
  }

  const savePurpose = (acknowledged = false) => {
    if (!canChangePurpose) return onClose()
    const e = validateDatedChange({ value: purposeId, current: cow.purposeId ? String(cow.purposeId) : '', date, reason, today, entryDate })
    if (!e.value && chosenPurpose && !purposeFitsSex(chosenPurpose.purposeType, sex)) e.value = purposeSexMessage(chosenPurpose.name, chosenPurpose.purposeType)
    setErrors(e)
    if (Object.keys(e).length) return
    return run((ack) => updatePurpose(cow.code, Number(purposeId), { ...context, effectiveDate: date, reason: reason.trim(), acknowledgedReproductionChange: ack }), acknowledged)
  }

  const saveStage = (acknowledged = false) => {
    const e = validateDatedChange({ value: stage, current: currentStage, date, reason, today: backend ? today : '9999-12-31', entryDate })
    setErrors(e)
    if (Object.keys(e).length) return
    return run((ack) => updateStage(cow.code, { stage, date, reason: reason.trim(), acknowledgedReproductionChange: ack }, context), acknowledged)
  }

  const save = () => (tab === 'identity' ? saveIdentity() : tab === 'purpose' ? savePurpose() : saveStage())
  const confirmReproEnd = () => {
    setConfirmRepro('')
    void (tab === 'purpose' ? savePurpose(true) : saveStage(true))
  }

  const pickPhoto = (file: File | null) => {
    setRemovePhoto(false)
    setPhoto(file)
    setPhotoError(file ? validatePhoto(file) : '')
  }

  const stageOptions = backend ? LIFE_STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) : STAGES.map((s) => ({ value: s, label: s }))
  const datedFields = (
    <>
      <Field label="Ngày hiệu lực *">
        <DateInput value={date} onChange={setDate} />
        <ErrorText>{errors.date}</ErrorText>
      </Field>
      <Field label="Lý do *">
        <Textarea className="!h-16 !leading-[normal]" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <ErrorText>{errors.reason}</ErrorText>
      </Field>
    </>
  )

  return (
    <Modal
      title={`Cập nhật hồ sơ – ${cow.code}`}
      topTitle="Cập nhật hồ sơ bò"
      sub={`${cow.breed} · ${cow.sex} · ${cow.ageLong} · ${cow.barn}`}
      width={600}
      onClose={close}
    >
      <div>
        <Seg options={TABS} value={tab} onChange={(next) => { setTab(next); setErrors({}); setFailure('') }} />
      </div>

      {tab === 'identity' && (
        <Panel pad="p-0" gap="gap-4" className="border-0">
          {backend && (
            <Field label="Ảnh">
              <input type="file" accept="image/jpeg,image/png" aria-label="Chọn ảnh" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} className="text-sm" />
              {Boolean(cow.photoUrl) && !photo && (
                <label className="flex items-center gap-2 text-xs text-ink">
                  <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} />Xóa ảnh hiện tại
                </label>
              )}
              <ErrorText>{photoError}</ErrorText>
            </Field>
          )}
          <Field label="Số thẻ tai">
            <input className={fieldCls} maxLength={30} value={identity.tag} onChange={(e) => setIdentity({ ...identity, tag: e.target.value })} />
            <ErrorText>{identityErrors.tag}</ErrorText>
          </Field>
          <Field label="Tên gọi">
            <input className={fieldCls} maxLength={50} value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
            <ErrorText>{identityErrors.name}</ErrorText>
          </Field>
          <Field label="Màu lông & đặc điểm">
            <Textarea className="!h-16 !leading-[normal]" maxLength={255} value={identity.colour} onChange={(e) => setIdentity({ ...identity, colour: e.target.value })} />
            <ErrorText>{identityErrors.colour}</ErrorText>
          </Field>
          {backend && (
            <Field label="Ghi chú">
              <Textarea className="!h-16 !leading-[normal]" maxLength={1000} value={identity.notes} onChange={(e) => setIdentity({ ...identity, notes: e.target.value })} />
              <ErrorText>{identityErrors.notes}</ErrorText>
            </Field>
          )}
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
              {purposeOptions.map((p) => (
                <option key={p.id} value={p.id}>{`${p.name} · ${PURPOSE_TYPE_LABELS[p.purposeType] ?? p.purposeType}`}</option>
              ))}
            </Select>
            <ErrorText>{errors.value}</ErrorText>
          </Field>
          {canChangePurpose && backend && datedFields}
          <Note tone="grey">{canChangePurpose ? 'Mục đích loại Đực giống chỉ dùng cho bò đực, Sinh sản chỉ dùng cho bò cái.' : 'Mục đích nuôi chỉ Chủ trại được đổi. Bò đã xuất hoặc đã hủy chỉ xem.'}</Note>
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
            <ErrorText>{errors.value}</ErrorText>
          </Field>
          {datedFields}
          {suggestion && <Note tone="info">Điền sẵn theo gợi ý đổi giai đoạn. Lưu xong, gợi ý này được đánh dấu đã giải quyết.</Note>}
          <Note tone="grey">Mục đích nuôi chỉ Chủ trại được đổi. Bò đã xuất hoặc đã hủy chỉ xem.</Note>
        </>
      )}

      {confirmRepro && (
        <Note tone="warn">
          <span className="flex flex-col gap-2">
            {confirmRepro}
            <span className="flex gap-2">
              <ModalButton onClick={() => setConfirmRepro('')}>Hủy</ModalButton>
              <ModalButton variant="primary" onClick={confirmReproEnd}>Tiếp tục</ModalButton>
            </span>
          </span>
        </Note>
      )}
      {confirmDiscard && (
        <Note tone="warn">
          <span className="flex flex-col gap-2">
            Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?
            <span className="flex gap-2">
              <ModalButton onClick={() => setConfirmDiscard(false)}>Tiếp tục sửa</ModalButton>
              <ModalButton variant="danger" onClick={onClose}>Bỏ thay đổi</ModalButton>
            </span>
          </span>
        </Note>
      )}
      {failure && <Note tone="err">{failure}</Note>}
      <ModalFooter>
        <ModalButton onClick={close} disabled={saving}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={saving || !!confirmRepro}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
