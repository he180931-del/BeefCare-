import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { EmptyBlock, ErrorBlock, LoadingBlock, Note, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { announcementsApi } from '../api/announcementsApi'
import { messageOf, RichText, useViewer } from '../components/shared'
import { formatFull, formatTime, ROLE_LABEL } from '../domain/format'

type Tab = 'unread' | 'all'

function TechnicianList() {
  const viewer = useViewer()
  const [tab, setTab] = useState<Tab>('unread')
  const list = useQuery(() => announcementsApi.list(viewer), [viewer])
  if (list.loading && !list.data) return <TechnicianLayout title="Thông báo trại" back="/kt"><LoadingBlock /></TechnicianLayout>
  if (list.error != null || !list.data) return <TechnicianLayout title="Thông báo trại" back="/kt"><ErrorBlock message={messageOf(list.error, 'Không tải được thông báo.')} onRetry={list.refetch} /></TechnicianLayout>

  const received = list.data.filter((a) => a.isReceived)
  const unread = received.filter((a) => a.unread)
  const shown = tab === 'unread' ? unread : received
  return (
    <TechnicianLayout title="Thông báo trại" back="/kt">
      <Segmented value={tab} onChange={(v) => setTab(v as Tab)} options={[{ value: 'unread', label: `Chưa đọc (${unread.length})` }, { value: 'all', label: `Tất cả (${received.length})` }]} />
      {shown.length === 0 && <EmptyBlock title={tab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'} sub="Thông báo mới từ Quản lý và Chủ trại sẽ hiện ở đây." />}
      {shown.map((a) => (
        <Link key={a.id} to={`/kt/thong-bao/${a.id}`} className="flex flex-col gap-1 rounded-lg border border-field bg-white px-3.5 py-3 text-inherit no-underline">
          <span className="flex items-center gap-2">
            {a.unread && <span role="img" aria-label="Chưa đọc" className="size-2 shrink-0 rounded-full bg-brand" />}
            <span className={`text-[13px] text-[#212121] ${a.unread ? 'font-semibold' : ''}`}>{a.title}</span>
          </span>
          <span className="text-[11px] text-muted">{[a.authorName, a.versionNo > 1 && `v${a.versionNo}`, a.publishedLabel].filter(Boolean).join(' · ')}</span>
        </Link>
      ))}
    </TechnicianLayout>
  )
}

function TechnicianDetail() {
  const viewer = useViewer()
  const id = Number(useParams().id)
  const [readTime, setReadTime] = useState<string | null>(null)
  const detail = useQuery(() => announcementsApi.get(id, viewer), [id, viewer])

  // Mở thông báo đánh dấu đã đọc; Kỹ thuật viên chỉ xem.
  useEffect(() => {
    let active = true
    announcementsApi.markRead(viewer, id).then((r) => { if (active) setReadTime(r?.readTime ?? null) }, () => undefined)
    return () => { active = false }
  }, [id, viewer])

  if (detail.loading && !detail.data) return <TechnicianLayout title="Thông báo" back="/kt/thong-bao"><LoadingBlock /></TechnicianLayout>
  if (detail.error != null || !detail.data) return <TechnicianLayout title="Thông báo" back="/kt/thong-bao"><ErrorBlock message={messageOf(detail.error, 'Không tải được thông báo.')} onRetry={detail.refetch} /></TechnicianLayout>

  const a = detail.data
  const at = readTime ?? a.readTime
  return (
    <TechnicianLayout title="Thông báo" back="/kt/thong-bao">
      <article className="flex flex-col gap-2 rounded-lg border border-field bg-white p-3.5">
        <h2 className="m-0 text-sm font-semibold text-[#212121]">{a.title}</h2>
        <p className="m-0 text-[11px] text-muted">{`${a.authorName} · ${ROLE_LABEL[a.authorRole]} · ${formatFull(a.publishedTime!)} · phiên bản ${a.version}`}</p>
        <RichText text={a.body} />
      </article>
      <Note tone="ok">{`${at ? `Đã đánh dấu đã đọc lúc ${formatTime(at)}. ` : ''}Kỹ thuật viên chỉ xem, không đính chính.`}</Note>
    </TechnicianLayout>
  )
}

/** /kt/thong-bao và /kt/thong-bao/:id */
export default function TechnicianAnnouncementRoutes() {
  return (
    <Routes>
      <Route index element={<TechnicianList />} />
      <Route path=":id" element={<TechnicianDetail />} />
      <Route path="*" element={<Navigate to="/kt/thong-bao" replace />} />
    </Routes>
  )
}
