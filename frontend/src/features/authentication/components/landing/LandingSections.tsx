import { useState } from 'react'
import { Link } from 'react-router-dom'
import farm from '../../../../assets/farm.png'
import wave from '../../../../assets/wave.png'
import { Icon } from '../../../../components/Icon'
import { HERO_POINTS, OVERVIEW_CARDS, STEPS } from '../../data/landingContent'
import { AUTH_PATH } from '../../domain/authErrors'
import type { AuthClient } from '../../types'
import { GoogleButton } from '../AuthControls'
import { container } from './LandingHeader'

const card = 'rounded-[14px] border border-field bg-white lg:rounded-[18px]'
const eyebrow = 'm-0 hidden text-xs font-bold uppercase tracking-wider text-brand lg:block'
const sectionTitle = 'm-0 text-[22px] font-bold leading-tight text-ink lg:text-[30px]'
const circle = 'row-span-2 grid size-9 place-items-center rounded-full text-[11px] font-bold lg:row-span-1 lg:size-[42px] lg:text-xs'

export function Hero({ client }: { client: AuthClient }) {
  return (
    <section id="top" className="relative overflow-hidden">
      <img src={wave} alt="" aria-hidden="true" className="pointer-events-none absolute -right-24 -top-10 hidden w-[900px] opacity-70 [mask-image:linear-gradient(to_right,transparent,black_35%)] lg:block" />
      <div className={`${container} relative grid items-center gap-8 pb-8 pt-8 lg:grid-cols-[1fr_596px] lg:gap-6 lg:pb-14 lg:pt-14`}>
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-brand lg:text-[13px]">Dành cho trại bò thịt 150–300 con</p>
          <h1 className="m-0 mt-4 text-[32px] font-bold leading-[1.2] text-ink lg:mt-5 lg:text-[42px]">Mỗi con bò một hồ sơ.<br />Cả <span className="hidden lg:inline">trang </span>trại trong tầm tay.</h1>
          <p className="m-0 mt-4 max-w-[520px] text-[15px] leading-7 text-subtle lg:mt-6 lg:text-[17px]">Ghi nhận tại chuồng, theo dõi sức khỏe và sinh sản, nhận nhắc việc đúng lúc<span className="hidden lg:inline"> — trên một hệ thống dễ dùng</span>.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-8">
            <Link to={AUTH_PATH.register} className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-brand px-7 text-[15px] font-bold text-white no-underline hover:bg-brand-dark lg:h-14">Đăng ký làm Chủ trại</Link>
            <GoogleButton client={client} label="Tiếp tục với Google" />
            <a href="#pricing" className="inline-flex h-12 items-center justify-center rounded-[14px] border border-field bg-white px-7 text-[15px] font-bold text-brand-dark no-underline hover:border-brand lg:h-14">Xem bảng giá</a>
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
      <h2 className={`${sectionTitle} mb-4 lg:hidden`}>Quản lý trọn vòng đời đàn bò</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-[17px]">
        {OVERVIEW_CARDS.map(([title, text]) => (
          <div key={title} className={`${card} px-4 py-4 lg:min-h-[112px] lg:rounded-2xl lg:px-6 lg:py-6`}>
            <p className="m-0 text-sm font-bold text-brand-dark lg:text-xl">{title}</p>
            <p className="m-0 mt-1.5 text-[11px] text-subtle lg:mt-2 lg:text-[13px]">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Features({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <section id="features" className={`${container} scroll-mt-20 py-6 lg:py-10`}>
      <p className={eyebrow}>Công cụ hằng ngày</p>
      <h2 className={`${sectionTitle} lg:mt-3`}><span className="lg:hidden">Đủ công cụ cho việc hằng ngày</span><span className="hidden lg:inline">Mọi thông tin quan trọng, cùng một chỗ</span></h2>
      <div className="mt-5 grid gap-3 lg:mt-8 lg:grid-cols-3 lg:gap-x-[17px] lg:gap-y-[18px]">
        {items.map(([title, text], index) => (
          <article key={title} className={`${card} grid min-h-[94px] grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 p-4 lg:min-h-[172px] lg:gap-y-3 lg:p-6`}>
            <span className={`${circle} bg-[#d7f0e1] text-brand-dark`}>{String(index + 1).padStart(2, '0')}</span>
            <h3 className="m-0 self-center text-sm font-bold text-ink lg:text-lg">{title}</h3>
            <p className="m-0 col-start-2 text-xs leading-5 text-subtle lg:col-span-2 lg:col-start-1 lg:text-sm lg:leading-6">{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function Steps() {
  return (
    <section id="steps" className="scroll-mt-20 lg:bg-[#eef4ef] lg:py-14">
      <div className={`${container} py-6 lg:py-0`}>
        <p className={eyebrow}>Bắt đầu thật đơn giản</p>
        <h2 className={`${sectionTitle} lg:mt-3 lg:text-[27px]`}><span className="lg:hidden">Bắt đầu theo 4 bước</span><span className="hidden lg:inline">Từ ghi nhận đến theo dõi — theo quy trình rõ ràng</span></h2>
        <div className="mt-5 grid gap-3 lg:mt-8 lg:grid-cols-4 lg:gap-[17px]">
          {STEPS.map(([title, text], index) => (
            <article key={title} className={`${card} grid min-h-[72px] grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 p-4 lg:min-h-[190px] lg:content-start lg:items-start lg:gap-y-3 lg:p-6`}>
              <span className={`${circle} bg-brand text-white lg:size-[38px]`}>{String(index + 1).padStart(2, '0')}</span>
              <h3 className="m-0 text-sm font-bold text-ink lg:text-lg">{title}</h3>
              <p className="m-0 col-start-2 text-[11px] leading-4 text-subtle lg:col-span-2 lg:col-start-1 lg:text-sm lg:leading-6">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Faq({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" className={`${container} scroll-mt-20 py-6 lg:py-10`}>
      <p className={eyebrow}>Câu hỏi thường gặp</p>
      <h2 className={`${sectionTitle} lg:mt-3 lg:text-[28px]`}><span className="lg:hidden">Câu hỏi thường gặp</span><span className="hidden lg:inline">Bạn muốn biết thêm điều gì?</span></h2>
      <div className="mt-5 flex flex-col gap-2.5 lg:mt-7 lg:gap-3">
        {items.map(([question, answer], index) => (
          <div key={question} className="rounded-xl border border-field bg-white">
            <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)} className="flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-4 py-3 text-left text-xs font-bold text-ink lg:min-h-[50px] lg:px-5 lg:text-sm">
              {question}<Icon name={open === index ? 'x' : 'plus'} size={16} className="hidden shrink-0 text-brand lg:block" />
            </button>
            {open === index && <p className="m-0 px-4 pb-4 text-sm leading-6 text-subtle lg:px-5">{answer}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
