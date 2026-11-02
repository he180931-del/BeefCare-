import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { Icon } from '../../../components/Icon'
import { Button, Card, ErrorBlock, Foot, LoadingBlock, Note } from '../../../components/ui'
import { useSession } from '../../authorization'
import { subscriptionApi } from '../api/subscriptionApi'
import { Facts, ICON_BTN, serviceLabel } from '../components/shared'
import { useStateDialog } from '../components/StateDialog'
import { TermCards } from '../components/TermCards'
import { useFarmScope } from '../components/useFarmScope'
import { TERMS, fmtDate, fmtVnd, priceFor, stateForOverview, stateFromError, termLabel, versionLabel } from '../domain/subscriptionRules'
import type { Term } from '../types'
import { useOverview } from './useOverview'

const ONBOARDING_FARM_ID = 2 // Trại Tản Lĩnh: trại vừa đăng ký ở bước 2

function Stepper() {
  const done = 'inline-flex items-center gap-1 rounded-full border border-rule bg-rule px-3 py-1.5 text-xs text-ink'
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0" aria-label="Các bước đăng ký">
      <li className={done}><Icon name="circle-check" size={14} /> 1 · Hồ sơ</li>
      <li className={done}><Icon name="circle-check" size={14} /> 2 · Trang trại</li>
      <li aria-current="step" className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">3 · Gói dịch vụ</li>
    </ol>
  )
}

const SIDE_STEPS = [
  ['Hồ sơ chủ trại', 'Thông tin người chịu trách nhiệm'],
  ['Thông tin trại', 'Địa chỉ và đặc điểm đàn'],
  ['Dịch vụ', 'Chọn kỳ và xem giá'],
]

/** Khung thiết lập trại (panel xanh + thanh người dùng) như frame 2473:6931; panel ẩn khi màn hình hẹp. */
function OnboardingShell({ children }: { children: ReactNode }) {
  const session = useSession()
  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-[263px] shrink-0 flex-col gap-5 bg-[#0b563c] p-6 text-white lg:flex">
        <div className="flex items-center gap-2.5 text-lg font-bold"><span className="size-6 rounded-md bg-[#08a15f]" aria-hidden /> BeefCare</div>
        <div className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-white/70">Thiết lập trại</div>
        <h2 className="m-0 text-xl font-bold leading-snug">Mỗi trại một hồ sơ rõ ràng.</h2>
        <p className="m-0 text-xs text-white/70">Thông tin, quyền truy cập và dịch vụ được quản lý riêng cho từng trại.</p>
        <ol className="m-0 mt-6 flex list-none flex-col gap-2 p-0">
          {SIDE_STEPS.map(([name, sub], i) => (
            <li key={name} className={`flex items-center gap-3 rounded-lg px-3 py-3 ${i === 2 ? 'bg-white/10' : ''}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${i === 2 ? 'bg-white text-[#0b563c]' : 'bg-white/20'}`}>{i + 1}</span>
              <span><span className="block text-[13px] font-semibold">{name}</span><span className="block text-[11px] text-white/70">{sub}</span></span>
            </li>
          ))}
        </ol>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-[72px] items-center justify-end border-b border-rule bg-white px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-[#bdbdbd] text-white"><Icon name="user-circle" size={20} /></span>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session?.fullName ?? 'Nguyễn Văn Hùng'}</div>
              <div className="text-[11px] text-muted">{session?.email ?? 'hung.nv@gmail.com'}</div>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6">{children}</main>
      </div>
    </div>
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
      <Stepper />
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
