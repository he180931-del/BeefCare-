import { Card, Table, Td, Th } from '../../../components/ui'
import { TICKET_CATEGORIES } from '../domain/ticketRules'

export function CategoryGuideCard() {
  return (
    <Card title="Danh mục hỗ trợ">
      <Table stack={false}>
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
