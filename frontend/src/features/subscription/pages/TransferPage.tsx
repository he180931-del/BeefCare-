import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { subscriptionApi } from '../api/subscriptionApi'
import { useIsPhone, useTick } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { PhoneTransfer, ProgressCard, QrCard, TransferInfoCard } from '../components/TransferParts'
import { useFarmScope } from '../components/useFarmScope'
import { fmtPeriod, fmtTimeDate, fmtVnd, stateFromError, termLabel, toMs } from '../domain/subscriptionRules'
import type { Payment } from '../types'
import { useOverview } from './useOverview'

const TITLE = 'Hướng dẫn chuyển khoản'

export default function TransferPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { farmId, to } = useFarmScope()
  const navigate = useNavigate()
  const demo = useDemoState()
  const phone = useIsPhone()
  useTick() // bộ đếm ngược chạy theo đồng hồ của store
  const payment = useQuery(() => subscriptionApi.getPayment(farmId, id), [farmId, id])
  const overview = useOverview(farmId)
  const [latest, setLatest] = useState<Payment | null>(null)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState('')
  const current = latest ?? payment.data ?? null
  const from = params.get('from')
  const expired = current?.state === 'EXPIRED'
  const dialog = useStateDialog({
    onReload: () => void check(),
    forced: expired && current ? { kind: 'expired', payment: current } : null,
    onDismiss: expired ? () => navigate(to('/goi-dich-vu/lich-su')) : undefined,
  })
  const now = subscriptionApi.now()
  const clockExpired = current?.state === 'PENDING' && now >= toMs(current.expiresAt)

  useEffect(() => { setLatest(null); setNotice('') }, [farmId, id])
  // Hết giờ đếm ngược thì hỏi lại trạng thái một lần để chuyển sang EXPIRED
  useEffect(() => { if (clockExpired) void check() }, [clockExpired]) // eslint-disable-line react-hooks/exhaustive-deps

  async function check() {
    setChecking(true)
    setNotice('')
    try {
      setLatest(await subscriptionApi.refreshPayment(farmId, id, demo === 'bank-paid' || demo === 'result-unavailable' ? demo : undefined))
    } catch (e) {
      const state = stateFromError(e)
      if (state) dialog.show(state)
      else setNotice(userFacingError(e, 'Không kiểm tra được trạng thái. Vui lòng thử lại.'))
    } finally {
      setChecking(false)
    }
  }

  if (payment.loading && !current) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (!current) return <Layout title={TITLE}><ErrorBlock message={userFacingError(payment.error, 'Không tìm thấy yêu cầu thanh toán.')} onRetry={payment.refetch} /></Layout>

  const closeTo = from === 'lich-su' ? to('/goi-dich-vu/lich-su') : from === 'onboarding' ? '/chon-trai' : to('/goi-dich-vu')
  const close = () => navigate(closeTo)
  const farmName = overview.data?.farmName ?? ''
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
              {from === 'onboarding'
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
