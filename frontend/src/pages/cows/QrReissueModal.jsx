import { useState } from 'react'
import { Field, Note, Select, Textarea } from '../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { QR_REASONS, MANAGER, newQrCode } from '../../data/cowsData'
import { reissueQr } from '../../api/cattleApi'
import { useMutation } from '../../hooks/useApi'
import { fieldCls } from './parts'

export default function QrReissueModal({ cow, onClose, onSaved }) {
  const reissue = useMutation((payload) => reissueQr(cow.code, payload))
  const cur = cow.qrHistory.find((q) => q.status === 'ACTIVE') || cow.qrHistory[0]
  const newCode = newQrCode(cow)
  const [reason, setReason] = useState('Thẻ bị hỏng')
  const [note, setNote] = useState(cow.code === 'BC-000125' ? 'Thẻ bị rách khi bò cọ vào hàng rào' : '')
  const [printMsg, setPrintMsg] = useState('')

  return (
    <Modal title={`Cấp lại thẻ QR – ${cow.code}`} topTitle="Cấp lại thẻ QR" sub={`${cow.breed} · ${cow.sex} · Chuồng ${cow.barn}`} width={600} onClose={onClose}>
      <Field label="Thẻ hiện hành">
        <input className={fieldCls} readOnly value={`${cur.code} · ${cur.status} · cấp ${cur.from}`} />
      </Field>
      <Field label="Lý do thay thẻ *">
        <Select className="[&_select]:!leading-[normal]" value={reason} onChange={(e) => setReason(e.target.value)}>
          {QR_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Mã thẻ mới" hint="Hệ thống tự cấp; thẻ cũ chuyển sang REPLACED.">
        <input className={fieldCls} readOnly value={newCode} />
      </Field>
      <Field label="Ghi chú">
        <Textarea className="!h-14 !leading-[normal]" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {printMsg && <p className="m-0 -mt-2 text-[11px] text-ok-fg">{printMsg}</p>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton onClick={() => setPrintMsg(`Đã gửi lệnh in thử tem ${newCode}.`)}>In thẻ thử</ModalButton>
        <ModalButton
          variant="primary"
          onClick={async () => {
            await reissue.mutate({ reason, note: note.trim(), by: MANAGER })
            onSaved()
          }}
        >
          Xác nhận cấp thẻ mới
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
