import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { platformAdminApi } from '../api/platformAdminApi'
import { ICON_BUTTON, SaPage, Toast, errorMessage } from '../components/common'
import { formatNoticeTime, noticeActionLabel } from '../domain/platformRules'
import type { NotificationView } from '../types'

const TITLE = 'Thông báo'

function NoticeContent() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const { data, loading, error, refetch } = useQuery(
    () => (demo === 'load-error' ? Promise.reject(new Error('Không tải được thông báo.')) : platformAdminApi.listNotifications()),
    [demo],
  )

  const unread = data?.filter((n) => !n.readTime).length ?? 0
  const shown = data ? (tab === 'unread' ? data.filter((n) => !n.readTime) : data) : []
  const now = new Date()

  const open = async (n: NotificationView) => {
    setBanner(null)
    try {
      const target = await platformAdminApi.openNotification(n.id)
      navigate(target.path)
    } catch (e) {
      setBanner(errorMessage(e, 'Không mở được thông báo.'))
      refetch()
    }
  }
  const markAll = async () => {
    try {
      await platformAdminApi.markAllNotificationsRead()
      setToast('Tất cả thông báo đã được đánh dấu là đã đọc.')
      refetch()
    } catch (e) {
      setBanner(errorMessage(e, 'Không đánh dấu được thông báo.'))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={TITLE} sub="Chỉ yêu cầu nội bộ được CS giao đích danh cho bạn · mở thông báo sẽ kiểm tra lại quyền">
        <Button className={ICON_BUTTON} onClick={markAll} disabled={unread === 0}>
          <Icon name="checks" size={16} />
          Đánh dấu đã đọc tất cả
        </Button>
      </PageHeader>
      <div>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'all' | 'unread')}
          options={[{ value: 'all', label: 'Tất cả' }, { value: 'unread', label: `Chưa đọc ${unread}` }]}
        />
      </div>
      {banner && <Note tone="err"><span role="alert">{banner}</span></Note>}

      {loading && !data && <LoadingBlock />}
      {error != null && <ErrorBlock message={userFacingError(error, 'Không tải được thông báo.')} onRetry={refetch} />}
      {data && !error && shown.length === 0 && (
        <EmptyBlock title={tab === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'} sub="Yêu cầu nội bộ CS giao cho bạn sẽ hiện ở đây." />
      )}
      {data && !error && shown.length > 0 && (
        <Card>
          <ul className="m-0 flex list-none flex-col p-0">
            {shown.map((n) => {
              const isUnread = !n.readTime
              return (
                <li key={n.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-1 py-3 last:border-b-0 ${isUnread ? 'bg-[#eef4ef]' : ''}`}>
                  <span aria-label={isUnread ? 'Chưa đọc' : undefined} className={`size-2 shrink-0 rounded-full ${isUnread ? 'bg-brand' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1 basis-64">
                    <div className={`text-[13px] text-ink ${isUnread ? 'font-semibold' : 'font-medium'}`}>{n.title}</div>
                    <div className="text-xs text-muted">{n.summary}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{formatNoticeTime(n.createdTime, now)}</span>
                  <Button variant="link" size="sm" onClick={() => open(n)}>{noticeActionLabel(n.category)}</Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <Foot>Thông báo của SA: yêu cầu nội bộ CS giao đích danh và nhắc việc khi chưa có kết quả sau 4 giờ.</Foot>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function AdminNoticePage() {
  return <SaPage title={TITLE}><NoticeContent /></SaPage>
}
