import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session/sessionContext'
import { Button } from '../../../shared/ui'
import { businessDate } from '../../../shared/lib/date/farmTime'
import FeedPrintFallback from '../components/FeedPrintFallback'
import FeedPrintFrame from '../components/FeedPrintFrame'
import { FeedDayLogPrintDocument, FeedFeedingRecordPrintDocument } from '../components/FeedPrintDocuments'
import { useFeedFeedingScreen } from '../hooks/useFeedFeeding'
import { isCalendarDate } from '../domain/feedPrintRoute'

export default function FeedFeedingPrintPage() {
  const [params] = useSearchParams()
  const session = useSession()
  const date = isCalendarDate(params.get('date')) ? params.get('date')! : businessDate()
  const recordId = params.get('recordId')
  const query = useFeedFeedingScreen({ from: date, to: date }, session?.role !== 'TECHNICIAN')
  const record = query.data?.records.find((row) => String(row.id) === recordId)
  const isRecordView = Boolean(recordId)

  return (
    <FeedPrintFrame title={isRecordView ? 'In bản ghi cho ăn' : 'In nhật ký cho ăn'}>
      <div className="feed-print-actions mx-auto flex max-w-[980px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to={`/thuc-an/nhat-ky?date=${encodeURIComponent(date)}`} className="text-sm font-semibold text-brand underline">Quay lại nhật ký</Link>
        {query.data && (!isRecordView || record) && <Button variant="primary" onClick={() => window.print()}>In bản đã lưu</Button>}
      </div>
      {query.loading && !query.data && <FeedPrintFallback title="Đang tải nhật ký…" />}
      {Boolean(query.error) && <FeedPrintFallback title="Không tải được nhật ký" detail="Không thể tạo bản in khi dữ liệu chưa được đọc từ nguồn hiện tại." />}
      {!query.loading && !query.error && isRecordView && !record && <FeedPrintFallback title="Không tìm thấy bản ghi cho ăn" detail="Bản ghi không có trong dữ liệu đã lưu; không tạo bản in chính thức." />}
      {record && <FeedFeedingRecordPrintDocument record={record} farmName={session?.farmName ?? undefined} />}
      {!isRecordView && query.data && <FeedDayLogPrintDocument date={date} records={query.data.records} rations={query.data.rations} pens={query.data.pens} farmName={session?.farmName ?? undefined} />}
    </FeedPrintFrame>
  )
}
