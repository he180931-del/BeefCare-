import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, PageHeader, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { announcementsApi } from '../api/announcementsApi'
import { AnnouncementDetail, HistoryModal } from '../components/AnnouncementDetail'
import { messageOf, Toast, useViewer } from '../components/shared'
import { canWrite } from '../domain/announcementRules'
import type { AnnouncementSummary } from '../types'

type Tab = 'received' | 'authored' | 'drafts'
const TITLE = 'Thông báo trại'

const metaOf = (a: AnnouncementSummary, tab: Tab) => {
  if (a.state === 'DRAFT') return 'Chưa gửi cho ai'
  if (tab === 'received') return `${a.authorName} · v${a.versionNo} · ${a.publishedLabel}`
  return `v${a.versionNo} · ${a.publishedLabel} · ${a.recipientCount} người nhận`
}

export default function AnnouncementListPage() {
  const viewer = useViewer()
  const writer = canWrite(viewer.role)
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab | null) ?? (writer ? 'authored' : 'received'))
  const [toast, setToast] = useState((location.state as { toast?: string } | null)?.toast ?? '')
  const [refresh, setRefresh] = useState(0)
  const marked = useRef(new Set<string>())
  const list = useQuery(() => announcementsApi.list(viewer), [viewer, refresh])

  const groups = useMemo(() => {
    const all = list.data ?? []
    return {
      received: all.filter((a) => a.isReceived),
      authored: all.filter((a) => a.isAuthor && a.state === 'PUBLISHED'),
      drafts: all.filter((a) => a.state === 'DRAFT' && a.isAuthor),
    }
  }, [list.data])
  const items = groups[tab]
  const requested = Number(params.get('id'))
  const selectedId = items.find((a) => a.id === requested)?.id ?? items[0]?.id ?? null
  const detail = useQuery(() => (selectedId ? announcementsApi.get(selectedId, viewer) : Promise.resolve(null)), [selectedId, viewer, refresh])

  // Mở thông báo đánh dấu đã đọc; không đổi dữ liệu chăm sóc (GBR-62).
  useEffect(() => {
    const d = detail.data
    if (!d?.unread) return
    const key = `${d.id}:${d.version}`
    if (marked.current.has(key)) return
    marked.current.add(key)
    announcementsApi.markRead(viewer, d.id).then(() => setRefresh((n) => n + 1), () => undefined)
  }, [detail.data, viewer])

  const pickTab = (next: Tab) => { setTab(next); const p = new URLSearchParams(params); p.set('tab', next); p.delete('id'); setParams(p) }
  const pick = (id: number) => { const p = new URLSearchParams(params); p.set('id', String(id)); p.set('tab', tab); setParams(p) }

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
        <Segmented options={tabs} value={tab} onChange={(v) => pickTab(v as Tab)} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
          <Card>
            {items.length === 0 ? <EmptyBlock title="Chưa có thông báo" sub="Thông báo trong mục này sẽ hiện ở đây." /> : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pick(a.id)}
                      aria-current={a.id === selectedId}
                      className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-md border px-3 py-2.5 text-left ${a.id === selectedId ? 'border-edge bg-chip' : 'border-transparent bg-white hover:bg-page'}`}
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
          <div className="min-w-0">
            {detail.error ? <ErrorBlock message={messageOf(detail.error, 'Không tải được thông báo.')} onRetry={detail.refetch} />
              : detail.data ? <AnnouncementDetail a={detail.data} onHistory={() => openModal('lich-su')} />
                : !detail.loading && <EmptyBlock title="Chọn một thông báo" sub="Nội dung và tình trạng nhận sẽ hiện ở đây." action={<Icon name="speakerphone" size={20} />} />}
          </div>
        </div>
        <Foot>Tab "Bản nháp" chỉ hiện cho tác giả; mở thông báo sẽ đánh dấu đã đọc. Nút Đính chính chỉ dành cho tác giả của thông báo đã đăng; bảng tình trạng nhận chỉ tác giả thấy.</Foot>
      </div>
      {m === 'lich-su' && detail.data && <HistoryModal a={detail.data} onClose={closeModal} />}
      <Toast message={toast} onClose={() => setToast('')} />
    </Layout>
  )
}
