import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Button, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Segmented } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { notificationsApi } from '../api/notificationsApi'
import { NotificationRow } from '../components/NotificationRow'
import { countByTab, filterByTab, isUnread, NOTIFICATION_TABS, notificationTarget } from '../domain/notificationRules'
import type { NotificationTab, NotificationView } from '../types'

const TITLE = 'Thông báo của tôi'

/** SCR-45: thông báo gói, thanh toán và hỗ trợ của Chủ trại. */
export default function MyNotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<NotificationTab>('ALL')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, refetch } = useQuery(async () => ({ list: await notificationsApi.listMine(), now: notificationsApi.now() }), [])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được thông báo.')} onRetry={refetch} /></Layout>

  const { list, now } = data
  const counts = countByTab(list)
  const shown = filterByTab(list, tab)
  const unread = list.filter(isUnread).length

  const markAll = async () => {
    setBusy(true)
    try {
      await notificationsApi.markAllRead()
      setNotice({ tone: 'ok', text: 'Tất cả thông báo đã được đánh dấu là đã đọc.' })
      await refetch()
    } catch {
      setNotice({ tone: 'err', text: 'Không cập nhật được thông báo. Vui lòng thử lại.' })
    } finally {
      setBusy(false)
    }
  }
  const open = async (item: NotificationView) => {
    try {
      await notificationsApi.markRead(item.id)
      navigate(notificationTarget(item))
    } catch {
      setNotice({ tone: 'err', text: 'Không mở được thông báo này. Vui lòng thử lại.' })
    }
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE}>
          <Button onClick={markAll} disabled={busy || unread === 0}>
            <Icon name="checks" size={16} /> Đánh dấu đã đọc tất cả
          </Button>
        </PageHeader>
        {notice && <Note tone={notice.tone}>{notice.text}</Note>}
        <Segmented options={NOTIFICATION_TABS.map((t) => ({ value: t.value, label: `${t.label} (${counts[t.value]})` }))} value={tab} onChange={(v) => setTab(v as NotificationTab)} />
        {shown.length === 0 ? (
          <EmptyBlock title="Chưa có thông báo" sub="Thông báo về gói, thanh toán và hỗ trợ sẽ xuất hiện ở đây." />
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((n) => (
              <NotificationRow key={n.id} item={n} now={now} onOpen={open} />
            ))}
          </div>
        )}
        <Foot>Lọc thông báo theo tất cả, thanh toán và hỗ trợ; mỗi mục cho biết nội dung, trại hoặc mã phiếu, thời điểm và dấu chưa đọc.</Foot>
      </div>
    </Layout>
  )
}
