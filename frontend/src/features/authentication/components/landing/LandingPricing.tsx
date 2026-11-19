import { Link } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { PLAN_YEARS } from '../../data/landingContent'
import { AUTH_PATH } from '../../domain/authErrors'
import { container } from './LandingHeader'
import type { PriceState, Prices } from './usePublicLanding'

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value))} đ`
const priceOf = (prices: Prices, years: 1 | 2 | 3) => years === 1 ? prices.price1y : years === 2 ? prices.price2y : prices.price3y

/** Ghi chú dưới giá, tính từ giá của phiên bản hiệu lực; không có giá thì không hiện số nào. */
function planNote(years: 1 | 2 | 3, prices: Prices | null) {
  const term = `Trọn ${years * 12} tháng`
  if (!prices) return term
  if (years === 1) return <>{term}<span className="hidden lg:inline"> · {money(prices.price1y / 12)}/tháng</span></>
  const saving = Math.round((1 - priceOf(prices, years) / (years * prices.price1y)) * 100)
  return saving > 0 ? `${term} · tiết kiệm ${saving}%` : term
}

const Skeleton = ({ className }: { className: string }) => <span aria-hidden="true" className={`block animate-pulse rounded-md bg-chip ${className}`} />

export function Pricing({ state, onRetry }: { state: PriceState; onRetry: () => void }) {
  const { status, prices } = state
  return (
    <section id="pricing" aria-busy={status === 'loading'} className={`${container} scroll-mt-20 py-6 lg:py-10`}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="m-0 hidden text-xs font-bold uppercase tracking-wider text-brand lg:block">Bảng giá</p>
          <h2 className="m-0 text-[22px] font-bold leading-tight text-ink lg:mt-3 lg:text-[28px]"><span className="lg:hidden">Bảng giá dễ hiểu</span><span className="hidden lg:inline">Giá theo năm, trả một lần cho từng trang trại</span></h2>
        </div>
        {status === 'loading' && <Badge tone="info">Đang tải bảng giá…</Badge>}
      </div>
      {status === 'unavailable' && (
        <div role="status" className="mt-5 flex max-w-[640px] flex-wrap items-center justify-between gap-4 rounded-xl border border-edge bg-white px-5 py-4">
          <div className="min-w-0 flex-1 basis-[280px]">
            <p className="m-0 text-xl font-bold text-[#212121]">Giá chưa khả dụng</p>
            <p className="m-0 mt-2 text-[13px] leading-5 text-muted">Chưa thể lấy đầy đủ bảng giá 1, 2 và 3 năm. Vui lòng thử lại; bạn vẫn có thể đăng ký, đăng nhập và xem các phần khác.</p>
          </div>
          <Button variant="primary" onClick={onRetry}>Thử lại</Button>
        </div>
      )}
      <div className="mt-5 grid gap-3 lg:mt-7 lg:grid-cols-3 lg:gap-[17px]">
        {PLAN_YEARS.map((years) => (
          <article key={years} className="rounded-[18px] border border-field bg-white p-4 lg:rounded-[20px] lg:p-6">
            <div className="flex items-baseline justify-between gap-3 lg:block">
              <h3 className="m-0 text-[22px] font-bold text-brand-dark lg:text-2xl">Gói {years} năm</h3>
              {status === 'loading' ? <Skeleton className="h-[34px] w-[200px] lg:mt-4" /> : <p className="m-0 text-[22px] font-bold text-brand-dark lg:mt-4 lg:text-[32px]">{prices ? money(priceOf(prices, years)) : '— đ'}</p>}
            </div>
            {status === 'loading' ? <Skeleton className="mt-3 h-3.5 w-60 max-w-full" /> : <p className="m-0 mt-1.5 text-sm text-subtle lg:mt-2 lg:text-base">{planNote(years, prices)}</p>}
            {status === 'loading'
              ? <Skeleton className="mt-6 hidden h-[52px] lg:block" />
              : <Link to={AUTH_PATH.register} className="mt-6 hidden h-[52px] items-center justify-center rounded-[14px] bg-brand text-[15px] font-bold text-white no-underline hover:bg-brand-dark lg:flex">Đăng ký trại</Link>}
          </article>
        ))}
      </div>
      <p className="m-0 mt-3 text-xs text-subtle lg:text-[13px]">Giá trọn kỳ, chuyển khoản một lần, không tự gia hạn.<span className="hidden lg:inline"> Cùng chức năng cho cả 3 thời hạn.</span></p>
      <Link to={AUTH_PATH.register} className="mt-4 flex h-11 items-center justify-center rounded-[14px] bg-brand text-[15px] font-bold text-white no-underline lg:hidden">Đăng ký trại</Link>
    </section>
  )
}
