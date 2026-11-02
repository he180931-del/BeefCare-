import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { Button, Card, ErrorBlock, Foot, LoadingBlock, Note } from '../../../components/ui'
import SetupLayout from '../../farm-workspace/components/SetupLayout'
import { Stepper } from '../../farm-workspace/components/WorkspaceUi'
import { subscriptionApi } from '../api/subscriptionApi'
import { Facts, ICON_BTN, serviceLabel } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { TermCards } from '../components/TermCards'
import { useFarmScope } from '../components/useFarmScope'
import { TERMS, fmtDate, fmtVnd, priceFor, stateForOverview, stateFromError, termLabel, versionLabel } from '../domain/subscriptionRules'
import type { Term } from '../types'
import { useOverview } from './useOverview'

const ONBOARDING_FARM_ID = 2 // Trại Tản Lĩnh: trại vừa đăng ký ở bước 2

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <SetupLayout narrow step={3} eyebrow="Thiết lập trại" heading="Mỗi trại một hồ sơ rõ ràng." lines={['Thông tin, quyền truy cập và dịch vụ được quản lý riêng cho từng trại.']}>
      {children}
    </SetupLayout>
  )
}

export default function FirstSubscriptionPage() {
  const { farmId, to } = useFarmScope(ONBOARDING_FARM_ID)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preset = Number(params.get('term')) as Term
  const [term, setTerm] = useState<Term | null>(TERMS.includes(preset) ? preset : null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { data, loading, error, refetch } = useOverview(farmId)
  const dialog = useStateDialog({ onReload: refetch, forced: stateForOverview(data) })

  if (loading && !data) return <OnboardingShell><LoadingBlock /></OnboardingShell>
  if (error || !data) return <OnboardingShell><ErrorBlock message={userFacingError(error, 'Không tải được thông tin gói dịch vụ.')} onRetry={refetch} /></OnboardingShell>

  const price = data.currentPrices

  async function submit() {
    if (!term || !price) return
    setSaving(true)
    setSaveError('')
    try {
      const p = await subscriptionApi.createPayment(farmId, { durationYears: term, expectedPriceVersionId: price.id })
      navigate(to(`/goi-dich-vu/chuyen-khoan/${p.quoteRef}`, { from: 'onboarding' }))
    } catch (e) {
      const state = stateFromError(e)
      if (state) dialog.show(state)
      else setSaveError(userFacingError(e, 'Không thể lưu dữ liệu. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingShell>
      <Stepper current={3} />
      <Card title={`Đăng ký gói dịch vụ · ${data.farmName}`}>
        <div className="flex flex-col gap-4">
          <Facts items={[['Trạng thái trang trại', serviceLabel(data.serviceStatus), data.serviceStatus === 'PENDING_PAYMENT' ? 'warn' : undefined], ['Kỳ dịch vụ', data.currentPeriod ? 'Đang có kỳ' : 'Chưa có']]} />
          <TermCards prices={price} selected={term} onSelect={setTerm} />
          <Card title="Xem lại trước khi tạo">
            <Facts items={[
              ['Trang trại', data.farmName],
              ['Thời hạn', term ? termLabel(term) : 'Chưa chọn'],
              ['Số tiền', term && price ? fmtVnd(priceFor(price, term)) : '—'],
              ['Bảng giá', price ? `${versionLabel(price.id)} · hiệu lực ${fmtDate(price.effectiveAt)}` : 'Chưa khả dụng'],
            ]} />
          </Card>
          {saveError && <Note tone="err">{saveError}</Note>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button size="lg" onClick={() => navigate('/chon-trai')}>Để sau</Button>
            <Button size="lg" variant="primary" className={ICON_BTN} disabled={!term || !price || saving} onClick={submit}>
              <Icon name="circle-plus" size={16} /> {saving ? 'Đang tạo yêu cầu…' : 'Tạo yêu cầu thanh toán'}
            </Button>
          </div>
        </div>
      </Card>
      <Foot>Chọn một thời hạn cho trại này; yêu cầu chuyển khoản có hiệu lực 24 giờ và không tự gia hạn.</Foot>
      {dialog.element}
    </OnboardingShell>
  )
}
