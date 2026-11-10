import { Card } from '../../../components/ui'
import type { FeedReceipt } from '../types/feedReceipt'

type AuditFields = Pick<FeedReceipt, 'createdByName' | 'createdAt' | 'postedByName' | 'postedAt' | 'voidedByName' | 'voidedAt' | 'voidReason'>

function timeInBrowserZone(value: string | undefined) {
  if (!value) return ''
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? value : time.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/** Only show facts returned by the backend; old receipts may not have actor metadata. */
export function FeedReceiptAudit({ receipt }: { receipt: AuditFields }) {
  const rows = [
    { label: 'Tạo phiếu', actor: receipt.createdByName, at: receipt.createdAt },
    { label: 'Ghi sổ', actor: receipt.postedByName, at: receipt.postedAt },
    { label: 'Hủy phiếu', actor: receipt.voidedByName, at: receipt.voidedAt },
  ].filter((row) => row.actor || row.at)
  if (!rows.length && !receipt.voidReason) return null
  return (
    <Card title="Lịch sử phiếu" sub="Thời gian hiển thị theo giờ máy">
      <dl className="m-0 flex flex-col gap-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">{row.label}:</dt>
            <dd className="m-0">{[row.actor, timeInBrowserZone(row.at)].filter(Boolean).join(' · ')}</dd>
          </div>
        ))}
        {receipt.voidReason && <div className="flex flex-wrap gap-x-2"><dt className="font-semibold">Lý do hủy:</dt><dd className="m-0">{receipt.voidReason}</dd></div>}
      </dl>
    </Card>
  )
}
