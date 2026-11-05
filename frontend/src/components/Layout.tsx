import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigationForRole } from '../app/navigation'
import { loadOrders, loadSelectedFarmId } from '../features/subscription/subscriptionStore'
import logo from '../assets/logo.png'
import farm from '../assets/farm.png'
import wave from '../assets/wave.png'

export const NAV_GROUPS = navigationForRole('owner')
export const pageName = (path: string) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === path)?.name

const USERS = {
  manager: { initials: 'TL', name: 'Trần Quốc Long', role: 'Quản lý', groups: navigationForRole('manager'), gap: 'mt-[2px]' },
  owner: { initials: 'NH', name: 'Nguyễn Văn Hùng', role: 'Chủ trại', groups: navigationForRole('owner'), gap: 'mt-[3px]' },
}
const notificationRoute = (user: keyof typeof USERS) => user === 'owner' ? '/ui/scr-74' : '/ui/scr-73'

function selectedFarmName() {
  if (typeof window !== 'undefined') {
    try {
      const demo = JSON.parse(window.localStorage.getItem('beefcare-ui-demo') || '{}') as { account?: { 'farm-selection'?: { farm?: string } } }
      const selected = demo.account?.['farm-selection']?.farm
      if (selected) return selected
    } catch { /* fall through to the subscription fixture */ }
  }
  const selectedId = loadSelectedFarmId()
  return loadOrders().find((farmRow) => farmRow.id === selectedId)?.name ?? 'Chọn trang trại'
}

// Modal đổi tiêu đề thanh trên (Figma: khi mở modal, tiêu đề topbar = tên modal).
const TitleCtx = createContext<(title: string | null) => void>(() => undefined)
export const useTopbarTitle = (title?: string) => {
  const set = useContext(TitleCtx)
  useEffect(() => {
    if (!title) return undefined
    set(title)
    return () => set(null)
  }, [title, set])
}

const NAV = 'mx-3 mb-0.5 flex min-h-10 items-center gap-2 rounded-md border-l-2 px-2.5 text-sm before:size-3.5 before:shrink-0 before:rounded'

/**
 * Khung trang. `user`: 'manager' | 'owner'. `dim` không cần: Modal tự phủ lớp mờ.
 * Nội dung (children) nằm trong <main> padding 32px, gap 20px, rộng 100% (không max-width).
 */
export default function Layout({ title, user = 'owner', children }: { title: string; user?: keyof typeof USERS; children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const u = USERS[user]
  const [open, setOpen] = useState(false)
  const [override, setOverride] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const farmName = selectedFarmName()
  return (
    <TitleCtx.Provider value={setOverride}>
      <div className="min-h-screen overflow-x-clip">
        <a href="#main-content" className="sr-only left-3 top-3 z-50 rounded-md bg-white px-3 py-2 font-semibold text-brand shadow focus:not-sr-only focus:fixed">
          Bỏ qua điều hướng
        </a>
        {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-[248px] overflow-x-hidden overflow-y-auto bg-side transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="absolute left-5 top-4 flex items-center gap-2.5 text-lg font-bold text-white">
            <img src={logo} alt="" width="36" height="36" className="size-9 rounded-lg object-cover" />
            BeefCare
          </div>
          <nav className="absolute inset-x-0 top-[72px] z-10 pb-56">
            {u.groups.map((g, i) => (
              <div key={g.label} className={i ? u.gap : ''}>
                <div className="mb-0.5 px-5 text-xs font-semibold leading-5 text-side-label">{g.label}</div>
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `${NAV} ${isActive ? 'border-white bg-side-active font-semibold text-white before:bg-[#cde9d8]' : 'border-transparent text-side-text before:bg-side-item'}`
                    }
                  >
                    {it.name}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <img src={farm} alt="" width="248" height="220" className="pointer-events-none absolute bottom-0 left-0 h-[220px] w-[248px] object-cover opacity-[0.72]" />
        </aside>

        <div className="min-h-screen min-w-0 bg-page bg-cover bg-center bg-no-repeat lg:ml-[248px]" style={{ backgroundImage: `url(${wave})` }}>
          <header className="relative flex h-16 min-w-0 items-center bg-white px-4 lg:pl-6 lg:pr-6">
            <button type="button" aria-label="Mở menu" onClick={() => setOpen(true)} className="mr-3 grid size-8 shrink-0 place-items-center rounded-md border border-field text-lg text-brand-dark lg:hidden">☰</button>
            <div className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{override || title}</div>
            <NavLink
              to="/ui/scr-10"
              state={{ returnTo: location.pathname + location.search }}
              aria-label={`Đổi trang trại; hiện tại ${farmName}`}
              className="mr-4 hidden min-h-10 max-w-[220px] shrink-0 items-center gap-2 rounded-md border border-field bg-white px-3 text-sm font-bold text-brand-dark hover:border-brand hover:bg-ok-bg lg:flex"
            >
              <span className="truncate">{farmName}</span>
              <span aria-hidden="true" className="ml-auto text-xs text-subtle">Đổi</span>
            </NavLink>
            <NavLink to="/ui/scr-10" state={{ returnTo: location.pathname + location.search }} aria-label={`Đổi trang trại; hiện tại ${farmName}`} className="mr-2 grid size-9 shrink-0 place-items-center rounded-md border border-field bg-white text-brand hover:border-brand hover:bg-ok-bg lg:hidden">⌂</NavLink>
            <form
              role="search"
              className="mr-4 hidden min-h-10 w-[260px] shrink-0 items-center rounded-md border border-field bg-page focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 xl:flex"
              onSubmit={(event) => {
                event.preventDefault()
                const value = search.trim()
                if (value) navigate(`/ui/scr-26?q=${encodeURIComponent(value)}`)
              }}
            >
              <input
                aria-label="Tìm hồ sơ bò hoặc mã QR"
                autoComplete="off"
                spellCheck={false}
                name="global-cattle-search"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle"
                placeholder="Tìm hồ sơ bò hoặc mã QR…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit" aria-label="Tìm" className="grid size-9 shrink-0 place-items-center text-base font-bold text-brand hover:bg-ok-bg">⌕</button>
            </form>
            <NavLink to={notificationRoute(user)} aria-label="Mở thông báo" className="mr-3 grid size-8 shrink-0 place-items-center rounded-full bg-[#eef4ef] text-base font-bold text-brand hover:bg-ok-bg">•</NavLink>
            <div className="relative">
              <button type="button" aria-label={`Mở menu tài khoản của ${u.name}`} aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)} className="flex min-h-10 min-w-10 items-center gap-2 rounded-md px-0 text-left hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:px-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d7f0e1] text-xs font-bold text-brand-dark">{u.initials}</span>
                <span className="hidden w-[140px] shrink-0 sm:block"><span className="block whitespace-nowrap text-sm font-bold leading-5 text-ink">{u.name}</span><span className="block text-xs leading-5 text-subtle">{u.role}</span></span>
              </button>
              {accountMenuOpen && <div role="menu" aria-label="Tài khoản" className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 border border-edge bg-white p-1 shadow-lg"><NavLink role="menuitem" to="/ui/scr-08" onClick={() => setAccountMenuOpen(false)} className="flex min-h-10 items-center px-3 text-sm font-semibold text-ink hover:bg-page">Hồ sơ của tôi</NavLink><NavLink role="menuitem" to="/ui/scr-10" state={{ returnTo: location.pathname + location.search }} onClick={() => setAccountMenuOpen(false)} className="flex min-h-10 items-center px-3 text-sm font-semibold text-ink hover:bg-page">Đổi trang trại</NavLink><button type="button" role="menuitem" onClick={() => navigate('/ui/scr-02')} className="flex min-h-10 w-full items-center px-3 text-left text-sm font-semibold text-err-fg hover:bg-err-bg">Đăng xuất</button></div>}
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="flex w-full min-w-0 flex-col gap-4 px-4 pb-8 pt-5 sm:px-6 lg:px-6 xl:px-8">{children}</main>
        </div>
      </div>
    </TitleCtx.Provider>
  )
}
