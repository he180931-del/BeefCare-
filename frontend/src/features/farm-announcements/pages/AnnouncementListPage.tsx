import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Icon, LoadingBlock, PageHeader, Segmented } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { AnnouncementDetail, HistoryModal } from '../components/AnnouncementDetail'
import { messageOf, Toast, useViewer } from '../components/shared'
import { canWrite } from '../domain/announcementRules'
import { useAnnouncementUseCases } from '../hooks/useAnnouncementUseCases'
import type { AnnouncementSummary } from '../types'

type Tab = 'received' | 'authored' | 'drafts'
const TITLE = 'Thông báo trại'

const metaOf = (a: AnnouncementSummary, tab: Tab) => {
  if (a.state === 'DRAFT') return 'Chưa gửi cho ai'
  if (tab === 'received') return `${a.authorName} · v${a.versionNo} · ${a.publishedLabel}`
  return `v${a.versionNo} · ${a.publishedLabel} · ${a.recipientCount} người nhận`
}

const emptyMessageOf = (tab: Tab) => {
  if (tab === 'received') return 'Chưa có thông báo đã nhận.'
  if (tab === 'authored') return 'Chưa có thông báo bạn đã viết.'
  return 'Chưa có bản nháp.'
}

export default function AnnouncementListPage() {
  const viewer = useViewer()
  const writer = canWrite(viewer.role)
  const navigate = useNavigate()
  const routeId = useParams().id
  const location = useLocation()
  const [params] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab | null) ?? (writer ? 'authored' : 'received'))
  const [toast, setToast] = useState((location.state as { toast?: string } | null)?.toast ?? '')
  const [refresh, setRefresh] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const marked = useRef(new Set<string>())
  const requestedValue = routeId !== undefined ? Number(routeId) : params.has('id') ? Number(params.get('id')) : null
  const requested = typeof requestedValue === 'number' && Number.isInteger(requestedValue) && requestedValue > 0 ? requestedValue : null
  const hasRequestedTarget = routeId !== undefined || params.has('id')
  const { list, detail, markRead } = useAnnouncementUseCases({ viewer, loadList: true, detailId: requested ?? selectedId, refreshKey: refresh })

  const groups = useMemo(() => {
    const all = list.data ?? []
    return {
      received: all.filter((a) => a.isReceived),
      authored: all.filter((a) => a.isAuthor && a.state === 'PUBLISHED'),
      drafts: all.filter((a) => a.state === 'DRAFT' && a.isAuthor),
    }
  }, [list.data])
  const requestedItem = list.data?.find((a) => a.id === requested)
  const activeTab: Tab = requestedItem
    ? requestedItem.state === 'DRAFT' ? 'drafts' : requestedItem.isReceived ? 'received' : 'authored'
    : tab
  const items = groups[activeTab]
  const computedSelectedId = requested ?? (hasRequestedTarget ? null : items[0]?.id ?? null)
  const versionIdParam = params.get('versionId')
  const selectedVersion = detail.data?.versions.find((version) => String(version.id) === versionIdParam)
    ?? (versionIdParam === null ? detail.data?.versions[0] : undefined)

  // Only acknowledge the newest visible delivery. A stale notification link to an older version
  // must not mark a later correction as read.
  useEffect(() => {
    if (computedSelectedId !== selectedId) setSelectedId(computedSelectedId)
  }, [computedSelectedId, selectedId])

  useEffect(() => {
    const d = detail.data
    if (!d || !selectedVersion?.unread || selectedVersion.id !== d.versions[0]?.id) return
    const key = `${d.id}:${selectedVersion.id}`
    if (marked.current.has(key)) return
    marked.current.add(key)
    markRead(d.id).then(() => setRefresh((n) => n + 1), () => undefined)
  }, [detail.data, selectedVersion, markRead])

  const pickTab = (next: Tab) => {
    setTab(next)
    const p = new URLSearchParams(params)
    p.set('tab', next)
    p.delete('id')
    p.delete('versionId')
    const query = p.toString()
    navigate(`/thong-bao${query ? `?${query}` : ''}`)
  }
  const pick = (id: number) => {
    const item = items.find((announcement) => announcement.id === id)
    const p = new URLSearchParams()
    p.set('tab', activeTab)
    if (item?.state === 'PUBLISHED' && item.latestVersionId !== null) p.set('versionId', String(item.latestVersionId))
    navigate(`/thong-bao/${id}?${p}`)
  }

  if (list.loading && !list.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (list.error || !list.data) return <Layout title={TITLE}><ErrorBlock message={messageOf(list.error, 'Không tải được thông báo.')} onRetry={list.refetch} /></Layout>

  const tabs = [
    { value: 'received', label: `Đã nhận (${groups.received.length})` },
    { value: 'authored', label: `Tôi đã viết (${groups.authored.length})` },
    ...(writer ? [{ value: 'drafts', label: `Bản nháp (${groups.drafts.length})` }] : []),
  ]

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Thông báo trại" sub="Đọc thông báo đã nhận hoặc đã viết, xem phiên bản và tình trạng nhận.">
          {writer && <Button variant="primary" onClick={() => navigate('/thong-bao/moi')}>Soạn thông báo</Button>}
        </PageHeader>
        <Segmented options={tabs} value={activeTab} onChange={(v) => pickTab(v as Tab)} />
        <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,3fr)_minmax(0,5fr)] @min-[1024px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @min-[1024px]:gap-6">
          <Card variant="panel">
            {items.length === 0 ? <EmptyBlock title={emptyMessageOf(activeTab)} /> : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pick(a.id)}
                      aria-current={a.id === selectedId}
                      className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-brand ${a.id === selectedId ? 'border-ok-bg bg-ok-bg' : 'border-transparent bg-white hover:bg-page'}`}
                    >
                      <span className={`text-[13px] text-[#212121] ${a.unread ? 'font-bold' : 'font-semibold'}`}>{a.title}</span>
                      <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                        <span>{metaOf(a, tab)}</span>
                        {a.state === 'DRAFT' ? <Badge tone="outline">Bản nháp</Badge> : <Badge tone="ok" icon="circle-check">Đã đăng</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {(items.length > 0 || hasRequestedTarget) && <div className="min-w-0">
            {hasRequestedTarget && !requestedItem && !detail.data && !detail.error && detail.loading ? <LoadingBlock />
              : hasRequestedTarget && !requestedItem && !detail.data && detail.error ? <ErrorBlock message={messageOf(detail.error, 'Không tìm thấy thông báo này hoặc bạn không có quyền xem.')} onRetry={detail.refetch} />
                : hasRequestedTarget && !requestedItem && !detail.data ? <ErrorBlock message="Không tìm thấy thông báo này hoặc bạn không có quyền xem." onRetry={detail.refetch} />
              : detail.error ? <ErrorBlock message={messageOf(detail.error, 'Không tải được thông báo.')} onRetry={detail.refetch} />
                : detail.data && versionIdParam !== null && !selectedVersion ? <ErrorBlock message="Không tìm thấy phiên bản thông báo này hoặc bạn không có quyền xem." onRetry={detail.refetch} />
              : detail.data ? <AnnouncementDetail a={detail.data} version={selectedVersion} onHistory={() => openModal('lich-su')} />
                : !detail.loading && <EmptyBlock title="Chọn một thông báo" sub="Nội dung và tình trạng nhận sẽ hiện ở đây." action={<Icon name="speakerphone" size={20} />} />}
          </div>}
        </div>
      </div>
      {m === 'lich-su' && detail.data && <HistoryModal a={detail.data} onClose={closeModal} />}
      <Toast message={toast} onClose={() => setToast('')} />
    </Layout>
  )
}
