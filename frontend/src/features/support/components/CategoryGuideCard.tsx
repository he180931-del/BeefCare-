import { Card, Table, Td, Th } from '../../../shared/ui'
import { TICKET_CATEGORIES } from '../domain/ticketRules'

export function CategoryGuideCard() {
  return (
    <Card variant="panel" title="Danh mục hỗ trợ">
      <Table variant="panel" stack={false}>
        <thead>
          <tr>
            <Th>Danh mục</Th>
            <Th>Dùng khi</Th>
          </tr>
        </thead>
        <tbody>
          {TICKET_CATEGORIES.map((c) => (
            <tr key={c.value}>
              <Td className="font-medium">{c.label}</Td>
              <Td>{c.hint}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
