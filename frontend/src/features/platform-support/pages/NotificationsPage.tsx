import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, PageHeader, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { supportApi } from '../api/supportApi'
import { errText } from '../components/common'

const TITLE = 'Thông báo hỗ trợ'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const { data, loading, error, refetch } = useQuery(() => supportApi.listNotifications(), [])
  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={errText(error, 'Không tải được thông báo.')} onRetry={refetch} /></Layout>
  const unread = data.filter((n) => !n.read).length
  const items = tab === 'unread' ? data.filter((n) => !n.read) : data
  const open = async (id: number, ticketCode: string, targetType?: string, targetId?: number) => {
    await supportApi.markNotificationRead(id)
    navigate(targetType === 'INTERNAL_REQUEST' ? `/nen-tang/yeu-cau/${targetId ?? ticketCode}` : `/nen-tang/ho-tro/${ticketCode}`) // màn đích kiểm tra lại quyền khi mở
  }
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub="Mở thông báo sẽ kiểm tra lại quyền của bạn với ticket">
          <Button disabled={unread === 0} onClick={async () => { await supportApi.markAllNotificationsRead(); await refetch() }}><Icon name="checks" size={16} /> Đánh dấu đã đọc tất cả</Button>
        </PageHeader>
        <div><Segmented options={[{ value: 'all', label: 'Tất cả' }, { value: 'unread', label: `Chưa đọc ${unread}` }]} value={tab} onChange={setTab} /></div>
        <Card>
          {items.length === 0 ? <EmptyBlock title="Không có thông báo" sub="Bạn đã đọc hết thông báo hỗ trợ." /> : (
            <ul className="m-0 flex list-none flex-col p-0">
              {items.map((n) => (
                <li key={n.id} className={`flex items-center gap-3 border-b border-rule px-3 py-3 last:border-b-0 ${n.read ? 'bg-white' : 'bg-[#eef4ef]'}`}>
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${n.read ? '' : 'bg-brand'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`m-0 text-[13px] text-ink ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</p>
                    <p className="m-0 text-xs text-muted">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{n.at}</span>
                  <Button variant="link" size="sm" onClick={() => void open(n.id, n.ticketCode, n.targetType, n.targetId)}>{n.actionLabel}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Foot>Thông báo hỗ trợ của CS. Thông báo chưa đọc có nền xanh nhạt và chấm xanh; nút bên phải mở thẳng việc cần làm. Khi mở, hệ thống kiểm tra lại quyền với ticket (ví dụ ticket đã bàn giao cho người khác chỉ còn xem).</Foot>
      </div>
    </Layout>
  )
}
