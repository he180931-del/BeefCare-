import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import TechnicianLayout from '../../../app/layouts/TechnicianLayout'
import { EmptyBlock, ErrorBlock, LoadingBlock, Note, Segmented } from '../../../shared/ui'
import { messageOf, RichText, useViewer } from '../components/shared'
import { formatFull, formatTime, ROLE_LABEL } from '../domain/format'
import { useAnnouncementUseCases } from '../hooks/useAnnouncementUseCases'

type Tab = 'unread' | 'all'

function TechnicianList() {
  const viewer = useViewer()
  const [tab, setTab] = useState<Tab>('unread')
  const { list } = useAnnouncementUseCases({ viewer, loadList: true })
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
        <Link key={a.id} to={`/kt/thong-bao/${a.id}${a.latestVersionId === null ? '' : `?versionId=${a.latestVersionId}`}`} className="flex flex-col gap-1 rounded-2xl border border-field bg-white p-4 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-brand">
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
  const [params] = useSearchParams()
  const versionIdParam = params.get('versionId')
  const [readTime, setReadTime] = useState<string | null>(null)
  const { detail, markRead } = useAnnouncementUseCases({ viewer, detailId: id })
  const selectedVersion = detail.data?.versions.find((version) => String(version.id) === versionIdParam)
    ?? (versionIdParam === null ? detail.data?.versions[0] : undefined)

  // Mark only the newest visible delivery as read; a stale link must not acknowledge a correction.
  useEffect(() => {
    if (!detail.data || !selectedVersion?.unread || selectedVersion.id !== detail.data.versions[0]?.id) return
    let active = true
    markRead(id).then((r) => { if (active) setReadTime(r?.readTime ?? null) }, () => undefined)
    return () => { active = false }
  }, [detail.data, id, markRead, selectedVersion])

  if (detail.loading && !detail.data) return <TechnicianLayout title="Thông báo" back="/kt/thong-bao"><LoadingBlock /></TechnicianLayout>
  if (detail.error != null || !detail.data) return <TechnicianLayout title="Thông báo" back="/kt/thong-bao"><ErrorBlock message={messageOf(detail.error, 'Không tải được thông báo.')} onRetry={detail.refetch} /></TechnicianLayout>

  const a = detail.data
  if (versionIdParam !== null && !selectedVersion) return <TechnicianLayout title="Thông báo" back="/kt/thong-bao"><ErrorBlock message="Không tìm thấy phiên bản thông báo này hoặc bạn không có quyền xem." onRetry={detail.refetch} /></TechnicianLayout>
  const at = readTime ?? a.readTime
  return (
    <TechnicianLayout title="Thông báo" back="/kt/thong-bao">
      <article className="flex flex-col gap-2 rounded-2xl border border-field bg-white p-4">
        <h2 className="m-0 text-sm font-semibold text-[#212121]">{selectedVersion?.title ?? a.title}</h2>
        <p className="m-0 text-[11px] text-muted">{`${a.authorName} · ${ROLE_LABEL[a.authorRole]} · ${formatFull(selectedVersion?.publishedTime ?? a.publishedTime!)} · phiên bản ${selectedVersion?.versionNo ?? a.versions[0]?.versionNo ?? 1}`}</p>
        <RichText text={selectedVersion?.body ?? a.body} />
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
