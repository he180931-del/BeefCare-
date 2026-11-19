import { Link, useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Table, Td, Th } from '../../../components/ui'
import { Facts, ICON_BTN, ServiceBadge, type Fact } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { TermCards } from '../components/TermCards'
import { useFarmScope } from '../components/useFarmScope'
import { fmtDate, fmtEndDay, fmtPeriod, fmtVnd, termLabel, toMs, versionLabel } from '../domain/subscriptionRules'
import type { PeriodStatus, SubscriptionOverview } from '../types'
import { useOverview } from './useOverview'

const TITLE = 'Gói dịch vụ của trại'
const PERIOD_BADGE: Record<PeriodStatus, ['ok' | 'info' | 'outline', string]> = { CURRENT: ['ok', 'Hiện tại'], FUTURE: ['info', 'Sắp tới'], PAST: ['outline', 'Đã qua'] }

function ServiceFacts({ o, openHref }: { o: SubscriptionOverview; openHref: string }) {
  const price = o.currentPrices
  const items: Fact[] = [
    ['Kỳ hiện tại', o.currentPeriod ? fmtPeriod(o.currentPeriod.start, o.currentPeriod.end) : 'Chưa có'],
    ['Còn lại', o.daysRemaining !== null ? `${o.daysRemaining} ngày` : '—'],
    ['Ngày kết thúc đã xác nhận', o.latestEnd ? fmtEndDay(o.latestEnd) : '—'],
    ['Mở gia hạn từ', o.renewalOpensAt ? fmtDate(o.renewalOpensAt) : '—'],
    ['Tạm ngưng', o.suspended ? `Có (từ ${o.suspendedSince ? fmtDate(o.suspendedSince) : '—'})` : 'Không', o.suspended ? 'warn' : undefined],
    ['Yêu cầu đang chờ', o.pendingPayment ? <span key="p">{o.pendingPayment.quoteRef} · <Link className="font-semibold text-brand" to={openHref}>Mở hướng dẫn</Link></span> : 'Không'],
    ['Bảng giá hiện hành', price ? `${versionLabel(price.id)} · từ ${fmtDate(price.effectiveAt)}` : 'Chưa khả dụng'],
    ['Kỳ tương lai', o.futurePeriods.length ? o.futurePeriods.map((p) => fmtPeriod(p.start, p.end)).join(', ') : '—'],
  ]
  return <Facts items={items} cols={4} />
}

export default function SubscriptionHomePage() {
  const { farmId, to } = useFarmScope()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOverview(farmId)
  const dialog = useStateDialog({ onReload: refetch })

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được thông tin gói dịch vụ.')} onRetry={refetch} /></Layout>

  const first = data.periods.length === 0
  const elig = data.eligibility
  const periods = [...data.periods].sort((a, b) => toMs(b.start) - toMs(a.start))
  const notice = !elig.ok && elig.reason === 'SUSPENDED'
    ? <Note tone="warn">{data.farmName} đang tạm ngưng dịch vụ. Hiện chưa thể tạo yêu cầu thanh toán; hãy gửi yêu cầu hỗ trợ.</Note>
    : !elig.ok && elig.reason === 'OUTSIDE_WINDOW'
      ? <Note tone="info">Gia hạn mở từ {fmtDate(elig.opensAt)}, trước ngày kết thúc đã xác nhận {data.latestEnd ? fmtEndDay(data.latestEnd) : ''} 90 ngày.</Note>
      : null

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub={data.farmName}>
          <Button className={ICON_BTN} onClick={() => navigate(to('/goi-dich-vu/lich-su'))}><Icon name="history" size={16} /> Lịch sử thanh toán</Button>
          <Button variant="primary" disabled={!elig.ok} onClick={() => navigate(to('/goi-dich-vu/gia-han'))}>{first ? 'Thanh toán để kích hoạt' : 'Gia hạn gói'}</Button>
        </PageHeader>
        {notice}
        <Card title="Trạng thái dịch vụ" actions={<ServiceBadge status={data.serviceStatus} />}>
          <ServiceFacts o={data} openHref={to(`/goi-dich-vu/chuyen-khoan/${data.pendingPayment?.quoteRef ?? ''}`, { from: 'subscription' })} />
        </Card>
        <Card title="Bảng giá gói BeefCare">
          {data.currentPrices ? (
            <TermCards prices={data.currentPrices} />
          ) : (
            <Note tone="warn">
              <span className="flex flex-wrap items-center justify-between gap-2">
                Hiện chưa lấy được bảng giá gói.
                <Button size="sm" className={ICON_BTN} onClick={refetch}><Icon name="refresh" size={14} /> Thử lại</Button>
              </span>
            </Note>
          )}
        </Card>
        <Card title="Các kỳ đã mua">
          {periods.length ? (
            <Table>
              <thead><tr><Th>Kỳ dịch vụ</Th><Th>Mã thanh toán</Th><Th>Thời hạn</Th><Th>Số tiền</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.paymentCode}>
                    <Td className="font-medium">{fmtPeriod(p.start, p.end)}</Td>
                    <Td>{p.paymentCode}</Td>
                    <Td>{termLabel(p.durationYears)}</Td>
                    <Td>{fmtVnd(p.amountVnd)}</Td>
                    <Td><Badge tone={PERIOD_BADGE[p.status][0]}>{PERIOD_BADGE[p.status][1]}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyBlock title="Chưa có kỳ dịch vụ nào" sub="Kỳ dịch vụ xuất hiện sau khi thanh toán đầu tiên được xác nhận." />
          )}
        </Card>
        <Foot>Xem thời hạn hiện tại, ngày hết hạn, bảng giá áp dụng và yêu cầu chuyển khoản đang chờ; lịch sử thanh toán luôn mở được từ đây.</Foot>
      </div>
      {dialog.element}
    </Layout>
  )
}
