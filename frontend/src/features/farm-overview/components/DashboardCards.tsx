import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyBlock, Icon, Table, Td, Th } from '../../../shared/ui'
import type { AttentionRow, DashboardView, GettingStarted } from '../types'

export function AttentionCard({ rows, unavailable = false }: { rows: AttentionRow[]; unavailable?: boolean }) {
  if (rows.length === 0 && !unavailable) return null
  const orderedRows = [...rows].sort((a, b) => ({ err: 0, warn: 1, info: 2, ok: 3 }[a.tone] - { err: 0, warn: 1, info: 2, ok: 3 }[b.tone]))
  return (
    <Card title={<span className="text-[20px] font-bold">Cảnh báo tổng quan</span>}>
      <p className="m-0 text-base text-muted">Các việc cần bạn kiểm tra thêm.</p>
      {unavailable && <p role="status" className="m-0 rounded border border-warn-bg bg-warn-bg/30 p-3 text-base text-ink">Bộ lọc chuồng, nhóm đàn hoặc giai đoạn không áp dụng cho cảnh báo này; danh sách theo bộ lọc chưa có.</p>}
      {orderedRows.length > 0 && <ul className="m-0 grid list-none gap-3 p-0">
        {orderedRows.map((row) => (
          <li key={`${row.code}-${row.kind}-${row.issue}`} className="flex flex-col gap-3 rounded border border-edge bg-page p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-base font-semibold text-ink">{row.issue}</p>
              <p className="mb-0 mt-1 text-base text-muted">{row.code} · Chuồng {row.pen} · {row.status}</p>
            </div>
            <Link to={row.to ?? '/nhac-viec'} className="inline-flex min-h-12 w-full items-center justify-center rounded border border-edge bg-white px-4 text-center text-base font-semibold text-brand no-underline hover:bg-white sm:w-auto">
              {row.to ? 'Mở hồ sơ' : 'Mở danh sách nhắc việc'}
            </Link>
          </li>
        ))}
      </ul>}
    </Card>
  )
}

export function QuickRecordCard() {
  const shortcuts = [
    { label: 'Xem danh sách cân', to: '/can-nang', icon: 'scale' as const },
    { label: 'Xem lịch tiêm', to: '/tiem-phong', icon: 'vaccine' as const },
    { label: 'Xem sức khỏe', to: '/suc-khoe', icon: 'stethoscope' as const },
    { label: 'Xem nhật ký cho ăn', to: '/thuc-an/nhat-ky', icon: 'grain' as const },
  ]
  return (
    <Card title={<span className="text-[20px] font-bold">Ghi chép nhanh</span>}>
      <p className="m-0 text-base text-muted">Mở danh sách phù hợp để tiếp tục công việc. Chọn bò trước khi ghi thao tác theo từng con.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/cattle" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded border border-brand bg-brand px-5 text-center text-base font-bold text-white no-underline hover:bg-brand-dark">
          <Icon name="circle-plus" size={18} />Chọn bò để ghi chép
        </Link>
        {shortcuts.map((shortcut) => <Link key={shortcut.to} to={shortcut.to} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded border border-edge bg-white px-5 text-center text-base font-semibold text-brand no-underline hover:bg-page">
          <Icon name={shortcut.icon} size={18} />{shortcut.label}
        </Link>)}
      </div>
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

export function HerdStructureCard({ data, filtersApplied = false }: { data: DashboardView['indicators']['m05']; filtersApplied?: boolean }) {
  const populatedRows = data.rows.filter((row) => row.head > 0)
  return (
    <Card title={<span className="text-[20px] font-bold">Cơ cấu đàn</span>} sub="Chỉ hiện nhóm đang có bò.">
      {data.total === 0 ? <p className="m-0 text-base text-muted">Chưa có bò đang nuôi.</p> : <>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {populatedRows.map((r) => (
            <li key={r.group} className="flex flex-wrap items-center justify-between gap-3 rounded border border-edge bg-page p-3">
              {filtersApplied
                ? <span className="min-h-12 flex-1 content-center text-base font-semibold text-ink">{r.label}</span>
                : <Link to={`/cattle?nhom=${encodeURIComponent(r.group)}`} className="min-h-12 flex-1 content-center text-base font-semibold text-brand no-underline hover:underline">{r.label}</Link>}
              {filtersApplied
                ? <span className="inline-flex min-h-12 min-w-20 items-center justify-center rounded bg-white px-3 text-base font-bold text-ink">{`${r.head} con`}</span>
                : <Link to={`/cattle?nhom=${encodeURIComponent(r.group)}`} className="inline-flex min-h-12 min-w-20 items-center justify-center rounded bg-white px-3 text-base font-bold text-ink no-underline hover:bg-white">{`${r.head} con`}</Link>}
              {r.pregnant !== null && <span className="w-full text-base text-muted">{`${r.pregnant} con mang thai`}</span>}
            </li>
          ))}
        </ul>
        <p className="m-0 text-base font-semibold text-ink">{`Tổng đàn: ${data.total} con${data.pregnant > 0 ? ` · ${data.pregnant} con mang thai` : ''}`}</p>
        {filtersApplied && <p className="m-0 text-base text-muted">Nhóm đang theo bộ lọc. Bỏ bộ lọc để mở danh sách của từng nhóm.</p>}
      </>}
    </Card>
  )
}
