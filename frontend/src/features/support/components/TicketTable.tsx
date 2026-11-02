import { Link, useNavigate } from 'react-router-dom'
import { Table, Td, Th } from '../../../components/ui'
import { formatDayTime } from '../domain/format'
import { categoryLabel, shortFarmName } from '../domain/ticketRules'
import type { Ticket } from '../types'
import { TicketStatusBadge } from './TicketStatusBadge'

export function TicketTable({ items }: { items: Ticket[] }) {
  const navigate = useNavigate()
  return (
    <Table>
      <thead>
        <tr>
          <Th>Mã</Th>
          <Th>Tiêu đề</Th>
          <Th>Danh mục</Th>
          <Th>Trang trại</Th>
          <Th>Trạng thái</Th>
          <Th>Cập nhật</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} onClick={() => navigate(`/ho-tro/${t.id}`)} className="cursor-pointer hover:bg-page">
            <Td className="font-medium">
              <Link to={`/ho-tro/${t.id}`} onClick={(e) => e.stopPropagation()} className="text-ink hover:underline">
                {t.code}
              </Link>
            </Td>
            <Td>{t.subject}</Td>
            <Td>{categoryLabel(t.category)}</Td>
            <Td>{shortFarmName(t.farmName)}</Td>
            <Td>
              <TicketStatusBadge ticket={t} variant="list" />
            </Td>
            <Td>{formatDayTime(t.updatedAt)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
