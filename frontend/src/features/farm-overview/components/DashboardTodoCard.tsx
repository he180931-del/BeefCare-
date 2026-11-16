import { Link } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Badge, Button, Card } from '../../../components/ui'
import { dueLabel, pillLabel, sortReminders, TYPE_LABEL } from '../domain/reminderRules'
import type { AttentionRow, ReminderItem, ReminderList, Urgency } from '../types'

const GROUPS: Array<{ urgency: Urgency; label: string; tone: 'err' | 'warn' | 'ok' }> = [
  { urgency: 'OVERDUE', label: 'Quá hạn', tone: 'err' },
  { urgency: 'TODAY', label: 'Hôm nay', tone: 'warn' },
  { urgency: 'UPCOMING', label: 'Sắp tới', tone: 'ok' },
]

const dueFirst = (items: ReminderItem[]) => sortReminders(items).sort((a, b) => {
  if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1
  if ((a.type === 'health') !== (b.type === 'health')) return a.type === 'health' ? -1 : 1
  return 0
})

function ReminderAction({ item }: { item: ReminderItem }) {
  const target = item.to && item.openLabel
    ? { to: item.to, label: item.openLabel }
    : item.profileTo
      ? { to: item.profileTo, label: 'Mở hồ sơ bò' }
      : { to: `/nhac-viec?loai=${encodeURIComponent(item.type)}`, label: `Xem nhắc việc · ${TYPE_LABEL[item.type]}` }
  return <Link to={target.to} className="inline-flex min-h-12 w-full items-center justify-center rounded border border-brand bg-brand px-4 text-center text-base font-semibold text-white no-underline hover:bg-brand-dark sm:w-auto">{target.label}</Link>
}

function AttentionSection({ rows, unavailable }: { rows: AttentionRow[]; unavailable: boolean }) {
  if (!rows.length && !unavailable) return null

  const priority = { err: 0, warn: 1, info: 2, ok: 3 } as const
  const orderedRows = [...rows].sort((a, b) => priority[a.tone] - priority[b.tone])

  return (
    <section aria-label="Cảnh báo tổng quan" className="rounded-md border border-warn-bg bg-warn-bg/30 p-4">
      <h2 className="m-0 text-lg font-bold text-ink">Cảnh báo tổng quan</h2>
      <p className="mb-0 mt-1 text-base text-muted">Các việc cần bạn kiểm tra thêm.</p>
      {unavailable && <p role="status" className="mb-0 mt-3 rounded border border-warn-bg bg-white p-3 text-base text-ink">Bộ lọc chuồng, nhóm đàn hoặc giai đoạn hiện không áp dụng cho cảnh báo này; chưa thể hiển thị danh sách theo bộ lọc.</p>}
      {orderedRows.length > 0 && (
        <ul className="m-0 mt-3 grid list-none gap-3 p-0">
          {orderedRows.map((row) => (
            <li key={`${row.code}-${row.kind}-${row.issue}`} className="flex flex-col gap-3 rounded border border-edge bg-white p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-base font-semibold text-ink">{row.issue}</p>
                <p className="mb-0 mt-1 text-base text-muted">{row.code} · Chuồng {row.pen} · {row.status}</p>
              </div>
              <Link to={row.to ?? '/nhac-viec'} className="inline-flex min-h-12 w-full items-center justify-center rounded border border-edge bg-white px-4 text-center text-base font-semibold text-brand no-underline hover:bg-page sm:w-auto">
                {row.to?.startsWith('/cattle/') ? `Mở hồ sơ ${row.code}` : row.to ? 'Mở danh sách liên quan' : 'Mở danh sách nhắc việc'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReminderRow({ item, today, timeZone }: { item: ReminderItem; today: string; timeZone?: string }) {
  const animal = item.code ?? item.group ?? (item.type === 'feed' ? 'Thức ăn' : 'Theo nhóm đàn')
  const source = item.sourceSummary ?? item.source
  return (
    <li className="flex flex-col gap-3 rounded-md border border-edge bg-white p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[17px] font-semibold text-ink">{item.title}</h3>
          {item.highlighted && <Badge tone="err">Ưu tiên</Badge>}
          {item.type === 'health' && <Badge tone="warn">Sức khỏe</Badge>}
        </div>
        <p className="mb-0 mt-1 text-base text-ink">{animal}{item.breed ? ` · ${item.breed}` : ''}{item.pen ? ` · chuồng ${item.pen}` : ''}</p>
        <p className="mb-0 mt-1 text-base text-muted"><strong className="font-semibold text-ink">Hạn:</strong> {dueLabel(item, today, timeZone)} · {pillLabel(item.type)}</p>
        {item.basisMissing
          ? <p className="mb-0 mt-1 text-base text-warn-fg">{`Chưa xác định hạn: thiếu ${item.basisMissing}.`}</p>
          : source && <p className="mb-0 mt-1 text-base text-muted">{`Nguồn: ${source}`}{item.basis ? ` · Cơ sở: ${item.basis}` : ''}</p>}
      </div>
      <ReminderAction item={item} />
    </li>
  )
}

function urgencyPath(urgency: Urgency) {
  return `/nhac-viec?muc-do=${urgency}`
}

export default function DashboardTodoCard({
  list, loading, error, onRetry, attention, attentionUnavailable = false,
}: {
  list?: ReminderList
  loading: boolean
  error?: unknown
  onRetry: () => void
  attention: AttentionRow[]
  attentionUnavailable?: boolean
}) {
  const items = list?.items ?? []

  return (
    <Card
      title={<span className="text-[22px] font-bold">Việc cần làm</span>}
      actions={<Link to="/nhac-viec" className="inline-flex min-h-12 items-center px-2 text-base font-semibold text-brand no-underline">Mở tất cả nhắc việc →</Link>}
    >
      <AttentionSection rows={attention} unavailable={attentionUnavailable} />
      {loading && !list
        ? <p role="status" className="m-0 rounded border border-edge bg-page p-3 text-base text-muted">Đang tải danh sách việc cần làm…</p>
        : error || !list
          ? <div role="alert" className="flex flex-col gap-3 rounded border border-err-bg bg-err-bg/30 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="m-0 text-base text-err-fg">{userFacingError(error, 'Không tải được danh sách việc cần làm.')}</p><Button className="min-h-12 px-5 text-base" onClick={onRetry}>Thử tải lại</Button></div>
          : items.length === 0
            ? <p className="m-0 text-base text-muted">Không có nhắc việc cần làm.</p>
            : <div className="flex flex-col gap-5">
              {GROUPS.map((group) => {
                const grouped = dueFirst(items.filter((item) => item.urgency === group.urgency))
                if (!grouped.length) return null
                const visible = grouped.slice(0, 3)
                return (
                  <section key={group.urgency} aria-label={`${group.label} (${grouped.length})`} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="m-0 flex items-center gap-2 text-lg font-bold text-ink">{group.label}<Badge tone={group.tone}>{grouped.length}</Badge></h2>
                      <Link to={urgencyPath(group.urgency)} className="inline-flex min-h-12 items-center rounded px-3 text-base font-semibold text-brand no-underline hover:bg-page">{`Xem ${grouped.length} việc ${group.urgency === 'OVERDUE' ? 'quá hạn' : group.urgency === 'TODAY' ? 'hôm nay' : 'sắp tới'}`}</Link>
                    </div>
                    <ul className="m-0 grid list-none gap-3 p-0">
                      {visible.map((item) => <ReminderRow key={item.id} item={item} today={list.today} timeZone={list.timeZone} />)}
                    </ul>
                    {grouped.length > visible.length && <p className="m-0 text-base text-muted">{`${grouped.length - visible.length} việc khác nằm trong danh sách đã lọc.`}</p>}
                  </section>
                )
              })}
            </div>}
    </Card>
  )
}
