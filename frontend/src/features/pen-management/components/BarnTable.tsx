import { useState } from 'react'
import { Badge, Table, Td, Th } from '../../../components/ui'
import { acceptsSummary, criteriaOf } from '../domain/penRules'
import { cx, TH } from './parts'
import type { Pen } from '../../../types'

export const penName = (b: { code: string; name: string }) => b.name.startsWith(b.code) ? b.name.slice(b.code.length).replace(/^\s*[–-]\s*/, '') : b.name
const HEAD = 'bg-[#f0f0f0] whitespace-nowrap'

/** SCR-17 pen list (fields 5–9): code is sortable, a full pen is highlighted, "Accepts" summarises the criteria. */
export default function BarnTable({ rows, selected, onSelect, loading, emptyText = 'Không có chuồng phù hợp' }: { rows: Pen[]; selected?: string; onSelect: (code: string) => void; loading: boolean; emptyText?: string }) {
  const [descending, setDescending] = useState(false)
  const sorted = [...rows].sort((a, b) => (descending ? -1 : 1) * a.code.localeCompare(b.code, 'vi', { numeric: true }))
  return (
    <Table stack={false}>
      <thead>
        <tr>
          <Th className={cx(TH, HEAD, 'xl:w-[76px]')}>
            <button type="button" className="cursor-pointer font-semibold" onClick={() => setDescending((d) => !d)} aria-label="Sắp xếp theo mã chuồng">
              Chuồng {descending ? '▼' : '▲'}
            </button>
          </Th>
          <Th className={cx(TH, HEAD, 'xl:w-[138px]')}>Tên</Th>
          <Th className={cx(TH, HEAD, 'xl:w-[120px]')}>Số con / Sức chứa</Th>
          <Th className={cx(TH, HEAD)}>Nhận</Th>
          <Th className={cx(TH, HEAD)}>Trạng thái</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && (
          <tr>
            <Td colSpan={5} className={cx(TH, 'text-muted')}>{loading ? 'Đang tải…' : emptyText}</Td>
          </tr>
        )}
        {sorted.map((barn) => {
          const full = barn.count >= barn.capacity
          return (
            <tr
              key={barn.code}
              onClick={() => onSelect(barn.code)}
              className={cx('cursor-pointer hover:bg-page', barn.code === selected && 'bg-[#eef4ef]')}
            >
              <Td className={cx(TH, 'font-medium')}>{barn.code}</Td>
              <Td className={TH}>{penName(barn)}</Td>
              <Td className={cx(TH, full && 'font-semibold text-err-fg')}>{barn.count} / {barn.capacity}</Td>
              <Td className={TH}>{acceptsSummary(criteriaOf(barn))}</Td>
              <Td className={TH}>
                {barn.status === 'ACTIVE' ? <Badge tone="ok" icon="circle-check" className="!border-0">Đang hoạt động</Badge> : <Badge>Ngừng hoạt động</Badge>}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
