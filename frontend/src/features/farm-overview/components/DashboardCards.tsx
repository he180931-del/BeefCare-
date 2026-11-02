import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyBlock, Table, Td, Th } from '../../../components/ui'
import type { AttentionRow, DashboardView, GettingStarted } from '../types'

export function AttentionCard({ rows }: { rows: AttentionRow[] }) {
  return (
    <Card title="Cần chú ý hôm nay" actions={<Link to="/nhac-viec" className="text-xs font-bold text-brand no-underline">Xem tất cả nhắc việc →</Link>}>
      {rows.length === 0 ? <EmptyBlock title="Không có việc cần chú ý" sub="Không có bò nào cần xử lý theo bộ lọc hiện tại." /> : (
        <Table stack={false}>
          <thead><tr><Th>Bò</Th><Th>Chuồng</Th><Th>Vấn đề</Th><Th>Trạng thái</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.code}-${row.kind}`}>
                <Td className="font-bold">{row.to ? <Link to={row.to} className="text-ink no-underline hover:underline">{row.code}</Link> : row.code}</Td>
                <Td>{row.pen}</Td>
                <Td>{row.issue}</Td>
                <Td><Badge tone={row.tone}>{row.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

export function GettingStartedCard({ data, busy, onMark, onDismiss }: { data: GettingStarted; busy: boolean; onMark: (step: string) => void; onDismiss: () => void }) {
  return (
    <Card title="Bắt đầu sử dụng" actions={<Button variant="link" size="sm" disabled={busy} onClick={onDismiss}>Ẩn hướng dẫn</Button>}>
      <Table stack={false}>
        <thead><tr><Th>Bước</Th><Th>Việc cần làm</Th><Th>Trạng thái</Th></tr></thead>
        <tbody>
          {data.steps.map((s, index) => (
            <tr key={s.step}>
              <Td className="font-bold">{index + 1}</Td>
              <Td>{s.label}</Td>
              <Td>
                {s.done ? <Badge tone="ok">Đã xong</Badge> : (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Link to={s.screen} className="no-underline"><Badge tone="info">Mở →</Badge></Link>
                    {s.markable && <Button variant="link" size="sm" disabled={busy} onClick={() => onMark(s.step)}>Đánh dấu đã xong</Button>}
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

export function HerdStructureCard({ data }: { data: DashboardView['indicators']['m05'] }) {
  return (
    <Card title="Cơ cấu đàn" sub="Bò đang nuôi theo nhóm đàn · chọn dòng để mở Đàn bò">
      <Table stack={false}>
        <thead><tr><Th>Nhóm đàn</Th><Th>Số con</Th><Th>Mang thai</Th></tr></thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.group}>
              <Td><Link to={`/cattle?nhom=${r.group}`} className="text-ink no-underline hover:underline">{r.label}</Link></Td>
              <Td className="font-bold">{r.head}</Td>
              <Td>{r.pregnant ?? '—'}</Td>
            </tr>
          ))}
          <tr>
            <Td className="font-bold">Tổng</Td>
            <Td className="font-bold">{data.total}</Td>
            <Td className="font-bold">{data.pregnant}</Td>
          </tr>
        </tbody>
      </Table>
    </Card>
  )
}
