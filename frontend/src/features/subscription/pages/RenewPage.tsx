import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import { Button, Card, ErrorBlock, Icon, LoadingBlock, Note, PageHeader, Panel } from '../../../shared/ui'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { InactiveFarmBanner, openedInactiveFromFarmSelect } from '../../farm-workspace'
import { subscriptionApi } from '../api/subscriptionApi'
import { usePaymentRequest } from '../hooks/usePaymentRequest'
import { Facts, serviceLabel } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { TermCards } from '../components/TermCards'
import { useFarmScope } from '../hooks/useFarmScope'
import { TERMS, estimatePeriod, fmtDate, fmtPeriod, fmtVnd, priceFor, stateForOverview, stateFromError, termLabel, versionLabel } from '../domain/subscriptionRules'
import type { Term } from '../types'
import { useOverview } from '../hooks/useOverview'

const TITLE = 'Gia hạn gói – chọn thời hạn'

export default function RenewPage() {
  const { farmId, to } = useFarmScope()
  const createPayment = usePaymentRequest(farmId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preset = Number(params.get('term')) as Term
  const [term, setTerm] = useState<Term | null>(TERMS.includes(preset) ? preset : null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { data, loading, error, refetch } = useOverview(farmId)
  const blocked = stateForOverview(data)
  const dialog = useStateDialog({
    onReload: refetch,
    forced: blocked,
    onDismiss: blocked ? () => navigate(to('/goi-dich-vu')) : undefined,
  })

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được thông tin gói dịch vụ.')} onRetry={refetch} /></Layout>

  const price = data.currentPrices
  const estimate = term ? estimatePeriod(subscriptionApi.now(), data.latestEnd, term) : null
  const back = () => navigate(to('/goi-dich-vu'))

  async function submit() {
    if (!term || !price) return
    setSaving(true)
    setSaveError('')
    try {
      const p = await createPayment(term, price.id)
      if (p.reopened) dialog.show({ kind: 'pending-exists', payment: p })
      else navigate(to(`/goi-dich-vu/chuyen-khoan/${subscriptionApi.paymentRouteId(p)}`, { from: 'subscription' }))
    } catch (e) {
      const state = stateFromError(e)
      if (state) dialog.show(state)
      else setSaveError(userFacingError(e, 'Không thể lưu dữ liệu. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub={data.farmName} />
        <Card variant="panel" title="Trạng thái trang trại"><Facts items={[
          ['Dịch vụ', serviceLabel(data.serviceStatus)],
          ['Kỳ hiện tại', data.currentPeriod ? fmtPeriod(data.currentPeriod.start, data.currentPeriod.end) : 'Chưa có'],
        ]} /></Card>
        {openedInactiveFromFarmSelect(params, data.serviceStatus) && <InactiveFarmBanner farmName={data.farmName} status={data.serviceStatus} />}
        <div className="grid grid-cols-4 items-start gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6">
          <div className="col-span-full min-w-0 @min-[880px]:col-span-5 @min-[1024px]:col-span-8 flex flex-col gap-4 @min-[1024px]:gap-6">
            <Card variant="panel" title="Thời hạn">
              <TermCards prices={price} selected={term} onSelect={setTerm} />
            </Card>
            <Card variant="panel" title="Điều khoản gói">
              <Facts items={[['Chức năng', 'Như nhau cho 1, 2, 3 năm'], ['Thanh toán', 'Một lần cho từng trại bằng chuyển khoản'], ['Tự động gia hạn', 'Không'], ['Hiệu lực yêu cầu', '24 giờ']]} />
            </Card>
          </div>
          <Panel tone="emphasis" className="col-span-full min-w-0 @min-[880px]:col-span-3 @min-[1024px]:col-span-4" title="Xem lại trước khi tạo">
            <div className="flex flex-col gap-4">
              <Facts cols={1} onDark items={[
                ['Trang trại', data.farmName],
                ['Thời hạn', term ? termLabel(term) : 'Chưa chọn'],
                ['Số tiền', term && price ? fmtVnd(priceFor(price, term)) : '—'],
                ['Kỳ dịch vụ (ước tính)', estimate ? fmtPeriod(estimate.start, estimate.end) : '—'],
                ['Bảng giá', price ? `${versionLabel(price.id)} · từ ${fmtDate(price.effectiveAt)}` : 'Chưa khả dụng'],
              ]} />
              {saveError && <Note tone="err">{saveError}</Note>}
              <Button variant="onDarkPrimary" size="bento" block disabled={!term || !price || saving} onClick={submit}>
                <Icon name="circle-plus" size={16} /> {saving ? 'Đang tạo yêu cầu…' : 'Tạo yêu cầu thanh toán'}
              </Button>
              <Button variant="onDark" size="bento" block onClick={back}><Icon name="arrow-left" size={16} /> Quay lại</Button>
            </div>
          </Panel>
        </div>
      </div>
      {dialog.element}
    </Layout>
  )
}
