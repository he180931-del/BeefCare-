import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, Card, EmptyBlock, ErrorBlock, Icon, LoadingBlock, PageHeader, Segmented } from '../../../shared/ui'
import { financeError } from '../api/financeError'
import { useFinanceNotices, usePlatformFinanceUseCases } from '../hooks/usePlatformFinanceUseCases'
import { relativeTime, unreadCount } from '../domain/financeRules'
import type { NoticeKind, PmNotice } from '../types'
import { FlashNote, type Flash } from './common'

/** Danh sách thông báo dùng chung cho SCR-47 (đối soát) và thông báo hỗ trợ của PM. */
export function NoticeList({ kind, title, sub }: { kind: NoticeKind; title: string; sub: string }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'ALL' | 'UNREAD'>('ALL')
  const [flash, setFlash] = useState<Flash | null>(null)
  const useCases = usePlatformFinanceUseCases()
  const { data, loading, error, refetch } = useFinanceNotices(kind)

  if (loading && !data) return <Layout title={title}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={title}><ErrorBlock message={financeError(error, 'Không tải được thông báo.')} onRetry={refetch} /></Layout>

  const unread = unreadCount(data.list)
  const shown = tab === 'UNREAD' ? data.list.filter((n) => !n.readTime) : data.list
  const markAll = async () => {
    try {
      await useCases.markAllNoticesRead(kind)
      setFlash({ tone: 'ok', text: 'Tất cả thông báo đã được đánh dấu là đã đọc.' })
      refetch()
    } catch (e) { setFlash({ tone: 'err', text: financeError(e, 'Không cập nhật được thông báo.') }) }
  }
  const openItem = async (n: PmNotice) => {
    try { await useCases.markNoticeRead(n.id); navigate(n.href) } catch (e) { setFlash({ tone: 'err', text: financeError(e, 'Không mở được thông báo.') }) }
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
      </div>
    </Layout>
  )
}
