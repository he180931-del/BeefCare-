import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Badge, Button, ErrorBlock, Field, inputCls, LoadingBlock } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { announcementsApi } from '../../farm-announcements'
import { useSession } from '../../authorization'
import { farmOverviewApi } from '../api/farmOverviewApi'
import { dueLabel } from '../domain/reminderRules'
import { formatKeyShort, weekdayOf } from '../domain/format'
import type { ReminderItem } from '../types'

const URGENCY_BADGE = {
  OVERDUE: { tone: 'err', label: 'Quá hạn', icon: 'alert-triangle' },
  TODAY: { tone: 'info', label: 'Hôm nay', icon: undefined },
  UPCOMING: { tone: 'warn', label: 'Sắp tới', icon: 'clock' },
} as const

const card = 'flex flex-col gap-2 rounded-lg border border-field bg-white p-3.5'
const cardHead = (title: string, to: string, link: string) => (
  <div className="flex items-center justify-between gap-2">
    <h2 className="m-0 text-sm font-semibold text-[#212121]">{title}</h2>
    <Link to={to} className="text-[11px] font-semibold text-brand no-underline">{link}</Link>
  </div>
)

function ReminderLine({ item, today }: { item: ReminderItem; today: string }) {
  const badge = URGENCY_BADGE[item.urgency]
  return (
    <Link to={`/kt/nhac-viec?m=chi-tiet&r=${item.id}`} className="flex items-center justify-between gap-2 text-inherit no-underline">
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-[#212121]">{item.title}</span>
        <span className="block text-[10px] text-muted">{[item.code ?? item.group, item.pen].filter(Boolean).join(' · ')}</span>
      </span>
      <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>
      <span className="sr-only">{dueLabel(item, today)}</span>
    </Link>
  )
}

export default function TechnicianHomePage() {
  const session = useSession()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const viewer = { name: session?.fullName ?? '', role: 'TECHNICIAN' as const }
  const home = useQuery(() => farmOverviewApi.getTechnicianHome(), [])
  const unread = useQuery(() => announcementsApi.listUnread(viewer, 3), [viewer.name])
  const given = session?.fullName.trim().split(/\s+/).pop() || 'bạn'

  if (home.loading && !home.data) return <TechnicianLayout title={`Chào ${given}`} hero><LoadingBlock /></TechnicianLayout>
  if (home.error || !home.data) return <TechnicianLayout title={`Chào ${given}`} hero><ErrorBlock message={userFacingError(home.error, 'Không tải được trang chủ.')} onRetry={home.refetch} /></TechnicianLayout>

  const { today, reminders, feeding } = home.data
  const sub = `${session?.farmName ?? home.data.farmName} · ${weekdayOf(today)} ${formatKeyShort(today)}`
  const open = (e: FormEvent) => { e.preventDefault(); if (code.trim()) navigate(`/kt/dan-bo/${encodeURIComponent(code.trim())}`) }

  return (
    <TechnicianLayout title={`Chào ${given}`} sub={sub} hero>
      <Button variant="primary" block onClick={() => navigate('/kt/quet-qr')}><Icon name="qrcode" size={16} /> Quét thẻ tai QR</Button>
      <form onSubmit={open}>
        <Field label="Mở hồ sơ bò" id="open-cattle">
          <input id="open-cattle" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Nhập mã bò hoặc số thẻ tai" enterKeyHint="go" />
        </Field>
      </form>

      <section className={card} aria-label="Thông báo mới">
        {cardHead('Thông báo mới', '/kt/thong-bao', 'Xem tất cả')}
        {unread.data?.length ? unread.data.map((a) => (
          <Link key={a.id} to={`/kt/thong-bao/${a.id}`} className="flex flex-col gap-0.5 text-inherit no-underline">
            <span className="text-[13px] font-semibold text-[#212121]">{a.title}</span>
            <span className="text-[11px] text-muted">{`${a.authorName} · ${a.publishedLabel}`}</span>
          </Link>
        )) : <p className="m-0 text-xs text-muted">{unread.error ? 'Không tải được thông báo.' : 'Không có thông báo mới.'}</p>}
      </section>

      <section className={card} aria-label="Nhắc việc hôm nay">
        {cardHead(`Nhắc việc hôm nay (${reminders.length})`, '/kt/nhac-viec', 'Xem tất cả')}
        {reminders.length ? reminders.map((r) => <ReminderLine key={r.id} item={r} today={today} />) : <p className="m-0 text-xs text-muted">Hôm nay chưa có nhắc việc.</p>}
      </section>

      <section className={card} aria-label="Khẩu phần hôm nay">
        {cardHead('Khẩu phần hôm nay', '/kt/thuc-an', 'Xem khẩu phần')}
        <p className="m-0 text-xs text-[#212121]">{`${feeding.label} · ${feeding.unrecorded} / ${feeding.total} chuồng chưa ghi`}</p>
      </section>
    </TechnicianLayout>
  )
}
