import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { label: 'Tồn kho', to: '/thuc-an' },
  { label: 'Phiếu nhập kho', to: '/thuc-an/phieu-nhap' },
  { label: 'Kiểm kê', to: '/thuc-an/kiem-ke' },
  { label: 'Khẩu phần', to: '/thuc-an/khau-phan' },
  { label: 'Nhật ký cho ăn', to: '/thuc-an/nhat-ky' },
  { label: 'Danh mục', to: '/thuc-an/danh-muc' },
  { label: 'Báo cáo', to: '/thuc-an/bao-cao' },
] as const

/** Pill tabs of the feed module (same look as Segmented, but real links so each tab has a URL). */
export default function FeedManagementTabs() {
  const { pathname } = useLocation()
  return (
    <nav role="tablist" aria-label="Các màn hình quản lý thức ăn" className="inline-flex max-w-full gap-[3px] self-start overflow-x-auto rounded-[5px] bg-chip p-[3px]">
      {TABS.map((tab) => {
        const active = tab.to === '/thuc-an' ? pathname === '/thuc-an' : pathname.startsWith(tab.to)
        return (
          <Link
            key={tab.label}
            to={tab.to}
            role="tab"
            aria-selected={active}
            className={`whitespace-nowrap rounded border px-3.5 py-[7px] text-xs no-underline ${active ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted'}`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
