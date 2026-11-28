import { Button, Icon, Table } from '../../../shared/ui'
import { Td, Th } from './parts'
import type { Pen } from '../../pen-management'
import type { CattleViewModel as CowSeed } from '../types'

/** Dòng tóm tắt khi khối Lịch sử chuồng đang gập (D79): chuồng hiện tại, từ ngày, số con / sức chứa. */
export function barnNote(cow: CowSeed, barns: Record<string, Pen>): string {
  const cur = barns[cow.barn]
  if (!cow.barn) return 'Chưa phân chuồng'
  return [cur?.name || cow.barn, cow.barnSince && cow.barnSince !== '—' && `từ ${cow.barnSince}`, cur && `${cur.count}/${cur.capacity} con`]
    .filter(Boolean)
    .join(' · ')
}

/**
 * SCR-20 Lịch sử chuồng, nằm trong tab Tổng quan từ D79 (khối gập "Lịch sử chuồng"). Không có khung riêng: khung là khối
 * gập bên ngoài, ở đây chỉ có hai phần chuồng hiện tại và lịch sử phân chuồng.
 */
export default function BarnsTab({ cow, barns, canWrite, onOpenModal }: { cow: CowSeed; barns: Record<string, Pen>; canWrite: boolean; onOpenModal: (name: string) => void }) {
  const cur = barns[cow.barn]
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="m-0 text-[13px] font-semibold text-[#212121]">Chuồng hiện tại</h4>
          <div className="flex-1" />
          {canWrite && <Button className="gap-1.5 leading-[normal]" onClick={() => onOpenModal('move')}><Icon name="arrows-exchange" />Chuyển chuồng</Button>}
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-[260px]">Chuồng</Th>
              <Th className="w-[200px]">Từ ngày</Th>
              <Th className="w-[200px]">Sức chứa</Th>
              <Th className="w-[340px]">Tiêu chí tiếp nhận</Th>
            </tr>
          </thead>
          <tbody>
            {cur ? (
              <tr>
                <Td className="font-medium">{cur.name}</Td>
                <Td>{cow.barnSince}</Td>
                <Td>{`${cur.count} / ${cur.capacity} con`}</Td>
                <Td>{[cur.purpose, cur.stage].filter(Boolean).join(' · ')}</Td>
              </tr>
            ) : (
              <tr><Td colSpan={4}>Không có phân chuồng đang mở.</Td></tr>
            )}
          </tbody>
        </Table>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="m-0 text-[13px] font-semibold text-[#212121]">Lịch sử phân chuồng</h4>
        <Table>
          <thead>
            <tr>
              <Th className="w-[120px]">Từ ngày</Th>
              <Th className="w-[120px]">Đến ngày</Th>
              <Th className="w-[220px]">Chuồng</Th>
              <Th className="w-[360px]">Lý do</Th>
              <Th className="w-[180px]">Người ghi</Th>
            </tr>
          </thead>
          <tbody>
            {cow.barnHistory.map((h) => (
              <tr key={`${h.from}-${h.barn}`}>
                <Td className="font-medium">{h.from}</Td>
                <Td>{h.to}</Td>
                <Td>{h.barn}</Td>
                <Td>{h.reason === 'Correction' ? 'Sửa nhầm (chuyển ngược)' : h.reason}{h.warningReason && <span className="block text-[11px] text-warn-fg">{`Lý do cảnh báo: ${h.warningReason}`}</span>}</Td>
                <Td>{h.by}</Td>
              </tr>
            ))}
            {cow.barnHistory.length === 0 && <tr><Td colSpan={5} className="text-muted">Chưa có lần phân chuồng nào.</Td></tr>}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
