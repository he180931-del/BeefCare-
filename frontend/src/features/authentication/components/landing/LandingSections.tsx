import { useState } from 'react'
import { Link } from 'react-router-dom'
import farm from '../../../../shared/assets/farm.png'
import wave from '../../../../shared/assets/wave.png'
import growthPreview from '../../assets/landing-growth-profile.jpg'
import { HERO_POINTS, OVERVIEW_CARDS, STEPS } from '../../constants/landingContent'
import { AUTH_PATH } from '../../domain/authPaths'
import { container } from './LandingHeader'

const card = 'rounded-[14px] border border-field bg-white lg:rounded-[18px]'
const eyebrow = 'm-0 hidden text-xs font-bold uppercase tracking-wider text-brand lg:block'
const sectionTitle = 'm-0 text-[22px] font-bold leading-tight text-ink lg:text-[30px]'
const circle = 'row-span-2 grid size-9 place-items-center rounded-full text-[11px] font-bold lg:row-span-1 lg:size-[42px] lg:text-xs'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <img src={wave} alt="" aria-hidden="true" className="pointer-events-none absolute -right-24 -top-10 hidden w-[900px] opacity-70 [mask-image:linear-gradient(to_right,transparent,black_35%)] lg:block" />
      <div className={`${container} relative grid items-center gap-8 pb-8 pt-8 lg:grid-cols-[1fr_596px] lg:gap-6 lg:pb-14 lg:pt-14`}>
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-brand lg:text-[13px]">Dành cho trại bò thịt 150–300 con</p>
          <h1 className="m-0 mt-4 text-[32px] font-bold leading-[1.2] text-ink lg:mt-5 lg:text-[42px]">Mỗi con bò một hồ sơ.<br />Cả <span className="hidden lg:inline">trang </span>trại trong tầm tay.</h1>
          <p className="m-0 mt-4 max-w-[520px] text-[15px] leading-7 text-subtle lg:mt-6 lg:text-[17px]">Từ chiếc thẻ tai đến từng mốc chăm sóc, BeefCare giúp bạn ghi nhận rõ ràng, theo dõi chủ động và chăm đàn tự tin hơn<span className="hidden lg:inline"> — trên một hệ thống dễ dùng</span>.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8">
            <Link to={AUTH_PATH.register} className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-brand px-7 text-[15px] font-bold text-white no-underline hover:bg-brand-dark lg:h-14">Bắt đầu quản lý trại</Link>
            <a href="#features" className="inline-flex h-12 items-center justify-center rounded-[14px] border border-field bg-white px-7 text-[15px] font-bold text-brand-dark no-underline hover:border-brand lg:h-14">Khám phá tính năng</a>
          </div>
          <ul className="m-0 mt-6 hidden list-none flex-wrap gap-x-8 gap-y-2 p-0 text-[13px] text-subtle lg:flex">
            {HERO_POINTS.map((point) => <li key={point}>✓ {point}</li>)}
          </ul>
        </div>
        <img src={farm} alt="Minh họa trang trại bò" className="relative mx-auto w-full max-w-[596px]" />
      </div>
    </section>
  )
}

export function Overview() {
  return (
    <section className={`${container} pb-10 lg:pb-12`}>
      <h2 className={`${sectionTitle} mb-4 lg:hidden`}>Một nhịp quản lý rõ ràng cho cả trại</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-[17px]">
        {OVERVIEW_CARDS.map(([title, text]) => (
          <div key={title} className={`${card} px-4 py-4 lg:min-h-[112px] lg:rounded-2xl lg:px-6 lg:py-6`}>
            <p className="m-0 text-sm font-bold text-brand-dark lg:text-xl">{title}</p>
            <p className="m-0 mt-1.5 text-[11px] text-brand-dark lg:mt-2 lg:text-[13px]">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Features({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <section id="features" aria-labelledby="landing-features-title" className={`${container} @container scroll-mt-20 py-6 lg:py-10`}>
      <p className={eyebrow}>Công cụ hằng ngày</p>
      <h2 id="landing-features-title" className={`${sectionTitle} lg:mt-3`}>Mọi thông tin quan trọng, cùng một chỗ</h2>
      {/* Bento (docs/BeefCare-Bento-Grid.md §1): một ảnh sản phẩm đủ lớn + các thẻ tính năng do Admin xuất bản. */}
      <div className="mt-5 grid gap-4 @min-[1024px]:mt-8 @min-[1024px]:grid-cols-2 @min-[1024px]:gap-6">
        <ProfilePreview />
        <ul className="m-0 grid min-w-0 list-none content-start gap-4 p-0 @min-[640px]:grid-cols-2 @min-[1024px]:content-stretch">
          {items.map(([title, text], index) => (
            <li key={title} className={`min-w-0 rounded-2xl border border-field bg-white p-4 @min-[1024px]:p-5 ${items.length % 2 === 1 && index === items.length - 1 ? '@min-[640px]:col-span-full' : ''}`}>
              <h3 className="m-0 text-base font-bold text-ink @min-[1024px]:text-lg">{title}</h3>
              <p className="mb-0 mt-2 text-sm leading-6 text-subtle">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * Ảnh chụp màn hình thật (tab Tăng trưởng & BCS, dữ liệu mẫu của chế độ mô phỏng), cắt quanh phần giải thích tính năng
 * (§3). Khối này không gắn với thẻ tính năng nào, nên Admin đổi thứ tự hay nội dung thẻ cũng không làm ảnh lệch chữ.
 */
function ProfilePreview() {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-4 rounded-2xl bg-brand-dark p-4 text-white @min-[640px]:p-6">
      <figcaption>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-lg font-bold @min-[640px]:text-xl">Xem hồ sơ bò trong BeefCare</p>
          <span className="rounded-full bg-ok-bg px-2 py-1 text-[11px] font-medium text-ok-fg">Dữ liệu minh họa</span>
        </div>
        <p className="mb-0 mt-2 text-sm leading-6 text-side-text">Mỗi con có tab Tăng trưởng &amp; BCS: tăng cân, lần cân tới, cân nặng theo thời gian và điểm thể trạng.</p>
      </figcaption>
      <img
        src={growthPreview}
        width={592}
        height={543}
        loading="lazy"
        alt="Tab Tăng trưởng & BCS với dữ liệu minh họa: tăng cân 0,43 kg/ngày, cân tới khoảng 331 kg vào 09/11/2026, biểu đồ cân nặng tăng từ 282 kg (20/07) lên 318 kg (10/10), BCS 3,0 / 5 và 9 lần đo."
        className="block h-auto w-full max-w-[592px] rounded-xl bg-page"
      />
    </figure>
  )
}

export function Steps() {
  return (
    <section id="steps" className="scroll-mt-20 lg:bg-[#eef4ef] lg:py-14">
      <div className={`${container} py-6 lg:py-0`}>
        <p className={eyebrow}>Bắt đầu thật đơn giản</p>
        <h2 className={`${sectionTitle} lg:mt-3 lg:text-[27px]`}><span className="lg:hidden">Bốn bước nhẹ nhàng, cả trại vững vàng</span><span className="hidden lg:inline">Ghi đúng một lần, nắm rõ cả hành trình</span></h2>
        <div className="mt-5 grid gap-3 lg:mt-8 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-[18px]">
          {STEPS.map(([title, text], index) => (
            <article key={title} className={`${card} relative grid min-h-[72px] grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 p-4 after:absolute after:-bottom-5 after:left-1/2 after:z-10 after:flex after:size-7 after:-translate-x-1/2 after:items-center after:justify-center after:rounded-full after:border after:border-brand/20 after:bg-white after:text-base after:font-bold after:leading-none after:text-brand after:shadow-sm after:content-['↓'] lg:min-h-[168px] lg:content-start lg:items-start lg:gap-y-3 lg:p-5 lg:after:-bottom-auto lg:after:left-auto lg:after:-right-[30px] lg:after:top-1/2 lg:after:translate-x-0 lg:after:-translate-y-1/2 lg:after:content-['→'] ${index === STEPS.length - 1 ? 'after:hidden' : ''}`}>
              <span className={`${circle} bg-brand text-white lg:size-[38px]`}>{String(index + 1).padStart(2, '0')}</span>
              <h3 className="m-0 text-sm font-bold text-ink lg:text-lg">{title}</h3>
              <p className="m-0 col-start-2 ml-3 border-l-2 border-brand/25 pl-3 text-[11px] leading-4 text-brand-dark before:mr-1.5 before:font-bold before:text-brand before:content-['•'] lg:col-span-2 lg:col-start-1 lg:text-sm lg:leading-6">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Faq({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const toggle = (index: number) => setOpen((current) => {
    const next = new Set(current)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    return next
  })
  return (
    <section id="faq" className={`${container} scroll-mt-20 py-6 lg:py-10`}>
      <p className={eyebrow}>Câu hỏi thường gặp</p>
      <h2 className={`${sectionTitle} lg:mt-3 lg:text-[28px]`}><span className="lg:hidden">Câu hỏi thường gặp</span><span className="hidden lg:inline">Bắt đầu với BeefCare, thật dễ dàng</span></h2>
      <div className="mt-5 flex flex-col gap-2.5 lg:mt-7 lg:gap-3">
        {items.map(([question, answer], index) => (
          <div key={question} className={`rounded-xl border bg-white transition-colors ${open.has(index) ? 'border-brand/30 bg-[#fbfdfb]' : 'border-field'}`}>
            <button type="button" aria-expanded={open.has(index)} onClick={() => toggle(index)} className="flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-4 py-3 text-left text-xs font-bold text-ink lg:min-h-[50px] lg:px-5 lg:text-sm">
              {question}<span aria-hidden="true" className="shrink-0 text-xl font-normal leading-none text-brand transition-transform duration-300 ease-out motion-reduce:transition-none">{open.has(index) ? '−' : '+'}</span>
            </button>
            <div aria-hidden={!open.has(index)} className={`origin-top overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out motion-reduce:transition-none ${open.has(index) ? 'max-h-[18rem] opacity-100' : 'max-h-0 opacity-0'}`}>
              <ul className="m-0 ml-3 flex list-none flex-col gap-1.5 px-4 pb-4 pt-3 text-sm leading-6 text-brand-dark lg:px-5">
                {(answer.match(/[^.!?]+[.!?]+/g) ?? [answer]).map((point) => <li key={point.trim()} className="flex items-start gap-2"><span aria-hidden="true" className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-brand" />{point.trim()}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
