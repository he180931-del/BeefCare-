import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { Icon, type IconName } from './Icon'

// Figma vẽ tạm ký tự ở thanh dưới; dùng icon của bộ tab 00 theo đúng nhãn.
const TABS: ReadonlyArray<{ label: string; to: string; icon: IconName; end?: boolean }> = [
  { label: 'Trang chủ', to: '/kt', icon: 'home', end: true },
  { label: 'Đàn bò', to: '/kt/dan-bo', icon: 'zebu-silhouette' },
  { label: 'Quét QR', to: '/kt/quet-qr', icon: 'qrcode' },
  { label: 'Sinh sản', to: '/kt/sinh-san', icon: 'dna' },
  { label: 'Thức ăn', to: '/kt/thuc-an', icon: 'grain' },
  { label: 'Tài khoản', to: '/kt/tai-khoan', icon: 'user-circle' },
]

/**
 * Khung điện thoại của Kỹ thuật viên (frame 390 x 844, bỏ thanh trạng thái của máy).
 * `hero`: thanh xanh có logo của trang chủ; còn lại là thanh trắng, `back` là đường dẫn quay lại (true = trang trước).
 */
export default function TechnicianLayout({ title, sub, hero = false, back, actions, children }: {
  title: string; sub?: ReactNode; hero?: boolean; back?: string | true; actions?: ReactNode; children: ReactNode
}) {
  const navigate = useNavigate()
  const backIcon = <Icon name="chevron-left" size={22} label="Quay lại" />
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-page">
      {hero ? (
        <header className="flex items-center gap-2.5 bg-side px-4 py-3.5">
          <img src={logo} alt="" className="size-[38px] rounded-[10px] object-cover" />
          <div className="min-w-0">
            <h1 className="m-0 truncate text-xl font-bold leading-[25px] text-white">{title}</h1>
            {sub && <p className="m-0 mt-0.5 truncate text-[11px] leading-[14px] text-[#c7ded1]">{sub}</p>}
          </div>
        </header>
      ) : (
        <header className="flex min-h-[52px] items-center gap-2.5 bg-white px-4 py-3">
          {typeof back === 'string' && <Link to={back} className="grid place-items-center text-brand-dark">{backIcon}</Link>}
          {back === true && <button type="button" onClick={() => navigate(-1)} className="grid cursor-pointer place-items-center text-brand-dark">{backIcon}</button>}
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-sm font-semibold leading-[18px] text-[#212121]">{title}</h1>
            {sub && <p className="m-0 mt-0.5 truncate text-[11px] leading-[14px] text-muted">{sub}</p>}
          </div>
          {actions}
        </header>
      )}
      <main className="flex min-w-0 flex-1 flex-col gap-3 px-4 pb-[69px] pt-3">{children}</main>
      <nav aria-label="Điều hướng chính" className="fixed bottom-0 left-1/2 z-30 flex h-[53px] w-full max-w-[430px] -translate-x-1/2 items-start justify-between border-t border-field bg-white px-2 pt-[7px]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `flex w-[58px] flex-col items-center gap-[3px] text-[9px] leading-[11px] no-underline ${isActive ? 'font-semibold text-brand' : 'text-muted'}`}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
