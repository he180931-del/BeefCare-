import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigationForRole } from '../app/navigation'
import { FarmQuickSwitcher } from '../features/account/components/FarmQuickSwitcher'

const technicianIcon: Record<string, string> = {
  'Hôm nay': '⌂',
  'Đàn bò': '♉',
  'Quét QR': '▣',
  'Sinh sản': '♡',
  'Khẩu phần hôm nay': '≋',
  'Nhắc việc': '✓',
  'Thông báo': '◉',
}

export default function TechnicianLayout({ title, children }: { title: string; children: ReactNode }) {
  const items = navigationForRole('technician')[0].items
  const location = useLocation()
  const navigate = useNavigate()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  return (
    <div className="technician-shell min-h-screen min-w-0 bg-page pb-[calc(52px+env(safe-area-inset-bottom))]">
      <a href="#main-content" className="sr-only left-3 top-3 z-50 rounded-md bg-white px-3 py-2 font-semibold text-brand shadow focus:not-sr-only focus:fixed">
        Bỏ qua điều hướng
      </a>
      <header className="sticky top-0 z-30 flex min-h-[60px] items-center border-b border-rule bg-white px-4 sm:px-6 lg:px-8">
        <strong className="min-w-0 flex-1 truncate text-xl font-bold leading-tight text-ink">{title}</strong>
        <div className="mr-2"><FarmQuickSwitcher compact preferredRole="Kỹ thuật viên" /></div>
        <div className="relative">
          <button type="button" aria-label="Mở menu tài khoản" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)} className="grid size-11 shrink-0 place-items-center rounded-md bg-ok-bg text-sm font-bold text-brand hover:bg-[#d7f0e1]">KT</button>
          {accountMenuOpen && <div role="menu" aria-label="Tài khoản kỹ thuật viên" className="absolute right-0 top-[calc(100%+8px)] z-40 w-52 border border-edge bg-white p-1 shadow-lg"><NavLink role="menuitem" to="/ui/scr-08" onClick={() => setAccountMenuOpen(false)} className="flex min-h-10 items-center px-3 text-sm font-semibold text-ink hover:bg-page">Hồ sơ của tôi</NavLink><NavLink role="menuitem" to="/ui/scr-10" state={{ returnTo: location.pathname + location.search }} onClick={() => setAccountMenuOpen(false)} className="flex min-h-10 items-center px-3 text-sm font-semibold text-ink hover:bg-page">Đổi trang trại</NavLink><button type="button" role="menuitem" onClick={() => navigate('/ui/scr-02')} className="flex min-h-10 w-full items-center px-3 text-left text-sm font-semibold text-err-fg hover:bg-err-bg">Đăng xuất</button></div>}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex w-full min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      <nav
        aria-label="Điều hướng kỹ thuật viên"
        className="fixed inset-x-0 bottom-0 z-30 grid min-h-[52px] border-t border-rule bg-white pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            className={({ isActive }) => `flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 border-r border-rule px-1 py-1 text-center text-xs leading-tight last:border-r-0 ${isActive ? 'bg-brand font-bold text-white' : 'bg-white text-subtle hover:bg-page'}`}
          >
            <span aria-hidden="true" className="text-lg leading-none">{technicianIcon[entry.name] ?? '•'}</span>
            <span className="w-full truncate px-0.5">{entry.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
