import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../../../assets/logo.png'
import { NAV_LINKS } from '../../data/landingContent'
import { AUTH_PATH } from '../../domain/authErrors'

export const container = 'mx-auto w-full max-w-[1216px] px-5 xl:px-0'

export function LandingHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-20 border-b border-[#e6ece7] bg-white">
      <div className={`${container} flex h-[66px] items-center justify-between gap-4 lg:h-[78px]`}>
        <a href="#top" aria-label="BeefCare, đầu trang" className="flex items-center gap-2.5 text-xl font-bold text-brand-dark no-underline">
          <img src={logo} alt="" className="size-9 rounded-[9px] object-cover lg:size-10 lg:rounded-[10px]" />BeefCare
        </a>
        <nav aria-label="Điều hướng trang" className="hidden items-center gap-9 text-[13px] font-bold text-ink lg:flex">
          {NAV_LINKS.map(([label, href]) => <a key={href} href={href} className="text-ink no-underline hover:text-brand">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to={AUTH_PATH.signIn} className="inline-flex h-12 items-center rounded-[14px] border border-field bg-white px-6 text-[15px] font-bold text-brand-dark no-underline hover:border-brand">Đăng nhập</Link>
          <Link to={AUTH_PATH.register} className="inline-flex h-12 items-center rounded-[14px] bg-brand px-6 text-[15px] font-bold text-white no-underline hover:bg-brand-dark">Đăng ký làm Chủ trại</Link>
        </div>
        <button type="button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-brand-dark lg:hidden">
          <span aria-hidden="true" className="flex flex-col gap-[5px]"><span className="h-0.5 w-5 rounded bg-current" /><span className="h-0.5 w-5 rounded bg-current" /><span className="h-0.5 w-5 rounded bg-current" /></span>
        </button>
      </div>
      {open && (
        <div className="border-t border-[#e6ece7] bg-white lg:hidden">
          <div className={`${container} flex flex-col gap-1 py-3`}>
            {NAV_LINKS.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-bold text-ink no-underline">{label}</a>)}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to={AUTH_PATH.signIn} className="inline-flex h-11 items-center justify-center rounded-[14px] border border-field text-sm font-bold text-brand-dark no-underline">Đăng nhập</Link>
              <Link to={AUTH_PATH.register} className="inline-flex h-11 items-center justify-center rounded-[14px] bg-brand text-sm font-bold text-white no-underline">Đăng ký làm Chủ trại</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
