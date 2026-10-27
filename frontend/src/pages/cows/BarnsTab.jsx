import { Button, Foot, Table } from '../../components/ui'
import { Panel, Td, Th } from './parts'

export default function BarnsTab({ cow, barns, onOpenModal }) {
  const cur = barns[cow.barn]
  return (
    <>
      <Panel
        title="Chuồng hiện tại"
        gap="gap-3"
        action={cow.status === 'ACTIVE' && <Button className="leading-[normal]" onClick={() => onOpenModal('move')}>Chuyển chuồng</Button>}
      >
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
                <Td>{`${cur.purpose} · ${cur.stage}`}</Td>
              </tr>
            ) : (
              <tr><Td colSpan={4}>Không có phân chuồng đang mở.</Td></tr>
            )}
          </tbody>
        </Table>
      </Panel>
      <Panel title="Lịch sử phân chuồng" gap="gap-3">
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
                <Td>{h.reason}</Td>
                <Td>{h.by}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Foot>Mỗi lần chuyển chuồng đóng phân chuồng cũ và mở phân chuồng mới; lịch sử không sửa trực tiếp.</Foot>
    </>
  )
}
