import { useState } from 'react'
import { Field, Note, Select, Textarea } from '../../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { QR_REASONS, MANAGER, newQrCode } from '../../../data/cowsData'
import { reissueQr } from '../api/cattleApi'
import { useMutation } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { fieldCls } from './parts'
import type { CowSeed } from '../../../data/cowsData'

type ReissuePayload = { reason: string; note: string; by: string }

const tagCodeOf = (result: unknown): string => {
  const code = typeof result === 'object' && result !== null ? (result as { tagCode?: unknown }).tagCode : undefined
  return typeof code === 'string' ? code : ''
}

export default function QrReissueModal({ cow, onClose, onSaved }: { cow: CowSeed; onClose: () => void; onSaved: () => void }) {
  const backend = cow.backendId != null && cow.backendVersion != null
  const reissue = useMutation((payload: ReissuePayload) => reissueQr(cow.code, payload, backend ? { backendId: cow.backendId, backendVersion: cow.backendVersion } : {}))
  const cur = cow.qrHistory.find((q) => q.status === 'ACTIVE') || cow.qrHistory[0]
  const [issued, setIssued] = useState('')
  const newCode = backend ? issued : newQrCode(cow)
  const [reason, setReason] = useState('Thẻ bị hỏng')
  // Ghi chú mẫu của Figma chỉ dành cho dữ liệu demo, không áp cho bò từ backend.
  const [note, setNote] = useState(!backend && cow.code === 'BC-000125' ? 'Thẻ bị rách khi bò cọ vào hàng rào' : '')
  const [printMsg, setPrintMsg] = useState('')
  const [error, setError] = useState('')

  const confirm = async () => {
    setError('')
    try {
      const result = await reissue.mutate({ reason, note: note.trim(), by: MANAGER })
      if (!backend) return onSaved()
      // Giữ mã do backend cấp hiển thị đến khi người dùng đóng hộp thoại.
      setIssued(tagCodeOf(result) || '—')
    } catch (e) {
      setError(userFacingError(e, 'Không cấp được thẻ mới. Vui lòng thử lại.'))
    }
  }

  return (
    <Modal title={`Cấp lại thẻ QR – ${cow.code}`} topTitle="Cấp lại thẻ QR" sub={`${cow.breed} · ${cow.sex} · Chuồng ${cow.barn}`} width={600} onClose={issued ? onSaved : onClose}>
      <Field label="Thẻ hiện hành">
        <input className={fieldCls} readOnly value={cur ? `${cur.code} · ${cur.status} · cấp ${cur.from}` : 'Chưa có thẻ'} />
      </Field>
      <Field label="Lý do thay thẻ *">
        <Select className="[&_select]:!leading-[normal]" value={reason} disabled={!!issued} onChange={(e) => setReason(e.target.value)}>
          {QR_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Mã thẻ mới" hint="Hệ thống tự cấp; thẻ cũ chuyển sang REPLACED.">
        <input className={fieldCls} readOnly value={newCode} placeholder={backend ? 'Cấp khi xác nhận' : undefined} />
      </Field>
      <Field label="Ghi chú">
        <Textarea className="!h-14 !leading-[normal]" value={note} readOnly={!!issued} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {printMsg && <p className="m-0 -mt-2 text-[11px] text-ok-fg">{printMsg}</p>}
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        {!issued && <ModalButton onClick={onClose}>Hủy</ModalButton>}
        <ModalButton disabled={backend && !issued} onClick={() => setPrintMsg(`Đã gửi lệnh in thử tem ${newCode}.`)}><Icon name="printer" />In thẻ thử</ModalButton>
        {issued ? (
          <ModalButton variant="primary" onClick={onSaved}>Đóng</ModalButton>
        ) : (
          <ModalButton variant="primary" disabled={reissue.loading} onClick={confirm}>Xác nhận cấp thẻ mới</ModalButton>
        )}
      </ModalFooter>
    </Modal>
  )
}
