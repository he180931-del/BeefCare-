import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, PageHeader, Segmented } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { financeApi } from '../api/financeApi'
import { relativeTime, unreadCount } from '../domain/financeRules'
import type { NoticeKind, PmNotice } from '../types'
import { FlashNote, type Flash } from './common'

/** Danh sách thông báo dùng chung cho SCR-47 (đối soát) và thông báo hỗ trợ của PM. */
export function NoticeList({ kind, title, sub, foot }: { kind: NoticeKind; title: string; sub: string; foot: string }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'ALL' | 'UNREAD'>('ALL')
  const [flash, setFlash] = useState<Flash | null>(null)
  const { data, loading, error, refetch } = useQuery(async () => ({ list: await financeApi.listNotices(kind), now: financeApi.now() }), [kind])

  if (loading && !data) return <Layout title={title}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={title}><ErrorBlock message={userFacingError(error, 'Không tải được thông báo.')} onRetry={refetch} /></Layout>

  const unread = unreadCount(data.list)
  const shown = tab === 'UNREAD' ? data.list.filter((n) => !n.readTime) : data.list
  const markAll = async () => {
    try {
      await financeApi.markAllNoticesRead(kind)
      setFlash({ tone: 'ok', text: 'Tất cả thông báo đã được đánh dấu là đã đọc.' })
      refetch()
    } catch (e) { setFlash({ tone: 'err', text: userFacingError(e, 'Không cập nhật được thông báo.') }) }
  }
  const openItem = async (n: PmNotice) => {
    try { await financeApi.markNoticeRead(n.id); navigate(n.href) } catch (e) { setFlash({ tone: 'err', text: userFacingError(e, 'Không mở được thông báo.') }) }
  }

  return (
    <Layout title={title}>
      <div className="flex flex-col gap-4">
        <PageHeader title={title} sub={sub}>
          <Button onClick={markAll} disabled={unread === 0}><Icon name="checks" size={16} /> Đánh dấu đã đọc tất cả</Button>
        </PageHeader>
        <FlashNote flash={flash} />
        <div><Segmented value={tab} onChange={(v) => setTab(v as 'ALL' | 'UNREAD')} options={[{ value: 'ALL', label: 'Tất cả' }, { value: 'UNREAD', label: `Chưa đọc ${unread}` }]} /></div>
        <Card>
          {shown.length === 0 ? <EmptyBlock title="Không có thông báo" sub={tab === 'UNREAD' ? 'Bạn đã đọc hết thông báo.' : 'Chưa có thông báo nào.'} /> : (
            <ul className="m-0 flex list-none flex-col p-0">
              {shown.map((n) => {
                const isUnread = !n.readTime
                return (
                  <li key={n.id} className={`flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3 last:border-b-0 ${isUnread ? 'bg-[#eef4ef]' : ''}`}>
                    <span aria-label={isUnread ? 'Chưa đọc' : 'Đã đọc'} className={`h-2 w-2 shrink-0 rounded-full ${isUnread ? 'bg-brand' : 'bg-transparent'}`} />
                    <div className="min-w-[220px] flex-1">
                      <div className={`text-[13px] text-ink ${isUnread ? 'font-semibold' : 'font-medium'}`}>{n.title}</div>
                      <div className="text-[12px] text-muted">{n.summary}</div>
                    </div>
                    <span className="text-[11px] text-muted">{relativeTime(n.createdTime, data.now)}</span>
                    <Button variant="link" onClick={() => openItem(n)}>{n.actionLabel}</Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Foot>{foot}</Foot>
      </div>
    </Layout>
  )
}
