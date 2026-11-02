import { Badge, Table, Td, Th } from '../../../components/ui'
import { cx, TH } from './parts'
import type { Pen } from '../../../types'

export const penName = (b: { code: string; name: string }) => b.name.startsWith(b.code) ? b.name.slice(b.code.length).replace(/^\s*[–-]\s*/, '') : b.name
const HEAD = 'bg-[#f0f0f0] whitespace-nowrap'

export default function BarnTable({ rows, selected, onSelect, loading }: { rows: Pen[]; selected?: string; onSelect: (code: string) => void; loading: boolean }) {
  return (
    <Table stack={false}>
      <thead>
        <tr>
          <Th className={cx(TH, HEAD, 'xl:w-[66px]')}>Chuồng</Th>
          <Th className={cx(TH, HEAD, 'xl:w-[138px]')}>Tên</Th>
          <Th className={cx(TH, HEAD, 'xl:w-[130px]')}>Đang có / Sức chứa</Th>
          <Th className={cx(TH, HEAD)}>Tiếp nhận</Th>
          <Th className={cx(TH, HEAD)}>Trạng thái</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <Td colSpan={5} className={cx(TH, 'text-muted')}>{loading ? 'Đang tải…' : 'Không có chuồng phù hợp'}</Td>
          </tr>
        )}
        {rows.map((barn) => (
          <tr
            key={barn.code}
            onClick={() => onSelect(barn.code)}
            className={cx('cursor-pointer hover:bg-page', barn.code === selected && 'bg-[#eef4ef]')}
          >
            <Td className={cx(TH, 'font-medium')}>{barn.code}</Td>
            <Td className={TH}>{penName(barn)}</Td>
            <Td className={TH}>{barn.count} / {barn.capacity}</Td>
            <Td className={TH}>{barn.accept || barn.purpose || '—'}</Td>
            <Td className={TH}>
              {barn.status === 'ACTIVE' ? <Badge tone="ok" icon="circle-check" className="!border-0">ACTIVE</Badge> : <Badge>INACTIVE</Badge>}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
