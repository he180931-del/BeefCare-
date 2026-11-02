import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import farm from '../assets/farm.png'
import wave from '../assets/wave.png'
import { Icon, type IconName } from './Icon'
import { useSession, type AppRole } from '../features/authorization/sessionContext'

// Menu theo Figma Redesign. Quản lý (manager) không có "Thông tin trại / Gói dịch vụ / Hỗ trợ".
const item = (name: string, to: string, icon: IconName) => ({ name, to, icon })
const NAV_COMMON = [
  { label: 'VẬN HÀNH', items: [item('Tổng quan', '/tong-quan', 'layout-dashboard'), item('Nhắc việc', '/nhac-viec', 'alarm'), item('Thông báo trại', '/thong-bao', 'speakerphone')] },
  { label: 'ĐÀN BÒ', items: [item('Đàn bò', '/cattle', 'zebu-silhouette'), item('Nhập đàn', '/herd-entry', 'file-import'), item('Chuồng trại', '/pens', 'fence'), item('Xuất đàn', '/herd-exit', 'file-export')] },
  {
    label: 'CHĂM SÓC',
    items: [item('Cân nặng & thể trạng', '/can-nang', 'scale'), item('Tiêm phòng', '/tiem-phong', 'vaccine'), item('Sức khỏe & Điều trị', '/suc-khoe', 'stethoscope'), item('Sinh sản', '/sinh-san', 'dna'), item('Thức ăn', '/thuc-an', 'grain')],
  },
  { label: 'QUẢN TRỊ', items: [item('Báo cáo', '/bao-cao', 'report-analytics'), item('Danh mục & Tham số', '/danh-muc', 'adjustments')] },
]
const FARM_MANAGER = { label: 'TRANG TRẠI', items: [item('Thành viên & quyền', '/thanh-vien', 'users')] }
const FARM_OWNER = {
  label: 'TRANG TRẠI',
  items: [item('Thông tin trại', '/thong-tin-trai', 'building-warehouse'), item('Thành viên & quyền', '/thanh-vien', 'users'), item('Gói dịch vụ', '/goi-dich-vu', 'credit-card'), item('Hỗ trợ', '/ho-tro', 'lifebuoy')],
}
export const NAV_GROUPS = [...NAV_COMMON, FARM_OWNER]
export const pageName = (path: string) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === path)?.name

type Shell = {
  initials: string; name: string; role: string; groups: typeof NAV_COMMON; gap: string
  platformRole?: string; search: string; searchTo: string; notifications: string; profile: string
}

const FARM_SEARCH = { search: 'Tìm hồ sơ bò hoặc mã QR...', searchTo: '/cattle', profile: '/ho-so' }
const USERS = {
  manager: { initials: 'TL', name: 'Trần Quốc Long', role: 'Quản lý', groups: [...NAV_COMMON, FARM_MANAGER], gap: 'mt-[2px]', notifications: '/thong-bao', ...FARM_SEARCH },
  owner: { initials: 'NH', name: 'Nguyễn Văn Hùng', role: 'Chủ trại', groups: [...NAV_COMMON, FARM_OWNER], gap: 'mt-[3px]', notifications: '/thong-bao-cua-toi', ...FARM_SEARCH },
} satisfies Record<string, Shell>

const PLATFORM_PROFILE = '/nen-tang/ho-so'
const PLATFORM: Partial<Record<AppRole, Shell>> = {
  CS: {
    initials: 'PH', name: 'Phạm Thu Hà', role: 'Customer Support', gap: 'mt-[3px]', platformRole: 'Customer Support · CS',
    search: 'Tìm ticket, trang trại, người dùng…', searchTo: '/nen-tang/ho-tro', notifications: '/nen-tang/ho-tro/thong-bao', profile: PLATFORM_PROFILE,
    groups: [
      { label: 'HỖ TRỢ', items: [item('Hàng đợi hỗ trợ', '/nen-tang/ho-tro', 'inbox'), item('Ticket được giao', '/nen-tang/ho-tro/duoc-giao', 'ticket'), item('Thông báo hỗ trợ', '/nen-tang/ho-tro/thong-bao', 'bell')] },
      { label: 'TÀI KHOẢN', items: [item('Hồ sơ của tôi', PLATFORM_PROFILE, 'user-circle')] },
    ],
  },
  PM: {
    initials: 'ĐQ', name: 'Đỗ Minh Quân', role: 'Platform Manager', gap: 'mt-[3px]', platformRole: 'Platform Manager · PM',
    search: 'Tìm trại, chủ trại, mã đăng ký…', searchTo: '/nen-tang/dich-vu', notifications: '/nen-tang/thong-bao-doi-soat', profile: PLATFORM_PROFILE,
    groups: [
      { label: 'DỊCH VỤ', items: [item('Dịch vụ trang trại', '/nen-tang/dich-vu', 'building-community'), item('Gói đăng ký', '/nen-tang/goi-dang-ky', 'calendar-dollar'), item('Thanh toán & đối soát', '/nen-tang/thanh-toan', 'arrows-exchange'), item('Bảng giá gói', '/nen-tang/bang-gia', 'currency-dong'), item('Yêu cầu nội bộ', '/nen-tang/yeu-cau', 'message-forward')] },
      { label: 'TÀI CHÍNH NỀN TẢNG', items: [item('Biên nhận gói', '/nen-tang/bien-nhan', 'receipt'), item('Thu chi khác', '/nen-tang/thu-chi', 'cash'), item('Báo cáo dòng tiền', '/nen-tang/bao-cao-dong-tien', 'chart-line')] },
      { label: 'KHÁC', items: [item('Thông báo đối soát', '/nen-tang/thong-bao-doi-soat', 'bell'), item('Thông báo hỗ trợ', '/nen-tang/thong-bao-ho-tro', 'bell')] },
    ],
  },
  SA: {
    initials: 'VN', name: 'Vũ Hoàng Nam', role: 'System Admin', gap: 'mt-[3px]', platformRole: 'System Admin · SA',
    search: 'Tìm tên, Gmail…', searchTo: '/nen-tang/tai-khoan', notifications: '/nen-tang/thong-bao', profile: PLATFORM_PROFILE,
    groups: [
      { label: 'QUẢN TRỊ HỆ THỐNG', items: [item('Tài khoản người dùng', '/nen-tang/tai-khoan', 'user-cog'), item('Quyền nhân sự nền tảng', '/nen-tang/quyen', 'shield-lock'), item('Lịch sử audit', '/nen-tang/audit', 'history'), item('Yêu cầu nội bộ', '/nen-tang/yeu-cau', 'message-forward')] },
      { label: 'KHÁC', items: [item('Thông báo', '/nen-tang/thong-bao', 'bell')] },
    ],
  },
}

const initialsOf = (fullName: string) => {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const first = words[0].charAt(0)
  return (words.length > 1 ? first + words[words.length - 1].charAt(0) : first).toLocaleUpperCase('vi')
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

const NAV = 'mx-3.5 mb-px flex h-7 items-center gap-2.5 rounded-xl px-2.5 text-[13px]'

/**
 * Khung trang. Vai trò lấy từ phiên đăng nhập; `user` ('manager' | 'owner') chỉ dùng khi render ngoài phiên (test từng trang).
 * Nội dung (children) nằm trong <main> padding 32px, gap 20px, rộng 100% (không max-width).
 */
export default function Layout({ title, user = 'owner', children }: { title: string; user?: keyof typeof USERS; children: ReactNode }) {
  const session = useSession()
  const navigate = useNavigate()
  const base: Shell = (session && PLATFORM[session.role]) ?? (session ? USERS[session.role === 'OWNER' ? 'owner' : 'manager'] : USERS[user])
  const u: Shell = session ? { ...base, name: session.fullName, initials: initialsOf(session.fullName), role: session.role === 'OWNER' ? 'Chủ trại' : session.role === 'MANAGER' ? 'Quản lý' : base.role } : base
  const platform = Boolean(u.platformRole)
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [override, setOverride] = useState<string | null>(null)
  const search = (event: FormEvent) => {
    event.preventDefault()
    const text = query.trim()
    navigate(text ? `${u.searchTo}?q=${encodeURIComponent(text)}` : u.searchTo)
  }
  return (
    <TitleCtx.Provider value={setOverride}>
      <div className="min-h-screen overflow-x-clip">
        {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-[264px] overflow-hidden bg-side transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="absolute left-[22px] top-5 flex items-center gap-2.5 text-[19px] font-bold text-white">
            <img src={logo} alt="" className="size-[38px] rounded-[10px] object-cover" />
            BeefCare
          </div>
          {platform && <div className="absolute left-[70px] top-[52px] text-[11px] leading-[14px] text-side-text">Bảng điều khiển nền tảng</div>}
          <nav className="absolute inset-x-0 top-[82px] z-10">
            {platform && (
              <div className="mb-[18px]">
                <div className="mb-1 h-3.5 px-6 text-[10px] font-semibold leading-[14px] text-side-label">VAI TRÒ NỀN TẢNG</div>
                <div className="mx-3.5 flex h-[29px] items-center rounded-md bg-white/10 px-2.5 text-xs font-semibold text-white">{u.platformRole}</div>
              </div>
            )}
            {u.groups.map((g, i) => (
              <div key={g.label} className={i ? u.gap : ''}>
                <div className="mb-1 h-3.5 px-6 text-[10px] font-semibold leading-[14px] text-side-label">{g.label}</div>
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    // Mục cha cùng tiền tố với mục con (Hàng đợi / Ticket được giao) không được sáng cùng lúc.
                    end={g.items.some((other) => other !== it && other.to.startsWith(`${it.to}/`))}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => `${NAV} ${isActive ? 'bg-side-active font-semibold text-white' : 'text-side-text'}`}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`grid h-5 w-3.5 shrink-0 place-items-center rounded-[7px] ${isActive ? 'bg-[#cde9d8] text-side-active' : 'bg-side-item text-[#cde9d8]'}`}>
                          <Icon name={it.icon} size={14} />
                        </span>
                        {it.name}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          {platform && <p className="absolute inset-x-6 bottom-[256px] z-10 m-0 text-[11px] leading-[14px] text-side-text">Không có quyền vận hành trại hay quản lý thành viên trại.</p>}
          <img src={farm} alt="" className="pointer-events-none absolute bottom-0 left-0 h-[234px] w-[264px] object-cover opacity-[0.72]" />
        </aside>

        <div className="min-h-screen min-w-0 bg-page bg-cover bg-center bg-no-repeat lg:ml-[264px]" style={{ backgroundImage: `url(${wave})` }}>
          <header className="flex h-[72px] items-center bg-white px-4 lg:pl-8 lg:pr-[30px]">
            <button type="button" aria-label="Mở menu" onClick={() => setOpen(true)} className="mr-3 grid size-10 shrink-0 place-items-center rounded-lg border border-field text-xl text-brand-dark lg:hidden">☰</button>
            <div className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{override || title}</div>
            {!platform && (
              <Link to="/chon-trai" className="mr-[22px] hidden h-[46px] w-[200px] shrink-0 items-center gap-1 rounded-xl border border-field bg-white px-[13px] text-[13px] font-bold text-brand-dark no-underline lg:flex">
                <span className="min-w-0 truncate">{session?.farmName ?? 'Trại bò Yên Bài – Ba Vì'}</span>
                <Icon name="chevron-down" size={14} />
              </Link>
            )}
            <form role="search" onSubmit={search} className={`mr-5 hidden h-[46px] shrink-0 items-center gap-2 rounded-xl border border-field bg-page px-[13px] text-[13px] text-subtle xl:flex ${platform ? 'w-[500px]' : 'w-[278px]'}`}>
              <Icon name="search" />
              <input aria-label={u.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={u.search} className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle" />
            </form>
            <Link to={u.notifications} aria-label="Thông báo" className="mr-4 grid size-9 shrink-0 place-items-center rounded-full bg-[#eef4ef] text-brand">
              <Icon name="bell" size={18} />
            </Link>
            <div className="relative flex shrink-0 items-center">
              <button type="button" aria-haspopup="menu" aria-expanded={menu} aria-label="Tài khoản" onClick={() => setMenu((value) => !value)} className="flex cursor-pointer items-center text-left">
                <span className="mr-2 grid size-10 shrink-0 place-items-center rounded-full bg-[#d7f0e1] text-xs font-bold text-brand-dark">{u.initials}</span>
                <span className="hidden w-[150px] shrink-0 sm:block">
                  <span className="block whitespace-nowrap text-xs font-bold leading-[18px] text-ink">{u.name}</span>
                  <span className="block text-[10px] leading-4 text-subtle">{u.role}</span>
                </span>
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 top-[48px] z-40 w-[200px] rounded-md border border-edge bg-white py-1 text-xs shadow-md">
                  <Link role="menuitem" to={u.profile} onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 text-ink no-underline hover:bg-page"><Icon name="user-circle" />Hồ sơ của tôi</Link>
                  {session && <button role="menuitem" type="button" onClick={() => { setMenu(false); void session.logout() }} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-err-fg hover:bg-page"><Icon name="logout" />Đăng xuất</button>}
                </div>
              )}
            </div>
          </header>
          <main className="flex w-full min-w-0 flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TitleCtx.Provider>
  )
}
