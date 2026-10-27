import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { Field, Note, Textarea } from '../../components/ui'
import { useStore } from '../../data/store'
import { money } from '../../data/format'

const MAX_REASON = 500

export default function CancelModal({ row, onClose, onCancelled }) {
  const { updateExport } = useStore()
  const [cancelReason, setCancelReason] = useState('Lò mổ trả lại 4 con do đổi lịch giết mổ')
  const collected = (row.detail?.payments ?? []).reduce((s, p) => s + p.amount, 0)
  const barnCount = row.count

  const confirm = () => {
    const time = new Date().toTimeString().slice(0, 5)
    updateExport(row.id, {
      status: 'Đã hủy',
      cancelReason,
      detail: {
        ...row.detail,
        history: [...(row.detail?.history ?? []), `22/10 ${time} · N. V. Hùng hủy phiếu: ${cancelReason}`],
      },
    })
    onCancelled()
  }

  return (
    <Modal width={640} title={`Hủy phiếu xuất ${row.id}`} sub={`${row.type} · ${row.date.slice(8)}/${row.date.slice(5, 7)}/${row.date.slice(0, 4)} · ${barnCount} con · ${row.who}`} topTitle="Hủy phiếu xuất" onClose={onClose}>
      <div className="-mt-2 flex flex-col gap-2.5">
        <div className="text-sm font-semibold">Khi xác nhận hủy</div>
        <Note tone="ok">
          ✓ {barnCount} con trở lại ACTIVE và mở lại phân chuồng cuối B1 – Vỗ béo (43/50 → 47/50).<br />
          ✓ Phiếu giữ nguyên trong lịch sử với trạng thái ĐÃ HỦY và lý do.
        </Note>
        <Note tone="warn">
          ! Mũi tiêm, nhắc việc đã hủy do xuất đàn KHÔNG tự khôi phục – Quản lý lập lại nếu cần.<br />
          ! Tiền đã thu {money(collected)} đ vẫn giữ trong lịch sử – hoàn trả xử lý ngoài hệ thống.
        </Note>
      </div>
      <Field label="Lý do hủy *" hint={`Tối đa ${MAX_REASON} ký tự`}>
        <Textarea
          className="!leading-[normal] h-14"
          rows={1}
          maxLength={MAX_REASON}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Field>
      <Note>Chỉ Chủ trại hủy được phiếu đã xuất. Nếu chuồng cuối ngưng sử dụng hoặc không đủ chỗ, hệ thống yêu cầu chọn chuồng khác cho từng con trước khi hủy (MSG-FE13-09).</Note>
      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={!cancelReason.trim()} onClick={confirm}>Hủy phiếu xuất</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
