import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { ScreenRole } from '../app/screenManifest'
import { navigationForRole } from '../app/navigation'

export default function PlatformLayout({ title, role, children }: { title: string; role: Extract<ScreenRole, 'cs' | 'pm' | 'sa'>; children: ReactNode }) {
  const groups = navigationForRole(role)
  const notificationRoute = role === 'pm' ? '/ui/scr-76' : '/ui/scr-75'
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="min-h-screen overflow-x-clip bg-page">
      <a href="#main-content" className="sr-only left-3 top-3 z-50 rounded-md bg-white px-3 py-2 font-semibold text-brand shadow focus:not-sr-only focus:fixed">
        Bỏ qua điều hướng
      </a>
      {menuOpen && <button type="button" aria-label="Đóng menu" className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-[248px] overflow-y-auto bg-brand-dark p-5 text-white transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-7 text-xl font-bold">BeefCare <span className="text-base font-medium text-side-label">Platform</span></div>
        <nav>
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 text-[13px] font-semibold text-side-label">{group.label}</div>
              {group.items.map((entry) => (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `mb-1 flex min-h-11 items-center border-l-2 px-3 text-sm ${isActive ? 'border-white bg-white/10 font-semibold text-white' : 'border-transparent text-side-text'}`}
                >
                  {entry.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-h-screen min-w-0 lg:ml-[248px]">
        <header className="flex min-h-16 items-center border-b border-rule bg-white px-4 sm:px-5 lg:px-8">
          <button type="button" aria-label="Mở menu" onClick={() => setMenuOpen(true)} className="mr-3 grid size-8 shrink-0 place-items-center rounded-md border border-field text-lg text-brand-dark lg:hidden">☰</button>
          <h1 className="m-0 min-w-0 flex-1 truncate text-lg font-bold text-ink lg:text-xl">{title}</h1>
          <NavLink to={notificationRoute} aria-label="Mở thông báo nền tảng" className="mr-3 grid size-9 place-items-center rounded-full bg-[#eef4ef] text-lg font-bold text-brand hover:bg-ok-bg">•</NavLink>
          <span className="text-sm font-semibold uppercase text-subtle">{role}</span>
        </header>
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-col gap-5 p-4 sm:p-5 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
