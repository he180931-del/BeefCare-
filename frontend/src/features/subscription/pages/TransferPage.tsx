import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { useDemoState } from '../../../hooks/useDemoState'
import { subscriptionApi } from '../api/subscriptionApi'
import { useIsPhone, useTick } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { PhoneTransfer, ProgressCard, QrCard, TransferInfoCard } from '../components/TransferParts'
import { useFarmScope } from '../components/useFarmScope'
import { fmtPeriod, fmtTimeDate, fmtVnd, stateFromError, termLabel, toMs } from '../domain/subscriptionRules'
import { useOverview } from './useOverview'
import { usePaymentStatus } from './usePaymentStatus'

const TITLE = 'Hướng dẫn chuyển khoản'

export default function TransferPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { farmId, to } = useFarmScope()
  const navigate = useNavigate()
  const demo = useDemoState()
  const phone = useIsPhone()
  useTick() // bộ đếm ngược chạy theo đồng hồ của store
  const payment = usePaymentStatus(farmId, id, demo === 'bank-paid' || demo === 'result-unavailable' ? demo : undefined)
  const overview = useOverview(farmId)
  const now = subscriptionApi.now()
  const loaded = payment.payment
  const current = loaded?.state === 'PENDING' && now >= toMs(loaded.expiresAt) ? { ...loaded, state: 'EXPIRED' as const } : loaded
  const checking = payment.checking
  const notice = payment.notice
  const from = params.get('from')
  const expired = current?.state === 'EXPIRED'
  const dialog = useStateDialog({
    onReload: () => void check(),
    forced: expired && current ? { kind: 'expired', payment: current } : null,
    onDismiss: expired ? () => navigate(to('/goi-dich-vu/lich-su')) : undefined,
  })
  async function check() {
    try {
      await payment.refresh()
    } catch (e) {
      const state = stateFromError(e)
      if (state) dialog.show(state)
    }
  }

  if (payment.loading && !current) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (!current) return <Layout title={TITLE}><ErrorBlock message={userFacingError(payment.error, 'Không tìm thấy yêu cầu thanh toán.')} onRetry={() => void payment.refresh().catch(() => {})} /></Layout>

  const closeTo = from === 'lich-su' ? to('/goi-dich-vu/lich-su') : from === 'onboarding' ? '/chon-trai' : to('/goi-dich-vu')
  const close = () => navigate(closeTo)
  const farmOverview = overview.data?.farmId === farmId ? overview.data : null
  const farmName = farmOverview?.farmName ?? ''
  const firstPurchase = farmOverview != null && farmOverview.periods.every((p) => p.paymentCode === current.quoteRef
    || current.purchasedStart != null && toMs(p.start) > toMs(current.purchasedStart))
  const paid = current.state === 'PAID'
  const pending = current.state === 'PENDING'

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        {phone ? (
          <p className="m-0 text-[11px] text-muted">{from === 'onboarding' ? 'Đăng ký gói' : 'Gia hạn gói'} · {farmName}</p>
        ) : (
          <PageHeader title={TITLE} sub={`Yêu cầu ${current.quoteRef} · ${termLabel(current.durationYears)} · ${farmName}`}>
            <Button onClick={close}>Đóng hướng dẫn</Button>
          </PageHeader>
        )}
        {paid && (
          <Note tone="ok">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>Thanh toán {current.quoteRef} đã được xác nhận. Kỳ dịch vụ {current.purchasedStart && current.purchasedEnd ? fmtPeriod(current.purchasedStart, current.purchasedEnd) : '—'}.</span>
              {firstPurchase
                ? <Button variant="primary" size="sm" onClick={() => navigate('/tong-quan')}>Vào trại</Button>
                : <Button variant="primary" size="sm" onClick={() => navigate(to('/goi-dich-vu'))}>Về gói dịch vụ</Button>}
            </span>
          </Note>
        )}
        {pending && !phone && (
          <Note tone="info">
            Chuyển đúng {fmtVnd(current.amountVnd)} với nội dung {current.quoteRef} trước {fmtTimeDate(current.expiresAt)}. Dịch vụ được kích hoạt tự động sau khi giao dịch được xác nhận.
          </Note>
        )}
        {notice && <Note tone="err">{notice}</Note>}
        {phone ? (
          <PhoneTransfer payment={current} now={now} checking={checking} onCheck={() => void check()} onClose={close} />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[376px_minmax(0,1fr)]">
            <QrCard payment={current} now={now} />
            <div className="flex min-w-0 flex-col gap-4">
              <TransferInfoCard payment={current} />
              <ProgressCard payment={current} checking={checking} onCheck={() => void check()} onHistory={() => navigate(to('/goi-dich-vu/lich-su'))} />
            </div>
          </div>
        )}
        <Foot>Đối chiếu mã yêu cầu, ngân hàng nhận, số tài khoản, số tiền và nội dung chuyển khoản; mã quét chỉ hiển thị khi yêu cầu còn hiệu lực.</Foot>
      </div>
      {dialog.element}
    </Layout>
  )
}
