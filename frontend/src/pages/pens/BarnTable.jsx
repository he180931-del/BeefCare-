import { Badge, Table, Td, Th } from '../../components/ui'
import { cx, TH } from './parts'

const HEAD = 'bg-[#f0f0f0] whitespace-nowrap'

export default function BarnTable({ rows, selected, onSelect }) {
  return (
    <Table stack={false}>
      <thead>
        <tr>
          <Th className={cx(TH, HEAD, 'xl:w-[66px]')}>Chuồng</Th>
          <Th className={cx(TH, HEAD, 'xl:w-[138px]')}>Tên</Th>
          <Th className={cx(TH, HEAD, 'xl:w-[118px]')}>Đang có / Sức chứa</Th>
          <Th className={cx(TH, HEAD, 'xl:w-[108px]')}>Tiếp nhận</Th>
          <Th className={cx(TH, HEAD)}>Trạng thái</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <Td colSpan={5} className={cx(TH, 'text-muted')}>Không có chuồng phù hợp</Td>
          </tr>
        )}
        {rows.map((barn) => (
          <tr
            key={barn.code}
            onClick={() => onSelect(barn.code)}
            className={cx('cursor-pointer hover:bg-page', barn.code === selected && 'bg-[#eef4ef]')}
          >
            <Td className={cx(TH, 'font-medium')}>{barn.code}</Td>
            <Td className={TH}>{barn.name}</Td>
            <Td className={TH}>{barn.count} / {barn.capacity}</Td>
            <Td className={TH}>{barn.accept}</Td>
            <Td className={TH}>
              {barn.status === 'ACTIVE' ? <Badge tone="ok" className="!border-0">ACTIVE</Badge> : <Badge>INACTIVE</Badge>}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
