import { Link } from 'react-router-dom'
import { Badge, Button, Icon, Panel, Table, Td, Th } from '../../../shared/ui'
import type { AttentionRow, DashboardView, GettingStarted } from '../types'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const textLink = `rounded font-semibold text-brand underline-offset-2 hover:underline ${focusRing}`
// Vùng chạm ~44 px khi bảng hẹp (điện thoại, docs/BeefCare-Bento-Grid.md §3); bảng rộng giữ dòng gọn như Figma.
const rowLink = `${textLink} -my-2.5 inline-flex min-h-11 items-center @min-[480px]:my-0 @min-[480px]:min-h-0`
const attentionPriority = { err: 0, warn: 1, info: 2, ok: 3 } as const

/** Cảnh báo toàn trại (overview không nhận bộ lọc chuồng / nhóm đàn / giai đoạn, nên danh sách luôn áp dụng). */
export function AttentionCard({ rows }: { rows: AttentionRow[] }) {
  const orderedRows = [...rows].sort((a, b) => attentionPriority[a.tone] - attentionPriority[b.tone])
  return (
    <Panel
      title="Cần chú ý hôm nay"
      className="h-full"
      actions={<Link to="/nhac-viec" className={`${textLink} inline-flex min-h-11 items-center text-sm`}>Xem tất cả nhắc việc →</Link>}
    >
      {orderedRows.length > 0 ? (
        <Table narrow bordered={false}>
          <thead><tr><Th scope="col">Bò</Th><Th scope="col">Chuồng</Th><Th scope="col">Vấn đề</Th><Th scope="col">Trạng thái</Th></tr></thead>
          <tbody>
            {orderedRows.map((row) => {
              const action = row.to?.startsWith('/cattle/') ? `Mở hồ sơ ${row.code}` : row.to ? 'Mở danh sách liên quan' : 'Mở danh sách nhắc việc'
              return (
                <tr key={`${row.code}-${row.kind}-${row.issue}`}>
                  <Td className="font-semibold whitespace-nowrap text-ink">{row.code}</Td>
                  <Td>{row.pen}</Td>
                  <Td>
                    <Link to={row.to ?? '/nhac-viec'} aria-label={`${row.issue} · ${action}`} className={`${rowLink} underline decoration-brand/40 hover:decoration-current`}>{row.issue}</Link>
                  </Td>
                  <Td><Badge tone={row.tone} className="whitespace-normal">{row.status}</Badge></Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      ) : <p className="m-0 text-sm text-muted">Không có cảnh báo cần chú ý.</p>}
    </Panel>
  )
}

export function QuickRecordCard() {
  const shortcuts = [
    { label: 'Xem danh sách cân', to: '/can-nang', icon: 'scale' as const },
    { label: 'Xem lịch tiêm', to: '/tiem-phong', icon: 'vaccine' as const },
    { label: 'Xem sức khỏe', to: '/suc-khoe', icon: 'stethoscope' as const },
    { label: 'Xem nhật ký cho ăn', to: '/thuc-an/nhat-ky', icon: 'grain' as const },
  ]
  const action = `flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-center text-sm leading-tight font-semibold no-underline ${focusRing}`
  return (
    <Panel title="Ghi chép nhanh">
      {/* 2 cột trên điện thoại, 1 + 4 từ 640 px, một hàng 5 nút khi mỗi nút còn ≥ 150 px. */}
      <div className="grid grid-cols-2 gap-2 @min-[640px]:grid-cols-4 @min-[880px]:grid-cols-5">
        <Link to="/cattle" className={`${action} col-span-full border-brand bg-brand text-white hover:bg-brand-dark @min-[880px]:col-span-1`}>
          <Icon name="circle-plus" size={16} />Chọn bò để ghi chép
        </Link>
        {shortcuts.map((shortcut) => <Link key={shortcut.to} to={shortcut.to} className={`${action} border-field text-brand hover:bg-page`}>
          <Icon name={shortcut.icon} size={16} />{shortcut.label}
        </Link>)}
      </div>
    </Panel>
  )
}

export function GettingStartedCard({ data, busy, onMark, onDismiss }: { data: GettingStarted; busy: boolean; onMark: (step: string) => void; onDismiss: () => void }) {
  return (
    <Panel title="Bắt đầu sử dụng" actions={<Button variant="link" size="sm" disabled={busy} onClick={onDismiss}>Ẩn hướng dẫn</Button>}>
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
    </Panel>
  )
}

export function HerdStructureCard({ data }: { data: DashboardView['indicators']['m05'] }) {
  const populatedRows = data.rows.filter((row) => row.head > 0)
  const number = 'tabular-nums text-right'
  return (
    <Panel title="Cơ cấu đàn" sub="Bò đang nuôi theo nhóm đàn · chọn nhóm để mở Đàn bò" className="h-full">
      {data.total === 0 ? <p className="m-0 text-sm text-muted">Chưa có bò đang nuôi.</p> : (
        <Table stack={false} bordered={false}>
          <thead><tr><Th scope="col">Nhóm đàn</Th><Th scope="col" className="text-right!">Số con</Th><Th scope="col" className="text-right!">Mang thai</Th></tr></thead>
          <tbody>
            {populatedRows.map((row) => (
              <tr key={row.group}>
                {/* -my-2.5 bù padding của ô: vùng chạm 44 px mà dòng vẫn cao 44 px. */}
                <Td><Link to={`/cattle?nhom=${encodeURIComponent(row.group)}`} className={`${textLink} -my-2.5 flex min-h-11 items-center`}>{row.label}</Link></Td>
                <Td className={`${number} font-semibold`}>{row.head}</Td>
                <Td className={number}>{row.pregnant ?? <><span aria-hidden="true">—</span><span className="sr-only">Không áp dụng</span></>}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-field bg-page font-bold text-ink">
              <Td className="border-0">Tổng</Td><Td className={`border-0 ${number}`}>{data.total}</Td><Td className={`border-0 ${number}`}>{data.pregnant}</Td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Panel>
  )
}
