import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../shared/ui'
import { useDemoState } from '../../../demo/demoModules'
import { SetupLayout, Stepper } from '../../farm-workspace'
import { useIsPhone, useTick } from '../components/shared'
import CancelRequestDialog from '../components/CancelRequestDialog'
import DevTransferSimulator from '../components/DevTransferSimulator'
import PaidTransfer from '../components/PaidTransfer'
import { useStateDialog } from '../components/StateDialog'
import { PhoneTransfer, ProgressCard, QrCard, TransferInfoCard } from '../components/TransferParts'
import { useFarmScope } from '../hooks/useFarmScope'
import { fmtDateTime, fmtVnd, stateFromError, termLabel, toMs } from '../domain/subscriptionRules'
import { useOverview } from '../hooks/useOverview'
import { usePaymentStatus } from '../hooks/usePaymentStatus'
import { useSubscriptionBoundary } from '../hooks/useSubscriptionUseCase'

const TITLE = 'Hướng dẫn chuyển khoản'

export default function TransferPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { farmId, to } = useFarmScope()
  const navigate = useNavigate()
  const demo = useDemoState()
  const phone = useIsPhone()
  const subscription = useSubscriptionBoundary()
  useTick() // bộ đếm ngược chạy theo đồng hồ của store
  const payment = usePaymentStatus(farmId, id, demo === 'bank-paid' || demo === 'result-unavailable' ? demo : undefined)
  const overview = useOverview(farmId)
  const now = subscription.now()
  const loaded = payment.payment
  const current = loaded?.state === 'PENDING' && now >= toMs(loaded.expiresAt) ? { ...loaded, state: 'EXPIRED' as const } : loaded
  const checking = payment.checking
  const notice = payment.notice
  const [cancelling, setCancelling] = useState(false)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
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

  // Opened from SCR-58 while registering a farm (step 3): the tab has not entered that farm, so stay in the onboarding
  // shell like SCR-58 instead of the farm shell, whose header and sidebar belong to the farm this tab was in.
  const shell = (children: ReactNode) => from === 'onboarding'
    ? <SetupLayout step={3} eyebrow="Thiết lập trại" heading="Mỗi trại một hồ sơ rõ ràng." lines={['Thông tin, quyền truy cập và dịch vụ được quản lý riêng cho từng trại.']}><Stepper current={3} />{children}</SetupLayout>
    : <Layout title={TITLE}>{children}</Layout>

  if (payment.loading && !current) return shell(<LoadingBlock />)
  if (!current) return shell(<ErrorBlock message={userFacingError(payment.error, 'Không tìm thấy yêu cầu thanh toán.')} onRetry={() => void payment.refresh().catch(() => {})} />)

  const closeTo = from === 'lich-su' ? to('/goi-dich-vu/lich-su') : from === 'onboarding' ? '/chon-trai' : to('/goi-dich-vu')
  const close = () => navigate(closeTo)
  const farmOverview = overview.data?.farmId === farmId ? overview.data : null
  const farmName = farmOverview?.farmName ?? ''
  if (current.state === 'PAID') {
    return shell(<PaidTransfer key={`${farmId}:${current.id}`} farmId={farmId} farmName={farmName} payment={current}
      checkAccess={subscription.entersFarmAfterPayment} onClose={close} />)
  }

  const firstPurchase = farmOverview != null && farmOverview.periods.every((p) => p.paymentCode === current.quoteRef
    || current.purchasedStart != null && toMs(p.start) > toMs(current.purchasedStart))
  const pending = current.state === 'PENDING'
  const cancelled = current.state === 'CANCELLED'
  // D38: same rule as A18 — unexpired PENDING and no transfer received yet (bước 2 của tiến trình còn "Đang chờ").
  const cancellable = pending && !current.receivedAt && now < toMs(current.expiresAt)
  const openCancel = () => { setPageNotice(null); setCancelling(true) }

  return shell(
    <>
      <div className="flex flex-col gap-4">
        {phone ? (
          // A first purchase is "Đăng ký gói" from every entry point (SCR-58, SCR-57, history), not only from onboarding.
          <p className="m-0 text-[11px] text-muted">{from === 'onboarding' || firstPurchase ? 'Đăng ký gói · ' : farmOverview ? 'Gia hạn gói · ' : ''}{farmName}</p>
        ) : (
          <PageHeader title={TITLE} sub={`Yêu cầu ${current.quoteRef} · ${termLabel(current.durationYears)} · ${farmName}`}>
            {/* SCR-59 #12: a secondary button (red text), not a solid red one beside "Đóng hướng dẫn". */}
            {cancellable && <Button size="bento" className="!text-err-fg" onClick={openCancel}>Hủy yêu cầu</Button>}
            <Button size="bento" onClick={close}>Đóng hướng dẫn</Button>
          </PageHeader>
        )}
        {pending && !phone && (
          <Note tone="info">
            Chuyển đúng {fmtVnd(current.amountVnd)} với nội dung {current.quoteRef} trước {fmtDateTime(current.expiresAt)}. Dịch vụ được kích hoạt tự động sau khi giao dịch được xác nhận.
          </Note>
        )}
        {cancelled && (
          // MSG-FE19-18 (D38)
          <Note tone="warn">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Yêu cầu thanh toán {current.quoteRef} đã hủy{current.cancelledAt ? ` lúc ${fmtDateTime(current.cancelledAt)}` : ''}. Đừng chuyển khoản vào mã này.
                {current.cancelReason ? ` Lý do: ${current.cancelReason}` : ''}
              </span>
              <span className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(to('/goi-dich-vu'))}>Về gói dịch vụ</Button>
                <Button variant="primary" size="sm" onClick={() => navigate(to('/goi-dich-vu/gia-han'))}>Tạo yêu cầu mới</Button>
              </span>
            </span>
          </Note>
        )}
        {pageNotice && <Note tone="info">{pageNotice}</Note>}
        {notice && <Note tone="err">{notice}</Note>}
        {phone ? (
          <PhoneTransfer payment={current} now={now} checking={checking} onCheck={() => void check()} onClose={close} onCancel={cancellable ? openCancel : undefined} />
        ) : (
          <div className="grid grid-cols-4 items-start gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6">
            <div className="col-span-full min-w-0 @min-[880px]:col-span-3 @min-[1024px]:col-span-4"><QrCard payment={current} now={now} /></div>
            <div className="col-span-full min-w-0 @min-[880px]:col-span-5 @min-[1024px]:col-span-8 flex flex-col gap-4 @min-[1024px]:gap-6">
              <TransferInfoCard payment={current} />
              <ProgressCard payment={current} checking={checking} onCheck={() => void check()} onHistory={() => navigate(to('/goi-dich-vu/lich-su'))} />
            </div>
          </div>
        )}
        {/* Chỉ khi chạy thử (vite dev); bản build production loại bỏ nhánh này. */}
        {import.meta.env.DEV && pending && <DevTransferSimulator farmId={farmId} payment={current} onSent={() => void check()} />}
        <Foot>Đối chiếu mã yêu cầu, ngân hàng nhận, số tài khoản, số tiền và nội dung chuyển khoản; mã quét chỉ hiển thị khi yêu cầu còn hiệu lực.</Foot>
      </div>
      {cancelling && (
        <CancelRequestDialog farmId={farmId} payment={current} onClose={() => setCancelling(false)}
          onCancelled={() => { setCancelling(false); void check() }}
          onBlocked={(state) => { setCancelling(false); dialog.show(state); void check() }}
          onStale={(message) => { setCancelling(false); setPageNotice(message); void check() }} />
      )}
      {dialog.element}
    </>,
  )
}
