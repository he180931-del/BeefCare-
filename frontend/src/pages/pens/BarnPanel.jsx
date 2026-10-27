import { Badge, Button, KV, Table, Td, Th } from '../../components/ui'
import { thresholdText } from '../../data/barnsData'
import { Box, TH } from './parts'

export default function BarnPanel({ barn, onEdit, onToggle, onMoveCow, onViewAll }) {
  const active = barn.status === 'ACTIVE'
  return (
    <Box>
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-[#212121]">{barn.code} – {barn.name}</h3>
        <div className="flex shrink-0 gap-2">
          <Button onClick={onEdit}>Sửa</Button>
          <Button onClick={onToggle}>{active ? 'Ngừng sử dụng' : 'Mở lại sử dụng'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <KV k="Sức chứa">{barn.capacity}</KV>
        <KV k="Đang có">{barn.count}</KV>
        <KV k="Còn trống">{barn.capacity - barn.count}</KV>
        <KV k="Trạng thái">
          {active ? <Badge tone="ok" className="!border-0">ACTIVE</Badge> : <Badge>INACTIVE</Badge>}
        </KV>
      </div>

      <div>
        <h4 className="m-0 text-[13px] font-semibold text-[#212121]">Tiêu chí tiếp nhận · {barn.version}</h4>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <KV k="Mục đích">{barn.purpose}</KV>
          <KV k="Giai đoạn">{barn.stage}</KV>
          <KV k="Ngưỡng">{thresholdText(barn)}</KV>
          <KV k="Giới tính">{barn.sex}</KV>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="m-0 text-[13px] font-semibold text-[#212121]">Bò trong chuồng</h4>
        <Table stack={false}>
          <thead>
            <tr>
              <Th className={`${TH} w-[128px] bg-[#f0f0f0]`}>Bò</Th>
              <Th className={`${TH} w-[198px] bg-[#f0f0f0]`}>Tình trạng</Th>
              <Th className={`${TH} bg-[#f0f0f0]`} />
            </tr>
          </thead>
          <tbody>
            {barn.cows.length === 0 && (
              <tr>
                <Td colSpan={3} className={`${TH} text-muted`}>Chuồng chưa có bò</Td>
              </tr>
            )}
            {barn.cows.map(([cowCode, condition]) => (
              <tr key={cowCode}>
                <Td className={`${TH} font-medium`}>{cowCode}</Td>
                <Td className={TH}>{condition}</Td>
                <Td className={TH}>
                  <Button variant="link" small onClick={() => onMoveCow(cowCode)}>Chuyển</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {barn.cows.length > 0 && (
          <Button variant="link" small className="self-start" onClick={onViewAll}>Xem tất cả {barn.count} con →</Button>
        )}
      </div>
    </Box>
  )
}
