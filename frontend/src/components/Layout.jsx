import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '../assets/logo.png'
import farm from '../assets/farm.png'
import wave from '../assets/wave.png'

// Menu theo Figma. Quản lý (manager) không có "Thông tin trại / Gói dịch vụ / Hỗ trợ".
const item = (name, to) => ({ name, to })
const NAV_COMMON = [
  { label: 'VẬN HÀNH', items: [item('Tổng quan', '/tong-quan'), item('Nhắc việc', '/nhac-viec'), item('Thông báo trại', '/thong-bao')] },
  { label: 'ĐÀN BÒ', items: [item('Đàn bò', '/dan-bo'), item('Nhập đàn', '/nhap'), item('Chuồng trại', '/chuong-trai'), item('Xuất đàn', '/xuat')] },
  {
    label: 'CHĂM SÓC',
    items: [item('Cân nặng & thể trạng', '/can-nang'), item('Tiêm phòng', '/tiem-phong'), item('Sức khỏe & Điều trị', '/suc-khoe'), item('Sinh sản', '/sinh-san'), item('Thức ăn', '/thuc-an')],
  },
  { label: 'QUẢN TRỊ', items: [item('Báo cáo', '/bao-cao'), item('Danh mục & Tham số', '/danh-muc')] },
]
const FARM_MANAGER = { label: 'TRANG TRẠI', items: [item('Thành viên & quyền', '/thanh-vien')] }
const FARM_OWNER = {
  label: 'TRANG TRẠI',
  items: [item('Thông tin trại', '/thong-tin-trai'), item('Thành viên & quyền', '/thanh-vien'), item('Gói dịch vụ', '/goi-dich-vu'), item('Hỗ trợ', '/ho-tro')],
}
export const NAV_GROUPS = [...NAV_COMMON, FARM_OWNER]
export const pageName = (path) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === path)?.name

const USERS = {
  manager: { initials: 'TL', name: 'Trần Quốc Long', role: 'Quản lý', groups: [...NAV_COMMON, FARM_MANAGER], gap: 'mt-[2px]' },
  owner: { initials: 'NH', name: 'Nguyễn Văn Hùng', role: 'Chủ trại', groups: [...NAV_COMMON, FARM_OWNER], gap: 'mt-[3px]' },
}

// Modal đổi tiêu đề thanh trên (Figma: khi mở modal, tiêu đề topbar = tên modal).
const TitleCtx = createContext(() => {})
export const useTopbarTitle = (title) => {
  const set = useContext(TitleCtx)
  useEffect(() => {
    if (!title) return undefined
    set(title)
    return () => set(null)
  }, [title, set])
}

const NAV = 'mx-3.5 mb-px flex h-7 items-center gap-2.5 rounded-xl px-2.5 text-[13px] before:size-5 before:shrink-0 before:rounded-[7px]'

/**
 * Khung trang. `user`: 'manager' | 'owner'. `dim` không cần: Modal tự phủ lớp mờ.
 * Nội dung (children) nằm trong <main> padding 32px, gap 20px, rộng 100% (không max-width).
 */
export default function Layout({ title, user = 'owner', children }) {
  const u = USERS[user]
  const [open, setOpen] = useState(false)
  const [override, setOverride] = useState(null)
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
          <nav className="absolute inset-x-0 top-[82px] z-10">
            {u.groups.map((g, i) => (
              <div key={g.label} className={i ? u.gap : ''}>
                <div className="mb-1 h-3.5 px-6 text-[10px] font-semibold leading-[14px] text-side-label">{g.label}</div>
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `${NAV} ${isActive ? 'bg-side-active font-semibold text-white before:bg-[#cde9d8]' : 'text-side-text before:bg-side-item'}`
                    }
                  >
                    {it.name}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <img src={farm} alt="" className="pointer-events-none absolute bottom-0 left-0 h-[234px] w-[264px] object-cover opacity-[0.72]" />
        </aside>

        <div className="min-h-screen min-w-0 bg-page bg-cover bg-center bg-no-repeat lg:ml-[264px]" style={{ backgroundImage: `url(${wave})` }}>
          <header className="flex h-[72px] items-center bg-white px-4 lg:pl-8 lg:pr-[30px]">
            <button type="button" aria-label="Mở menu" onClick={() => setOpen(true)} className="mr-3 grid size-10 shrink-0 place-items-center rounded-lg border border-field text-xl text-brand-dark lg:hidden">☰</button>
            <div className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{override || title}</div>
            <div className="mr-[22px] hidden h-[46px] w-[200px] shrink-0 items-center rounded-xl border border-field bg-white px-[13px] text-[13px] font-bold text-brand-dark lg:flex">
              Trại bò Yên Bài – Ba Vì &nbsp;▾
            </div>
            <div className="mr-5 hidden h-[46px] w-[278px] shrink-0 items-center rounded-xl border border-field bg-page px-[13px] text-[13px] text-subtle xl:flex">
              ⌕&nbsp; Tìm hồ sơ bò hoặc mã QR...
            </div>
            <div className="mr-4 grid size-9 shrink-0 place-items-center rounded-full bg-[#eef4ef] text-lg font-bold text-brand">•</div>
            <div className="mr-2 grid size-10 shrink-0 place-items-center rounded-full bg-[#d7f0e1] text-xs font-bold text-brand-dark">{u.initials}</div>
            <div className="hidden w-[150px] shrink-0 sm:block">
              <div className="whitespace-nowrap text-xs font-bold leading-[18px] text-ink">{u.name}</div>
              <div className="text-[10px] leading-4 text-subtle">{u.role}</div>
            </div>
          </header>
          <main className="flex w-full min-w-0 flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TitleCtx.Provider>
  )
}
