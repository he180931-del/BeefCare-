import { Badge, type BadgeTone, Icon, type IconName, KV, Table, Td, Th } from '../../../shared/ui'
import { useSession } from '../../../app/session/sessionContext'
import type { ReactNode } from 'react'

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
// Khoảng cách giữa các cột 8px như Figma (ghi đè px của Th/Td trong ui.tsx).
export const TH = '!px-1 first:!pl-3 last:!pr-3'

/** Thẻ Figma: viền #bdbdbd, bo 6, padding 16. */
export const Box = ({ title, sub, actions, gap = 'gap-[10px]', className, children }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; gap?: string; className?: string; children: ReactNode }) => (
  <section className={cx('flex min-w-0 flex-col rounded-2xl border border-field bg-white p-4', gap, className)}>
    {(title || actions) && (
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-[#212121]">{title}</h3>
          {sub && <div className="mt-[3px] text-[11px] text-muted">{sub}</div>}
        </div>
        <div className="flex-1" />
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    )}
    {children}
  </section>
)

export const DocRow = ({ ext, name }: { ext?: string; name: string }) => (
  <div className="flex items-center gap-2 text-xs">
    <Badge>{ext}</Badge>
    <span>{name}</span>
    <span className="flex-1" />
    <button type="button" className="cursor-pointer p-1 font-semibold text-brand">Xem</button>
  </div>
)

export const Drop = ({ hint }: { hint?: ReactNode }) => (
  <div className="flex flex-col items-center gap-1 rounded-md border border-field bg-page p-3.5">
    <span className="flex items-center gap-1.5 text-xs font-semibold text-brand"><Icon name="upload" size={14} />Kéo thả tệp hoặc Chọn tệp</span>
    <span className="max-w-[240px] text-center text-[11px] text-muted">{hint}</span>
  </div>
)

/** Thẻ "Tóm tắt phiếu xuất": rows = [[nhãn, giá trị]], children = phần thêm dưới danh sách. */
export const SummaryCard = ({ badge, rows, children }: { badge?: ReactNode; rows: Array<ReadonlyArray<unknown>>; children?: ReactNode }) => (
  <Box title="Tóm tắt phiếu xuất" actions={badge}>
    <div className="flex flex-col gap-3">
      {rows.map(([k, v]) => <KV key={String(k)} k={String(k)}>{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</KV>)}
    </div>
    {children}
  </Box>
)

/** Bảng "Kiểm tra trước khi xác nhận": rows = [[mục, kết quả, lỗi?]]. */
export const CheckList = ({ rows }: { rows: Array<[string, ReactNode, boolean?]> }) => (
  <Table variant="panel" stack={false}>
    <thead>
      <tr><Th className={cx(TH, 'w-[150px]')}>Mục</Th><Th className={TH}>Kết quả</Th></tr>
    </thead>
    <tbody>
      {rows.map(([label, value, bad]) => (
        <tr key={label}>
          <Td className={TH}>{label}</Td>
          <Td className={cx(TH, bad && 'font-medium text-err-fg')}>{value}</Td>
        </tr>
      ))}
    </tbody>
  </Table>
)

export { MoneyInput, parseMoney } from '../../../shared/ui'

const EXIT_STATUS: Record<string, { tone?: BadgeTone; icon?: IconName }> = {
  'Nháp': { icon: 'pencil' },
  'Chờ xác nhận': { tone: 'warn', icon: 'clock' },
  'Đã xuất': { tone: 'ok', icon: 'logout' },
  'Đã hủy': { tone: 'err', icon: 'circle-x' },
  'Đã bác': {},
}
/** Huy hiệu trạng thái phiếu xuất kèm icon như Figma. */
export function ExitStatusBadge({ status }: { status: string }) {
  const s = EXIT_STATUS[status] ?? {}
  return <Badge tone={s.tone} icon={s.icon}>{status}</Badge>
}

/** Chỉ Chủ trại lập, xác nhận, thu tiền và hủy phiếu xuất (GBR-07, GBR-94); Quản lý chỉ xem. Không có phiên thì coi là Chủ trại. */
export function useIsOwner() {
  const role = useSession()?.role
  return !role || role === 'OWNER'
}
