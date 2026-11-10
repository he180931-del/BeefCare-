import { useDemoState } from '../../../hooks/useDemoState'
import { CONTACT } from '../data/landingContent'
import type { AuthClient } from '../types'
import { LandingHeader, container } from '../components/landing/LandingHeader'
import { Faq, Features, Hero, Overview, Steps } from '../components/landing/LandingSections'
import { Pricing } from '../components/landing/LandingPricing'
import { usePublicPrices, usePublishedLanding } from '../components/landing/usePublicLanding'

/** SCR-01. Giá lấy từ phiên bản hiệu lực; `?demo=prices-loading` và `?demo=prices-unavailable` (mô phỏng) hiện hai trạng thái giá. */
export function PublicLandingPage({ client }: { client: AuthClient }) {
  const demo = useDemoState()
  const { state, retry } = usePublicPrices(client, demo)
  const { features, faq, contactEmail, contactPhone } = usePublishedLanding(client)
  const email = contactEmail ?? CONTACT.email
  const phone = contactPhone ?? CONTACT.phone
  return (
    <main className="min-h-screen bg-page text-ink">
      <LandingHeader />
      <Hero />
      <Overview />
      <Features items={features} />
      <Steps />
      <Pricing state={state} onRetry={() => void retry()} />
      <Faq items={faq} />
      <section id="contact" className={`${container} scroll-mt-20 py-6 lg:py-10`}>
        <div className="flex flex-col gap-4 rounded-[22px] bg-brand-dark px-6 py-6 text-white lg:flex-row lg:items-center lg:justify-between lg:rounded-3xl lg:px-8 lg:py-9">
          <div>
            <h2 className="m-0 text-xl font-bold lg:text-[25px]"><span className="lg:hidden">Cần tư vấn?</span><span className="hidden lg:inline">Cần tư vấn cho trang trại của bạn?</span></h2>
            <p className="m-0 mt-2 text-[13px] leading-6 text-[#d7ebdf] lg:text-sm">Email: <a href={`mailto:${email}`} className="text-[#d7ebdf]">{email}</a><span className="hidden lg:inline">  ·  </span><br className="lg:hidden" />Điện thoại: <a href={`tel:${phone.replace(/\s+/g, '')}`} className="text-[#d7ebdf]">{phone}</a></p>
          </div>
          <a href={`mailto:${email}`} className="inline-flex h-[42px] items-center justify-center rounded-[14px] bg-[#eef4ef] px-8 text-[15px] font-bold text-brand-dark no-underline lg:h-[54px] lg:w-[280px]"><span className="lg:hidden">Liên hệ</span><span className="hidden lg:inline">Liên hệ BeefCare</span></a>
        </div>
      </section>
      <footer className={`${container} flex flex-col gap-1 pb-8 pt-4 lg:h-[88px] lg:flex-row lg:items-center lg:justify-between lg:py-0`}>
        <span className="text-sm font-bold text-brand-dark lg:text-[13px]">BeefCare</span>
        <span className="text-[11px] text-subtle lg:text-xs"><span className="hidden lg:inline">© 2026 BeefCare  ·  </span>Điều khoản · Chính sách dữ liệu</span>
      </footer>
    </main>
  )
}
