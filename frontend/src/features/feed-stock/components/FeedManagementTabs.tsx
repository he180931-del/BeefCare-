import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { label: 'Tồn kho', to: '/thuc-an', enabled: true },
  { label: 'Phiếu nhập kho', to: '/thuc-an/phieu-nhap', enabled: true },
  { label: 'Kiểm kê', to: '/thuc-an/kiem-ke', enabled: true },
  { label: 'Khẩu phần', to: '/thuc-an/khau-phan', enabled: true },
  { label: 'Nhật ký cho ăn', to: '/thuc-an/nhat-ky', enabled: true },
  { label: 'Danh mục', to: '/thuc-an/danh-muc', enabled: true },
  { label: 'Báo cáo', to: '/thuc-an/bao-cao', enabled: true },
] as const

export default function FeedManagementTabs() {
  const { pathname } = useLocation()
  return (
    <nav role="tablist" aria-label="Các màn hình quản lý thức ăn" className="flex max-w-full gap-1 overflow-x-auto border-b border-edge">
      {TABS.map((tab) => {
        const active = tab.enabled && (tab.to === '/thuc-an' ? pathname === '/thuc-an' : pathname.startsWith(tab.to))
        const className = `whitespace-nowrap border-b-2 px-3 py-2.5 text-xs ${active ? 'border-brand font-semibold text-brand-dark' : 'border-transparent text-muted'}`
        return tab.enabled ? (
          <Link key={tab.label} to={tab.to} role="tab" aria-selected={active} className={className}>
            {tab.label}
          </Link>
        ) : (
          <button key={tab.label} type="button" role="tab" aria-selected={false} disabled title={`Màn hình ${tab.label.toLowerCase()} chưa được triển khai`} className={`${className} cursor-not-allowed`}>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
