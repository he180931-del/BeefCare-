import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { Badge, DateInput, Field, KV, Note, Radio, Textarea } from '../../components/ui'

export default function DisableModal({ barn, onConfirm, onClose }) {
  const isInactive = barn.status === 'INACTIVE'
  const [nextStatus, setNextStatus] = useState(isInactive ? 'ACTIVE' : 'INACTIVE')
  const [date, setDate] = useState('2026-10-20')
  const [reason, setReason] = useState(isInactive ? '' : 'Sửa mái chuồng, tạm ngừng nhận bò mới')
  const canConfirm = nextStatus !== barn.status && reason.trim() !== ''

  return (
    <Modal
      width={560}
      title={`${isInactive ? 'Mở lại sử dụng chuồng' : 'Ngừng sử dụng chuồng'} – ${barn.code}`}
      sub={`${barn.count} con đang ở`}
      topTitle="Ngừng / mở lại sử dụng chuồng"
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-4">
        <KV k="Trạng thái hiện tại">
          {isInactive ? <Badge>INACTIVE</Badge> : <Badge tone="ok" className="!border-0">ACTIVE</Badge>}
        </KV>
        <KV k="Đang có">{barn.count} / {barn.capacity} con</KV>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink">Trạng thái mới *</span>
        <div className="flex gap-[18px]">
          <Radio name="nextStatus" checked={nextStatus === 'ACTIVE'} onChange={() => setNextStatus('ACTIVE')}>ACTIVE</Radio>
          <Radio name="nextStatus" checked={nextStatus === 'INACTIVE'} onChange={() => setNextStatus('INACTIVE')}>INACTIVE</Radio>
        </div>
      </div>

      <Field label="Ngày hiệu lực *">
        <DateInput value={date} onChange={setDate} />
      </Field>
      <Field label="Lý do *">
        <Textarea rows={1} value={reason} onChange={(e) => setReason(e.target.value)} className="!leading-[normal] h-[60px]" />
      </Field>

      <Note tone="warn">
        {nextStatus === 'INACTIVE'
          ? 'Chuồng ngừng sử dụng không nhận bò mới; bò đang ở vẫn giữ nguyên cho đến khi chuyển đi.'
          : 'Chuồng mở lại sử dụng sẽ nhận bò mới theo tiêu chí tiếp nhận hiện hành.'}
      </Note>

      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!canConfirm} onClick={() => onConfirm(nextStatus, { date, reason: reason.trim() })}>
          Xác nhận
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
