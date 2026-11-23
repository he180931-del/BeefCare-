import { Badge, Field, Icon, Modal, ModalButton, ModalFooter, Note, Table, Td, Textarea, Th } from '../../../shared/ui'
import { useState } from 'react'
import { dmy, money } from '../../../shared/lib/format'
import type { EntryDetail, HerdEntry } from '../types'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import { entryPaymentTotals } from '../domain/entryPaymentTotals'

const TH = 'px-1! first:pl-3! last:pr-3!'

/**
 * Hủy cả phiếu nhập. Chỉ hủy được khi không con nào có sự kiện khác sau nhập đàn (cow.events rỗng).
 * `onConfirm(reason)` do trang chi tiết xử lý (đổi trạng thái, ghi lịch sử).
 */
export default function CancelModal({ record, onConfirm, onClose, error, saving, onReload }: { record: HerdEntry; onConfirm: (reason: string) => void | Promise<void>; onClose: () => void; error?: unknown; saving?: boolean; onReload?: () => Promise<unknown> }) {
  // Phiếu không có chi tiết (phiếu cũ) vẫn hủy được; danh sách bò rỗng.
  const d: EntryDetail = { payments: [], sourceName: record.source, ...record.detail, cows: (record.detail?.cows ?? []).filter(cow => cow.lineStatus !== 'VOID') }
  const { paid } = entryPaymentTotals(record)
  const blocked = (d.cows ?? []).some((c) => c.events?.length)
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
        <Table variant="panel" stack={false}>
          <thead>
            <tr>
              <Th className={`${TH} w-[170px]`}>Bò</Th>
              <Th className={`${TH} w-[260px]`}>Sự kiện sau nhập đàn</Th>
              <Th className={TH}>Kết quả</Th>
            </tr>
          </thead>
          <tbody>
            {(d.cows ?? []).map((c) => (
              <tr key={c.code}>
                <Td className={TH}>{c.code} · {c.tag}</Td>
                <Td className={TH}>{c.events?.length ? c.events.join(', ') : 'Không có (chỉ nhập đàn và xếp chuồng)'}</Td>
                <Td className={TH}>{c.events?.length ? <Badge tone="err">Không hủy được</Badge> : <Badge tone="ok" icon="circle-x">Hủy được</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Khi xác nhận hủy</h3>
        <Note tone="ok">
          <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />Hồ sơ {(d.cows ?? []).map((c) => c.code).join(', ')} chuyển ĐÃ HỦY; mã bò {(d.cows ?? []).map((c) => c.code).join(', ')} không được dùng lại.</div>
          <div className="flex items-start gap-1.5"><Icon name="circle-check" size={14} className="mt-px shrink-0" />Đóng phân chuồng {(d.cows ?? []).map((c) => (c.barn ?? '').split(' ')[0]).join(', ')}, giải phóng {(d.cows ?? []).length} chỗ; thẻ QR bị thu hồi.</div>
        </Note>
        {paid > 0 && <Note tone="warn"><div className="flex items-start gap-1.5"><Icon name="alert-triangle" size={14} className="mt-px shrink-0" />Khoản đã thanh toán {money(paid)} đ vẫn giữ trong lịch sử – việc đòi lại tiền xử lý ngoài hệ thống.</div></Note>}
      </div>

      <Field label="Lý do hủy *">
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>

      {onReload && <VoucherCommandError error={error} onReload={onReload} />}
      <ModalFooter className="px-0! pt-0! pb-0!">
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={!reason.trim() || blocked || saving} onClick={() => { void Promise.resolve(onConfirm(reason.trim())).catch(() => undefined) }}>
          <Icon name="circle-x" />Hủy phiếu nhập
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
