import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Card, ErrorBlock, Info, LoadingBlock, PageHeader } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { platformServiceApi } from '../api/platformServiceApi'
import { fmtDate, fmtEndDate, fmtSeconds, fmtVnd } from '../domain/dates'
import { PAYMENT_STATE_LABEL } from '../domain/reconciliation'

/** Read-only payment slice for UC4's source link, through the existing PM endpoint. */
export default function PaymentSourcePage() {
  const [params] = useSearchParams()
  const paymentId = Number(params.get('paymentId'))
  const farmId = Number(params.get('farmId'))
  const { data, loading, error, refetch } = useQuery(async () => {
    if (!Number.isSafeInteger(paymentId) || paymentId <= 0) throw new Error('Mã thanh toán không hợp lệ.')
    const payment = await platformServiceApi.getPayment(paymentId)
    if (params.has('farmId') && payment.farmId !== farmId) throw new Error('Thanh toán không thuộc trại đã chọn.')
    return payment
  }, [paymentId, farmId])
  return <Layout title="Thanh toán nguồn">
    <PageHeader title="Thanh toán nguồn" />
    <section aria-label="Thanh toán nguồn">
      {loading ? <LoadingBlock /> : error || !data ? <ErrorBlock message={userFacingError(error, 'Không tải được thanh toán nguồn.')} onRetry={refetch} /> :
        <Card title={data.quoteRef} sub={data.farmName}><Info cols={2} items={[
          ['Trạng thái', PAYMENT_STATE_LABEL[data.state]], ['Kỳ hạn', `${data.termYears} năm`], ['Số tiền', fmtVnd(data.amount)],
          ['Phiên bản giá', `v${data.priceVersionId}`], ['Tạo lúc', fmtSeconds(data.requestedAt)], ['Hết hạn lúc', fmtSeconds(data.expiresAt)],
          ['Kỳ đã mua', data.purchasedStart && data.purchasedEnd ? `${fmtDate(data.purchasedStart)} → ${fmtEndDate(data.purchasedEnd)}` : '—'],
          ['Biên lai', data.receiptCode ?? '—'], ['Người tạo yêu cầu', data.requestedByEmail ?? '—'],
        ]} /></Card>}
    </section>
    <Link className="mt-4 inline-flex rounded border border-field bg-white px-4 py-2 text-sm font-semibold text-brand"
      to={Number.isSafeInteger(farmId) && farmId > 0 ? `/nen-tang/goi-dang-ky?farmId=${farmId}` : '/nen-tang/goi-dang-ky'}>Quay lại gói của trại</Link>
  </Layout>
}
