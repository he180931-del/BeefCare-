import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { Badge, Field, Note, Table, Td, Textarea, Th } from '../../components/ui'
import { dmy, money } from '../../data/format'

const TH = 'px-1! first:pl-3! last:pr-3!'

/**
 * Hủy cả phiếu nhập. Chỉ hủy được khi không con nào có sự kiện khác sau nhập đàn (cow.events rỗng).
 * `onConfirm(reason)` do trang chi tiết xử lý (đổi trạng thái, ghi lịch sử).
 */
export default function CancelModal({ record, onConfirm, onClose }) {
  // Phiếu không có chi tiết (phiếu cũ) vẫn hủy được; danh sách bò rỗng.
  const d = record.detail ?? { cows: [], payments: [], sourceName: record.source }
  const paid = d.payments.reduce((s, p) => s + p.amount, 0)
  const blocked = d.cows.some((c) => c.events?.length)
  const [reason, setReason] = useState('Ghi nhầm nguồn – bò thực tế mua của hộ ông Lê Văn C')

  return (
    <Modal
      width={640}
      title={`Hủy phiếu nhập ${record.id}`}
      sub={`${record.type} · ${dmy(record.date)} · ${record.count} con · ${d.sourceName}`}
      topTitle="Hủy phiếu nhập"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Kiểm tra trước khi hủy</h3>
        <Table stack={false}>
          <thead>
            <tr>
              <Th className={`${TH} w-[170px]`}>Bò</Th>
              <Th className={`${TH} w-[260px]`}>Sự kiện sau nhập đàn</Th>
              <Th className={TH}>Kết quả</Th>
            </tr>
          </thead>
          <tbody>
            {d.cows.map((c) => (
              <tr key={c.code}>
                <Td className={TH}>{c.code} · {c.tag}</Td>
                <Td className={TH}>{c.events?.length ? c.events.join(', ') : 'Không có (chỉ nhập đàn và xếp chuồng)'}</Td>
                <Td className={TH}>{c.events?.length ? <Badge tone="err">Không hủy được</Badge> : <Badge tone="ok">Hủy được</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Khi xác nhận hủy</h3>
        <Note tone="ok">
          <div>✓ Hồ sơ {d.cows.map((c) => c.code).join(', ')} chuyển ĐÃ HỦY; mã nội bộ và mã hiển thị không được dùng lại.</div>
          <div>✓ Đóng phân chuồng {d.cows.map((c) => c.barn.split(' ')[0]).join(', ')}, giải phóng {d.cows.length} chỗ; thẻ QR bị thu hồi.</div>
        </Note>
        {paid > 0 && <Note tone="warn">! Khoản đã thanh toán {money(paid)} đ vẫn giữ trong lịch sử – việc đòi lại tiền xử lý ngoài hệ thống.</Note>}
      </div>

      <Field label="Lý do hủy *">
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>

      <ModalFooter>
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={!reason.trim() || blocked} onClick={() => onConfirm(reason.trim())}>
          Hủy phiếu nhập
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
