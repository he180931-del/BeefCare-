import { Link, useParams } from 'react-router-dom'
import { useSession } from '../../../app/session/sessionContext'
import { Button } from '../../../shared/ui'
import FeedPrintFallback from '../components/FeedPrintFallback'
import FeedPrintFrame from '../components/FeedPrintFrame'
import { FeedRationPrintDocument } from '../components/FeedPrintDocuments'
import { useFeedRationList } from '../hooks/useFeedRationList'

export default function FeedRationPrintPage() {
  const { id } = useParams()
  const session = useSession()
  const query = useFeedRationList()
  const ration = query.data?.rows.find((row) => String(row.id) === String(id))

  return (
    <FeedPrintFrame title="In khẩu phần">
      <div className="feed-print-actions mx-auto flex max-w-[980px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/thuc-an/khau-phan" className="text-sm font-semibold text-brand underline">Quay lại khẩu phần</Link>
        {ration && <Button variant="primary" onClick={() => window.print()}>In bản đã lưu</Button>}
      </div>
      {query.loading && !query.data && <FeedPrintFallback title="Đang tải khẩu phần…" />}
      {Boolean(query.error) && <FeedPrintFallback title="Không tải được khẩu phần" detail="Không thể tạo bản in khi dữ liệu chưa được đọc từ nguồn hiện tại." />}
      {!query.loading && !query.error && !ration && <FeedPrintFallback title="Không tìm thấy phiên bản khẩu phần" detail="Phiên bản này không có trong dữ liệu đã lưu; không tạo bản in chính thức." />}
      {ration && <FeedRationPrintDocument ration={ration} pens={query.data?.pens ?? []} farmName={session?.farmName ?? undefined} />}
    </FeedPrintFrame>
  )
}
